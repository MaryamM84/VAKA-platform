from django.db import transaction
from django.utils import timezone

from rest_framework.exceptions import (
    APIException,
    NotFound,
    PermissionDenied,
    ValidationError,
)

from accounts.models import ExecutorProfile, UserRole
from accounts.profile_avatar_serializers import (
    get_avatar_id,
    get_avatar_type,
    get_avatar_url,
)
from accounts.profile_metrics import get_executor_profile_metrics
from tasks.choices import TaskStatus
from tasks.models import Task, TaskStatusHistory

from .models import Bid, BidStatus, BidStatusHistory
from tasks.lifecycle import transition_task_locked
from payments.fees import calculate_platform_fee_amount, get_platform_fee_rate_bps
from payments.lifecycle import EscrowStatus, VerifiedFinancialEvent
from payments.models import FeePayer, Wallet
from payments.services import reserve_funds_for_bid


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


def _require_assignable_executor(*, profile):
    """Check current eligibility at BOTH bid selection and funded assignment."""
    if (
        profile.verification_status != ExecutorProfile.VerificationStatus.APPROVED
        or profile.profile_status != "ACTIVE"
        or not profile.user.is_active
        or not UserRole.objects.filter(
            user_id=profile.user_id, role__code="EXECUTOR",
        ).exists()
    ):
        raise BidDecisionConflict("The executor is not eligible for assignment.")


def get_employer_bid_assignment_preview(*, user, bid_id, request=None):
    """Build a read-only assignment and escrow preview for the task employer.

    This endpoint deliberately does not reserve funds or change task/bid state.
    The accept operation revalidates every condition under database locks.
    """
    _require_employer(user)

    bid = (
        Bid.objects.select_related(
            "task",
            "task__category",
            "executor_profile",
            "executor_profile__user",
        )
        .prefetch_related("task__locations")
        .filter(bid_id=bid_id, task__employer_user_id=user.pk)
        .first()
    )
    if bid is None:
        raise NotFound("Bid not found.")

    task = bid.task
    now = timezone.now()
    if task.status != TaskStatus.OPEN:
        raise BidDecisionConflict("Only bids for OPEN tasks can be previewed for assignment.")
    if task.proposal_deadline_at <= now:
        raise BidDecisionConflict("The proposal deadline has passed.")
    if bid.status != BidStatus.ACTIVE:
        raise BidDecisionConflict("Only ACTIVE bids can be previewed for assignment.")
    if bid.expires_at is not None and bid.expires_at <= now:
        raise BidDecisionConflict("The selected bid has expired.")

    profile = bid.executor_profile
    _require_assignable_executor(profile=profile)

    # Keep GET genuinely read-only: preview an unsaved default wallet when
    # the employer has not created one yet. The accept service creates it.
    wallet = Wallet.objects.filter(user=user).first() or Wallet(user=user)
    labor_amount = int(bid.proposed_wage_amount)
    expense_amount = int(task.item_cost_cap_amount or 0)
    reserved_amount = labor_amount + expense_amount
    fee_rate_bps = get_platform_fee_rate_bps()
    fee_amount = calculate_platform_fee_amount(labor_amount, fee_rate_bps)
    currency_matches = wallet.currency_code == task.currency_code
    reservation_amount_is_positive = reserved_amount > 0
    has_sufficient_balance = (
        currency_matches
        and reservation_amount_is_positive
        and wallet.available_balance >= reserved_amount
    )
    shortfall_amount = (
        max(reserved_amount - wallet.available_balance, 0)
        if currency_matches else reserved_amount
    )

    metrics = get_executor_profile_metrics(profile=profile)
    executor_user = profile.user

    return {
        "task": {
            "task_id": task.pk,
            "title": task.title,
            "description": task.description,
            "category_name": task.category.name,
            "status": task.status,
            "currency_code": task.currency_code,
            "receipt_required": task.receipt_required,
            "execution_window_start_at": task.execution_window_start_at,
            "execution_window_end_at": task.execution_window_end_at,
            "deadline_at": task.deadline_at,
            "delivery_criteria": task.delivery_criteria,
            "locations": list(
                task.locations.values(
                    "location_type", "stop_order", "city", "region"
                )
            ),
        },
        "bid": {
            "bid_id": bid.pk,
            "status": bid.status,
            "proposed_wage_amount": labor_amount,
            "proposed_duration_minutes": bid.proposed_duration_minutes,
            "message": bid.message,
            "expires_at": bid.expires_at,
        },
        "executor": {
            "profile_id": profile.pk,
            "full_name": executor_user.full_name,
            "avatar_type": get_avatar_type(executor_user),
            "avatar_id": get_avatar_id(executor_user),
            "avatar_url": get_avatar_url(executor_user, request),
            "bio": profile.bio,
            "verification_status": profile.verification_status,
            "completed_tasks_count": metrics["completed_tasks_count"],
            "active_tasks_count": metrics["active_tasks_count"],
            "average_rating": metrics["average_rating"],
            "rating_count": metrics["rating_count"],
        },
        "reservation_preview": {
            "labor_amount": labor_amount,
            "expense_amount": expense_amount,
            "reserved_amount": reserved_amount,
            "currency_code": task.currency_code,
            "platform_fee_rate_bps": fee_rate_bps,
            "platform_fee_amount": fee_amount,
            "fee_payer": FeePayer.WORKER,
            "fee_included_in_reserved_amount": False,
        },
        "wallet": {
            "wallet_id": wallet.pk if not wallet._state.adding else None,
            "currency_code": wallet.currency_code,
            "total_balance": wallet.total_balance,
            "available_balance": wallet.available_balance,
            "reserved_balance": wallet.reserved_balance,
            "required_reservation_amount": reserved_amount,
            "shortfall_amount": shortfall_amount,
            "has_sufficient_balance": has_sufficient_balance,
            "currency_matches": currency_matches,
            "available_balance_after_reservation": (
                wallet.available_balance - reserved_amount
                if has_sufficient_balance else None
            ),
            "reserved_balance_after_reservation": (
                wallet.reserved_balance + reserved_amount
                if has_sufficient_balance else None
            ),
        },
        "can_confirm": has_sufficient_balance,
        "blocking_reason": (
            None if has_sufficient_balance
            else "WALLET_CURRENCY_MISMATCH" if not currency_matches
            else "INVALID_RESERVATION_AMOUNT" if not reservation_amount_is_positive
            else "INSUFFICIENT_BALANCE"
        ),
    }


@transaction.atomic
def accept_employer_bid(*, user, bid_id, idempotency_key):
    """Atomically reserve escrow funds and finalize one selected bid.

    The Task row is the serialization point. The OPEN -> FUNDING_PENDING ->
    ASSIGNED transitions, wallet movement, escrow row, ledger entry, selected
    bid acceptance and competing bid rejections all share this outer DB
    transaction. A failure at any point rolls the complete operation back.
    """
    task, bid = _lock_employer_bid(
        user=user,
        bid_id=bid_id,
    )

    if (
        not isinstance(idempotency_key, str)
        or not idempotency_key.strip()
        or len(idempotency_key.strip()) > 128
    ):
        raise ValidationError({
            "Idempotency-Key": "A non-empty Idempotency-Key of at most 128 characters is required."
        })
    idempotency_key = idempotency_key.strip()

    # A retry of the exact successful request must return its original escrow
    # reservation rather than attempting a second assignment or ledger entry.
    # reserve_funds_for_bid validates the stored request hash and authoritative
    # ledger entry before returning a replay.
    if task.status == TaskStatus.ASSIGNED and bid.status == BidStatus.ACCEPTED:
        reservation, financial_event = reserve_funds_for_bid(
            employer=user,
            task=task,
            bid=bid,
            idempotency_key=idempotency_key,
        )
        if (
            financial_event.state != EscrowStatus.HELD
            or financial_event.task_reference != str(task.pk)
            or financial_event.bid_reference != str(bid.pk)
            or reservation.task_id != task.pk
            or reservation.bid_id != bid.pk
        ):
            raise BidDecisionConflict(
                "The original escrow reservation does not match this assignment."
            )
        return bid, task, reservation

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

    _require_assignable_executor(profile=bid.executor_profile)

    # First record the selected bid intent through the Task State Machine.
    # This is still uncommitted and invisible to other transactions.
    transition_task_locked(
        task=task,
        target=TaskStatus.FUNDING_PENDING,
        event="bid_selected",
        actor=user,
        reason="Employer selected bid; reserving escrow funds",
        metadata={"selected_bid_id": str(bid.pk)},
    )

    # Wallet, Escrow and Ledger are persisted in nested atomic blocks that
    # remain part of this outer transaction.
    reservation, financial_event = reserve_funds_for_bid(
        employer=user,
        task=task,
        bid=bid,
        idempotency_key=idempotency_key,
    )

    # Assignment is finalized only after the finance service has persisted
    # a HELD reservation and its matching idempotent ledger entry.
    accepted_bid, task = confirm_funded_bid(
        task_id=task.pk,
        financial_event=financial_event,
        actor=None,
        changed_by_user=user,
    )
    return accepted_bid, task, reservation


def _pending_bid_id(*, task):
    """Read the selected bid intent recorded by the task transition engine."""
    row = (
        TaskStatusHistory.objects.filter(
            task=task, to_status=TaskStatus.FUNDING_PENDING,
        )
        .order_by("-created_at", "-history_id")
        .first()
    )
    bid_id = (row.metadata or {}).get("selected_bid_id") if row else None
    if not bid_id:
        raise BidDecisionConflict("There is no pending selected bid.")
    return str(bid_id)


@transaction.atomic
def confirm_funded_bid(*, task_id, financial_event, actor=None, changed_by_user=None):
    """PRIVATE finance adapter hook, never expose via untrusted HTTP inputs.

    The caller must obtain this event from the private wallet reservation
    service after it has persisted the HELD escrow and matching ledger entry.
    """
    task = Task.objects.select_for_update().get(task_id=task_id)
    if task.status != TaskStatus.FUNDING_PENDING:
        raise BidDecisionConflict("No pending funding exists for this task.")
    selected_id = _pending_bid_id(task=task)
    if (
        not isinstance(financial_event, VerifiedFinancialEvent)
        or financial_event.state != EscrowStatus.HELD
        or financial_event.task_reference != str(task.pk)
        or financial_event.bid_reference != selected_id
    ):
        raise BidDecisionConflict("A verified ledger HOLD for the selected bid is required.")

    active_bids = list(
        Bid.objects.select_for_update()
        .filter(task=task, status=BidStatus.ACTIVE)
        .order_by("bid_id")
    )
    selected = next((bid for bid in active_bids if str(bid.pk) == selected_id), None)
    if selected is None:
        raise BidDecisionConflict("Selected bid is no longer active.")

    # Eligibility may have changed while payment was pending. Lock and
    # re-read the profile/account instead of trusting the earlier selection.
    current_profile = (
        ExecutorProfile.objects.select_for_update()
        .select_related("user")
        .get(pk=selected.executor_profile_id)
    )
    _require_assignable_executor(profile=current_profile)

    transition_task_locked(
        task=task, target=TaskStatus.ASSIGNED,
        event="funding_confirmed", actor=actor,
        reason="Escrow funds held; one worker assigned",
        financial_event=financial_event,
        metadata={"accepted_bid_id": selected_id},
    )
    for item in active_bids:
        old_status = item.status
        item.status = BidStatus.ACCEPTED if item.pk == selected.pk else BidStatus.REJECTED
        item.save(update_fields=["status", "updated_at"])
        BidStatusHistory.objects.create(
            bid=item, from_status=old_status, to_status=item.status,
            changed_by_user=changed_by_user or actor,
            reason=("Funding confirmed: bid accepted" if item.pk == selected.pk
                    else "Funding confirmed: another bid was accepted"),
        )
    return selected, task


@transaction.atomic
def release_failed_funding(*, task_id, financial_event, actor=None):
    """PRIVATE finance callback for a verified FAILED funding operation."""
    task = Task.objects.select_for_update().get(task_id=task_id)
    if task.status != TaskStatus.FUNDING_PENDING:
        raise BidDecisionConflict("No pending funding exists for this task.")
    if (
        not isinstance(financial_event, VerifiedFinancialEvent)
        or financial_event.state != EscrowStatus.FAILED
        or financial_event.task_reference != str(task.pk)
        or financial_event.bid_reference != _pending_bid_id(task=task)
    ):
        raise BidDecisionConflict("A verified funding failure is required.")
    transition_task_locked(
        task=task, target=TaskStatus.OPEN, event="funding_failed",
        actor=actor, reason="Escrow funding failed; bidding reopened",
        financial_event=financial_event,
    )
    return task


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