"""FS §7 lifecycle regression tests, on top of backend(2).zip tests."""
from datetime import timedelta

from django.core.management import call_command
from django.test import SimpleTestCase
from django.utils import timezone
from rest_framework.test import APITestCase
from rest_framework.exceptions import PermissionDenied

from accounts.models import ExecutorProfile, Role, User, UserRole
from offers.models import Bid, BidStatus, BidStatusHistory
from offers.employer_bid_decisions import (
    BidDecisionConflict, confirm_funded_bid, release_failed_funding,
)
from payments.lifecycle import (
    EscrowSnapshot, EscrowStatus, InvalidEscrowTransition,
    VerifiedFinancialEvent,
)
from reviews.dispute_lifecycle import (
    DisputeSnapshot, DisputeStatus, InvalidDisputeTransition,
)
from tasks.choices import TaskStatus
from tasks.lifecycle import TaskTransitionConflict, state_for, transition_task
from tasks.lifecycle.engine import EVENT_FOR_TRANSITION
from tasks.models import Task, TaskCategory, TaskStatusHistory


class FSMRuleTests(SimpleTestCase):
    def test_exact_fs_edges_have_corresponding_events(self):
        expected = {
            TaskStatus.DRAFT: {TaskStatus.OPEN, TaskStatus.CANCELLED},
            TaskStatus.OPEN: {TaskStatus.FUNDING_PENDING, TaskStatus.CANCELLED, TaskStatus.EXPIRED},
            TaskStatus.FUNDING_PENDING: {TaskStatus.ASSIGNED, TaskStatus.OPEN},
            TaskStatus.ASSIGNED: {TaskStatus.IN_PROGRESS, TaskStatus.CANCELLATION_REVIEW},
            TaskStatus.IN_PROGRESS: {TaskStatus.SUBMITTED, TaskStatus.CANCELLATION_REVIEW},
            TaskStatus.SUBMITTED: {TaskStatus.APPROVED, TaskStatus.DISPUTED},
            TaskStatus.APPROVED: {TaskStatus.COMPLETED},
            TaskStatus.DISPUTED: {TaskStatus.COMPLETED, TaskStatus.CANCELLED},
            TaskStatus.CANCELLATION_REVIEW: {TaskStatus.CANCELLED, TaskStatus.DISPUTED},
            TaskStatus.COMPLETED: set(),
            TaskStatus.CANCELLED: set(),
            TaskStatus.EXPIRED: set(),
        }
        self.assertEqual(set(expected), set(TaskStatus.values))
        for source, allowed in expected.items():
            self.assertEqual(state_for(source).allowed_targets(), allowed)
            for target in TaskStatus.values:
                if target in allowed:
                    state_for(source).validate(target)
                    self.assertIn((source, target), EVENT_FOR_TRANSITION)
                else:
                    with self.assertRaises(TaskTransitionConflict):
                        state_for(source).validate(target)

    def test_money_and_dispute_policies_are_not_task_states(self):
        escrow = EscrowSnapshot(EscrowStatus.INITIATED).transition(EscrowStatus.HELD)
        self.assertEqual(escrow.state, EscrowStatus.HELD)
        self.assertEqual(
            escrow.transition(EscrowStatus.PARTIALLY_SETTLED).state,
            EscrowStatus.PARTIALLY_SETTLED,
        )
        with self.assertRaises(InvalidEscrowTransition):
            escrow.transition(EscrowStatus.FAILED)
        dispute = DisputeSnapshot(DisputeStatus.OPEN).transition(DisputeStatus.UNDER_REVIEW)
        self.assertEqual(dispute.transition(DisputeStatus.DECIDED).state, DisputeStatus.DECIDED)
        with self.assertRaises(InvalidDisputeTransition):
            dispute.transition(DisputeStatus.OPEN)


class TaskFSMIntegrationTests(APITestCase):
    def setUp(self):
        self.employer_role, _ = Role.objects.get_or_create(
            code="EMPLOYER", defaults={"name": "Employer"},
        )
        executor_role, _ = Role.objects.get_or_create(
            code="EXECUTOR", defaults={"name": "Executor"},
        )
        self.employer = User.objects.create_user(
            phone="09123009001", full_name="Employer", phone_verified_at=timezone.now(),
        )
        UserRole.objects.create(user=self.employer, role=self.employer_role)
        self.executor = User.objects.create_user(
            phone="09123009002", full_name="Executor", phone_verified_at=timezone.now(),
        )
        UserRole.objects.create(user=self.executor, role=executor_role)
        self.profile = ExecutorProfile.objects.create(
            user=self.executor, verification_status="APPROVED",
            profile_status="ACTIVE", approved_at=timezone.now(),
        )
        self.other = User.objects.create_user(
            phone="09123009003", full_name="Executor 2", phone_verified_at=timezone.now(),
        )
        UserRole.objects.create(user=self.other, role=executor_role)
        self.profile_two = ExecutorProfile.objects.create(
            user=self.other, verification_status="APPROVED",
            profile_status="ACTIVE", approved_at=timezone.now(),
        )
        self.category = TaskCategory.objects.create(name="FS Test")
        now = timezone.now()
        self.task = Task.objects.create(
            employer_user=self.employer, category=self.category,
            title="Task", description="Task for FS lifecycle", status=TaskStatus.OPEN,
            published_at=now, estimated_duration_minutes=60,
            wage_budget_amount=500000, currency_code="IRR",
            execution_window_start_at=now + timedelta(days=1),
            execution_window_end_at=now + timedelta(days=2),
            proposal_deadline_at=now + timedelta(hours=12),
            delivery_criteria="Delivered",
        )
        self.bid = Bid.objects.create(
            task=self.task, executor_profile=self.profile,
            proposed_wage_amount=500000, proposed_duration_minutes=60,
            message="I can do it", status=BidStatus.ACTIVE,
        )
        self.bid_two = Bid.objects.create(
            task=self.task, executor_profile=self.profile_two,
            proposed_wage_amount=550000, proposed_duration_minutes=60,
            message="I can also do it", status=BidStatus.ACTIVE,
        )
        self.client.force_authenticate(user=self.employer)

    def finance_proof(self, state):
        return VerifiedFinancialEvent(
            state=state, escrow_reference="escrow-001",
            operation_reference=f"operation-{state.value}",
            idempotency_key=f"idem-{state.value}",
            task_reference=str(self.task.pk), bid_reference=str(self.bid.pk),
        )

    def _select_bid(self):
        response = self.client.post(
            f"/api/offers/employer/bids/{self.bid.pk}/accept/", {}, format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        return response

    def test_draft_create_and_publish_are_two_real_transitions(self):
        payload = {
            "category_id": str(self.category.pk),
            "title": "Second task", "description": "Detailed description",
            "estimated_duration_minutes": 75, "wage_budget_amount": 700000,
            "execution_window_start_at": (timezone.now() + timedelta(days=1)).isoformat(),
            "execution_window_end_at": (timezone.now() + timedelta(days=2)).isoformat(),
            "proposal_deadline_at": (timezone.now() + timedelta(hours=4)).isoformat(),
            "delivery_criteria": "Complete",
        }
        created = self.client.post("/api/tasks/", payload, format="json")
        self.assertEqual(created.status_code, 201, created.data)
        self.assertEqual(created.data["status"], TaskStatus.DRAFT)
        self.assertIsNone(created.data["published_at"])
        task_id = created.data["task_id"]
        published = self.client.post(f"/api/tasks/{task_id}/publish/", {}, format="json")
        self.assertEqual(published.status_code, 200, published.data)
        self.assertEqual(published.data["status"], TaskStatus.OPEN)
        history = list(TaskStatusHistory.objects.filter(task_id=task_id).order_by("created_at"))
        self.assertEqual([h.to_status for h in history], [TaskStatus.DRAFT, TaskStatus.OPEN])
        self.assertEqual([h.from_status for h in history], [None, TaskStatus.DRAFT])
        self.assertEqual(self.client.post(
            f"/api/tasks/{task_id}/publish/", {}, format="json",
        ).status_code, 409)

    def test_publishing_expired_draft_is_rejected(self):
        self.task.status = TaskStatus.DRAFT
        self.task.published_at = None
        self.task.proposal_deadline_at = timezone.now() - timedelta(hours=1)
        self.task.save(update_fields=["status", "published_at", "proposal_deadline_at"])
        response = self.client.post(
            f"/api/tasks/{self.task.pk}/publish/", {}, format="json",
        )
        self.assertEqual(response.status_code, 400, response.data)
        self.task.refresh_from_db()
        self.assertEqual(self.task.status, TaskStatus.DRAFT)

    def test_owner_and_executor_guards_protect_transitions(self):
        self.task.status = TaskStatus.DRAFT
        self.task.published_at = None
        self.task.save(update_fields=["status", "published_at"])
        from rest_framework.exceptions import PermissionDenied
        with self.assertRaises(PermissionDenied):
            transition_task(
                task_id=self.task.pk, target=TaskStatus.OPEN,
                event="publish", actor=self.executor, reason="not employer",
            )
        self.task.refresh_from_db()
        self.assertEqual(self.task.status, TaskStatus.DRAFT)

    def test_arbitration_needs_both_case_and_financial_decision(self):
        self.task.status = TaskStatus.SUBMITTED
        self.task.save(update_fields=["status"])
        with self.assertRaises(TaskTransitionConflict):
            transition_task(
                task_id=self.task.pk, target=TaskStatus.DISPUTED,
                event="dispute_opened", actor=self.employer, reason="no case",
            )
        transition_task(
            task_id=self.task.pk, target=TaskStatus.DISPUTED,
            event="dispute_opened", actor=self.employer,
            reason="dispute opened", metadata={"dispute_reference": "case-1"},
        )
        with self.assertRaises(TaskTransitionConflict):
            transition_task(
                task_id=self.task.pk, target=TaskStatus.CANCELLED,
                event="arbitration_refunded", actor=None,
                reason="no verified finance", metadata={"decision_reference": "ruling-1"},
            )
        transition_task(
            task_id=self.task.pk, target=TaskStatus.CANCELLED,
            event="arbitration_refunded", actor=None, reason="documented refund",
            metadata={"decision_reference": "ruling-1"},
            financial_event=self.finance_proof(EscrowStatus.REFUNDED),
        )
        self.task.refresh_from_db()
        self.assertEqual(self.task.status, TaskStatus.CANCELLED)

    def test_select_is_pending_until_funding_succeeds(self):
        response = self._select_bid()
        self.assertEqual(response.data["task_status"], TaskStatus.FUNDING_PENDING)
        self.assertEqual(response.data["status"], BidStatus.ACTIVE)
        self.task.refresh_from_db()
        self.bid.refresh_from_db()
        self.bid_two.refresh_from_db()
        self.assertEqual(self.task.status, TaskStatus.FUNDING_PENDING)
        self.assertEqual(self.bid.status, BidStatus.ACTIVE)
        self.assertEqual(self.bid_two.status, BidStatus.ACTIVE)
        row = TaskStatusHistory.objects.get(task=self.task, to_status=TaskStatus.FUNDING_PENDING)
        self.assertEqual(row.metadata["selected_bid_id"], str(self.bid.pk))
        self.assertEqual(row.metadata["event"], "bid_selected")
        self.assertEqual(self.client.post(
            f"/api/offers/employer/bids/{self.bid_two.pk}/accept/", {}, format="json",
        ).status_code, 409)

    def test_confirm_finance_is_atomic_and_rejects_other_bids_once(self):
        self._select_bid()
        with self.assertRaises(BidDecisionConflict):
            confirm_funded_bid(task_id=self.task.pk, financial_event=None)
        accepted, task = confirm_funded_bid(
            task_id=self.task.pk, financial_event=self.finance_proof(EscrowStatus.HELD),
        )
        self.assertEqual(task.status, TaskStatus.ASSIGNED)
        self.assertEqual(accepted.pk, self.bid.pk)
        self.bid.refresh_from_db()
        self.bid_two.refresh_from_db()
        self.assertEqual(self.bid.status, BidStatus.ACCEPTED)
        self.assertEqual(self.bid_two.status, BidStatus.REJECTED)
        self.assertEqual(BidStatusHistory.objects.filter(
            bid=self.bid, to_status=BidStatus.ACCEPTED,
        ).count(), 1)
        self.assertEqual(TaskStatusHistory.objects.filter(
            task=self.task, to_status=TaskStatus.ASSIGNED,
        ).count(), 1)
        with self.assertRaises(BidDecisionConflict):
            confirm_funded_bid(task_id=self.task.pk, financial_event=self.finance_proof(EscrowStatus.HELD))

    def test_wrong_task_ledger_confirmation_is_rejected(self):
        self._select_bid()
        bad = VerifiedFinancialEvent(
            state=EscrowStatus.HELD, escrow_reference="e", operation_reference="o",
            idempotency_key="i", task_reference="wrong-task",
            bid_reference=str(self.bid.pk),
        )
        with self.assertRaises(BidDecisionConflict):
            confirm_funded_bid(task_id=self.task.pk, financial_event=bad)
        self.task.refresh_from_db()
        self.assertEqual(self.task.status, TaskStatus.FUNDING_PENDING)

    def test_funding_failed_returns_to_open_without_picking_a_bid(self):
        self._select_bid()
        release_failed_funding(
            task_id=self.task.pk,
            financial_event=self.finance_proof(EscrowStatus.FAILED),
        )
        self.task.refresh_from_db()
        self.bid.refresh_from_db()
        self.assertEqual(self.task.status, TaskStatus.OPEN)
        self.assertEqual(self.bid.status, BidStatus.ACTIVE)

    def test_assigned_cannot_skip_to_completed_or_start_without_held_funds(self):
        with self.assertRaises(TaskTransitionConflict):
            transition_task(
                task_id=self.task.pk, target=TaskStatus.ASSIGNED,
                event="funding_confirmed", actor=self.employer, reason="forged",
                financial_event=self.finance_proof(EscrowStatus.HELD),
            )
        self.task.refresh_from_db()
        self.assertEqual(self.task.status, TaskStatus.OPEN)

    def test_execution_submission_approval_and_release_guards(self):
        self._select_bid()
        confirm_funded_bid(task_id=self.task.pk, financial_event=self.finance_proof(EscrowStatus.HELD))
        actions = [
            (TaskStatus.IN_PROGRESS, "execution_started", {}),
            (TaskStatus.SUBMITTED, "delivery_submitted", {"evidence_reference": "image-1"}),
            (TaskStatus.APPROVED, "delivery_approved", {}),
        ]
        for target, event, metadata in actions:
            transition_task(
                task_id=self.task.pk, target=target, event=event,
                actor=(self.executor if event in ("execution_started", "delivery_submitted") else self.employer),
                reason=event, metadata=metadata,
            )
        # An employer cannot impersonate the internal financial service.
        with self.assertRaises(PermissionDenied):
            transition_task(
                task_id=self.task.pk, target=TaskStatus.COMPLETED,
                event="settlement_confirmed", actor=self.employer, reason="unauthorized settlement",
            )
        # Even a system-initiated transition needs verified ledger evidence.
        with self.assertRaises(TaskTransitionConflict):
            transition_task(
                task_id=self.task.pk, target=TaskStatus.COMPLETED,
                event="settlement_confirmed", actor=None, reason="no receipt",
            )
        transition_task(
            task_id=self.task.pk, target=TaskStatus.COMPLETED,
            event="settlement_confirmed", actor=None,
            reason="ledger released", financial_event=self.finance_proof(EscrowStatus.RELEASED),
        )
        self.task.refresh_from_db()
        self.assertEqual(self.task.status, TaskStatus.COMPLETED)
        self.assertEqual(TaskStatusHistory.objects.filter(task=self.task).count(), 6)
        with self.assertRaises(TaskTransitionConflict):
            transition_task(
                task_id=self.task.pk, target=TaskStatus.OPEN, event="publish",
                actor=self.employer, reason="invalid reopen",
            )

    def test_cancelled_and_expired_are_terminal(self):
        self.task.status = TaskStatus.DRAFT
        self.task.published_at = None
        self.task.save(update_fields=["status", "published_at"])
        response = self.client.post(f"/api/tasks/{self.task.pk}/cancel/", {}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        with self.assertRaises(TaskTransitionConflict):
            transition_task(
                task_id=self.task.pk, target=TaskStatus.OPEN,
                event="publish", actor=self.employer, reason="invalid reopen",
            )

    def test_pending_cannot_be_cancelled_without_resolution(self):
        self._select_bid()
        response = self.client.post(f"/api/tasks/{self.task.pk}/cancel/", {}, format="json")
        self.assertEqual(response.status_code, 409, response.data)
        self.task.refresh_from_db()
        self.assertEqual(self.task.status, TaskStatus.FUNDING_PENDING)

    def test_expire_command_is_idempotent_and_expires_bids(self):
        self.task.proposal_deadline_at = timezone.now() - timedelta(minutes=1)
        self.task.save(update_fields=["proposal_deadline_at"])
        call_command("expire_open_tasks", verbosity=0)
        self.task.refresh_from_db()
        self.bid.refresh_from_db()
        self.assertEqual(self.task.status, TaskStatus.EXPIRED)
        self.assertEqual(self.bid.status, BidStatus.EXPIRED)
        self.assertEqual(TaskStatusHistory.objects.filter(
            task=self.task, to_status=TaskStatus.EXPIRED,
        ).count(), 1)
        call_command("expire_open_tasks", verbosity=0)
        self.assertEqual(TaskStatusHistory.objects.filter(task=self.task).count(), 1)
