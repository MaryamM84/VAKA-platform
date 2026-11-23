"""Executor workspace authorization and transactional actions."""
from django.db import transaction
from rest_framework.exceptions import NotFound, PermissionDenied
from accounts.models import ExecutorProfile, UserRole
from offers.models import Bid, BidStatus
from tasks.choices import TaskStatus
from tasks.models import Task
from tasks.lifecycle.errors import TaskTransitionConflict
from tasks.lifecycle import transition_task_locked
from .models import TaskProgressReport, TaskDelivery


ACTIVE_EXECUTION_STATUSES = frozenset({
    TaskStatus.IN_PROGRESS, TaskStatus.SUBMITTED, TaskStatus.APPROVED,
    TaskStatus.DISPUTED, TaskStatus.CANCELLATION_REVIEW,
})


def approved_executor_profile(*, user):
    """Never authorize a non-current or unverified worker by stale bid alone."""
    if user is None or not user.is_authenticated or not user.is_active:
        raise PermissionDenied("An active executor account is required.")
    if not UserRole.objects.filter(user_id=user.pk, role__code="EXECUTOR").exists():
        raise PermissionDenied("The EXECUTOR role is required.")
    profile = ExecutorProfile.objects.filter(
        user_id=user.pk, profile_status="ACTIVE",
        verification_status=ExecutorProfile.VerificationStatus.APPROVED,
    ).first()
    if profile is None:
        raise PermissionDenied("An active, verified executor profile is required.")
    return profile


def _assigned_bid(*, task, profile):
    bid = Bid.objects.filter(
        task_id=task.pk, executor_profile=profile, status=BidStatus.ACCEPTED,
    ).first()
    if bid is None:
        raise NotFound("Assigned task not found.")
    return bid


def _conflict(task, reason, target=None):
    raise TaskTransitionConflict(
        source=task.status, target=target or task.status, reason=reason,
    )


@transaction.atomic
def record_progress(*, task_id, actor, progress_percent, description, on_schedule):
    profile = approved_executor_profile(user=actor)
    try:
        task = Task.objects.select_for_update().get(pk=task_id, deleted_at__isnull=True)
    except Task.DoesNotExist:
        raise NotFound("Assigned task not found.") from None
    _assigned_bid(task=task, profile=profile)
    if task.status != TaskStatus.IN_PROGRESS:
        _conflict(task, "Progress reports are allowed only during IN_PROGRESS.")

    previous = TaskProgressReport.objects.filter(task=task).order_by(
        "-created_at", "-report_id",
    ).first()
    if previous is not None and progress_percent < previous.progress_percent:
        _conflict(task, "Reported progress cannot go backwards.")

    return TaskProgressReport.objects.create(
        task=task, executor_profile=profile, progress_percent=progress_percent,
        description=description, on_schedule=on_schedule,
    )


@transaction.atomic
def submit_delivery(*, task_id, actor, summary, evidence_urls):
    profile = approved_executor_profile(user=actor)
    try:
        task = Task.objects.select_for_update().get(pk=task_id, deleted_at__isnull=True)
    except Task.DoesNotExist:
        raise NotFound("Assigned task not found.") from None
    _assigned_bid(task=task, profile=profile)
    if task.status != TaskStatus.IN_PROGRESS:
        _conflict(task, "Only an IN_PROGRESS task can be delivered.", TaskStatus.SUBMITTED)
    # The evidence reference must be a server-generated, persisted row, not
    # an arbitrary reference supplied by the client.
    delivery = TaskDelivery.objects.create(
        task=task, executor_profile=profile,
        summary=summary, evidence_urls=evidence_urls,
    )
    transition_task_locked(
        task=task, target=TaskStatus.SUBMITTED, event="delivery_submitted",
        actor=actor, reason="Executor submitted delivery evidence",
        metadata={"evidence_reference": str(delivery.pk)},
    )
    return delivery
