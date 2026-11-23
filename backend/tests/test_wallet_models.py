from datetime import timedelta

from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.test import TestCase
from django.utils import timezone

from accounts.models import ExecutorProfile, User
from offers.models import Bid
from tasks.models import Task, TaskCategory

from payments.lifecycle import EscrowStatus
from payments.models import (
    EscrowReservation,
    IdempotencyRecord,
    IdempotencyStatus,
    Wallet,
    WalletTransaction,
    WalletTransactionDirection,
    WalletTransactionType,
)


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
                Wallet.objects.create(
                    user=self.user,
                    available_balance=-1,
                )

    def test_wallet_rejects_negative_reserved_balance(self):
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                Wallet.objects.create(
                    user=self.user,
                    reserved_balance=-1,
                )

    def test_user_can_have_only_one_wallet(self):
        Wallet.objects.create(user=self.user)

        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                Wallet.objects.create(user=self.user)


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

    def make_reservation(self, *, key="escrow-key-1", status=EscrowStatus.INITIATED.value):
        return EscrowReservation.objects.create(
            task=self.task,
            bid=self.bid,
            wallet=self.wallet,
            amount=400000,
            currency_code="IRR",
            status=status,
            idempotency_key=key,
        )

    def test_reservation_requires_positive_amount(self):
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                EscrowReservation.objects.create(
                    task=self.task,
                    bid=self.bid,
                    wallet=self.wallet,
                    amount=0,
                    currency_code="IRR",
                    idempotency_key="zero-amount",
                )

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
            amount=100000,
            currency_code="IRR",
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
        return WalletTransaction.objects.create(
            wallet=self.wallet,
            transaction_type=WalletTransactionType.DEPOSIT,
            direction=WalletTransactionDirection.CREDIT,
            amount=50000,
            currency_code="IRR",
            idempotency_key="deposit-key-1",
            description="Test posted deposit",
        )

    def test_wallet_transaction_is_created_as_ledger_entry(self):
        entry = self.make_transaction()
        self.assertEqual(entry.wallet_id, self.wallet.wallet_id)
        self.assertEqual(entry.amount, 50000)

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
            operation_type="BID_ACCEPT",
            idempotency_key="request-key-1",
            request_hash="a" * 64,
        )
        self.assertEqual(record.status, IdempotencyStatus.PROCESSING)

    def test_same_user_operation_and_key_must_be_unique(self):
        IdempotencyRecord.objects.create(
            user=self.user,
            operation_type="BID_ACCEPT",
            idempotency_key="request-key-2",
            request_hash="b" * 64,
        )

        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                IdempotencyRecord.objects.create(
                    user=self.user,
                    operation_type="BID_ACCEPT",
                    idempotency_key="request-key-2",
                    request_hash="b" * 64,
                )

    def test_same_key_can_be_used_for_a_different_operation_type(self):
        IdempotencyRecord.objects.create(
            user=self.user,
            operation_type="BID_ACCEPT",
            idempotency_key="shared-key",
            request_hash="c" * 64,
        )
        second = IdempotencyRecord.objects.create(
            user=self.user,
            operation_type="WALLET_DEPOSIT",
            idempotency_key="shared-key",
            request_hash="d" * 64,
        )

        self.assertEqual(second.operation_type, "WALLET_DEPOSIT")
