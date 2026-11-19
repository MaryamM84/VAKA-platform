"""Start execution through the existing FS Task State Machine (T3-02)."""

from django.db import transaction
from rest_framework.exceptions import NotFound, PermissionDenied

from accounts.models import ExecutorProfile, UserRole
from offers.models import Bid, BidStatus
from payments import hold_gateway
from payments.lifecycle import EscrowStatus
from tasks.choices import TaskStatus
from tasks.lifecycle import transition_task_locked
from tasks.lifecycle.errors import TaskTransitionConflict
from tasks.models import Task


def _conflict(task, detail):
    raise TaskTransitionConflict(
        source=task.status, target=TaskStatus.IN_PROGRESS, reason=detail,
    )


@transaction.atomic
def start_task_execution(*, task_id, actor):
    """Only the selected, currently eligible executor can start a funded task.

    Lock order: Task -> accepted Bid (+ profile/user via select_related).
    No client-supplied escrow fields or public status setter are trusted.
    """
    try:
        task = Task.objects.select_for_update().get(task_id=task_id)
    except Task.DoesNotExist:
        raise NotFound("Task not found.")

    if task.status != TaskStatus.ASSIGNED or task.deleted_at is not None:
        _conflict(task, "Only a non-deleted ASSIGNED task can be started.")

    bid = (
        Bid.objects.select_for_update()
        .select_related("executor_profile", "executor_profile__user")
        .filter(task=task, status=BidStatus.ACCEPTED)
        .first()
    )
    if bid is None:
        _conflict(task, "A confirmed accepted bid is required.")

    profile = bid.executor_profile
    if actor is None or actor.pk != profile.user_id:
        raise PermissionDenied("Only the assigned executor can start this task.")

    if (
        not profile.user.is_active
        or profile.profile_status != "ACTIVE"
        or profile.verification_status != ExecutorProfile.VerificationStatus.APPROVED
        or not UserRole.objects.filter(user_id=profile.user_id, role__code="EXECUTOR").exists()
    ):
        raise PermissionDenied("An active, verified executor is required.")

    reservation = hold_gateway.read_verified_held_reservation(
        task_id=task.pk, bid_id=bid.pk,
    )
    if (
        not isinstance(reservation, hold_gateway.VerifiedHeldReservation)
        or not isinstance(reservation.state, EscrowStatus)
        or reservation.state != EscrowStatus.HELD
        or reservation.task_reference != str(task.pk)
        or reservation.bid_reference != str(bid.pk)
        or not reservation.escrow_reference
        or not reservation.operation_reference
    ):
        _conflict(task, "A current, verified HELD escrow reservation is required.")

    return transition_task_locked(
        task=task,
        target=TaskStatus.IN_PROGRESS,
        event="execution_started",
        actor=actor,
        reason="Assigned executor started execution after verified escrow hold",
        metadata={
            "accepted_bid_id": str(bid.pk),
            "escrow_reference": reservation.escrow_reference,
            "escrow_operation_reference": reservation.operation_reference,
        },
    )
