import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import connection, models
from django.db.models import F, Q

from tasks.fields import CurrencyCodeField

from .fees import calculate_platform_fee_amount
from .lifecycle import EscrowStatus


ESCROW_STATUS_CHOICES = tuple(
    (status.value, status.value.replace("_", " ").title())
    for status in EscrowStatus
)


def generate_escrow_public_reference():
    """Allocate a short, globally unique, human-readable escrow reference.

    PostgreSQL sequences are concurrency-safe and are not rolled back, so two
    simultaneous reservations can never receive the same public reference.
    The suffix expands naturally after 999999 while retaining the ESC- prefix.
    """
    with connection.cursor() as cursor:
        cursor.execute("SELECT nextval('payments_escrow_public_reference_seq')")
        sequence_value = cursor.fetchone()[0]
    return f"ESC-{sequence_value:06d}"


class Wallet(models.Model):
    """One currency-specific wallet per platform user."""

    wallet_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
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
                name="ck_wallet_available_nonneg",
            ),
            models.CheckConstraint(
                condition=Q(reserved_balance__gte=0),
                name="ck_wallet_reserved_nonneg",
            ),
        ]

    @property
    def total_balance(self):
        """Total funds owned by the user, including funds held in escrow."""
        return self.available_balance + self.reserved_balance

    def __str__(self):
        return f"Wallet {self.wallet_id} ({self.user_id})"


class FeePayer(models.TextChoices):
    WORKER = "WORKER", "Worker"
    EMPLOYER = "EMPLOYER", "Employer"
    SPLIT = "SPLIT", "Split"


class EscrowReservation(models.Model):
    """A persisted hold for the selected bid and its task.

    ``amount`` is the employer-funded amount (labor + allowed expenses).
    The platform commission is withheld from the worker's labor share during
    settlement; it is not added to the employer's reservation and is never
    calculated on the expense component.
    """

    reservation_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    public_reference = models.CharField(
        max_length=16,
        unique=True,
        editable=False,
        default=generate_escrow_public_reference,
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
    labor_amount = models.BigIntegerField()
    expense_amount = models.BigIntegerField(default=0)
    amount = models.BigIntegerField()
    currency_code = CurrencyCodeField(default="IRR")
    platform_fee_rate_bps = models.PositiveSmallIntegerField(default=1_000)
    platform_fee_amount = models.BigIntegerField()
    fee_payer = models.CharField(
        max_length=16,
        choices=FeePayer.choices,
        default=FeePayer.WORKER,
    )
    status = models.CharField(
        max_length=24,
        choices=ESCROW_STATUS_CHOICES,
        default=EscrowStatus.INITIATED.value,
    )
    idempotency_key = models.CharField(max_length=128)
    operation_reference = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    held_at = models.DateTimeField(null=True, blank=True)
    released_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "escrow_reservations"
        ordering = ["-created_at"]
        constraints = [
            models.CheckConstraint(
                condition=Q(labor_amount__gte=0),
                name="ck_escrow_labor_nonneg",
            ),
            models.CheckConstraint(
                condition=Q(expense_amount__gte=0),
                name="ck_escrow_expense_nonneg",
            ),
            models.CheckConstraint(
                condition=Q(amount__gt=0),
                name="ck_escrow_amount_positive",
            ),
            models.CheckConstraint(
                condition=Q(amount=F("labor_amount") + F("expense_amount")),
                name="ck_escrow_amount_components",
            ),
            models.CheckConstraint(
                condition=Q(platform_fee_amount__gte=0)
                & Q(platform_fee_amount__lte=F("labor_amount")),
                name="ck_escrow_fee_within_labor",
            ),
            models.CheckConstraint(
                condition=Q(platform_fee_rate_bps__lte=10_000),
                name="ck_escrow_fee_rate_valid",
            ),
            models.CheckConstraint(
                condition=Q(fee_payer__in=FeePayer.values),
                name="ck_escrow_fee_payer_valid",
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
                        EscrowStatus.PARTIALLY_SETTLED.value,
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
            if self.wallet.user_id != self.task.employer_user_id:
                errors["wallet"] = "The wallet must belong to the task employer."
            if self.currency_code != self.task.currency_code:
                errors["currency_code"] = "The reservation currency must match the task currency."
            if self.currency_code != self.wallet.currency_code:
                errors["currency_code"] = "The reservation currency must match the wallet currency."
            expected_expense = self.task.item_cost_cap_amount or 0
            if self.expense_amount != expected_expense:
                errors["expense_amount"] = "Reserved expenses must match the task item cost cap."

        if self.labor_amount is not None and self.expense_amount is not None:
            if self.amount != self.labor_amount + self.expense_amount:
                errors["amount"] = "Reservation amount must equal labor plus expenses."

        if self.labor_amount is not None and self.platform_fee_rate_bps is not None:
            try:
                expected_fee = calculate_platform_fee_amount(
                    self.labor_amount,
                    self.platform_fee_rate_bps,
                )
            except ValueError as exc:
                errors["platform_fee_rate_bps"] = str(exc)
            else:
                if self.platform_fee_amount != expected_fee:
                    errors["platform_fee_amount"] = (
                        "Platform fee must match the stored labor amount and fee rate."
                    )

        if errors:
            raise ValidationError(errors)

    def __str__(self):
        return f"Escrow {self.reservation_id} - {self.status}"


class WalletTransactionType(models.TextChoices):
    DEPOSIT = "DEPOSIT", "Deposit"
    ESCROW_RESERVATION = "ESCROW_RESERVATION", "Escrow reservation"
    ESCROW_RELEASE = "ESCROW_RELEASE", "Escrow release"
    ESCROW_REFUND = "ESCROW_REFUND", "Escrow refund"
    PLATFORM_FEE = "PLATFORM_FEE", "Platform fee"
    WITHDRAWAL = "WITHDRAWAL", "Withdrawal"
    WITHDRAWAL_FEE = "WITHDRAWAL_FEE", "Withdrawal fee"


class WalletTransactionDirection(models.TextChoices):
    CREDIT = "CREDIT", "Credit"
    DEBIT = "DEBIT", "Debit"


class WalletTransactionQuerySet(models.QuerySet):
    """Prevent ordinary ORM bulk mutation/deletion of posted ledger entries."""

    def update(self, **kwargs):
        raise ValidationError("Posted wallet transactions are immutable.")

    def delete(self):
        raise ValidationError("Posted wallet transactions cannot be deleted.")

    def bulk_update(self, objs, fields, batch_size=None):
        raise ValidationError("Posted wallet transactions are immutable.")


class WalletTransaction(models.Model):
    """Append-only entry describing a confirmed wallet balance movement.

    Balance deltas make internal available-to-reserved transfers auditable:
    an escrow reservation has a negative available delta and an equal positive
    reserved delta, so total wallet balance remains unchanged.
    """

    transaction_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
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
    available_balance_delta = models.BigIntegerField(default=0)
    reserved_balance_delta = models.BigIntegerField(default=0)
    currency_code = CurrencyCodeField(default="IRR")
    idempotency_key = models.CharField(max_length=128)
    operation_reference = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    description = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    objects = WalletTransactionQuerySet.as_manager()

    class Meta:
        db_table = "wallet_transactions"
        ordering = ["-created_at", "-transaction_id"]
        constraints = [
            models.CheckConstraint(
                condition=Q(amount__gt=0),
                name="ck_wallet_tx_amount_positive",
            ),
            models.CheckConstraint(
                condition=Q(transaction_type__in=WalletTransactionType.values),
                name="ck_wallet_tx_type_valid",
            ),
            models.CheckConstraint(
                condition=Q(direction__in=WalletTransactionDirection.values),
                name="ck_wallet_tx_direction_valid",
            ),
            models.CheckConstraint(
                condition=~(Q(available_balance_delta=0) & Q(reserved_balance_delta=0)),
                name="ck_wallet_tx_nonzero_delta",
            ),
            models.UniqueConstraint(
                fields=["wallet", "transaction_type", "idempotency_key"],
                name="uq_wallet_tx_idem",
            ),
        ]

    def clean(self):
        super().clean()
        errors = {}

        if self.wallet_id and self.currency_code != self.wallet.currency_code:
            errors["currency_code"] = "The transaction currency must match the wallet currency."

        if self.transaction_type in {
            WalletTransactionType.ESCROW_RESERVATION,
            WalletTransactionType.ESCROW_RELEASE,
            WalletTransactionType.ESCROW_REFUND,
        }:
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

        if self.transaction_type == WalletTransactionType.DEPOSIT:
            if not (
                self.direction == WalletTransactionDirection.CREDIT
                and self.available_balance_delta == self.amount
                and self.reserved_balance_delta == 0
                and self.escrow_reservation_id is None
            ):
                errors["amount"] = "A deposit must credit the available wallet balance."

        if self.transaction_type == WalletTransactionType.ESCROW_RESERVATION:
            if not (
                self.direction == WalletTransactionDirection.DEBIT
                and self.available_balance_delta == -self.amount
                and self.reserved_balance_delta == self.amount
            ):
                errors["amount"] = "Escrow reservation must move funds from available to reserved."

        if self.transaction_type == WalletTransactionType.ESCROW_RELEASE:
            if not (
                self.direction == WalletTransactionDirection.DEBIT
                and self.available_balance_delta == 0
                and self.reserved_balance_delta == -self.amount
            ):
                errors["amount"] = "Escrow release must debit the reserved wallet balance."

        if self.transaction_type == WalletTransactionType.ESCROW_REFUND:
            if not (
                self.direction == WalletTransactionDirection.CREDIT
                and self.available_balance_delta == self.amount
                and self.reserved_balance_delta == -self.amount
            ):
                errors["amount"] = "Escrow refund must move funds from reserved to available."

        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        if not self._state.adding:
            raise ValidationError("Posted wallet transactions are immutable.")
        return super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValidationError("Posted wallet transactions cannot be deleted.")

    @property
    def status(self):
        """Ledger rows represent posted movements and are therefore successful."""
        return "SUCCEEDED"

    @property
    def total_balance_delta(self):
        return self.available_balance_delta + self.reserved_balance_delta

    def __str__(self):
        return f"{self.transaction_type} {self.amount} {self.currency_code}"


class IdempotencyStatus(models.TextChoices):
    PROCESSING = "PROCESSING", "Processing"
    COMPLETED = "COMPLETED", "Completed"
    FAILED = "FAILED", "Failed"


class IdempotencyRecord(models.Model):
    idempotency_record_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
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
                condition=Q(status=IdempotencyStatus.PROCESSING)
                | Q(completed_at__isnull=False, response_status__isnull=False),
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


class WalletDepositStatus(models.TextChoices):
    PROCESSING = "PROCESSING", "Processing"
    PENDING = "PENDING", "Pending"
    SUCCEEDED = "SUCCEEDED", "Succeeded"
    FAILED = "FAILED", "Failed"
    CANCELLED = "CANCELLED", "Cancelled"


class WalletDeposit(models.Model):
    """External top-up attempt; wallet credit is posted only after verified callback."""

    deposit_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    wallet = models.ForeignKey(
        Wallet,
        on_delete=models.PROTECT,
        related_name="deposit_attempts",
    )
    amount = models.BigIntegerField()
    currency_code = CurrencyCodeField(default="IRR")
    status = models.CharField(
        max_length=16,
        choices=WalletDepositStatus.choices,
        default=WalletDepositStatus.PROCESSING,
    )
    provider = models.CharField(max_length=48, blank=True, default="")
    provider_reference = models.CharField(max_length=128, null=True, blank=True)
    payment_url = models.URLField(max_length=1000, blank=True, default="")
    idempotency_key = models.CharField(max_length=128)
    request_hash = models.CharField(max_length=64)
    ledger_transaction = models.OneToOneField(
        WalletTransaction,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="deposit_attempt",
    )
    expires_at = models.DateTimeField(null=True, blank=True)
    confirmed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "wallet_deposits"
        ordering = ["-created_at"]
        constraints = [
            models.CheckConstraint(
                condition=Q(amount__gt=0),
                name="ck_wallet_deposit_amount_pos",
            ),
            models.CheckConstraint(
                condition=Q(status__in=WalletDepositStatus.values),
                name="ck_wallet_deposit_status_valid",
            ),
            models.UniqueConstraint(
                fields=["wallet", "idempotency_key"],
                name="uq_wallet_deposit_idem",
            ),
            models.UniqueConstraint(
                fields=["provider", "provider_reference"],
                condition=Q(provider_reference__isnull=False),
                name="uq_wallet_deposit_provider_ref",
            ),
        ]

    def clean(self):
        super().clean()
        if self.wallet_id and self.currency_code != self.wallet.currency_code:
            raise ValidationError({
                "currency_code": "The deposit currency must match the wallet currency."
            })

    def __str__(self):
        return f"Deposit {self.deposit_id} - {self.status}"
