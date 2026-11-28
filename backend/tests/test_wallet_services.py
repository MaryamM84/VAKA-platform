from datetime import timedelta
from unittest.mock import patch

from django.test import TestCase
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied

from accounts.models import ExecutorProfile, User
from offers.models import Bid, BidStatus
from payments.hold_gateway import read_verified_held_reservation
from payments.lifecycle import EscrowStatus
from payments.models import (
    EscrowReservation,
    Wallet,
    WalletTransaction,
    WalletTransactionType,
)
from payments.services import (
    InsufficientBalance,
    PaymentGatewayUnavailable,
    WalletOperationConflict,
    _validate_gateway_result,
    reserve_funds_for_bid,
)
from tasks.choices import TaskStatus
from tasks.models import Task, TaskCategory


class PaymentGatewayResponseValidationTests(TestCase):
    def test_payment_url_must_use_https(self):
        with self.assertRaises(PaymentGatewayUnavailable):
            _validate_gateway_result({
                "provider": "test-provider",
                "provider_reference": "provider-ref",
                "payment_url": "http://payments.example.test/pay/1",
                "expires_at": None,
            })

    def test_valid_https_payment_url_is_accepted(self):
        result = _validate_gateway_result({
            "provider": "test-provider",
            "provider_reference": "provider-ref",
            "payment_url": "https://payments.example.test/pay/1",
            "expires_at": None,
        })
        self.assertEqual(result[2], "https://payments.example.test/pay/1")


class ReserveFundsForBidTests(TestCase):
    def setUp(self):
        now = timezone.now()
        self.employer = User.objects.create_user(
            phone="09121001001",
            full_name="Wallet Employer",
            phone_verified_at=now,
        )
        executor = User.objects.create_user(
            phone="09121001002",
            full_name="Wallet Executor",
            phone_verified_at=now,
        )
        profile = ExecutorProfile.objects.create(
            user=executor,
            verification_status=ExecutorProfile.VerificationStatus.APPROVED,
            profile_status="ACTIVE",
        )
        category = TaskCategory.objects.create(name="Wallet service test")
        self.task = Task.objects.create(
            employer_user=self.employer,
            category=category,
            title="Funded task",
            description="Task used to test escrow service",
            status=TaskStatus.OPEN,
            estimated_duration_minutes=60,
            wage_budget_amount=800000,
            item_cost_cap_amount=100000,
            currency_code="IRR",
            execution_window_start_at=now + timedelta(days=1),
            execution_window_end_at=now + timedelta(days=2),
            proposal_deadline_at=now + timedelta(hours=12),
            delivery_criteria="Complete the work",
            published_at=now,
        )
        self.bid = Bid.objects.create(
            task=self.task,
            executor_profile=profile,
            proposed_wage_amount=500000,
            proposed_duration_minutes=60,
            message="I can do the work",
            status=BidStatus.ACTIVE,
        )
        self.wallet = Wallet.objects.create(
            user=self.employer,
            currency_code="IRR",
            available_balance=1_000_000,
            reserved_balance=0,
        )

    def test_reservation_moves_available_to_reserved_and_snapshots_fee(self):
        reservation, event = reserve_funds_for_bid(
            employer=self.employer,
            task=self.task,
            bid=self.bid,
            idempotency_key="reserve-task-1",
        )

        self.wallet.refresh_from_db()
        self.assertEqual(self.wallet.available_balance, 400000)
        self.assertEqual(self.wallet.reserved_balance, 600000)
        self.assertEqual(self.wallet.total_balance, 1_000_000)

        self.assertEqual(reservation.status, EscrowStatus.HELD.value)
        self.assertEqual(reservation.labor_amount, 500000)
        self.assertEqual(reservation.expense_amount, 100000)
        self.assertEqual(reservation.amount, 600000)
        self.assertEqual(reservation.platform_fee_rate_bps, 1000)
        self.assertEqual(reservation.platform_fee_amount, 50000)
        self.assertEqual(reservation.fee_payer, "WORKER")

        self.assertEqual(event.state, EscrowStatus.HELD)
        self.assertEqual(event.task_reference, str(self.task.pk))
        self.assertEqual(event.bid_reference, str(self.bid.pk))
        self.assertEqual(event.escrow_reference, str(reservation.pk))

        ledger = WalletTransaction.objects.get(escrow_reservation=reservation)
        self.assertEqual(ledger.transaction_type, WalletTransactionType.ESCROW_RESERVATION)
        self.assertEqual(ledger.amount, 600000)
        self.assertEqual(ledger.available_balance_delta, -600000)
        self.assertEqual(ledger.reserved_balance_delta, 600000)
        self.assertEqual(ledger.total_balance_delta, 0)

    def test_insufficient_balance_rolls_back_every_financial_record(self):
        self.wallet.available_balance = 500000
        self.wallet.save(update_fields=["available_balance"])

        with self.assertRaises(InsufficientBalance):
            reserve_funds_for_bid(
                employer=self.employer,
                task=self.task,
                bid=self.bid,
                idempotency_key="reserve-insufficient",
            )

        self.wallet.refresh_from_db()
        self.assertEqual(self.wallet.available_balance, 500000)
        self.assertEqual(self.wallet.reserved_balance, 0)
        self.assertEqual(EscrowReservation.objects.count(), 0)
        self.assertEqual(WalletTransaction.objects.count(), 0)

    def test_failure_while_posting_ledger_rolls_back_wallet_and_escrow(self):
        with patch(
            "payments.services.WalletTransaction.save",
            side_effect=RuntimeError("simulated ledger write failure"),
        ):
            with self.assertRaises(RuntimeError):
                reserve_funds_for_bid(
                    employer=self.employer,
                    task=self.task,
                    bid=self.bid,
                    idempotency_key="reserve-ledger-rollback",
                )

        self.wallet.refresh_from_db()
        self.assertEqual(self.wallet.available_balance, 1_000_000)
        self.assertEqual(self.wallet.reserved_balance, 0)
        self.assertEqual(EscrowReservation.objects.count(), 0)
        self.assertEqual(WalletTransaction.objects.count(), 0)

    def test_same_idempotency_key_replays_original_reservation(self):
        first_reservation, first_event = reserve_funds_for_bid(
            employer=self.employer,
            task=self.task,
            bid=self.bid,
            idempotency_key="reserve-replay",
        )
        second_reservation, second_event = reserve_funds_for_bid(
            employer=self.employer,
            task=self.task,
            bid=self.bid,
            idempotency_key="reserve-replay",
        )

        self.assertEqual(first_reservation.pk, second_reservation.pk)
        self.assertEqual(first_event.operation_reference, second_event.operation_reference)
        self.assertEqual(EscrowReservation.objects.count(), 1)
        self.assertEqual(WalletTransaction.objects.count(), 1)

        self.wallet.refresh_from_db()
        self.assertEqual(self.wallet.available_balance, 400000)
        self.assertEqual(self.wallet.reserved_balance, 600000)

    def test_same_key_cannot_be_reused_for_another_bid(self):
        other_executor = User.objects.create_user(
            phone="09121001003",
            full_name="Second Executor",
            phone_verified_at=timezone.now(),
        )
        other_profile = ExecutorProfile.objects.create(
            user=other_executor,
            verification_status=ExecutorProfile.VerificationStatus.APPROVED,
            profile_status="ACTIVE",
        )
        other_bid = Bid.objects.create(
            task=self.task,
            executor_profile=other_profile,
            proposed_wage_amount=450000,
            proposed_duration_minutes=60,
            message="Second offer",
            status=BidStatus.ACTIVE,
        )

        reserve_funds_for_bid(
            employer=self.employer,
            task=self.task,
            bid=self.bid,
            idempotency_key="reserve-key-reuse",
        )
        with self.assertRaises(WalletOperationConflict):
            reserve_funds_for_bid(
                employer=self.employer,
                task=self.task,
                bid=other_bid,
                idempotency_key="reserve-key-reuse",
            )

    def test_same_idempotency_key_rejects_changed_bid_amount(self):
        reserve_funds_for_bid(
            employer=self.employer,
            task=self.task,
            bid=self.bid,
            idempotency_key="reserve-changed-amount",
        )
        self.bid.proposed_wage_amount = 550000
        self.bid.save(update_fields=["proposed_wage_amount", "updated_at"])

        with self.assertRaises(WalletOperationConflict):
            reserve_funds_for_bid(
                employer=self.employer,
                task=self.task,
                bid=self.bid,
                idempotency_key="reserve-changed-amount",
            )

    def test_hold_gateway_rejects_unaccepted_bid_or_insufficient_reserved_balance(self):
        reservation, _event = reserve_funds_for_bid(
            employer=self.employer,
            task=self.task,
            bid=self.bid,
            idempotency_key="reserve-unaccepted-check",
        )
        self.assertIsNone(
            read_verified_held_reservation(task_id=self.task.pk, bid_id=self.bid.pk)
        )

        self.bid.status = BidStatus.ACCEPTED
        self.bid.save(update_fields=["status", "updated_at"])
        self.wallet.refresh_from_db()
        self.wallet.reserved_balance = reservation.amount - 1
        self.wallet.save(update_fields=["reserved_balance"])

        self.assertIsNone(
            read_verified_held_reservation(task_id=self.task.pk, bid_id=self.bid.pk)
        )

    def test_non_owner_cannot_reserve_task_funds(self):
        another_user = User.objects.create_user(
            phone="09121001004",
            full_name="Not the Employer",
            phone_verified_at=timezone.now(),
        )
        with self.assertRaises(PermissionDenied):
            reserve_funds_for_bid(
                employer=another_user,
                task=self.task,
                bid=self.bid,
                idempotency_key="wrong-owner",
            )

    def test_hold_gateway_requires_a_persisted_held_reservation_and_ledger(self):
        reservation, _event = reserve_funds_for_bid(
            employer=self.employer,
            task=self.task,
            bid=self.bid,
            idempotency_key="reserve-gateway-check",
        )
        self.bid.status = BidStatus.ACCEPTED
        self.bid.save(update_fields=["status", "updated_at"])

        verified = read_verified_held_reservation(
            task_id=self.task.pk,
            bid_id=self.bid.pk,
        )
        self.assertIsNotNone(verified)
        self.assertEqual(verified.state, EscrowStatus.HELD)
        self.assertEqual(verified.escrow_reference, str(reservation.pk))

        reservation.status = EscrowStatus.RELEASED.value
        reservation.save(update_fields=["status"])
        self.assertIsNone(
            read_verified_held_reservation(task_id=self.task.pk, bid_id=self.bid.pk)
        )
