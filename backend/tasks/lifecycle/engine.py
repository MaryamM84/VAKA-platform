"""Central, transaction-bound task state transition engine (FS §7.2).

All persisted task status writes in production services go through here.
The caller obtains a task row lock BEFORE locking bids, avoiding races.
Financial evidence is issued by a trusted private ledger integration, not users.
"""
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied

from payments.lifecycle import EscrowStatus, VerifiedFinancialEvent
from tasks.choices import TaskStatus
from tasks.models import Task, TaskStatusHistory
from .errors import TaskTransitionConflict
from .states import state_for


# Source/status plus a *business event* required. Never permit a generic
# 'set status' API: approval, payment and dispute transitions need guards.
EVENT_FOR_TRANSITION = {
    (TaskStatus.DRAFT, TaskStatus.OPEN): "publish",
    (TaskStatus.DRAFT, TaskStatus.CANCELLED): "cancel_before_assignment",
    (TaskStatus.OPEN, TaskStatus.FUNDING_PENDING): "bid_selected",
    (TaskStatus.OPEN, TaskStatus.CANCELLED): "cancel_before_assignment",
    (TaskStatus.OPEN, TaskStatus.EXPIRED): "proposal_deadline_elapsed",
    (TaskStatus.FUNDING_PENDING, TaskStatus.ASSIGNED): "funding_confirmed",
    (TaskStatus.FUNDING_PENDING, TaskStatus.OPEN): "funding_failed",
    (TaskStatus.ASSIGNED, TaskStatus.IN_PROGRESS): "execution_started",
    (TaskStatus.ASSIGNED, TaskStatus.CANCELLATION_REVIEW): "cancellation_requested",
    (TaskStatus.IN_PROGRESS, TaskStatus.SUBMITTED): "delivery_submitted",
    (TaskStatus.IN_PROGRESS, TaskStatus.CANCELLATION_REVIEW): "cancellation_requested",
    (TaskStatus.SUBMITTED, TaskStatus.APPROVED): "delivery_approved",
    (TaskStatus.SUBMITTED, TaskStatus.DISPUTED): "dispute_opened",
    (TaskStatus.APPROVED, TaskStatus.COMPLETED): "settlement_confirmed",
    (TaskStatus.DISPUTED, TaskStatus.COMPLETED): "arbitration_settled",
    (TaskStatus.DISPUTED, TaskStatus.CANCELLED): "arbitration_refunded",
    (TaskStatus.CANCELLATION_REVIEW, TaskStatus.CANCELLED): "cancellation_refunded",
    (TaskStatus.CANCELLATION_REVIEW, TaskStatus.DISPUTED): "cancellation_disputed",
}

# Access policy from FS §5. No public caller can assert settlement success.
EMPLOYER_EVENTS = frozenset((
    "publish", "cancel_before_assignment", "bid_selected",
    "cancellation_requested", "delivery_approved",
))
EXECUTOR_EVENTS = frozenset(("execution_started", "delivery_submitted"))
FINANCE_EVENTS = frozenset((
    "funding_confirmed", "funding_failed", "settlement_confirmed",
    "arbitration_settled", "arbitration_refunded", "cancellation_refunded",
))


def _validate_actor(*, task, event, actor):
    if event in EMPLOYER_EVENTS:
        from accounts.models import UserRole
        if (
            actor is None or actor.pk != task.employer_user_id or
            not actor.is_active or
            not UserRole.objects.filter(user_id=actor.pk, role__code="EMPLOYER").exists()
        ):
            raise PermissionDenied("Only the owning active employer may perform this action.")
    if event in EXECUTOR_EVENTS:
        # Import inside the policy to avoid circular imports (offers -> tasks).
        from offers.models import Bid, BidStatus
        from accounts.models import ExecutorProfile, UserRole
        if (
            actor is None or not actor.is_active or
            not UserRole.objects.filter(user_id=actor.pk, role__code="EXECUTOR").exists() or
            not ExecutorProfile.objects.filter(
                user_id=actor.pk, profile_status="ACTIVE",
                verification_status=ExecutorProfile.VerificationStatus.APPROVED,
            ).exists() or
            not Bid.objects.filter(
                task=task, status=BidStatus.ACCEPTED,
                executor_profile__user_id=actor.pk,
            ).exists()
        ):
            raise PermissionDenied("Only the assigned active executor may perform this action.")
    if event in ("dispute_opened", "cancellation_disputed"):
        from offers.models import Bid, BidStatus
        if actor is not None and (
            not actor.is_active or
            not (actor.pk == task.employer_user_id or
                 Bid.objects.filter(
                     task=task, status=BidStatus.ACCEPTED,
                     executor_profile__user_id=actor.pk,
                 ).exists())
        ):
            raise PermissionDenied("Only a party to this task may open a dispute.")
    if event in FINANCE_EVENTS and actor is not None:
        raise PermissionDenied("Financial transitions are internal ledger operations.")
    if event == "proposal_deadline_elapsed" and actor is not None:
        raise PermissionDenied("Task expiration is a system operation.")


FINANCE_REQUIRED = {
    "funding_confirmed": frozenset((EscrowStatus.HELD,)),
    "funding_failed": frozenset((EscrowStatus.FAILED,)),
    "settlement_confirmed": frozenset((EscrowStatus.RELEASED,)),
    "arbitration_settled": frozenset((EscrowStatus.RELEASED, EscrowStatus.PARTIALLY_SETTLED)),
    "arbitration_refunded": frozenset((EscrowStatus.REFUNDED, EscrowStatus.PARTIALLY_SETTLED)),
    "cancellation_refunded": frozenset((EscrowStatus.REFUNDED, EscrowStatus.PARTIALLY_SETTLED)),
}


def _invalid(task, target, reason):
    raise TaskTransitionConflict(source=task.status, target=target, reason=reason)


def record_initial_task_state(*, task, actor):
    """Create one immutable history record for a newly-created DRAFT."""
    if not transaction.get_connection().in_atomic_block:
        raise RuntimeError("Task creation history requires an atomic transaction.")
    if task.status != TaskStatus.DRAFT:
        _invalid(task, TaskStatus.DRAFT, "Task creation must start in DRAFT.")
    return TaskStatusHistory.objects.create(
        task=task, from_status=None, to_status=TaskStatus.DRAFT,
        changed_by_user=actor, reason="Task draft created",
    )


def transition_task_locked(
    *, task, target, event, actor, reason, metadata=None, financial_event=None,
):
    """Validate and persist a transition on an already locked task row.

    Must be called inside transaction.atomic() on a select_for_update row.
    There is intentionally no public endpoint for arbitrary transitions.
    """
    if not transaction.get_connection().in_atomic_block:
        raise RuntimeError("Task transitions require an atomic transaction.")
    source = task.status
    state_for(source).validate(target)

    expected = EVENT_FOR_TRANSITION.get((source, target))
    if event != expected:
        _invalid(task, target, f"Expected lifecycle event: {expected}.")
    if task.deleted_at is not None:
        _invalid(task, target, "Deleted tasks cannot change lifecycle state.")
    _validate_actor(task=task, event=event, actor=actor)

    now = timezone.now()
    if event == "proposal_deadline_elapsed" and task.proposal_deadline_at > now:
        _invalid(task, target, "The proposal deadline has not elapsed.")
    if event == "bid_selected":
        if task.proposal_deadline_at <= now:
            _invalid(task, target, "The proposal deadline has elapsed.")
        if not metadata or not metadata.get("selected_bid_id"):
            _invalid(task, target, "A selected bid reference is required.")
    if event == "publish" and task.published_at is not None:
        _invalid(task, target, "The task was already published.")

    if financial_event is not None and str(task.pk) != financial_event.task_reference:
        _invalid(task, target, "Financial proof belongs to a different task.")
    allowed_financial_states = FINANCE_REQUIRED.get(event)
    if allowed_financial_states is not None:
        if (
            not isinstance(financial_event, VerifiedFinancialEvent)
            or financial_event.state not in allowed_financial_states
        ):
            _invalid(task, target, "Verified finance/ledger confirmation is required.")
    if event in ("dispute_opened", "cancellation_disputed"):
        if not metadata or not metadata.get("dispute_reference"):
            _invalid(task, target, "A real dispute case reference is required.")
    if event in ("arbitration_settled", "arbitration_refunded"):
        if not metadata or not metadata.get("decision_reference"):
            _invalid(task, target, "A recorded arbitration decision is required.")
    if event == "delivery_submitted" and (not metadata or not metadata.get("evidence_reference")):
        _invalid(task, target, "Delivery evidence must be recorded.")

    task.status = target
    task.version += 1
    changed = ["status", "version", "updated_at"]
    if target == TaskStatus.OPEN and source == TaskStatus.DRAFT:
        task.published_at = now
        changed.append("published_at")
    task.save(update_fields=changed)

    history_metadata = dict(metadata or {})
    history_metadata["event"] = event
    if financial_event is not None:
        history_metadata["finance"] = {
            "escrow_reference": financial_event.escrow_reference,
            "operation_reference": financial_event.operation_reference,
            "idempotency_key": financial_event.idempotency_key,
            "escrow_state": financial_event.state.value,
        }
    TaskStatusHistory.objects.create(
        task=task, from_status=source, to_status=target,
        changed_by_user=actor, reason=reason,
        metadata=history_metadata,
    )
    return task


@transaction.atomic
def transition_task(*, task_id, target, event, actor=None, reason, metadata=None, financial_event=None):
    """Standalone API for internal services: lock first, then transition."""
    task = Task.objects.select_for_update().get(task_id=task_id)
    return transition_task_locked(
        task=task, target=target, event=event, actor=actor,
        reason=reason, metadata=metadata, financial_event=financial_event,
    )
