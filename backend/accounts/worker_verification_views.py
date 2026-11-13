"""Self-service, authenticated executor verification endpoints."""
from django.shortcuts import get_object_or_404
from django.db.models import Case, When, Value, IntegerField
from drf_spectacular.utils import extend_schema, OpenApiResponse
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import ExecutorProfile, WorkerVerificationIdentity
from .worker_verification_pii import masked_national_code, masked_iban
from .worker_verification_serializers import (
    WorkerVerificationDocumentUploadSerializer, WorkerVerificationDocumentReadSerializer,
    WorkerVerificationIdentitySerializer, WorkerVerificationIdentityReadSerializer,
    WorkerVerificationStatusSerializer,
)
from .worker_verification_services import (
    upload_worker_verification_document, delete_worker_verification_document,
    save_worker_verification_identity, submit_worker_verification_application,
    identity_to_payload,
)

def private_response(data, code=status.HTTP_200_OK):
    response = Response(data, status=code)
    response["Cache-Control"] = "private, no-store"
    return response

def build_verification_status_data(profile):
    if profile is None:
        return {
            "verification_status": ExecutorProfile.VerificationStatus.NOT_SUBMITTED,
            "application_submitted_at": None,
            "reviewed_at": None,
            "approved_at": None,
            "rejection_reason": None,
            "documents": [],
            "identity_saved": False,
            "national_code_masked": None,
            "iban_masked": None,
        }
    details = getattr(profile, "verification_identity", None)
    return {
        "verification_status": profile.verification_status,
        "application_submitted_at": profile.application_submitted_at,
        "reviewed_at": profile.reviewed_at,
        "approved_at": profile.approved_at,
        "rejection_reason": profile.rejection_reason if profile.verification_status == ExecutorProfile.VerificationStatus.REJECTED else None,
        "documents": (
            profile.verification_documents
            .annotate(
                document_order=Case(
                    When(
                        document_type="NATIONAL_CARD_FRONT",
                        then=Value(0),
                    ),
                    When(
                        document_type="NATIONAL_CARD_BACK",
                        then=Value(1),
                    ),
                    default=Value(2),
                    output_field=IntegerField(),
                )
            )
            .order_by("document_order", "uploaded_at")
        ),        "identity_saved": details is not None,
                "national_code_masked": masked_national_code(details.national_code_last4) if details else None,
                "iban_masked": masked_iban(details.iban_last4) if details else None,
            }

class WorkerVerificationIdentityView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(tags=["Worker Verification"], summary="Read saved identity form", responses={
        200: WorkerVerificationIdentityReadSerializer,
        401: OpenApiResponse(description="Authentication required."),
        404: OpenApiResponse(description="Identity form has not been saved."),
    })
    def get(self, request):
        details = get_object_or_404(
            WorkerVerificationIdentity.objects.select_related("executor_profile"),
            executor_profile__user=request.user,
        )
        return private_response(WorkerVerificationIdentityReadSerializer(identity_to_payload(details)).data)

    @extend_schema(tags=["Worker Verification"], summary="Validate and save identity form", request=WorkerVerificationIdentitySerializer,
        responses={200: WorkerVerificationIdentityReadSerializer, 400: OpenApiResponse(description="Invalid identity fields."),
                   401: OpenApiResponse(description="Authentication required."), 409: OpenApiResponse(description="Verification is locked.")})
    def put(self, request):
        serializer = WorkerVerificationIdentitySerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        details = save_worker_verification_identity(user=request.user, data=serializer.validated_data)
        return private_response(WorkerVerificationIdentityReadSerializer(identity_to_payload(details)).data)

class WorkerVerificationDocumentUploadView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    @extend_schema(tags=["Worker Verification"], summary="Upload front or back national card image", request=WorkerVerificationDocumentUploadSerializer,
        responses={201: WorkerVerificationDocumentReadSerializer,
                   400: OpenApiResponse(description="Unsupported image or invalid document type."),
                   401: OpenApiResponse(description="Authentication required."),
                   409: OpenApiResponse(description="Verification is locked.")})
    def post(self, request):
        serializer = WorkerVerificationDocumentUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        doc = upload_worker_verification_document(
            user=request.user, document_type=serializer.validated_data["document_type"],
            uploaded_file=serializer.validated_data["file"], mime_type=serializer.validated_data["mime_type"],
        )
        return private_response(WorkerVerificationDocumentReadSerializer(doc).data, status.HTTP_201_CREATED)

class WorkerVerificationDocumentDeleteView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(tags=["Worker Verification"], summary="Delete an uploaded document before submission", request=None,
        responses={204: OpenApiResponse(description="Document deleted."),
                   401: OpenApiResponse(description="Authentication required."),
                   404: OpenApiResponse(description="Document not found."),
                   409: OpenApiResponse(description="Verification is locked.")})
    def delete(self, request, document_id):
        delete_worker_verification_document(user=request.user, document_id=document_id)
        return private_response(None, status.HTTP_204_NO_CONTENT)

class WorkerVerificationStatusView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(tags=["Worker Verification"], summary="Read verification status and document metadata",
        responses={200: WorkerVerificationStatusSerializer, 401: OpenApiResponse(description="Authentication required.")})
    def get(self, request):
        profile = ExecutorProfile.objects.select_related("verification_identity").filter(user=request.user).first()
        return private_response(WorkerVerificationStatusSerializer(build_verification_status_data(profile)).data)

class WorkerVerificationSubmitView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(tags=["Worker Verification"], summary="Submit saved identity and both documents", request=None,
        responses={200: WorkerVerificationStatusSerializer, 400: OpenApiResponse(description="Missing saved identity or documents."),
                   401: OpenApiResponse(description="Authentication required."), 409: OpenApiResponse(description="Application already submitted.")})
    def post(self, request):
        if request.data:
            from rest_framework.exceptions import ValidationError
            raise ValidationError({"detail": ["Submit does not accept a request body."]})
        profile = submit_worker_verification_application(user=request.user)
        profile = ExecutorProfile.objects.select_related("verification_identity").get(pk=profile.pk)
        return private_response(WorkerVerificationStatusSerializer(build_verification_status_data(profile)).data)
