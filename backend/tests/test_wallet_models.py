from datetime import timedelta

from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.test import TestCase
from django.utils import timezone

from accounts.models import ExecutorProfile, User
from offers.models import Bid
from payments.fees import calculate_platform_fee_amount, get_platform_fee_rate_bps
from payments.lifecycle import EscrowStatus
from payments.models import (
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
from tasks.models import Task, TaskCategory


class WalletModelTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            phone="09120001001",
            full_name="Wallet Owner",
            phone_verified_at=timezone.now(),
        )

    def test_wallet_defaults_and_total_balance(self):
        wallet = Wallet.objects.create(user=self.user)

        self.assertEqual(wallet.available_balance, 0)
        self.assertEqual(wallet.reserved_balance, 0)
        self.assertEqual(wallet.total_balance, 0)

        wallet.available_balance = 875000
        wallet.reserved_balance = 120000
        wallet.save(update_fields=["available_balance", "reserved_balance"])

        self.assertEqual(wallet.total_balance, 995000)

    def test_wallet_rejects_negative_available_balance(self):
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                Wallet.objects.create(user=self.user, available_balance=-1)

    def test_wallet_rejects_negative_reserved_balance(self):
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                Wallet.objects.create(user=self.user, reserved_balance=-1)

    def test_user_can_have_only_one_wallet(self):
        Wallet.objects.create(user=self.user)
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                Wallet.objects.create(user=self.user)


class FeePolicyTests(TestCase):
    def test_default_platform_fee_is_ten_percent(self):
        self.assertEqual(get_platform_fee_rate_bps(), 1000)
        self.assertEqual(calculate_platform_fee_amount(1_000_000), 100_000)

    def test_fee_is_calculated_on_labor_only_and_rounded_half_up(self):
        self.assertEqual(calculate_platform_fee_amount(1_000_005, 1000), 100_001)

    def test_fee_rejects_invalid_amount_or_rate(self):
        with self.assertRaises(ValueError):
            calculate_platform_fee_amount(-1, 1000)
        with self.assertRaises(ValueError):
            calculate_platform_fee_amount(1000, 10001)


class EscrowReservationModelTests(TestCase):
    def setUp(self):
        now = timezone.now()
        self.employer = User.objects.create_user(
            phone="09120001002",
            full_name="Employer",
            phone_verified_at=now,
        )
        executor = User.objects.create_user(
            phone="09120001003",
            full_name="Executor",
            phone_verified_at=now,
        )
        profile = ExecutorProfile.objects.create(
            user=executor,
            verification_status=ExecutorProfile.VerificationStatus.APPROVED,
            profile_status="ACTIVE",
        )
        category = TaskCategory.objects.create(name="Wallet model test")
        self.task = Task.objects.create(
            employer_user=self.employer,
            category=category,
            title="Escrow test task",
            description="Task used by payment model tests",
            estimated_duration_minutes=60,
            wage_budget_amount=500000,
            item_cost_cap_amount=100000,
            currency_code="IRR",
            execution_window_start_at=now + timedelta(hours=1),
            execution_window_end_at=now + timedelta(hours=3),
            proposal_deadline_at=now + timedelta(minutes=30),
            delivery_criteria="Complete the task",
        )
        self.bid = Bid.objects.create(
            task=self.task,
            executor_profile=profile,
            proposed_wage_amount=400000,
            proposed_duration_minutes=60,
            message="I can complete this task",
        )
        self.wallet = Wallet.objects.create(
            user=self.employer,
            currency_code="IRR",
            available_balance=1000000,
        )

    def make_reservation(
        self,
        *,
        key="escrow-key-1",
        status=EscrowStatus.INITIATED.value,
        labor_amount=400000,
        expense_amount=100000,
        amount=500000,
        fee_rate=1000,
        fee_amount=40000,
    ):
        return EscrowReservation.objects.create(
            task=self.task,
            bid=self.bid,
            wallet=self.wallet,
            labor_amount=labor_amount,
            expense_amount=expense_amount,
            amount=amount,
            currency_code="IRR",
            platform_fee_rate_bps=fee_rate,
            platform_fee_amount=fee_amount,
            fee_payer=FeePayer.WORKER,
            status=status,
            idempotency_key=key,
        )

    def test_reservation_stores_ten_percent_worker_fee_snapshot(self):
        reservation = self.make_reservation()
        reservation.full_clean()
        self.assertEqual(reservation.platform_fee_rate_bps, 1000)
        self.assertEqual(reservation.platform_fee_amount, 40000)
        self.assertEqual(reservation.fee_payer, FeePayer.WORKER)
        self.assertEqual(reservation.amount, 500000)

    def test_reservation_amount_must_equal_labor_plus_expenses(self):
        reservation = self.make_reservation(amount=450000)
        with self.assertRaises(ValidationError):
            reservation.full_clean()

    def test_reservation_fee_must_match_snapshot(self):
        reservation = self.make_reservation(fee_amount=39999)
        with self.assertRaises(ValidationError):
            reservation.full_clean()

    def test_reservation_requires_positive_amount(self):
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                self.make_reservation(amount=0, labor_amount=0, expense_amount=0, fee_amount=0)

    def test_only_one_active_reservation_per_task(self):
        self.make_reservation()
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                self.make_reservation(key="escrow-key-2")

    def test_failed_reservation_does_not_block_a_new_attempt(self):
        reservation = self.make_reservation()
        reservation.status = EscrowStatus.FAILED.value
        reservation.save(update_fields=["status"])

        replacement = self.make_reservation(key="escrow-key-2")
        self.assertEqual(replacement.status, EscrowStatus.INITIATED.value)

    def test_reservation_clean_checks_task_bid_and_wallet_ownership(self):
        another_employer = User.objects.create_user(
            phone="09120001004",
            full_name="Another Employer",
            phone_verified_at=timezone.now(),
        )
        other_wallet = Wallet.objects.create(user=another_employer)
        reservation = EscrowReservation(
            task=self.task,
            bid=self.bid,
            wallet=other_wallet,
            labor_amount=400000,
            expense_amount=100000,
            amount=500000,
            currency_code="IRR",
            platform_fee_rate_bps=1000,
            platform_fee_amount=40000,
            idempotency_key="wrong-wallet",
        )
        with self.assertRaises(ValidationError):
            reservation.full_clean()


class WalletTransactionModelTests(TestCase):
    def setUp(self):
        user = User.objects.create_user(
            phone="09120001005",
            full_name="Ledger Owner",
            phone_verified_at=timezone.now(),
        )
        self.wallet = Wallet.objects.create(user=user, available_balance=100000)

    def make_transaction(self):
        entry = WalletTransaction(
            wallet=self.wallet,
            transaction_type=WalletTransactionType.DEPOSIT,
            direction=WalletTransactionDirection.CREDIT,
            amount=50000,
            available_balance_delta=50000,
            reserved_balance_delta=0,
            currency_code="IRR",
            idempotency_key="deposit-key-1",
            description="Test posted deposit",
        )
        entry.full_clean()
        entry.save()
        return entry

    def test_wallet_transaction_records_balance_deltas(self):
        entry = self.make_transaction()
        self.assertEqual(entry.available_balance_delta, 50000)
        self.assertEqual(entry.reserved_balance_delta, 0)
        self.assertEqual(entry.total_balance_delta, 50000)
        self.assertEqual(entry.status, "SUCCEEDED")

    def test_wallet_transaction_instance_cannot_be_updated(self):
        entry = self.make_transaction()
        entry.amount = 60000
        with self.assertRaises(ValidationError):
            entry.save()

    def test_wallet_transaction_instance_cannot_be_deleted(self):
        entry = self.make_transaction()
        with self.assertRaises(ValidationError):
            entry.delete()

    def test_wallet_transaction_queryset_cannot_be_updated_or_deleted(self):
        entry = self.make_transaction()
        queryset = WalletTransaction.objects.filter(pk=entry.pk)
        with self.assertRaises(ValidationError):
            queryset.update(amount=60000)
        with self.assertRaises(ValidationError):
            queryset.delete()


class IdempotencyRecordModelTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            phone="09120001006",
            full_name="Idempotency Owner",
            phone_verified_at=timezone.now(),
        )

    def test_idempotency_record_defaults_to_processing(self):
        record = IdempotencyRecord.objects.create(
            user=self.user,
            operation_type="BID_ESCROW_RESERVATION",
            idempotency_key="request-key-1",
            request_hash="a" * 64,
        )
        self.assertEqual(record.status, IdempotencyStatus.PROCESSING)

    def test_idempotency_key_is_unique_per_user_and_operation(self):
        IdempotencyRecord.objects.create(
            user=self.user,
            operation_type="BID_ESCROW_RESERVATION",
            idempotency_key="request-key-1",
            request_hash="a" * 64,
        )
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                IdempotencyRecord.objects.create(
                    user=self.user,
                    operation_type="BID_ESCROW_RESERVATION",
                    idempotency_key="request-key-1",
                    request_hash="b" * 64,
                )


class WalletDepositModelTests(TestCase):
    def setUp(self):
        user = User.objects.create_user(
            phone="09120001007",
            full_name="Deposit Owner",
            phone_verified_at=timezone.now(),
        )
        self.wallet = Wallet.objects.create(user=user)

    def test_deposit_attempt_is_pending_and_does_not_itself_credit_wallet(self):
        deposit = WalletDeposit.objects.create(
            wallet=self.wallet,
            amount=250000,
            currency_code="IRR",
            status=WalletDepositStatus.PROCESSING,
            idempotency_key="deposit-attempt-1",
            request_hash="b" * 64,
        )
        self.wallet.refresh_from_db()
        self.assertEqual(deposit.status, WalletDepositStatus.PROCESSING)
        self.assertEqual(self.wallet.available_balance, 0)

    def test_deposit_attempt_amount_must_be_positive(self):
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                WalletDeposit.objects.create(
                    wallet=self.wallet,
                    amount=0,
                    currency_code="IRR",
                    idempotency_key="zero-deposit",
                    request_hash="c" * 64,
                )
