"""T3-03: executor eligibility, protected commencement and finance boundary."""
from datetime import timedelta
from unittest.mock import patch

from django.utils import timezone
from rest_framework.test import APITestCase

from accounts.models import ExecutorProfile, Role, User, UserRole
from offers.employer_bid_decisions import BidDecisionConflict, confirm_funded_bid
from offers.models import Bid, BidStatus
from payments.hold_gateway import VerifiedHeldReservation
from payments.lifecycle import EscrowStatus, VerifiedFinancialEvent
from tasks.choices import TaskStatus
from tasks.models import Task, TaskCategory, TaskStatusHistory


class ExecutionStartAPITests(APITestCase):
    def setUp(self):
        executor_role, _ = Role.objects.get_or_create(
            code="EXECUTOR", defaults={"name": "Executor"},
        )
        employer_role, _ = Role.objects.get_or_create(
            code="EMPLOYER", defaults={"name": "Employer"},
        )
        now = timezone.now()
        self.employer = User.objects.create_user(
            phone="09123333001", full_name="Employer", phone_verified_at=now,
        )
        UserRole.objects.create(user=self.employer, role=employer_role)
        self.executor = User.objects.create_user(
            phone="09123333002", full_name="Executor", phone_verified_at=now,
        )
        UserRole.objects.create(user=self.executor, role=executor_role)
        self.profile = ExecutorProfile.objects.create(
            user=self.executor, verification_status="APPROVED", profile_status="ACTIVE",
            approved_at=now,
        )
        self.outsider = User.objects.create_user(
            phone="09123333003", full_name="Other executor", phone_verified_at=now,
        )
        UserRole.objects.create(user=self.outsider, role=executor_role)
        self.other_profile = ExecutorProfile.objects.create(
            user=self.outsider, verification_status="APPROVED", profile_status="ACTIVE",
            approved_at=now,
        )
        self.category = TaskCategory.objects.create(name="Execution start test")
        self.task = Task.objects.create(
            employer_user=self.employer, category=self.category, status=TaskStatus.ASSIGNED,
            title="Assigned task", description="A task about to be started",
            published_at=now, estimated_duration_minutes=60,
            wage_budget_amount=100000, currency_code="IRR",
            execution_window_start_at=now + timedelta(hours=1),
            execution_window_end_at=now + timedelta(hours=4),
            proposal_deadline_at=now + timedelta(minutes=30),
            delivery_criteria="Complete it",
        )
        self.bid = Bid.objects.create(
            task=self.task, executor_profile=self.profile,
            proposed_wage_amount=100000, proposed_duration_minutes=60,
            message="I will do it", status=BidStatus.ACCEPTED,
        )
        self.other_bid = Bid.objects.create(
            task=self.task, executor_profile=self.other_profile,
            proposed_wage_amount=100000, proposed_duration_minutes=60,
            message="Other offer", status=BidStatus.REJECTED,
        )
        self.url = f"/api/tasks/{self.task.pk}/start/"
        self.client.force_authenticate(user=self.executor)

    def hold(self, *, state=EscrowStatus.HELD, task_id=None, bid_id=None):
        return VerifiedHeldReservation(
            task_reference=str(task_id or self.task.pk),
            bid_reference=str(bid_id or self.bid.pk),
            escrow_reference="escrow-1", operation_reference="hold-operation-1",
            state=state,
        )

    @patch("payments.hold_gateway.read_verified_held_reservation")
    def test_assigned_verified_executor_can_start_with_authoritative_held_escrow(self, gateway):
        gateway.return_value = self.hold()
        original_version = self.task.version
        response = self.client.post(self.url, {}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["status"], TaskStatus.IN_PROGRESS)
        self.assertEqual(response.data["version"], original_version + 1)
        gateway.assert_called_once_with(task_id=self.task.pk, bid_id=self.bid.pk)
        self.task.refresh_from_db()
        self.assertEqual(self.task.status, TaskStatus.IN_PROGRESS)
        event = TaskStatusHistory.objects.get(task=self.task, to_status=TaskStatus.IN_PROGRESS)
        self.assertEqual(event.from_status, TaskStatus.ASSIGNED)
        self.assertEqual(event.changed_by_user_id, self.executor.pk)
        self.assertEqual(event.metadata["event"], "execution_started")
        self.assertEqual(event.metadata["escrow_reference"], "escrow-1")
        self.assertEqual(event.metadata["accepted_bid_id"], str(self.bid.pk))

    def test_gateway_not_integrated_fails_closed(self):
        response = self.client.post(self.url, {}, format="json")
        self.assertEqual(response.status_code, 409, response.data)
        self.task.refresh_from_db()
        self.assertEqual(self.task.status, TaskStatus.ASSIGNED)
        self.assertFalse(TaskStatusHistory.objects.filter(task=self.task).exists())

    @patch("payments.hold_gateway.read_verified_held_reservation")
    def test_second_start_is_rejected_without_second_history(self, gateway):
        gateway.return_value = self.hold()
        self.assertEqual(self.client.post(self.url, {}, format="json").status_code, 200)
        self.assertEqual(self.client.post(self.url, {}, format="json").status_code, 409)
        self.assertEqual(TaskStatusHistory.objects.filter(task=self.task).count(), 1)
        gateway.assert_called_once()

    @patch("payments.hold_gateway.read_verified_held_reservation")
    def test_wrong_task_hold_is_rejected(self, gateway):
        import uuid
        gateway.return_value = self.hold(task_id=uuid.uuid4())
        self.assertEqual(self.client.post(self.url, {}, format="json").status_code, 409)
        self.assertEqual(TaskStatusHistory.objects.filter(task=self.task).count(), 0)

    @patch("payments.hold_gateway.read_verified_held_reservation")
    def test_wrong_bid_hold_is_rejected(self, gateway):
        gateway.return_value = self.hold(bid_id=self.other_bid.pk)
        self.assertEqual(self.client.post(self.url, {}, format="json").status_code, 409)

    @patch("payments.hold_gateway.read_verified_held_reservation")
    def test_not_held_escrow_is_rejected(self, gateway):
        gateway.return_value = self.hold(state=EscrowStatus.RELEASED)
        self.assertEqual(self.client.post(self.url, {}, format="json").status_code, 409)

    @patch("payments.hold_gateway.read_verified_held_reservation")
    def test_string_held_state_is_not_accepted_as_financial_proof(self, gateway):
        gateway.return_value = self.hold(state="HELD")
        self.assertEqual(self.client.post(self.url, {}, format="json").status_code, 409)

    @patch("payments.hold_gateway.read_verified_held_reservation")
    def test_blank_finance_operation_reference_is_rejected(self, gateway):
        from dataclasses import replace
        gateway.return_value = replace(self.hold(), operation_reference="")
        self.assertEqual(self.client.post(self.url, {}, format="json").status_code, 409)

    @patch("payments.hold_gateway.read_verified_held_reservation")
    def test_plain_json_or_untrusted_hold_is_rejected(self, gateway):
        gateway.return_value = {"state": "HELD", "task_reference": str(self.task.pk)}
        self.assertEqual(self.client.post(self.url, {}, format="json").status_code, 409)

    @patch("payments.hold_gateway.read_verified_held_reservation")
    def test_unassigned_executor_is_forbidden(self, gateway):
        self.client.force_authenticate(user=self.outsider)
        response = self.client.post(self.url, {}, format="json")
        self.assertEqual(response.status_code, 403, response.data)
        gateway.assert_not_called()

    @patch("payments.hold_gateway.read_verified_held_reservation")
    def test_employer_cannot_start_execution(self, gateway):
        self.client.force_authenticate(user=self.employer)
        self.assertEqual(self.client.post(self.url, {}, format="json").status_code, 403)
        gateway.assert_not_called()

    def test_anonymous_cannot_start_execution(self):
        self.client.force_authenticate(user=None)
        response = self.client.post(self.url, {}, format="json")
        self.assertEqual(response.status_code, 401, response.data)

    @patch("payments.hold_gateway.read_verified_held_reservation")
    def test_unapproved_executor_is_forbidden(self, gateway):
        self.profile.verification_status = "REJECTED"
        self.profile.save(update_fields=["verification_status"])
        self.assertEqual(self.client.post(self.url, {}, format="json").status_code, 403)
        gateway.assert_not_called()

    @patch("payments.hold_gateway.read_verified_held_reservation")
    def test_inactive_profile_is_forbidden(self, gateway):
        self.profile.profile_status = "INACTIVE"
        self.profile.save(update_fields=["profile_status"])
        self.assertEqual(self.client.post(self.url, {}, format="json").status_code, 403)
        gateway.assert_not_called()

    @patch("payments.hold_gateway.read_verified_held_reservation")
    def test_suspended_account_is_forbidden(self, gateway):
        self.executor.account_status = User.AccountStatus.SUSPENDED
        self.executor.save(update_fields=["account_status"])
        self.assertEqual(self.client.post(self.url, {}, format="json").status_code, 403)
        gateway.assert_not_called()

    @patch("payments.hold_gateway.read_verified_held_reservation")
    def test_executor_role_removed_is_forbidden(self, gateway):
        UserRole.objects.filter(user=self.executor, role__code="EXECUTOR").delete()
        self.assertEqual(self.client.post(self.url, {}, format="json").status_code, 403)
        gateway.assert_not_called()

    @patch("payments.hold_gateway.read_verified_held_reservation")
    def test_not_assigned_state_is_rejected(self, gateway):
        self.task.status = TaskStatus.FUNDING_PENDING
        self.task.save(update_fields=["status"])
        self.assertEqual(self.client.post(self.url, {}, format="json").status_code, 409)
        gateway.assert_not_called()

    @patch("payments.hold_gateway.read_verified_held_reservation")
    def test_missing_accepted_bid_is_rejected(self, gateway):
        self.bid.status = BidStatus.ACTIVE
        self.bid.save(update_fields=["status"])
        self.assertEqual(self.client.post(self.url, {}, format="json").status_code, 409)
        gateway.assert_not_called()

    @patch("payments.hold_gateway.read_verified_held_reservation")
    def test_deleted_task_is_rejected(self, gateway):
        self.task.deleted_at = timezone.now()
        self.task.save(update_fields=["deleted_at"])
        self.assertEqual(self.client.post(self.url, {}, format="json").status_code, 409)
        gateway.assert_not_called()

    @patch("payments.hold_gateway.read_verified_held_reservation")
    def test_client_cannot_inject_fake_held_state(self, gateway):
        response = self.client.post(self.url, {"escrow_status": "HELD"}, format="json")
        self.assertEqual(response.status_code, 400, response.data)
        gateway.assert_not_called()

    def test_missing_task_returns_not_found(self):
        import uuid
        response = self.client.post(f"/api/tasks/{uuid.uuid4()}/start/", {}, format="json")
        self.assertEqual(response.status_code, 404, response.data)


class FundingConfirmationEligibilityTests(APITestCase):
    """A worker's eligibility must be checked again AFTER funds are held."""

    def setUp(self):
        executor_role, _ = Role.objects.get_or_create(
            code="EXECUTOR", defaults={"name": "Executor"},
        )
        now = timezone.now()
        self.executor = User.objects.create_user(
            phone="09123333101", full_name="Executor", phone_verified_at=now,
        )
        UserRole.objects.create(user=self.executor, role=executor_role)
        self.profile = ExecutorProfile.objects.create(
            user=self.executor, verification_status="APPROVED",
            profile_status="ACTIVE", approved_at=now,
        )
        self.employer = User.objects.create_user(
            phone="09123333102", full_name="Employer", phone_verified_at=now,
        )
        category = TaskCategory.objects.create(name="Funding eligibility test")
        self.task = Task.objects.create(
            employer_user=self.employer, category=category, status=TaskStatus.FUNDING_PENDING,
            title="Pending funds", description="Bid selected, awaiting financial confirmation",
            published_at=now, estimated_duration_minutes=60,
            wage_budget_amount=100000, currency_code="IRR",
            execution_window_start_at=now + timedelta(hours=1),
            execution_window_end_at=now + timedelta(hours=4),
            proposal_deadline_at=now + timedelta(minutes=30),
            delivery_criteria="Complete it",
        )
        self.bid = Bid.objects.create(
            task=self.task, executor_profile=self.profile,
            proposed_wage_amount=100000, proposed_duration_minutes=60,
            message="I can do it", status=BidStatus.ACTIVE,
        )
        TaskStatusHistory.objects.create(
            task=self.task, from_status=TaskStatus.OPEN,
            to_status=TaskStatus.FUNDING_PENDING,
            reason="Bid selected",
            metadata={"selected_bid_id": str(self.bid.pk), "event": "bid_selected"},
        )

    def finance_event(self):
        return VerifiedFinancialEvent(
            state=EscrowStatus.HELD,
            escrow_reference="escrow-funded",
            operation_reference="hold-001",
            idempotency_key="hold-001-idem",
            task_reference=str(self.task.pk), bid_reference=str(self.bid.pk),
        )

    def assert_assignment_rejected(self):
        with self.assertRaises(BidDecisionConflict):
            confirm_funded_bid(task_id=self.task.pk, financial_event=self.finance_event())
        self.task.refresh_from_db()
        self.bid.refresh_from_db()
        self.assertEqual(self.task.status, TaskStatus.FUNDING_PENDING)
        self.assertEqual(self.bid.status, BidStatus.ACTIVE)
        self.assertFalse(TaskStatusHistory.objects.filter(
            task=self.task, to_status=TaskStatus.ASSIGNED,
        ).exists())

    def test_funding_confirmation_with_eligible_executor_assigns(self):
        confirm_funded_bid(task_id=self.task.pk, financial_event=self.finance_event())
        self.task.refresh_from_db()
        self.bid.refresh_from_db()
        self.assertEqual(self.task.status, TaskStatus.ASSIGNED)
        self.assertEqual(self.bid.status, BidStatus.ACCEPTED)

    def test_unverified_after_selection_cannot_be_assigned(self):
        self.profile.verification_status = "REJECTED"
        self.profile.save(update_fields=["verification_status"])
        self.assert_assignment_rejected()

    def test_profile_disabled_after_selection_cannot_be_assigned(self):
        self.profile.profile_status = "INACTIVE"
        self.profile.save(update_fields=["profile_status"])
        self.assert_assignment_rejected()

    def test_suspended_user_after_selection_cannot_be_assigned(self):
        self.executor.account_status = User.AccountStatus.SUSPENDED
        self.executor.save(update_fields=["account_status"])
        self.assert_assignment_rejected()

    def test_role_revoked_after_selection_cannot_be_assigned(self):
        UserRole.objects.filter(user=self.executor, role__code="EXECUTOR").delete()
        self.assert_assignment_rejected()
