"""Read-only task monitoring APIs scoped to the authenticated task employer."""
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema, OpenApiResponse
from rest_framework.exceptions import NotFound
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.profile_avatar_serializers import get_avatar_type, get_avatar_id, get_avatar_url
from accounts.profile_metrics import get_executor_profile_metrics
from offers.models import Bid, BidStatus
from tasks.choices import TaskStatus
from tasks.models import Task
from tasks.pagination import TaskDiscoveryPagination
from tasks.permissions import IsEmployer

from .employer_serializers import EmployerAssignedExecutorSerializer
from .models import TaskProgressReport
from .serializers import ProgressReportReadSerializer, ProgressReportListResponseSerializer


PHONE_VISIBLE_STATUSES = frozenset({
    TaskStatus.IN_PROGRESS, TaskStatus.SUBMITTED, TaskStatus.APPROVED,
    TaskStatus.DISPUTED, TaskStatus.CANCELLATION_REVIEW, TaskStatus.COMPLETED,
})


def owned_task_or_404(*, request, task_id):
    return get_object_or_404(
        Task.objects.filter(employer_user_id=request.user.pk, deleted_at__isnull=True),
        pk=task_id,
    )


def accepted_bid_or_404(*, task):
    bid = (
        Bid.objects.select_related("executor_profile", "executor_profile__user")
        .filter(task=task, status=BidStatus.ACCEPTED)
        .first()
    )
    if bid is None:
        raise NotFound("No executor has been assigned to this task.")
    return bid


class EmployerAssignedExecutorView(APIView):
    permission_classes = [IsAuthenticated, IsEmployer]

    @extend_schema(
        tags=["Employer Task Monitoring"],
        operation_id="employer_assigned_executor_retrieve",
        summary="View the executor assigned to my task",
        responses={200: EmployerAssignedExecutorSerializer,
                   404: OpenApiResponse(description="Task or assigned executor not found.")},
    )
    def get(self, request, task_id):
        task = owned_task_or_404(request=request, task_id=task_id)
        bid = accepted_bid_or_404(task=task)
        profile = bid.executor_profile
        worker = profile.user
        metrics = get_executor_profile_metrics(profile=profile)
        can_view_phone = task.status in PHONE_VISIBLE_STATUSES
        payload = {
            "task_id": task.pk,
            "task_status": task.status,
            "accepted_bid_id": bid.pk,
            "executor_profile_id": profile.pk,
            "user_id": worker.pk,
            "full_name": worker.full_name,
            "bio": profile.bio,
            "avatar_type": get_avatar_type(worker),
            "avatar_id": get_avatar_id(worker),
            "avatar_url": get_avatar_url(worker, request),
            "verification_status": profile.verification_status,
            "service_area_city": profile.service_area_city,
            "service_area_region": profile.service_area_region,
            "completed_tasks_count": metrics["completed_tasks_count"],
            "active_tasks_count": metrics["active_tasks_count"],
            "average_rating": metrics["average_rating"],
            "rating_count": metrics["rating_count"],
            "can_view_phone": can_view_phone,
            "phone": worker.phone if can_view_phone else None,
        }
        response = Response(EmployerAssignedExecutorSerializer(payload).data)
        response["Cache-Control"] = "private, no-store"
        return response


class EmployerTaskProgressReportsView(APIView):
    permission_classes = [IsAuthenticated, IsEmployer]

    @extend_schema(
        tags=["Employer Task Monitoring"],
        operation_id="employer_task_progress_reports_list",
        summary="View executor progress reports for my task",
        responses={200: ProgressReportListResponseSerializer,
                   404: OpenApiResponse(description="Task or assigned executor not found.")},
    )
    def get(self, request, task_id):
        task = owned_task_or_404(request=request, task_id=task_id)
        bid = accepted_bid_or_404(task=task)
        queryset = TaskProgressReport.objects.filter(
            task_id=task.pk,
            executor_profile_id=bid.executor_profile_id,
        ).order_by("-created_at", "-report_id")
        paginator = TaskDiscoveryPagination()
        page = paginator.paginate_queryset(queryset, request, view=self)
        response = paginator.get_paginated_response(
            ProgressReportReadSerializer(page, many=True).data
        )
        response["Cache-Control"] = "private, no-store"
        return response
