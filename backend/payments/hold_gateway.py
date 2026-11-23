"""Read-only boundary for authoritative, persisted Escrow holds."""

from dataclasses import dataclass

from offers.models import BidStatus

from .fees import calculate_platform_fee_amount
from .lifecycle import EscrowStatus
from .models import (
    EscrowReservation,
    FeePayer,
    IdempotencyRecord,
    IdempotencyStatus,
    WalletTransaction,
    WalletTransactionDirection,
    WalletTransactionType,
)


@dataclass(frozen=True)
class VerifiedHeldReservation:
    """Snapshot returned only after checking the persisted reservation + ledger."""

    task_reference: str
    bid_reference: str
    escrow_reference: str
    operation_reference: str
    state: EscrowStatus


def read_verified_held_reservation(*, task_id, bid_id):
    """Return the current verified HELD reservation, otherwise fail closed."""
    reservation = (
        EscrowReservation.objects.select_related("task", "bid", "wallet")
        .filter(
            task_id=task_id,
            bid_id=bid_id,
            status=EscrowStatus.HELD.value,
        )
        .order_by("-created_at", "-reservation_id")
        .first()
    )
    if reservation is None:
        return None

    if (
        reservation.bid.task_id != reservation.task_id
        or reservation.wallet.user_id != reservation.task.employer_user_id
        or reservation.currency_code != reservation.task.currency_code
        or reservation.currency_code != reservation.wallet.currency_code
        or reservation.amount != reservation.labor_amount + reservation.expense_amount
        or reservation.expense_amount != (reservation.task.item_cost_cap_amount or 0)
        or reservation.fee_payer != FeePayer.WORKER
        or reservation.bid.status != BidStatus.ACCEPTED
        or reservation.wallet.reserved_balance < reservation.amount
        or reservation.platform_fee_amount != calculate_platform_fee_amount(
            reservation.labor_amount, reservation.platform_fee_rate_bps
        )
    ):
        return None

    idempotency_record_exists = IdempotencyRecord.objects.filter(
        user_id=reservation.wallet.user_id,
        operation_type="BID_ESCROW_RESERVATION",
        idempotency_key=reservation.idempotency_key,
        status=IdempotencyStatus.COMPLETED,
        response_body__reservation_id=str(reservation.reservation_id),
        response_body__operation_reference=str(reservation.operation_reference),
    ).exists()
    if not idempotency_record_exists:
        return None

    ledger_entries = WalletTransaction.objects.filter(
        wallet=reservation.wallet,
        task_id=reservation.task_id,
        escrow_reservation=reservation,
        transaction_type=WalletTransactionType.ESCROW_RESERVATION,
        direction=WalletTransactionDirection.DEBIT,
        amount=reservation.amount,
        available_balance_delta=-reservation.amount,
        reserved_balance_delta=reservation.amount,
        currency_code=reservation.currency_code,
        idempotency_key=reservation.idempotency_key,
        operation_reference=reservation.operation_reference,
    )
    if ledger_entries.count() != 1:
        return None

    return VerifiedHeldReservation(
        task_reference=str(reservation.task_id),
        bid_reference=str(reservation.bid_id),
        escrow_reference=str(reservation.reservation_id),
        operation_reference=str(reservation.operation_reference),
        state=EscrowStatus.HELD,
    )
