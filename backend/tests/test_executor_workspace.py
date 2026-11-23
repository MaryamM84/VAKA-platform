"""Contract and authorization regression tests for the screenshot-driven workspace."""
from datetime import timedelta
from unittest.mock import patch

from django.utils import timezone
from rest_framework.test import APITestCase

from accounts.models import ExecutorProfile, Role, User, UserRole
from execution.models import TaskDelivery, TaskProgressReport
from offers.models import Bid, BidStatus
from payments.hold_gateway import VerifiedHeldReservation
from payments.lifecycle import EscrowStatus
from tasks.choices import TaskStatus
from tasks.models import Task, TaskCategory, TaskStatusHistory




class ExecutorWorkspaceTests(APITestCase):
    def setUp(self):
        now = timezone.now()
        executor_role, _ = Role.objects.get_or_create(
            code="EXECUTOR", defaults={"name": "Executor"},
        )
        employer_role, _ = Role.objects.get_or_create(
            code="EMPLOYER", defaults={"name": "Employer"},
        )
        self.worker = User.objects.create_user(
            phone="09120009901", full_name="Assigned Worker", phone_verified_at=now,
        )
        UserRole.objects.create(user=self.worker, role=executor_role)
        self.profile = ExecutorProfile.objects.create(
            user=self.worker, verification_status="APPROVED", profile_status="ACTIVE",
        )
        self.other_worker = User.objects.create_user(
            phone="09120009902", full_name="Outsider", phone_verified_at=now,
        )
        UserRole.objects.create(user=self.other_worker, role=executor_role)
        ExecutorProfile.objects.create(
            user=self.other_worker, verification_status="APPROVED", profile_status="ACTIVE",
        )
        self.employer = User.objects.create_user(
            phone="09120009903", full_name="Actual Employer", phone_verified_at=now,
        )
        UserRole.objects.create(user=self.employer, role=employer_role)
        self.category = TaskCategory.objects.create(name="UI/UX")
        self.task = Task.objects.create(
            employer_user=self.employer, category=self.category,
            title="Design an online shop", description="Design mobile UI and flows",
            status=TaskStatus.ASSIGNED, estimated_duration_minutes=240,
            wage_budget_amount=175000000, currency_code="IRR",
            execution_window_start_at=now - timedelta(hours=1),
            execution_window_end_at=now + timedelta(days=7),
            proposal_deadline_at=now - timedelta(days=1),
            delivery_criteria="Responsive Figma design and assets",
        )
        self.bid = Bid.objects.create(
            task=self.task, executor_profile=self.profile, status=BidStatus.ACCEPTED,
            proposed_wage_amount=175000000, proposed_duration_minutes=240,
            message="I can do it",
        )
        self.base = f"/api/executor/tasks/{self.task.pk}/"
        self.client.force_authenticate(user=self.worker)

    def test_list_and_detail_only_show_accepted_assigned_tasks(self):
        response = self.client.get("/api/executor/tasks/")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(str(response.data["results"][0]["task_id"]), str(self.task.pk))
        detail = self.client.get(self.base)
        self.assertEqual(detail.status_code, 200, detail.data)
        self.assertEqual(detail.data["employer"]["full_name"], "Actual Employer")
        self.assertEqual(detail.data["agreed_wage_amount"], 175000000)
        self.assertIsNone(detail.data["employer"]["average_rating"])
        self.assertNotIn("employer_phone", detail.data)
        self.assertEqual(detail.data["progress_percent"], 0)
        self.assertFalse(detail.data["can_start"])  # No verified hold persisted.

    def test_filter_status_validation(self):
        response = self.client.get("/api/executor/tasks/?status=UNKNOWN")
        self.assertEqual(response.status_code, 400)

    def test_employer_cannot_act_as_executor(self):
        self.client.force_authenticate(user=self.employer)
        self.assertEqual(self.client.get("/api/executor/tasks/").status_code, 403)

    def test_private_details_denied_until_actual_task_start(self):
        self.assertEqual(self.client.get(self.base + "private-details/").status_code, 403)
        self.task.status = TaskStatus.IN_PROGRESS
        self.task.save(update_fields=["status"])
        response = self.client.get(self.base + "private-details/")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["employer_phone"], self.employer.phone)
        self.assertEqual(response.data["locations"], [])

    def test_non_assigned_worker_cannot_read_or_modify(self):
        self.client.force_authenticate(user=self.other_worker)
        self.assertEqual(self.client.get(self.base).status_code, 404)
        self.assertEqual(self.client.get(self.base + "private-details/").status_code, 404)
        self.assertEqual(self.client.post(self.base + "progress-reports/", {
            "progress_percent": 25, "description": "Unauthorized report", "on_schedule": True,
        }, format="json").status_code, 404)

    def test_report_requires_in_progress(self):
        response = self.client.post(self.base + "progress-reports/", {
            "progress_percent": 25, "description": "Finished first step", "on_schedule": True,
        }, format="json")
        self.assertEqual(response.status_code, 409)
        self.assertEqual(TaskProgressReport.objects.count(), 0)

    def test_progress_is_persisted_and_cannot_decrease(self):
        self.task.status = TaskStatus.IN_PROGRESS
        self.task.save(update_fields=["status"])
        first = self.client.post(self.base + "progress-reports/", {
            "progress_percent": 50, "description": "Wireframes prepared", "on_schedule": True,
        }, format="json")
        self.assertEqual(first.status_code, 201, first.data)
        regression = self.client.post(self.base + "progress-reports/", {
            "progress_percent": 25, "description": "Regress", "on_schedule": False,
        }, format="json")
        self.assertEqual(regression.status_code, 409)
        detail = self.client.get(self.base)
        self.assertEqual(detail.data["progress_percent"], 50)
        self.assertEqual(detail.data["reports_count"], 1)
        self.assertIsInstance(detail.data["remaining_seconds"], int)
        self.assertEqual(self.client.get(self.base + "progress-reports/").data["count"], 1)

    def test_progress_validation_blocks_fake_client_fields(self):
        self.task.status = TaskStatus.IN_PROGRESS
        self.task.save(update_fields=["status"])
        for payload in [
            {"progress_percent": 30, "description": "X", "on_schedule": True},
            {"progress_percent": 25, "description": "   ", "on_schedule": True},
            {"progress_percent": 25, "description": "X", "on_schedule": True, "status": "COMPLETED"},
        ]:
            self.assertEqual(self.client.post(self.base + "progress-reports/", payload, format="json").status_code, 400)

    def test_final_delivery_is_recorded_then_lifecycle_transitioned(self):
        self.task.status = TaskStatus.IN_PROGRESS
        self.task.save(update_fields=["status"])
        response = self.client.post(self.base + "delivery/", {
            "summary": "Final Figma screens and clickable prototype delivered",
            "evidence_urls": ["https://www.figma.com/file/example"],
        }, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        self.task.refresh_from_db()
        self.assertEqual(self.task.status, TaskStatus.SUBMITTED)
        delivery = TaskDelivery.objects.get(task=self.task)
        event = TaskStatusHistory.objects.get(task=self.task, to_status=TaskStatus.SUBMITTED)
        self.assertEqual(event.metadata["evidence_reference"], str(delivery.pk))
        self.assertEqual(self.client.post(self.base + "delivery/", {
            "summary": "Duplicate", "evidence_urls": [],
        }, format="json").status_code, 409)
        self.assertEqual(TaskDelivery.objects.count(), 1)
        self.assertEqual(self.client.get(self.base + "delivery/").status_code, 200)

    def test_invalid_delivery_rejected(self):
        self.task.status = TaskStatus.IN_PROGRESS
        self.task.save(update_fields=["status"])
        response = self.client.post(self.base + "delivery/", {
            "summary": "Done", "evidence_urls": ["http://example.com/file"],
        }, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(TaskDelivery.objects.count(), 0)

    @patch("payments.hold_gateway.read_verified_held_reservation")
    def test_existing_start_endpoint_remains_finance_guarded(self, gateway):
        gateway.return_value = VerifiedHeldReservation(
            task_reference=str(self.task.pk), bid_reference=str(self.bid.pk),
            escrow_reference="escrow", operation_reference="operation",
            state=EscrowStatus.HELD,
        )
        started = self.client.post(f"/api/tasks/{self.task.pk}/start/", {}, format="json")
        self.assertEqual(started.status_code, 200, started.data)
        self.assertEqual(started.data["status"], TaskStatus.IN_PROGRESS)
        self.assertEqual(self.client.get(self.base + "private-details/").status_code, 200)
