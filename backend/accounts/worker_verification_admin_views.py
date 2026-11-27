
from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404

from drf_spectacular.utils import (
    extend_schema,
    OpenApiResponse,
    OpenApiParameter,
)

from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    ExecutorProfile,
    WorkerVerificationDocument,
)

from .permissions import IsVerificationAdmin

from tasks.pagination import TaskDiscoveryPagination

from .worker_verification_admin_serializers import (
    AdminVerificationApplicationSummarySerializer,
    AdminVerificationApplicationPageSerializer,
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


class AdminVerificationApplicationsView(APIView):
    """Paginated applications by status, separate from the legacy pending list."""

    permission_classes = [IsAuthenticated, IsVerificationAdmin]
    VALID_STATUSES = {
        "ALL",
        ExecutorProfile.VerificationStatus.PENDING,
        ExecutorProfile.VerificationStatus.APPROVED,
        ExecutorProfile.VerificationStatus.REJECTED,
    }

    @extend_schema(
        tags=["Admin Worker Verification"],
        operation_id="admin_worker_verification_applications_list",
        summary="List pending, approved, rejected or all submitted applications",
        parameters=[
            OpenApiParameter(
                name="status", type=str, required=False,
                enum=["ALL", "PENDING", "APPROVED", "REJECTED"],
                description="Defaults to ALL. NOT_SUBMITTED is not an application.",
            ),
        ],
        responses={200: AdminVerificationApplicationPageSerializer},
    )
    def get(self, request):
        selected = request.query_params.get("status", "ALL").upper()
        if selected not in self.VALID_STATUSES:
            raise ValidationError({"status": "Use ALL, PENDING, APPROVED or REJECTED."})

        queryset = (
            ExecutorProfile.objects
            .filter(verification_status__in=[
                ExecutorProfile.VerificationStatus.PENDING,
                ExecutorProfile.VerificationStatus.APPROVED,
                ExecutorProfile.VerificationStatus.REJECTED,
            ])
            .select_related("user")
        )
        if selected != "ALL":
            queryset = queryset.filter(verification_status=selected)
        queryset = queryset.order_by("-application_submitted_at", "-executor_profile_id")
        paginator = TaskDiscoveryPagination()
        page = paginator.paginate_queryset(queryset, request, view=self)
        result = paginator.get_paginated_response(
            AdminVerificationApplicationSummarySerializer(page, many=True).data
        )
        result["Cache-Control"] = "private, no-store"
        return result
