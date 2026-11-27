"""Admin-only listing for approved, role-assigned executors."""
from django.db.models import Count, Q
from drf_spectacular.utils import extend_schema, OpenApiResponse
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from offers.models import BidStatus
from tasks.choices import TaskStatus
from tasks.pagination import TaskDiscoveryPagination

from .admin_executor_serializers import AdminExecutorListResponseSerializer, AdminExecutorListSerializer
from .models import ExecutorProfile
from .permissions import IsVerificationAdmin


ACTIVE_STATUSES = (
    TaskStatus.ASSIGNED, TaskStatus.IN_PROGRESS, TaskStatus.SUBMITTED,
    TaskStatus.APPROVED, TaskStatus.DISPUTED, TaskStatus.CANCELLATION_REVIEW,
)


class AdminExecutorListView(APIView):
    permission_classes = [IsAuthenticated, IsVerificationAdmin]

    @extend_schema(
        tags=["Admin Executors"],
        operation_id="admin_executors_list",
        summary="List approved executors",
        responses={
            200: AdminExecutorListResponseSerializer,
            403: OpenApiResponse(description="Administrator role required."),
        },
    )
    def get(self, request):
        queryset = (
            ExecutorProfile.objects
            .filter(
                verification_status=ExecutorProfile.VerificationStatus.APPROVED,
                user__user_roles__role__code="EXECUTOR",
            )
            .select_related("user")
            .annotate(
                completed_tasks_count=Count(
                    "bids__task_id",
                    filter=Q(bids__status=BidStatus.ACCEPTED,
                             bids__task__status=TaskStatus.COMPLETED),
                    distinct=True,
                ),
                active_tasks_count=Count(
                    "bids__task_id",
                    filter=Q(bids__status=BidStatus.ACCEPTED,
                             bids__task__status__in=ACTIVE_STATUSES),
                    distinct=True,
                ),
            )
            .order_by("-approved_at", "-executor_profile_id")
        )
        paginator = TaskDiscoveryPagination()
        page = paginator.paginate_queryset(queryset, request, view=self)
        data = AdminExecutorListSerializer(page, many=True).data
        response = paginator.get_paginated_response(data)
        response["Cache-Control"] = "private, no-store"
        return response
