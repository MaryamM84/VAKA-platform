
from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404

from drf_spectacular.utils import (
    extend_schema,
    OpenApiResponse,
)

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    ExecutorProfile,
    WorkerVerificationDocument,
)

from .permissions import IsVerificationAdmin

from .worker_verification_admin_serializers import (
    AdminWorkerVerificationListSerializer,
    AdminWorkerVerificationDetailSerializer,
    WorkerVerificationRejectSerializer,
)

from .worker_verification_admin_services import (
    approve_worker_verification,
    reject_worker_verification,
)


class AdminWorkerVerificationListView(APIView):

    permission_classes = [
        IsAuthenticated,
        IsVerificationAdmin,
    ]

    @extend_schema(
        tags=["Admin Worker Verification"],
        summary="List pending worker verification applications",
        responses={
            200: AdminWorkerVerificationListSerializer(many=True),
        },
    )
    def get(self, request):

        profiles = (
            ExecutorProfile.objects
            .filter(
                verification_status=(
                    ExecutorProfile.VerificationStatus.PENDING
                )
            )
            .select_related("user")
            .order_by("application_submitted_at")
        )

        serializer = AdminWorkerVerificationListSerializer(
            profiles,
            many=True,
        )

        return Response(
            serializer.data,
            status=status.HTTP_200_OK,
        )


class AdminWorkerVerificationDetailView(APIView):

    permission_classes = [
        IsAuthenticated,
        IsVerificationAdmin,
    ]

    def get_profile(self, executor_profile_id):

        return get_object_or_404(
            ExecutorProfile.objects
            .select_related(
                "user",
                "reviewed_by_user",
                "verification_identity",
            )
            .prefetch_related("verification_documents"),
            pk=executor_profile_id,
        )

    @extend_schema(
        tags=["Admin Worker Verification"],
        summary="Get worker verification application details",
        responses={
            200: AdminWorkerVerificationDetailSerializer,
            404: OpenApiResponse(
                description="Application not found."
            ),
        },
    )
    def get(self, request, executor_profile_id):

        profile = self.get_profile(
            executor_profile_id,
        )

        serializer = AdminWorkerVerificationDetailSerializer(
            profile,
        )

        response = Response(
            serializer.data,
            status=status.HTTP_200_OK,
        )
        response["Cache-Control"] = "private, no-store"
        return response


class AdminWorkerVerificationApproveView(APIView):

    permission_classes = [
        IsAuthenticated,
        IsVerificationAdmin,
    ]

    @extend_schema(
        tags=["Admin Worker Verification"],
        summary="Approve worker verification application",
        request=None,
        responses={
            200: AdminWorkerVerificationDetailSerializer,
            400: OpenApiResponse(
                description="Application is not pending."
            ),
            404: OpenApiResponse(
                description="Application not found."
            ),
        },
    )
    def post(self, request, executor_profile_id):

        profile = approve_worker_verification(
            executor_profile_id=executor_profile_id,
            reviewer=request.user,
        )

        serializer = AdminWorkerVerificationDetailSerializer(
            profile,
        )

        return Response(
            serializer.data,
            status=status.HTTP_200_OK,
        )


class AdminWorkerVerificationRejectView(APIView):

    permission_classes = [
        IsAuthenticated,
        IsVerificationAdmin,
    ]

    @extend_schema(
        tags=["Admin Worker Verification"],
        summary="Reject worker verification application",
        request=WorkerVerificationRejectSerializer,
        responses={
            200: AdminWorkerVerificationDetailSerializer,
            400: OpenApiResponse(
                description="Invalid rejection reason or application status."
            ),
            404: OpenApiResponse(
                description="Application not found."
            ),
        },
    )
    def post(self, request, executor_profile_id):

        input_serializer = WorkerVerificationRejectSerializer(
            data=request.data,
        )

        input_serializer.is_valid(
            raise_exception=True,
        )

        profile = reject_worker_verification(
            executor_profile_id=executor_profile_id,
            reviewer=request.user,
            reason=input_serializer.validated_data["reason"],
        )

        serializer = AdminWorkerVerificationDetailSerializer(
            profile,
        )

        return Response(
            serializer.data,
            status=status.HTTP_200_OK,
        )


class AdminWorkerVerificationDocumentDownloadView(APIView):

    permission_classes = [
        IsAuthenticated,
        IsVerificationAdmin,
    ]

    @extend_schema(
        tags=["Admin Worker Verification"],
        summary="Download a private verification document",
        responses={
            200: OpenApiResponse(
                description="Private verification document."
            ),
            404: OpenApiResponse(
                description="Document not found."
            ),
        },
    )
    def get(
        self,
        request,
        executor_profile_id,
        document_id,
    ):

        document = get_object_or_404(
            WorkerVerificationDocument.objects.filter(
                executor_profile_id=executor_profile_id,
            ),
            document_id=document_id,
        )

        if not document.file:
            raise Http404("Document file not found.")

        try:
            file_handle = document.file.open("rb")

        except (FileNotFoundError, OSError):
            raise Http404("Document file not found.")

        response = FileResponse(
            file_handle,
            as_attachment=True,
            filename=document.original_file_name,
            content_type=document.mime_type,
        )

        response["X-Content-Type-Options"] = "nosniff"

        return response
