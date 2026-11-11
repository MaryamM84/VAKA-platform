
from drf_spectacular.utils import (
    extend_schema,
    OpenApiResponse,
)

from rest_framework import status
from rest_framework.parsers import (
    MultiPartParser,
    FormParser,
)
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .worker_verification_serializers import (
    WorkerVerificationDocumentUploadSerializer,
    WorkerVerificationDocumentReadSerializer,
    WorkerVerificationStatusSerializer,
)

from .worker_verification_services import (
    upload_worker_verification_document,
    submit_worker_verification_application,
)

from .models import ExecutorProfile

class WorkerVerificationDocumentUploadView(APIView):

    permission_classes = [IsAuthenticated]

    parser_classes = [
        MultiPartParser,
        FormParser,
    ]

    @extend_schema(
        tags=["Worker Verification"],
        summary="Upload worker verification document",
        description=(
            "Upload a private identity verification document "
            "for the authenticated user's executor profile."
        ),
        request=WorkerVerificationDocumentUploadSerializer,
        responses={
            201: WorkerVerificationDocumentReadSerializer,
            400: OpenApiResponse(
                description="Invalid document or verification status."
            ),
            401: OpenApiResponse(
                description="Authentication required."
            ),
        },
    )
    def post(self, request):

        serializer = WorkerVerificationDocumentUploadSerializer(
            data=request.data,
        )

        serializer.is_valid(
            raise_exception=True,
        )

        document = upload_worker_verification_document(
            user=request.user,
            document_type=serializer.validated_data[
                "document_type"
            ],
            uploaded_file=serializer.validated_data["file"],
            mime_type=serializer.validated_data["mime_type"],
        )

        response_serializer = (
            WorkerVerificationDocumentReadSerializer(
                document,
            )
        )

        return Response(
            response_serializer.data,
            status=status.HTTP_201_CREATED,
        )


def build_verification_status_data(profile):

    if profile is None:

        return {
            "verification_status": (
                ExecutorProfile.VerificationStatus.NOT_SUBMITTED
            ),
            "application_submitted_at": None,
            "reviewed_at": None,
            "approved_at": None,
            "rejection_reason": None,
            "documents": [],
        }

    documents = (
        profile.verification_documents
        .order_by("-uploaded_at")
    )

    return {
        "verification_status": profile.verification_status,
        "application_submitted_at": profile.application_submitted_at,
        "reviewed_at": profile.reviewed_at,
        "approved_at": profile.approved_at,
        "rejection_reason": (
            profile.rejection_reason
            if profile.verification_status
            == ExecutorProfile.VerificationStatus.REJECTED
            else None
        ),
        "documents": documents,
    }


class WorkerVerificationStatusView(APIView):

    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Worker Verification"],
        summary="Get current worker verification status",
        responses={
            200: WorkerVerificationStatusSerializer,
            401: OpenApiResponse(
                description="Authentication required."
            ),
        },
    )
    def get(self, request):

        profile = ExecutorProfile.objects.filter(
            user=request.user,
        ).first()

        response_serializer = WorkerVerificationStatusSerializer(
            build_verification_status_data(profile),
        )

        return Response(
            response_serializer.data,
            status=status.HTTP_200_OK,
        )


class WorkerVerificationSubmitView(APIView):

    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Worker Verification"],
        summary="Submit worker verification application",
        request=None,
        responses={
            200: WorkerVerificationStatusSerializer,
            400: OpenApiResponse(
                description="Application cannot be submitted."
            ),
            401: OpenApiResponse(
                description="Authentication required."
            ),
        },
    )
    def post(self, request):

        profile = submit_worker_verification_application(
            user=request.user,
        )

        response_serializer = WorkerVerificationStatusSerializer(
            build_verification_status_data(profile),
        )

        return Response(
            response_serializer.data,
            status=status.HTTP_200_OK,
        )

