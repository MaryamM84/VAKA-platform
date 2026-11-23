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
