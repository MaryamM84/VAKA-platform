"""Views for assigned executor tasks; unrelated task APIs remain unchanged."""
from django.db.models import Count, OuterRef, Prefetch, Subquery
from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from accounts.profile_avatar_serializers import get_avatar_id, get_avatar_type, get_avatar_url
from offers.models import Bid, BidStatus
from payments.hold_gateway import read_verified_held_reservation
from payments.models import EscrowReservation
from tasks.choices import TaskStatus
from tasks.models import Task, TaskStatusHistory
from tasks.pagination import TaskDiscoveryPagination
from .models import TaskProgressReport
from .serializers import (
    ExecutorTaskCardSerializer, ExecutorTaskDetailSerializer, ExecutorTaskListResponseSerializer,
)
from .workspace_services import (
    ACTIVE_EXECUTION_STATUSES, approved_executor_profile,
)


VISIBLE_STATUSES = (
    TaskStatus.ASSIGNED, TaskStatus.IN_PROGRESS, TaskStatus.SUBMITTED,
    TaskStatus.APPROVED, TaskStatus.DISPUTED, TaskStatus.CANCELLATION_REVIEW,
    TaskStatus.COMPLETED, TaskStatus.CANCELLED,
)


def assigned_tasks_for(*, profile):
    latest_report = TaskProgressReport.objects.filter(
        task_id=OuterRef("pk"),
    ).order_by("-created_at", "-report_id")
    assigned_history = TaskStatusHistory.objects.filter(
        task_id=OuterRef("pk"), to_status=TaskStatus.ASSIGNED,
    ).order_by("-created_at", "-history_id")
    started_history = TaskStatusHistory.objects.filter(
        task_id=OuterRef("pk"), to_status=TaskStatus.IN_PROGRESS,
    ).order_by("-created_at", "-history_id")
    return (
        Task.objects.filter(
            deleted_at__isnull=True,
            status__in=VISIBLE_STATUSES,
            bids__status=BidStatus.ACCEPTED,
            bids__executor_profile=profile,
        )
        .select_related("category", "employer_user")
        .prefetch_related(
            Prefetch(
                "bids", queryset=Bid.objects.filter(status=BidStatus.ACCEPTED),
                to_attr="accepted_bids",
            ),
            "required_skills__skill",
        )
        .annotate(
            reports_count=Count("progress_reports", distinct=True),
            last_progress_percent=Subquery(latest_report.values("progress_percent")[:1]),
            assigned_at_value=Subquery(assigned_history.values("created_at")[:1]),
            started_at_value=Subquery(started_history.values("created_at")[:1]),
        )
        .distinct()
        .order_by("-updated_at", "-task_id")
    )


def assigned_task_or_404(*, profile, task_id):
    return get_object_or_404(assigned_tasks_for(profile=profile), pk=task_id)


def _card_payload(*, task, now):
    bid = task.accepted_bids[0]  # filtered by accepted-bid invariant
    reservation = read_verified_held_reservation(task_id=task.pk, bid_id=bid.pk)
    is_held = reservation is not None
    financial = None
    if is_held:
        # The gateway has already independently verified the ledger and hold.
        financial = EscrowReservation.objects.filter(
            pk=reservation.escrow_reference,
            task_id=task.pk, bid_id=bid.pk,
        ).values("amount", "labor_amount", "platform_fee_amount").first()
    is_held = is_held and financial is not None
    due_at = task.deadline_at or task.execution_window_end_at
    remaining_seconds = None
    if task.status == TaskStatus.IN_PROGRESS and due_at is not None:
        remaining_seconds = max(0, int((due_at - now).total_seconds()))
    return {
        "task_id": task.pk,
        "title": task.title,
        "description": task.description,
        "category_id": task.category_id,
        "category_name": task.category.name,
        "status": task.status,
        "accepted_bid_id": bid.pk,
        "agreed_wage_amount": bid.proposed_wage_amount,
        "currency_code": task.currency_code,
        "proposed_duration_minutes": bid.proposed_duration_minutes,
        "assigned_at": task.assigned_at_value,
        "started_at": task.started_at_value,
        "execution_window_start_at": task.execution_window_start_at,
        "execution_window_end_at": task.execution_window_end_at,
        "due_at": due_at,
        "remaining_seconds": remaining_seconds,
        "progress_percent": task.last_progress_percent or 0,
        "reports_count": task.reports_count,
        "escrow_verified": is_held,
        "secured_amount": financial["amount"] if is_held else None,
        "net_worker_amount": (
            financial["labor_amount"] - financial["platform_fee_amount"]
            if is_held else None
        ),
        "platform_fee_amount": financial["platform_fee_amount"] if is_held else None,
        "server_time": now,
        "can_start": task.status == TaskStatus.ASSIGNED and is_held,
        "can_report_progress": task.status == TaskStatus.IN_PROGRESS,
        "can_submit_delivery": task.status == TaskStatus.IN_PROGRESS,
        "can_view_private_details": task.status in ACTIVE_EXECUTION_STATUSES,
    }


def _detail_payload(*, task, request):
    data = _card_payload(task=task, now=timezone.now())
    employer = task.employer_user
    data.update({
        "employer": {
            "user_id": employer.pk,
            "full_name": employer.full_name,
            "avatar_type": get_avatar_type(employer),
            "avatar_id": get_avatar_id(employer),
            "avatar_url": get_avatar_url(employer, request),
            "completed_tasks_count": Task.objects.filter(
                employer_user=employer, status=TaskStatus.COMPLETED,
                deleted_at__isnull=True,
            ).count(),
            "average_rating": None,  # No ratings model in the supplied backend.
        },
        "delivery_criteria": task.delivery_criteria,
        "item_cost_cap_amount": task.item_cost_cap_amount,
        "receipt_required": task.receipt_required,
        "required_skills": [
            {
                "skill_id": relation.skill_id,
                "skill_name": relation.skill.name,
                "importance": relation.importance,
                "source": relation.source,
            }
            for relation in task.required_skills.all()
        ],
        "locations": list(task.locations.values(
            "task_location_id", "location_type", "stop_order", "city", "region",
        ).order_by("stop_order", "task_location_id")),
        "version": task.version,
    })
    return data


class ExecutorTaskListView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Executor Workspace"], operation_id="executor_tasks_list",
        summary="List only accepted, assigned tasks for the current verified worker",
        parameters=[OpenApiParameter(name="status", type=str, required=False,
                                     description="Optional TaskStatus filter")],
        responses={200: ExecutorTaskListResponseSerializer},
    )
    def get(self, request):
        profile = approved_executor_profile(user=request.user)
        qs = assigned_tasks_for(profile=profile)
        status_filter = request.query_params.get("status")
        if status_filter:
            if status_filter not in VISIBLE_STATUSES:
                raise ValidationError({"status": "Unknown executor task status."})
            qs = qs.filter(status=status_filter)
        pager = TaskDiscoveryPagination()
        page = pager.paginate_queryset(qs, request, view=self)
        rows = [_card_payload(task=task, now=timezone.now()) for task in page]
        return pager.get_paginated_response(ExecutorTaskCardSerializer(rows, many=True).data)


class ExecutorTaskDetailView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Executor Workspace"], operation_id="executor_tasks_retrieve",
        summary="Read task, accepted wage, requirements and execution status",
        responses={200: ExecutorTaskDetailSerializer, 404: OpenApiResponse(description="Not assigned")},
    )
    def get(self, request, task_id):
        profile = approved_executor_profile(user=request.user)
        task = assigned_task_or_404(profile=profile, task_id=task_id)
        return Response(ExecutorTaskDetailSerializer(
            _detail_payload(task=task, request=request),
        ).data)
