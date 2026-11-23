from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from threading import Barrier
from unittest.mock import patch

from django.db import close_old_connections
from django.test import TransactionTestCase, skipUnlessDBFeature
from django.urls import reverse
from django.utils import timezone

from rest_framework.test import APIClient, APITestCase

from accounts.models import ExecutorProfile, Role, User, UserRole
from offers.employer_bid_decisions import BidDecisionConflict
from offers.models import Bid, BidStatus
from payments.lifecycle import EscrowStatus
from payments.models import (
    EscrowReservation,
    IdempotencyRecord,
    Wallet,
    WalletTransaction,
    WalletTransactionType,
)
from tasks.choices import TaskStatus
from tasks.models import Task, TaskCategory, TaskStatusHistory


class AtomicBidAssignmentAPITests(APITestCase):
    def setUp(self):
        employer_role, _ = Role.objects.get_or_create(
            code="EMPLOYER", defaults={"name": "Employer"},
        )
        executor_role, _ = Role.objects.get_or_create(
            code="EXECUTOR", defaults={"name": "Executor"},
        )

        self.employer = User.objects.create_user(
            phone="09123110001",
            full_name="Atomic Employer",
            phone_verified_at=timezone.now(),
        )
        UserRole.objects.create(user=self.employer, role=employer_role)

        self.worker_one = User.objects.create_user(
            phone="09123110002",
            full_name="Atomic Worker One",
            phone_verified_at=timezone.now(),
        )
        UserRole.objects.create(user=self.worker_one, role=executor_role)
        self.profile_one = ExecutorProfile.objects.create(
            user=self.worker_one,
            verification_status=ExecutorProfile.VerificationStatus.APPROVED,
            profile_status="ACTIVE",
            approved_at=timezone.now(),
        )

        self.worker_two = User.objects.create_user(
            phone="09123110003",
            full_name="Atomic Worker Two",
            phone_verified_at=timezone.now(),
        )
        UserRole.objects.create(user=self.worker_two, role=executor_role)
        self.profile_two = ExecutorProfile.objects.create(
            user=self.worker_two,
            verification_status=ExecutorProfile.VerificationStatus.APPROVED,
            profile_status="ACTIVE",
            approved_at=timezone.now(),
        )

        category = TaskCategory.objects.create(name="Atomic Assignment")
        now = timezone.now()
        self.task = Task.objects.create(
            employer_user=self.employer,
            category=category,
            title="Atomic assignment task",
            description="Task used to verify atomic bid assignment.",
            status=TaskStatus.OPEN,
            estimated_duration_minutes=60,
            wage_budget_amount=800000,
            currency_code="IRR",
            item_cost_cap_amount=100000,
            execution_window_start_at=now + timedelta(days=1),
            execution_window_end_at=now + timedelta(days=2),
            proposal_deadline_at=now + timedelta(hours=12),
            delivery_criteria="Complete the requested work.",
            published_at=now,
        )

        self.bid_one = Bid.objects.create(
            task=self.task,
            executor_profile=self.profile_one,
            proposed_wage_amount=400000,
            proposed_duration_minutes=60,
            message="I can complete this task.",
            status=BidStatus.ACTIVE,
        )
        self.bid_two = Bid.objects.create(
            task=self.task,
            executor_profile=self.profile_two,
            proposed_wage_amount=450000,
            proposed_duration_minutes=60,
            message="I can also complete this task.",
            status=BidStatus.ACTIVE,
        )

        self.wallet = Wallet.objects.create(
            user=self.employer,
            currency_code="IRR",
            available_balance=2_000_000,
            reserved_balance=0,
        )
        self.client.force_authenticate(user=self.employer)

    def accept(self, bid=None, key="atomic-accept-001"):
        bid = bid or self.bid_one
        return self.client.post(
            f"/api/offers/employer/bids/{bid.pk}/accept/",
            {},
            format="json",
            HTTP_IDEMPOTENCY_KEY=key,
        )

    def test_success_reserves_funds_accepts_one_bid_and_rejects_competitors(self):
        response = self.accept()

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["task_status"], TaskStatus.ASSIGNED)
        self.assertEqual(response.data["status"], BidStatus.ACCEPTED)
        self.assertEqual(response.data["escrow_status"], EscrowStatus.HELD.value)
        self.assertEqual(response.data["reserved_amount"], 500000)
        self.assertEqual(response.data["labor_amount"], 400000)
        self.assertEqual(response.data["expense_amount"], 100000)
        self.assertEqual(response.data["platform_fee_rate_bps"], 1000)
        self.assertEqual(response.data["platform_fee_amount"], 40000)
        self.assertEqual(response.data["fee_payer"], "WORKER")
        self.assertEqual(response.data["currency_code"], "IRR")

        self.task.refresh_from_db()
        self.bid_one.refresh_from_db()
        self.bid_two.refresh_from_db()
        self.wallet.refresh_from_db()

        self.assertEqual(self.task.status, TaskStatus.ASSIGNED)
        self.assertEqual(self.bid_one.status, BidStatus.ACCEPTED)
        self.assertEqual(self.bid_two.status, BidStatus.REJECTED)
        self.assertEqual(self.wallet.available_balance, 1_500_000)
        self.assertEqual(self.wallet.reserved_balance, 500_000)
        self.assertEqual(self.wallet.total_balance, 2_000_000)

        reservation = EscrowReservation.objects.get(task=self.task)
        self.assertEqual(reservation.bid_id, self.bid_one.pk)
        self.assertEqual(reservation.status, EscrowStatus.HELD.value)
        self.assertEqual(reservation.amount, 500000)
        self.assertEqual(reservation.platform_fee_amount, 40000)

        ledger = WalletTransaction.objects.filter(
            wallet=self.wallet,
            escrow_reservation=reservation,
            transaction_type=WalletTransactionType.ESCROW_RESERVATION,
        )
        self.assertEqual(ledger.count(), 1)
        entry = ledger.get()
        self.assertEqual(entry.available_balance_delta, -500000)
        self.assertEqual(entry.reserved_balance_delta, 500000)

        self.assertTrue(TaskStatusHistory.objects.filter(
            task=self.task, to_status=TaskStatus.FUNDING_PENDING,
        ).exists())
        self.assertTrue(TaskStatusHistory.objects.filter(
            task=self.task, to_status=TaskStatus.ASSIGNED,
        ).exists())

        discovery_response = self.client.get(reverse("task-discovery-list"))
        self.assertEqual(discovery_response.status_code, 200, discovery_response.data)
        visible_task_ids = {
            row["task_id"] for row in discovery_response.data["results"]
        }
        self.assertNotIn(str(self.task.pk), visible_task_ids)

    def test_insufficient_balance_rolls_back_every_assignment_and_financial_write(self):
        self.wallet.available_balance = 499999
        self.wallet.save(update_fields=["available_balance", "updated_at"])

        response = self.accept(key="insufficient-001")

        self.assertEqual(response.status_code, 409, response.data)
        self.task.refresh_from_db()
        self.bid_one.refresh_from_db()
        self.bid_two.refresh_from_db()
        self.wallet.refresh_from_db()

        self.assertEqual(self.task.status, TaskStatus.OPEN)
        self.assertEqual(self.bid_one.status, BidStatus.ACTIVE)
        self.assertEqual(self.bid_two.status, BidStatus.ACTIVE)
        self.assertEqual(self.wallet.available_balance, 499999)
        self.assertEqual(self.wallet.reserved_balance, 0)
        self.assertFalse(EscrowReservation.objects.filter(task=self.task).exists())
        self.assertFalse(WalletTransaction.objects.filter(wallet=self.wallet).exists())
        self.assertFalse(IdempotencyRecord.objects.filter(
            user=self.employer,
            operation_type="BID_ESCROW_RESERVATION",
        ).exists())
        self.assertFalse(TaskStatusHistory.objects.filter(
            task=self.task, to_status=TaskStatus.FUNDING_PENDING,
        ).exists())

    def test_failure_after_wallet_reservation_rolls_back_the_outer_transaction(self):
        with patch(
            "offers.employer_bid_decisions.confirm_funded_bid",
            side_effect=BidDecisionConflict("Injected assignment failure."),
        ):
            response = self.accept(key="rollback-001")

        self.assertEqual(response.status_code, 409, response.data)
        self.task.refresh_from_db()
        self.bid_one.refresh_from_db()
        self.bid_two.refresh_from_db()
        self.wallet.refresh_from_db()

        self.assertEqual(self.task.status, TaskStatus.OPEN)
        self.assertEqual(self.bid_one.status, BidStatus.ACTIVE)
        self.assertEqual(self.bid_two.status, BidStatus.ACTIVE)
        self.assertEqual(self.wallet.available_balance, 2_000_000)
        self.assertEqual(self.wallet.reserved_balance, 0)
        self.assertFalse(EscrowReservation.objects.filter(task=self.task).exists())
        self.assertFalse(WalletTransaction.objects.filter(wallet=self.wallet).exists())
        self.assertFalse(IdempotencyRecord.objects.filter(
            user=self.employer,
            operation_type="BID_ESCROW_RESERVATION",
        ).exists())

    def test_same_idempotency_key_replays_the_original_success_without_duplicate_ledger(self):
        first = self.accept(key="replay-001")
        second = self.accept(key="replay-001")

        self.assertEqual(first.status_code, 200, first.data)
        self.assertEqual(second.status_code, 200, second.data)
        self.assertEqual(
            first.data["escrow_reservation_id"],
            second.data["escrow_reservation_id"],
        )
        self.assertEqual(EscrowReservation.objects.filter(task=self.task).count(), 1)
        self.assertEqual(WalletTransaction.objects.filter(wallet=self.wallet).count(), 1)
        self.assertEqual(
            TaskStatusHistory.objects.filter(
                task=self.task, to_status=TaskStatus.ASSIGNED,
            ).count(),
            1,
        )

    def test_same_assignment_with_a_new_idempotency_key_is_not_reserved_twice(self):
        first = self.accept(key="first-assignment-key")
        second = self.accept(key="second-assignment-key")

        self.assertEqual(first.status_code, 200, first.data)
        self.assertEqual(second.status_code, 409, second.data)
        self.assertEqual(EscrowReservation.objects.filter(task=self.task).count(), 1)
        self.assertEqual(WalletTransaction.objects.filter(wallet=self.wallet).count(), 1)

    def test_reusing_key_after_financial_inputs_change_is_rejected(self):
        first = self.accept(key="request-hash-001")
        self.assertEqual(first.status_code, 200, first.data)

        Bid.objects.filter(pk=self.bid_one.pk).update(proposed_wage_amount=401000)

        replay = self.accept(key="request-hash-001")

        self.assertEqual(replay.status_code, 409, replay.data)
        self.assertEqual(EscrowReservation.objects.filter(task=self.task).count(), 1)
        self.assertEqual(WalletTransaction.objects.filter(wallet=self.wallet).count(), 1)

    def test_ineligible_worker_cannot_be_assigned_or_funded(self):
        self.profile_one.verification_status = ExecutorProfile.VerificationStatus.REJECTED
        self.profile_one.save(update_fields=["verification_status"])

        response = self.accept(key="ineligible-001")

        self.assertEqual(response.status_code, 409, response.data)
        self.task.refresh_from_db()
        self.wallet.refresh_from_db()
        self.assertEqual(self.task.status, TaskStatus.OPEN)
        self.assertEqual(self.wallet.available_balance, 2_000_000)
        self.assertFalse(EscrowReservation.objects.filter(task=self.task).exists())

    def test_employer_cannot_accept_another_employers_bid(self):
        other_employer = User.objects.create_user(
            phone="09123110004",
            full_name="Other Employer",
            phone_verified_at=timezone.now(),
        )
        other_role = Role.objects.get(code="EMPLOYER")
        UserRole.objects.create(user=other_employer, role=other_role)
        self.client.force_authenticate(user=other_employer)

        response = self.accept(key="wrong-owner-001")

        self.assertEqual(response.status_code, 404)
        self.task.refresh_from_db()
        self.assertEqual(self.task.status, TaskStatus.OPEN)
        self.assertFalse(EscrowReservation.objects.filter(task=self.task).exists())


@skipUnlessDBFeature("has_select_for_update")
class ConcurrentAtomicBidAssignmentTests(TransactionTestCase):
    reset_sequences = True

    def setUp(self):
        employer_role, _ = Role.objects.get_or_create(
            code="EMPLOYER", defaults={"name": "Employer"},
        )
        executor_role, _ = Role.objects.get_or_create(
            code="EXECUTOR", defaults={"name": "Executor"},
        )

        self.employer = User.objects.create_user(
            phone="09123110101",
            full_name="Concurrent Employer",
            phone_verified_at=timezone.now(),
        )
        UserRole.objects.create(user=self.employer, role=employer_role)

        self.workers = []
        self.profiles = []
        for index in range(2):
            worker = User.objects.create_user(
                phone=f"0912311010{index + 2}",
                full_name=f"Concurrent Worker {index + 1}",
                phone_verified_at=timezone.now(),
            )
            UserRole.objects.create(user=worker, role=executor_role)
            profile = ExecutorProfile.objects.create(
                user=worker,
                verification_status=ExecutorProfile.VerificationStatus.APPROVED,
                profile_status="ACTIVE",
                approved_at=timezone.now(),
            )
            self.workers.append(worker)
            self.profiles.append(profile)

        category = TaskCategory.objects.create(name="Concurrent Assignment")
        now = timezone.now()
        self.task = Task.objects.create(
            employer_user=self.employer,
            category=category,
            title="Concurrent task",
            description="Only one bid may win.",
            status=TaskStatus.OPEN,
            estimated_duration_minutes=60,
            wage_budget_amount=900000,
            currency_code="IRR",
            item_cost_cap_amount=0,
            execution_window_start_at=now + timedelta(days=1),
            execution_window_end_at=now + timedelta(days=2),
            proposal_deadline_at=now + timedelta(hours=12),
            delivery_criteria="Complete the task.",
            published_at=now,
        )
        self.bids = [
            Bid.objects.create(
                task=self.task,
                executor_profile=self.profiles[0],
                proposed_wage_amount=400000,
                proposed_duration_minutes=60,
                message="Concurrent bid one",
                status=BidStatus.ACTIVE,
            ),
            Bid.objects.create(
                task=self.task,
                executor_profile=self.profiles[1],
                proposed_wage_amount=450000,
                proposed_duration_minutes=60,
                message="Concurrent bid two",
                status=BidStatus.ACTIVE,
            ),
        ]
        self.wallet = Wallet.objects.create(
            user=self.employer,
            currency_code="IRR",
            available_balance=2_000_000,
            reserved_balance=0,
        )

    def _post_accept(self, bid_id, key, barrier):
        close_old_connections()
        try:
            user = User.objects.get(pk=self.employer.pk)
            client = APIClient()
            client.force_authenticate(user=user)
            barrier.wait(timeout=10)
            response = client.post(
                f"/api/offers/employer/bids/{bid_id}/accept/",
                {},
                format="json",
                HTTP_IDEMPOTENCY_KEY=key,
            )
            return response.status_code
        finally:
            close_old_connections()

    def test_two_concurrent_accepts_cannot_assign_two_workers_or_double_reserve(self):
        barrier = Barrier(2)
        with ThreadPoolExecutor(max_workers=2) as pool:
            futures = [
                pool.submit(
                    self._post_accept,
                    str(self.bids[index].pk),
                    f"concurrent-key-{index}",
                    barrier,
                )
                for index in range(2)
            ]
            statuses = [future.result(timeout=30) for future in futures]

        self.assertEqual(sorted(statuses), [200, 409])
        self.task.refresh_from_db()
        self.wallet.refresh_from_db()

        self.assertEqual(self.task.status, TaskStatus.ASSIGNED)
        self.assertEqual(
            Bid.objects.filter(task=self.task, status=BidStatus.ACCEPTED).count(),
            1,
        )
        self.assertEqual(
            Bid.objects.filter(task=self.task, status=BidStatus.REJECTED).count(),
            1,
        )
        self.assertEqual(EscrowReservation.objects.filter(task=self.task).count(), 1)
        self.assertEqual(WalletTransaction.objects.filter(wallet=self.wallet).count(), 1)
        accepted_bid = Bid.objects.get(task=self.task, status=BidStatus.ACCEPTED)
        self.assertEqual(self.wallet.reserved_balance, accepted_bid.proposed_wage_amount)
