"""Receipted expense claims. Funds are moved only by the finance service."""

import uuid

from django.conf import settings
from django.db import models
from django.db.models import Q

from tasks.fields import CurrencyCodeField


class ExpenseClaimStatus(models.TextChoices):
    PENDING = "PENDING", "Pending employer decision"
    APPROVED = "APPROVED", "Approved and reimbursed"
    REJECTED = "REJECTED", "Rejected"


class ExpenseClaim(models.Model):
    claim_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    task = models.ForeignKey(
        "tasks.Task", on_delete=models.PROTECT, related_name="expense_claims",
    )
    escrow_reservation = models.ForeignKey(
        "payments.EscrowReservation", on_delete=models.PROTECT,
        related_name="expense_claims",
    )
    executor_profile = models.ForeignKey(
        "accounts.ExecutorProfile", on_delete=models.PROTECT,
        related_name="expense_claims",
    )
    amount_irr = models.BigIntegerField()
    currency_code = CurrencyCodeField(default="IRR")
    description = models.TextField()
    status = models.CharField(
        max_length=12, choices=ExpenseClaimStatus.choices,
        default=ExpenseClaimStatus.PENDING,
    )
    employer_debit = models.OneToOneField(
        "payments.WalletTransaction", on_delete=models.PROTECT,
        related_name="expense_claim_employer_debit", null=True, blank=True,
    )
    worker_credit = models.OneToOneField(
        "payments.WalletTransaction", on_delete=models.PROTECT,
        related_name="expense_claim_worker_credit", null=True, blank=True,
    )
    reviewed_by_user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True,
        related_name="reviewed_expense_claims",
    )
    rejection_reason = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "expense_claims"
        ordering = ["-created_at", "-claim_id"]
        indexes = [
            models.Index(fields=["task", "status", "-created_at"], name="exp_claim_task_status_idx"),
        ]
        constraints = [
            models.CheckConstraint(condition=Q(amount_irr__gt=0), name="ck_exp_claim_amount_pos"),
            models.CheckConstraint(
                condition=Q(status__in=ExpenseClaimStatus.values),
                name="ck_exp_claim_status_valid",
            ),
            models.CheckConstraint(
                condition=Q(status__in=[ExpenseClaimStatus.PENDING, ExpenseClaimStatus.REJECTED])
                | Q(status=ExpenseClaimStatus.APPROVED,
                    employer_debit__isnull=False, worker_credit__isnull=False,
                    reviewed_at__isnull=False, reviewed_by_user__isnull=False),
                name="ck_exp_claim_approval_ledger",
            ),
        ]


class ExpenseReceipt(models.Model):
    receipt_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    claim = models.ForeignKey(
        ExpenseClaim, on_delete=models.PROTECT, related_name="receipts",
    )
    # Always stored in PRIVATE_MEDIA_ROOT; never expose direct /media/ URLs.
    storage_key = models.CharField(max_length=512, unique=True)
    mime_type = models.CharField(max_length=32)
    size_bytes = models.PositiveIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "expense_receipts"
        ordering = ["created_at", "receipt_id"]
        constraints = [
            models.CheckConstraint(condition=Q(size_bytes__gt=0), name="ck_exp_receipt_size_pos"),
        ]
