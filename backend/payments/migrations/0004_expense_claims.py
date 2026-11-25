"""Expense receipts and employer-authorized reimbursement ledger support."""

import django.db.models.deletion
import tasks.fields
import uuid
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
    ("payments", "0003_escrow_public_reference"),
    ("accounts", "0004_executorprofile"),
    migrations.swappable_dependency(settings.AUTH_USER_MODEL),
]

    operations = [
        migrations.CreateModel(
            name="ExpenseClaim",
            fields=[
                ("claim_id", models.UUIDField(primary_key=True, default=uuid.uuid4,
                                              editable=False, serialize=False)),
                ("amount_irr", models.BigIntegerField()),
                ("currency_code", tasks.fields.CurrencyCodeField(default="IRR", max_length=3)),
                ("description", models.TextField()),
                ("status", models.CharField(max_length=12, default="PENDING", choices=[
                    ("PENDING", "Pending employer decision"),
                    ("APPROVED", "Approved and reimbursed"),
                    ("REJECTED", "Rejected"),
                ])),
                ("rejection_reason", models.TextField(blank=True, default="")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("reviewed_at", models.DateTimeField(blank=True, null=True)),
                ("employer_debit", models.OneToOneField(
                    to="payments.wallettransaction", blank=True, null=True,
                    on_delete=django.db.models.deletion.PROTECT,
                    related_name="expense_claim_employer_debit")),
                ("worker_credit", models.OneToOneField(
                    to="payments.wallettransaction", blank=True, null=True,
                    on_delete=django.db.models.deletion.PROTECT,
                    related_name="expense_claim_worker_credit")),
                ("reviewed_by_user", models.ForeignKey(
                    to=settings.AUTH_USER_MODEL, blank=True, null=True,
                    on_delete=django.db.models.deletion.PROTECT,
                    related_name="reviewed_expense_claims")),
                ("executor_profile", models.ForeignKey(
                    to="accounts.executorprofile", on_delete=django.db.models.deletion.PROTECT,
                    related_name="expense_claims")),
                ("escrow_reservation", models.ForeignKey(
                    to="payments.escrowreservation", on_delete=django.db.models.deletion.PROTECT,
                    related_name="expense_claims")),
                ("task", models.ForeignKey(
                    to="tasks.task", on_delete=django.db.models.deletion.PROTECT,
                    related_name="expense_claims")),
            ],
            options={
                "db_table": "expense_claims",
                "ordering": ["-created_at", "-claim_id"],
                "indexes": [
                    models.Index(fields=["task", "status", "-created_at"],
                                 name="exp_claim_task_status_idx"),
                ],
            },
        ),
        migrations.CreateModel(
            name="ExpenseReceipt",
            fields=[
                ("receipt_id", models.UUIDField(primary_key=True, default=uuid.uuid4,
                                                editable=False, serialize=False)),
                ("storage_key", models.CharField(max_length=512, unique=True)),
                ("mime_type", models.CharField(max_length=32)),
                ("size_bytes", models.PositiveIntegerField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("claim", models.ForeignKey(
                    to="payments.expenseclaim", on_delete=django.db.models.deletion.PROTECT,
                    related_name="receipts")),
            ],
            options={"db_table": "expense_receipts", "ordering": ["created_at", "receipt_id"]},
        ),
        migrations.AddConstraint(
            model_name="expenseclaim",
            constraint=models.CheckConstraint(
                condition=models.Q(amount_irr__gt=0), name="ck_exp_claim_amount_pos"),
        ),
        migrations.AddConstraint(
            model_name="expenseclaim",
            constraint=models.CheckConstraint(
                condition=models.Q(status__in=["PENDING", "APPROVED", "REJECTED"]),
                name="ck_exp_claim_status_valid"),
        ),
        migrations.AddConstraint(
            model_name="expenseclaim",
            constraint=models.CheckConstraint(
                condition=models.Q(status__in=["PENDING", "REJECTED"]) |
                models.Q(status="APPROVED", employer_debit__isnull=False,
                         worker_credit__isnull=False, reviewed_at__isnull=False,
                         reviewed_by_user__isnull=False),
                name="ck_exp_claim_approval_ledger"),
        ),
        migrations.AddConstraint(
            model_name="expensereceipt",
            constraint=models.CheckConstraint(
                condition=models.Q(size_bytes__gt=0), name="ck_exp_receipt_size_pos"),
        ),
        migrations.RemoveConstraint(
            model_name="wallettransaction", name="ck_wallet_tx_type_valid",
        ),
        migrations.AlterField(
            model_name="wallettransaction", name="transaction_type",
            field=models.CharField(max_length=24, choices=[
                ("DEPOSIT", "Deposit"),
                ("ESCROW_RESERVATION", "Escrow reservation"),
                ("ESCROW_RELEASE", "Escrow release"),
                ("ESCROW_REFUND", "Escrow refund"),
                ("EXPENSE_REIMBURSEMENT", "Expense reimbursement"),
                ("PLATFORM_FEE", "Platform fee"),
                ("WITHDRAWAL", "Withdrawal"),
                ("WITHDRAWAL_FEE", "Withdrawal fee"),
            ]),
        ),
        migrations.AddConstraint(
            model_name="wallettransaction",
            constraint=models.CheckConstraint(
                condition=models.Q(transaction_type__in=[
                    "DEPOSIT", "ESCROW_RESERVATION", "ESCROW_RELEASE", "ESCROW_REFUND",
                    "EXPENSE_REIMBURSEMENT", "PLATFORM_FEE", "WITHDRAWAL", "WITHDRAWAL_FEE",
                ]), name="ck_wallet_tx_type_valid"),
        ),
    ]
