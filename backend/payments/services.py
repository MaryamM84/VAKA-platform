"""Transactional wallet, escrow reservation and deposit application services."""

import hashlib
import json
import os
from urllib.parse import urlsplit

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.db import IntegrityError, transaction
from django.utils import timezone
from django.utils.module_loading import import_string
from rest_framework.exceptions import APIException, PermissionDenied

from offers.models import BidStatus

from .fees import calculate_platform_fee_amount, get_platform_fee_rate_bps
from .lifecycle import (
    EscrowSnapshot,
    EscrowStatus,
    VerifiedFinancialEvent,
)
from .models import (
    EscrowReservation,
    FeePayer,
    IdempotencyRecord,
    IdempotencyStatus,
    Wallet,
    WalletDeposit,
    WalletDepositStatus,
    WalletTransaction,
    WalletTransactionDirection,
    WalletTransactionType,
)


class WalletOperationConflict(APIException):
    status_code = 409
    default_detail = "The wallet operation conflicts with the current state."
    default_code = "WALLET_OPERATION_CONFLICT"


class InsufficientBalance(WalletOperationConflict):
    default_detail = "Insufficient wallet balance."
    default_code = "INSUFFICIENT_BALANCE"


class PaymentGatewayUnavailable(APIException):
    status_code = 503
    default_detail = "The payment gateway is not configured or is unavailable."
    default_code = "PAYMENT_GATEWAY_UNAVAILABLE"


def get_or_create_wallet(*, user):
    """Return the user's wallet, creating an empty IRR wallet if necessary."""
    wallet, _created = Wallet.objects.get_or_create(
        user=user,
        defaults={"currency_code": "IRR"},
    )
    return wallet


def _financial_event_for_reservation(reservation):
    return VerifiedFinancialEvent(
        state=EscrowStatus.HELD,
        escrow_reference=str(reservation.reservation_id),
        operation_reference=str(reservation.operation_reference),
        idempotency_key=reservation.idempotency_key,
        task_reference=str(reservation.task_id),
        bid_reference=str(reservation.bid_id),
    )


def _bid_reservation_request_hash(*, employer, task, bid):
    payload = {
        "employer_id": str(employer.pk),
        "task_id": str(task.pk),
        "bid_id": str(bid.pk),
        # Bind idempotency to the economic terms, not only the object IDs.
        # If an ACTIVE bid or task cost cap changes, the same key must not
        # silently replay a reservation for the previous amount.
        "labor_amount": int(bid.proposed_wage_amount),
        "expense_amount": int(task.item_cost_cap_amount or 0),
        "currency_code": str(task.currency_code),
        "operation": "BID_ESCROW_RESERVATION",
    }
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _replay_reservation(*, record, request_hash, task, bid):
    if record.request_hash != request_hash:
        raise WalletOperationConflict(
            "This Idempotency-Key has already been used for a different request."
        )
    if record.status != IdempotencyStatus.COMPLETED:
        raise WalletOperationConflict("The previous operation is still processing.")

    reservation_id = (record.response_body or {}).get("reservation_id")
    reservation = EscrowReservation.objects.filter(
        reservation_id=reservation_id,
        task=task,
        bid=bid,
        status=EscrowStatus.HELD.value,
    ).first()
    if reservation is None:
        raise WalletOperationConflict(
            "The original escrow reservation is no longer in HELD state."
        )

    expected_operation = (record.response_body or {}).get("operation_reference")
    ledger_exists = WalletTransaction.objects.filter(
        wallet=reservation.wallet,
        task=reservation.task,
        escrow_reservation=reservation,
        transaction_type=WalletTransactionType.ESCROW_RESERVATION,
        direction=WalletTransactionDirection.DEBIT,
        amount=reservation.amount,
        available_balance_delta=-reservation.amount,
        reserved_balance_delta=reservation.amount,
        currency_code=reservation.currency_code,
        idempotency_key=reservation.idempotency_key,
        operation_reference=reservation.operation_reference,
    ).count() == 1
    if expected_operation != str(reservation.operation_reference) or not ledger_exists:
        raise WalletOperationConflict(
            "The original reservation does not have a matching authoritative ledger entry."
        )
    return reservation, _financial_event_for_reservation(reservation)


@transaction.atomic
def reserve_funds_for_bid(*, employer, task, bid, idempotency_key):
    """Move the employer's available funds into escrow for one selected bid.

    The caller is responsible for locking and validating Task/Bid assignment
    state. This service locks the Wallet, writes the Escrow and append-only
    ledger entry, and records the idempotent result in the caller's transaction.

    Employer reservation = bid labor + task item-cost cap.
    VAKA fee = 10% of labor by default, paid by the worker at later settlement;
    it is snapshotted here and is not added to the employer's reservation.
    """
    if not employer or not getattr(employer, "is_authenticated", False):
        raise PermissionDenied("Authentication is required.")
    if task.employer_user_id != employer.pk:
        raise PermissionDenied("Only the task employer can reserve its funds.")
    if bid.task_id != task.pk:
        raise WalletOperationConflict("The selected bid does not belong to this task.")
    if not isinstance(idempotency_key, str) or not idempotency_key.strip() or len(idempotency_key) > 128:
        raise WalletOperationConflict("A valid Idempotency-Key is required.")
    idempotency_key = idempotency_key.strip()

    request_hash = _bid_reservation_request_hash(
        employer=employer,
        task=task,
        bid=bid,
    )
    operation_type = "BID_ESCROW_RESERVATION"

    try:
        with transaction.atomic():
            idempotency_record = IdempotencyRecord.objects.create(
                user=employer,
                operation_type=operation_type,
                idempotency_key=idempotency_key,
                request_hash=request_hash,
            )
    except IntegrityError:
        existing = (
            IdempotencyRecord.objects.select_for_update()
            .filter(
                user=employer,
                operation_type=operation_type,
                idempotency_key=idempotency_key,
            )
            .first()
        )
        if existing is None:
            raise
        return _replay_reservation(
            record=existing,
            request_hash=request_hash,
            task=task,
            bid=bid,
        )

    if bid.status != BidStatus.ACTIVE:
        raise WalletOperationConflict("Only an ACTIVE bid can be funded.")

    labor_amount = bid.proposed_wage_amount
    expense_amount = task.item_cost_cap_amount or 0
    reservation_amount = labor_amount + expense_amount
    if reservation_amount <= 0:
        raise WalletOperationConflict("A positive reservation amount is required.")

    fee_rate_bps = get_platform_fee_rate_bps()
    fee_amount = calculate_platform_fee_amount(labor_amount, fee_rate_bps)

    wallet = get_or_create_wallet(user=employer)
    wallet = Wallet.objects.select_for_update().get(pk=wallet.pk)

    if wallet.currency_code != task.currency_code:
        raise WalletOperationConflict(
            "The wallet currency does not match the task currency."
        )
    if wallet.available_balance < reservation_amount:
        raise InsufficientBalance()

    reservation = EscrowReservation(
        task=task,
        bid=bid,
        wallet=wallet,
        labor_amount=labor_amount,
        expense_amount=expense_amount,
        amount=reservation_amount,
        currency_code=task.currency_code,
        platform_fee_rate_bps=fee_rate_bps,
        platform_fee_amount=fee_amount,
        fee_payer=FeePayer.WORKER,
        status=EscrowStatus.INITIATED.value,
        idempotency_key=idempotency_key,
    )
    reservation.full_clean()
    reservation.save(force_insert=True)

    wallet.available_balance -= reservation_amount
    wallet.reserved_balance += reservation_amount
    wallet.save(update_fields=["available_balance", "reserved_balance", "updated_at"])

    # Validate the independent Escrow lifecycle transition before persisting HELD.
    EscrowSnapshot(EscrowStatus.INITIATED).transition(EscrowStatus.HELD)
    reservation.status = EscrowStatus.HELD.value
    reservation.held_at = timezone.now()
    reservation.save(update_fields=["status", "held_at"])

    ledger_entry = WalletTransaction(
        wallet=wallet,
        task=task,
        escrow_reservation=reservation,
        transaction_type=WalletTransactionType.ESCROW_RESERVATION,
        direction=WalletTransactionDirection.DEBIT,
        amount=reservation_amount,
        available_balance_delta=-reservation_amount,
        reserved_balance_delta=reservation_amount,
        currency_code=task.currency_code,
        idempotency_key=idempotency_key,
        operation_reference=reservation.operation_reference,
        description="Funds reserved in VAKA escrow for the selected task bid.",
    )
    ledger_entry.full_clean()
    ledger_entry.save(force_insert=True)

    idempotency_record.status = IdempotencyStatus.COMPLETED
    idempotency_record.response_status = 200
    idempotency_record.response_body = {
        "reservation_id": str(reservation.reservation_id),
        "operation_reference": str(reservation.operation_reference),
    }
    idempotency_record.completed_at = timezone.now()
    idempotency_record.save(
        update_fields=["status", "response_status", "response_body", "completed_at"]
    )

    return reservation, _financial_event_for_reservation(reservation)


def get_payment_gateway():
    """Load the configured provider adapter; no fake/live URL is ever invented.

    The configured adapter must expose ``create_payment_link`` and accept
    amount, currency_code, deposit_id and idempotency_key keyword arguments.
    It must return provider, provider_reference, payment_url and optional
    expires_at fields.
    """
    adapter_path = getattr(
        settings,
        "WALLET_PAYMENT_GATEWAY_ADAPTER",
        os.getenv("WALLET_PAYMENT_GATEWAY_ADAPTER", ""),
    )
    if not adapter_path:
        raise PaymentGatewayUnavailable(
            "No wallet payment gateway adapter is configured."
        )
    try:
        adapter_factory = import_string(adapter_path)
        return adapter_factory() if isinstance(adapter_factory, type) else adapter_factory
    except (ImportError, AttributeError, ImproperlyConfigured) as exc:
        raise PaymentGatewayUnavailable() from exc


def _deposit_request_hash(*, amount, currency_code):
    payload = {"amount": amount, "currency_code": currency_code}
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _validate_gateway_result(result):
    if not isinstance(result, dict):
        raise PaymentGatewayUnavailable("The payment provider returned an invalid response.")

    provider = result.get("provider")
    provider_reference = result.get("provider_reference")
    payment_url = result.get("payment_url")
    expires_at = result.get("expires_at")

    parsed_url = urlsplit(payment_url or "")
    from datetime import datetime

    if expires_at is not None and not isinstance(expires_at, datetime):
        raise PaymentGatewayUnavailable("The payment provider returned an invalid expiry timestamp.")
    if (
        not isinstance(provider, str)
        or not provider.strip()
        or len(provider) > 48
        or not isinstance(provider_reference, str)
        or not provider_reference.strip()
        or len(provider_reference) > 128
        or parsed_url.scheme != "https"
        or not parsed_url.netloc
    ):
        raise PaymentGatewayUnavailable("The payment provider returned incomplete payment details.")
    return provider, provider_reference, payment_url, expires_at


def initiate_wallet_deposit(*, user, amount, idempotency_key):
    """Create a provider payment link without crediting the wallet prematurely."""
    if not isinstance(amount, int) or isinstance(amount, bool) or amount <= 0:
        raise WalletOperationConflict("Deposit amount must be a positive integer.")
    if not isinstance(idempotency_key, str) or not idempotency_key.strip() or len(idempotency_key) > 128:
        raise WalletOperationConflict("A valid Idempotency-Key is required.")
    idempotency_key = idempotency_key.strip()

    # Fail closed before creating a pending deposit when no provider exists.
    gateway = get_payment_gateway()
    wallet = get_or_create_wallet(user=user)
    request_hash = _deposit_request_hash(
        amount=amount,
        currency_code=wallet.currency_code,
    )

    created = False
    with transaction.atomic():
        wallet = Wallet.objects.select_for_update().get(pk=wallet.pk)
        try:
            with transaction.atomic():
                deposit = WalletDeposit.objects.create(
                    wallet=wallet,
                    amount=amount,
                    currency_code=wallet.currency_code,
                    status=WalletDepositStatus.PROCESSING,
                    idempotency_key=idempotency_key,
                    request_hash=request_hash,
                )
            created = True
        except IntegrityError:
            deposit = (
                WalletDeposit.objects.select_for_update()
                .filter(wallet=wallet, idempotency_key=idempotency_key)
                .first()
            )
            if deposit is None:
                raise
            if deposit.request_hash != request_hash:
                raise WalletOperationConflict(
                    "This Idempotency-Key has already been used for a different deposit."
                )
            if deposit.status in {WalletDepositStatus.PENDING, WalletDepositStatus.SUCCEEDED}:
                return deposit, False
            if deposit.status in {WalletDepositStatus.FAILED, WalletDepositStatus.CANCELLED}:
                raise WalletOperationConflict(
                    "The previous deposit attempt failed or was cancelled; use a new Idempotency-Key."
                )
            # PROCESSING can be retried with the same provider idempotency key.

    try:
        result = gateway.create_payment_link(
            amount=deposit.amount,
            currency_code=deposit.currency_code,
            deposit_id=str(deposit.deposit_id),
            idempotency_key=idempotency_key,
        )
        provider, provider_reference, payment_url, expires_at = _validate_gateway_result(result)
    except Exception as exc:
        with transaction.atomic():
            locked_deposit = WalletDeposit.objects.select_for_update().get(pk=deposit.pk)
            if locked_deposit.status == WalletDepositStatus.PROCESSING:
                locked_deposit.status = WalletDepositStatus.FAILED
                locked_deposit.save(update_fields=["status", "updated_at"])
        if isinstance(exc, PaymentGatewayUnavailable):
            raise
        raise PaymentGatewayUnavailable() from exc

    with transaction.atomic():
        locked_deposit = WalletDeposit.objects.select_for_update().get(pk=deposit.pk)
        if locked_deposit.status == WalletDepositStatus.PROCESSING:
            locked_deposit.provider = provider
            locked_deposit.provider_reference = provider_reference
            locked_deposit.payment_url = payment_url
            locked_deposit.expires_at = expires_at
            locked_deposit.status = WalletDepositStatus.PENDING
            locked_deposit.save(
                update_fields=[
                    "provider",
                    "provider_reference",
                    "payment_url",
                    "expires_at",
                    "status",
                    "updated_at",
                ]
            )
        deposit = locked_deposit

    return deposit, created
