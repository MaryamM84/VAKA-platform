"""Transactional receipt submission and employer-approved wallet reimbursement.

This service moves VAKA *internal wallet credit*, not bank money. No gateway or
payout is triggered. Employer funds were already reserved when accepting a bid.
"""

from django.db import transaction
from django.db.models import Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError

from execution.workspace_services import approved_executor_profile
from offers.models import Bid, BidStatus
from tasks.choices import TaskStatus
from tasks.models import Task

from .expense_models import ExpenseClaim, ExpenseClaimStatus, ExpenseReceipt
from .expense_receipts import MAX_RECEIPTS, new_receipt_key, private_receipt_storage
from .hold_gateway import read_verified_held_reservation
from .lifecycle import EscrowStatus
from .models import (
    EscrowReservation, Wallet, WalletTransaction, WalletTransactionDirection,
    WalletTransactionType,
)
from .services import WalletOperationConflict, get_or_create_wallet


CLAIMABLE_TASK_STATES = frozenset({TaskStatus.ASSIGNED, TaskStatus.IN_PROGRESS})
REVIEWABLE_TASK_STATES = frozenset({
    TaskStatus.ASSIGNED, TaskStatus.IN_PROGRESS, TaskStatus.SUBMITTED,
})
MAX_WALLET_BALANCE = 2**63 - 1


def is_claim_party(*, task, actor):
    if task.employer_user_id == actor.pk:
        return True
    return Bid.objects.filter(
        task=task, status=BidStatus.ACCEPTED,
        executor_profile__user_id=actor.pk,
    ).exists()


def visible_claims(*, task_id, actor):
    task = get_object_or_404(Task, pk=task_id, deleted_at__isnull=True)
    if not is_claim_party(task=task, actor=actor):
        raise NotFound("Task not found.")
    return task, ExpenseClaim.objects.filter(task=task).prefetch_related("receipts")


def _locked_task(task_id):
    try:
        return Task.objects.select_for_update().get(pk=task_id, deleted_at__isnull=True)
    except Task.DoesNotExist:
        raise NotFound("Task not found.") from None


def _verified_reservation(*, task, bid):
    reservation = EscrowReservation.objects.select_for_update().filter(
        task=task, bid=bid, status=EscrowStatus.HELD.value,
    ).first()
    if reservation is not None and reservation.currency_code != "IRR":
        raise WalletOperationConflict("Expense claims currently support IRR only.")
    if reservation is None or read_verified_held_reservation(
        task_id=task.pk, bid_id=bid.pk,
    ) is None:
        raise WalletOperationConflict("No verified funded escrow is available for this task.")
    return reservation


def _claimed_amount(*, reservation, statuses):
    return ExpenseClaim.objects.filter(
        escrow_reservation=reservation, status__in=statuses,
    ).aggregate(value=Sum("amount_irr"))["value"] or 0


def _ensure_claim_budget(*, reservation, new_amount, include_pending):
    statuses = (
        [ExpenseClaimStatus.PENDING, ExpenseClaimStatus.APPROVED]
        if include_pending else [ExpenseClaimStatus.APPROVED]
    )
    committed = _claimed_amount(reservation=reservation, statuses=statuses)
    if new_amount <= 0 or committed + new_amount > reservation.expense_amount:
        raise WalletOperationConflict("The request exceeds the task's remaining purchase budget.")


def submit_expense_claim(*, task_id, actor, amount_irr, description, receipts):
    """Persist a claim and its private files. No money moves on submission."""
    profile = approved_executor_profile(user=actor)
    if not 1 <= len(receipts) <= MAX_RECEIPTS:
        raise ValidationError({"receipts": "Between one and three receipt images are required."})
    storage = private_receipt_storage()
    saved_keys = []
    try:
        with transaction.atomic():
            task = _locked_task(task_id)
            if task.status not in CLAIMABLE_TASK_STATES:
                raise WalletOperationConflict("Receipt claims require an assigned or in-progress task.")
            bid = Bid.objects.filter(
                task=task, executor_profile=profile, status=BidStatus.ACCEPTED,
            ).first()
            if bid is None:
                raise NotFound("Assigned task not found.")
            if task.employer_user_id == actor.pk:
                raise PermissionDenied("An employer cannot reimburse their own purchase.")
            reservation = _verified_reservation(task=task, bid=bid)
            _ensure_claim_budget(
                reservation=reservation, new_amount=amount_irr, include_pending=True,
            )
            claim = ExpenseClaim.objects.create(
                task=task, escrow_reservation=reservation,
                executor_profile=profile, amount_irr=amount_irr,
                description=description, currency_code=reservation.currency_code,
            )
            for upload, mime_type, extension in receipts:
                key = storage.save(new_receipt_key(
                    task_id=task.pk, claim_id=claim.pk, extension=extension,
                ), upload)
                saved_keys.append(key)
                ExpenseReceipt.objects.create(
                    claim=claim, storage_key=key, mime_type=mime_type,
                    size_bytes=upload.size,
                )
            return claim
    except Exception:
        # File storage is not transactional. Remove images on DB failures.
        for key in saved_keys:
            try:
                storage.delete(key)
            except OSError:
                pass
        raise


@transaction.atomic
def approve_expense_claim(*, task_id, claim_id, actor):
    task = _locked_task(task_id)
    if task.employer_user_id != actor.pk:
        raise PermissionDenied("Only the task employer can approve receipts.")
    claim = get_object_or_404(
        ExpenseClaim.objects.select_for_update().select_related("executor_profile"),
        pk=claim_id, task=task,
    )
    if claim.status == ExpenseClaimStatus.APPROVED:
        # Repeated POST returns the original result; it never posts money again.
        if not claim.employer_debit_id or not claim.worker_credit_id:
            raise WalletOperationConflict("Approved claim has no matching ledger references.")
        return claim
    if claim.status != ExpenseClaimStatus.PENDING:
        raise WalletOperationConflict("Only pending claims may be approved.")
    if task.status not in REVIEWABLE_TASK_STATES:
        raise WalletOperationConflict("The task is not eligible for expense approval.")
    bid = Bid.objects.filter(
        task=task, executor_profile=claim.executor_profile,
        status=BidStatus.ACCEPTED,
    ).first()
    if bid is None or claim.executor_profile.user_id == actor.pk:
        raise WalletOperationConflict("The assigned worker has changed or is invalid.")
    reservation = _verified_reservation(task=task, bid=bid)
    if claim.escrow_reservation_id != reservation.pk or claim.currency_code != reservation.currency_code:
        raise WalletOperationConflict("Claim and escrow reservation do not match.")
    _ensure_claim_budget(reservation=reservation, new_amount=claim.amount_irr, include_pending=False)
    if not claim.receipts.exists():
        raise WalletOperationConflict("A receipt is required before approval.")

    # Create the worker wallet if needed, then lock both balances in a stable
    # order. Locks serialize concurrent claims and protect against lost updates.
    worker_wallet = get_or_create_wallet(user=claim.executor_profile.user)
    wallets = {
        item.pk: item for item in Wallet.objects.select_for_update()
        .filter(pk__in=[reservation.wallet_id, worker_wallet.pk])
        .order_by("wallet_id")
    }
    employer_wallet = wallets[reservation.wallet_id]
    worker_wallet = wallets[worker_wallet.pk]
    amount = claim.amount_irr
    if employer_wallet.currency_code != reservation.currency_code or worker_wallet.currency_code != reservation.currency_code:
        raise WalletOperationConflict("Wallet currencies do not match the claim.")
    if employer_wallet.reserved_balance < amount:
        raise WalletOperationConflict("The employer's reserved balance is insufficient.")
    if worker_wallet.available_balance > MAX_WALLET_BALANCE - amount:
        raise WalletOperationConflict("The worker wallet cannot accept this amount.")

    key = f"expense-claim:{claim.pk}"
    debit = WalletTransaction(
        wallet=employer_wallet, task=task, escrow_reservation=reservation,
        transaction_type=WalletTransactionType.EXPENSE_REIMBURSEMENT,
        direction=WalletTransactionDirection.DEBIT, amount=amount,
        available_balance_delta=0, reserved_balance_delta=-amount,
        currency_code=reservation.currency_code, idempotency_key=key,
        description=f"Employer-approved expense claim {claim.pk}",
    )
    credit = WalletTransaction(
        wallet=worker_wallet, task=task,
        transaction_type=WalletTransactionType.EXPENSE_REIMBURSEMENT,
        direction=WalletTransactionDirection.CREDIT, amount=amount,
        available_balance_delta=amount, reserved_balance_delta=0,
        currency_code=reservation.currency_code, idempotency_key=key,
        description=f"Expense reimbursement for claim {claim.pk}",
    )
    debit.full_clean()
    credit.full_clean()
    debit.save(force_insert=True)
    credit.save(force_insert=True)
    employer_wallet.reserved_balance -= amount
    worker_wallet.available_balance += amount
    employer_wallet.save(update_fields=["reserved_balance", "updated_at"])
    worker_wallet.save(update_fields=["available_balance", "updated_at"])
    claim.status = ExpenseClaimStatus.APPROVED
    claim.employer_debit = debit
    claim.worker_credit = credit
    claim.reviewed_by_user = actor
    claim.reviewed_at = timezone.now()
    claim.save(update_fields=[
        "status", "employer_debit", "worker_credit", "reviewed_by_user", "reviewed_at",
    ])
    return claim


@transaction.atomic
def reject_expense_claim(*, task_id, claim_id, actor, reason):
    task = _locked_task(task_id)
    if task.employer_user_id != actor.pk:
        raise PermissionDenied("Only the task employer can reject receipts.")
    claim = get_object_or_404(
        ExpenseClaim.objects.select_for_update(), pk=claim_id, task=task,
    )
    if claim.status == ExpenseClaimStatus.REJECTED and claim.rejection_reason == reason:
        return claim
    if claim.status != ExpenseClaimStatus.PENDING:
        raise WalletOperationConflict("Only pending claims can be rejected.")
    if task.status not in REVIEWABLE_TASK_STATES:
        raise WalletOperationConflict("The task is not eligible for expense review.")
    claim.status = ExpenseClaimStatus.REJECTED
    claim.reviewed_at = timezone.now()
    claim.reviewed_by_user = actor
    claim.rejection_reason = reason
    claim.save(update_fields=[
        "status", "reviewed_at", "reviewed_by_user", "rejection_reason",
    ])
    return claim
