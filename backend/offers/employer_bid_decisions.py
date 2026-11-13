from django.db import transaction
from django.utils import timezone

from rest_framework.exceptions import (
    APIException,
    NotFound,
    PermissionDenied,
)

from accounts.models import ExecutorProfile, UserRole
from tasks.choices import TaskStatus
from tasks.models import Task, TaskStatusHistory

from .models import Bid, BidStatus, BidStatusHistory


class BidDecisionConflict(APIException):
    status_code = 409
    default_detail = "The bid cannot be changed in its current state."
    default_code = "bid_decision_conflict"


def _require_employer(user):

    if not user or not user.is_authenticated:
        raise PermissionDenied("Authentication is required.")

    if not user.is_active:
        raise PermissionDenied("An active account is required.")

    if not UserRole.objects.filter(
        user_id=user.pk,
        role__code="EMPLOYER",
    ).exists():
        raise PermissionDenied("Employer role is required.")


def _lock_employer_bid(*, user, bid_id):

    _require_employer(user)

    initial = (
        Bid.objects.filter(
            bid_id=bid_id,
            task__employer_user_id=user.pk,
        )
        .values("task_id")
        .first()
    )

    if initial is None:
        raise NotFound("Bid not found.")

    try:
        task = (
            Task.objects.select_for_update()
            .get(
                task_id=initial["task_id"],
                employer_user_id=user.pk,
            )
        )
    except Task.DoesNotExist:
        raise NotFound("Bid not found.")

    try:
        bid = (
            Bid.objects.select_for_update()
            .select_related(
                "executor_profile",
                "executor_profile__user",
            )
            .get(
                bid_id=bid_id,
                task=task,
            )
        )
    except Bid.DoesNotExist:
        raise NotFound("Bid not found.")

    return task, bid


@transaction.atomic
def accept_employer_bid(*, user, bid_id):

    task, bid = _lock_employer_bid(
        user=user,
        bid_id=bid_id,
    )

    now = timezone.now()

    if task.status != TaskStatus.OPEN:
        raise BidDecisionConflict(
            "Only OPEN tasks can have bids accepted."
        )

    if task.proposal_deadline_at <= now:
        raise BidDecisionConflict(
            "The proposal deadline has passed."
        )

    if Bid.objects.filter(
        task=task,
        status=BidStatus.ACCEPTED,
    ).exists():
        raise BidDecisionConflict(
            "A bid has already been accepted."
        )

    if bid.status != BidStatus.ACTIVE:
        raise BidDecisionConflict(
            "Only ACTIVE bids can be accepted."
        )

    if bid.expires_at is not None and bid.expires_at <= now:
        raise BidDecisionConflict(
            "The selected bid has expired."
        )

    profile = bid.executor_profile

    if (
        profile.verification_status
        != ExecutorProfile.VerificationStatus.APPROVED
        or profile.profile_status != "ACTIVE"
        or not profile.user.is_active
    ):
        raise BidDecisionConflict(
            "The executor is not eligible for assignment."
        )

    active_bids = list(
        Bid.objects.select_for_update()
        .filter(
            task=task,
            status=BidStatus.ACTIVE,
        )
        .order_by("bid_id")
    )

    accepted_bid = None

    for item in active_bids:

        previous_status = item.status

        if item.pk == bid.pk:
            item.status = BidStatus.ACCEPTED
            accepted_bid = item
            reason = "Bid accepted by employer"
        else:
            item.status = BidStatus.REJECTED
            reason = "Another bid was accepted"

        item.save(
            update_fields=["status", "updated_at"]
        )

        BidStatusHistory.objects.create(
            bid=item,
            from_status=previous_status,
            to_status=item.status,
            changed_by_user=user,
            reason=reason,
        )

    if accepted_bid is None:
        raise BidDecisionConflict(
            "The selected bid is no longer active."
        )

    previous_task_status = task.status

    task.status = TaskStatus.ASSIGNED
    task.version += 1

    task.save(
        update_fields=[
            "status",
            "version",
            "updated_at",
        ]
    )

    TaskStatusHistory.objects.create(
        task=task,
        from_status=previous_task_status,
        to_status=TaskStatus.ASSIGNED,
        changed_by_user=user,
        reason="Employer accepted an executor bid",
        metadata={
            "accepted_bid_id": str(accepted_bid.pk),
        },
    )

    return accepted_bid, task


@transaction.atomic
def reject_employer_bid(*, user, bid_id):

    task, bid = _lock_employer_bid(
        user=user,
        bid_id=bid_id,
    )

    if task.status != TaskStatus.OPEN:
        raise BidDecisionConflict(
            "Only bids for OPEN tasks can be rejected."
        )

    if bid.status != BidStatus.ACTIVE:
        raise BidDecisionConflict(
            "Only ACTIVE bids can be rejected."
        )

    previous_status = bid.status

    bid.status = BidStatus.REJECTED

    bid.save(
        update_fields=[
            "status",
            "updated_at",
        ]
    )

    BidStatusHistory.objects.create(
        bid=bid,
        from_status=previous_status,
        to_status=BidStatus.REJECTED,
        changed_by_user=user,
        reason="Bid rejected by employer",
    )

    return bid, task