import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q

from tasks.fields import CurrencyCodeField

from .lifecycle import EscrowStatus


ESCROW_STATUS_CHOICES = tuple(
    (status.value, status.value.replace("_", " ").title())
    for status in EscrowStatus
)


class Wallet(models.Model):
    wallet_id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="wallet",
    )
    currency_code = CurrencyCodeField(default="IRR")
    available_balance = models.BigIntegerField(default=0)
    reserved_balance = models.BigIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "wallets"
        constraints = [
            models.CheckConstraint(
                condition=Q(available_balance__gte=0),
                name="ck_wallet_avail_nonneg",
            ),
            models.CheckConstraint(
                condition=Q(reserved_balance__gte=0),
                name="ck_wallet_reserved_nonneg",
            ),
        ]

    @property
    def total_balance(self):
        return self.available_balance + self.reserved_balance

    def __str__(self):
        return f"Wallet {self.wallet_id} ({self.user_id})"


class EscrowReservation(models.Model):
    reservation_id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )
    task = models.ForeignKey(
        "tasks.Task",
        on_delete=models.PROTECT,
        related_name="escrow_reservations",
    )
    bid = models.ForeignKey(
        "offers.Bid",
        on_delete=models.PROTECT,
        related_name="escrow_reservations",
    )
    wallet = models.ForeignKey(
        Wallet,
        on_delete=models.PROTECT,
        related_name="escrow_reservations",
    )
    amount = models.BigIntegerField()
    currency_code = CurrencyCodeField(default="IRR")
    status = models.CharField(
        max_length=24,
        choices=ESCROW_STATUS_CHOICES,
        default=EscrowStatus.INITIATED.value,
    )
    idempotency_key = models.CharField(max_length=128)
    operation_reference = models.UUIDField(
        default=uuid.uuid4,
        unique=True,
        editable=False,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    held_at = models.DateTimeField(null=True, blank=True)
    released_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "escrow_reservations"
        ordering = ["-created_at"]
        constraints = [
            models.CheckConstraint(
                condition=Q(amount__gt=0),
                name="ck_escrow_amount_positive",
            ),
            models.CheckConstraint(
                condition=Q(status__in=[value for value, _label in ESCROW_STATUS_CHOICES]),
                name="ck_escrow_status_valid",
            ),
            models.UniqueConstraint(
                fields=["task"],
                condition=Q(
                    status__in=[
                        EscrowStatus.INITIATED.value,
                        EscrowStatus.HELD.value,
                    ]
                ),
                name="uq_escrow_active_task",
            ),
            models.UniqueConstraint(
                fields=["wallet", "idempotency_key"],
                name="uq_escrow_wallet_idem",
            ),
        ]

    def clean(self):
        super().clean()
        errors = {}

        if self.task_id and self.bid_id and self.bid.task_id != self.task_id:
            errors["bid"] = "The selected bid must belong to this task."

        if self.task_id and self.wallet_id:
            task = self.task
            wallet = self.wallet
            if wallet.user_id != task.employer_user_id:
                errors["wallet"] = "The wallet must belong to the task employer."
            if self.currency_code != task.currency_code:
                errors["currency_code"] = "The reservation currency must match the task currency."
            if self.currency_code != wallet.currency_code:
                errors["currency_code"] = "The reservation currency must match the wallet currency."

        if errors:
            raise ValidationError(errors)

    def __str__(self):
        return f"Escrow {self.reservation_id} - {self.status}"


class WalletTransactionType(models.TextChoices):
    DEPOSIT = "DEPOSIT", "Deposit"
    ESCROW_RESERVATION = "ESCROW_RESERVATION", "Escrow reservation"
    ESCROW_RELEASE = "ESCROW_RELEASE", "Escrow release"
    ESCROW_REFUND = "ESCROW_REFUND", "Escrow refund"
    WITHDRAWAL = "WITHDRAWAL", "Withdrawal"
    WITHDRAWAL_FEE = "WITHDRAWAL_FEE", "Withdrawal fee"


class WalletTransactionDirection(models.TextChoices):
    CREDIT = "CREDIT", "Credit"
    DEBIT = "DEBIT", "Debit"


class WalletTransactionQuerySet(models.QuerySet):
    """Prevent bulk mutation/deletion of posted financial ledger entries."""

    def update(self, **kwargs):
        raise ValidationError("Posted wallet transactions are immutable.")

    def delete(self):
        raise ValidationError("Posted wallet transactions cannot be deleted.")

    def bulk_update(self, objs, fields, batch_size=None):
        raise ValidationError("Posted wallet transactions are immutable.")


class WalletTransaction(models.Model):
    """Append-only record of a completed wallet balance movement.

    Pending external payment attempts will be stored separately from this
    ledger. A WalletTransaction is created only when a financial movement is
    confirmed and posted to the wallet.
    """

    transaction_id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )
    wallet = models.ForeignKey(
        Wallet,
        on_delete=models.PROTECT,
        related_name="transactions",
    )
    task = models.ForeignKey(
        "tasks.Task",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="wallet_transactions",
    )
    escrow_reservation = models.ForeignKey(
        EscrowReservation,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="ledger_entries",
    )
    transaction_type = models.CharField(
        max_length=24,
        choices=WalletTransactionType.choices,
    )
    direction = models.CharField(
        max_length=8,
        choices=WalletTransactionDirection.choices,
    )
    amount = models.BigIntegerField()
    currency_code = CurrencyCodeField(default="IRR")
    idempotency_key = models.CharField(max_length=128)
    operation_reference = models.UUIDField(
        default=uuid.uuid4,
        unique=True,
        editable=False,
    )
    description = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    objects = WalletTransactionQuerySet.as_manager()

    class Meta:
        db_table = "wallet_transactions"
        ordering = ["-created_at", "-transaction_id"]
        constraints = [
            models.CheckConstraint(
                condition=Q(amount__gt=0),
                name="ck_wallet_tx_amount_pos",
            ),
            models.CheckConstraint(
                condition=Q(transaction_type__in=WalletTransactionType.values),
                name="ck_wallet_tx_type_valid",
            ),
            models.CheckConstraint(
                condition=Q(direction__in=WalletTransactionDirection.values),
                name="ck_wallet_tx_direction_valid",
            ),
            models.UniqueConstraint(
                fields=["wallet", "transaction_type", "idempotency_key"],
                name="uq_wallet_tx_idem",
            ),
        ]

    def clean(self):
        super().clean()
        errors = {}
        escrow_types = {
            WalletTransactionType.ESCROW_RESERVATION,
            WalletTransactionType.ESCROW_RELEASE,
            WalletTransactionType.ESCROW_REFUND,
        }

        if self.wallet_id and self.currency_code != self.wallet.currency_code:
            errors["currency_code"] = "The transaction currency must match the wallet currency."

        if self.transaction_type in escrow_types:
            if not self.escrow_reservation_id:
                errors["escrow_reservation"] = "Escrow transactions require a reservation reference."
            if not self.task_id:
                errors["task"] = "Escrow transactions require a task reference."

        if self.escrow_reservation_id:
            reservation = self.escrow_reservation
            if reservation.wallet_id != self.wallet_id:
                errors["wallet"] = "The transaction wallet must match the escrow wallet."
            if self.task_id != reservation.task_id:
                errors["task"] = "The transaction task must match the escrow task."
            if self.currency_code != reservation.currency_code:
                errors["currency_code"] = "The transaction currency must match the escrow currency."

        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        if not self._state.adding:
            raise ValidationError("Posted wallet transactions are immutable.")
        return super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValidationError("Posted wallet transactions cannot be deleted.")

    def __str__(self):
        return f"{self.transaction_type} {self.amount} {self.currency_code}"


class IdempotencyStatus(models.TextChoices):
    PROCESSING = "PROCESSING", "Processing"
    COMPLETED = "COMPLETED", "Completed"
    FAILED = "FAILED", "Failed"


class IdempotencyRecord(models.Model):
    idempotency_record_id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="idempotency_records",
    )
    operation_type = models.CharField(max_length=48)
    idempotency_key = models.CharField(max_length=128)
    request_hash = models.CharField(max_length=64)
    status = models.CharField(
        max_length=12,
        choices=IdempotencyStatus.choices,
        default=IdempotencyStatus.PROCESSING,
    )
    response_status = models.PositiveSmallIntegerField(null=True, blank=True)
    response_body = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "idempotency_records"
        constraints = [
            models.UniqueConstraint(
                fields=["user", "operation_type", "idempotency_key"],
                name="uq_idem_user_operation_key",
            ),
            models.CheckConstraint(
                condition=Q(status__in=IdempotencyStatus.values),
                name="ck_idem_status_valid",
            ),
            models.CheckConstraint(
                condition=(
                    Q(status=IdempotencyStatus.PROCESSING)
                    | Q(completed_at__isnull=False, response_status__isnull=False)
                ),
                name="ck_idem_completed_fields",
            ),
        ]
        indexes = [
            models.Index(
                fields=["user", "operation_type", "created_at"],
                name="ix_idem_user_operation",
            ),
        ]

    def __str__(self):
        return f"{self.operation_type}:{self.idempotency_key} ({self.status})"
