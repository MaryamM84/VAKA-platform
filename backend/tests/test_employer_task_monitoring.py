"""Assigned executor and executor progress reports visible only to task employer."""
from datetime import timedelta

from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from accounts.models import ExecutorProfile, Role, User, UserRole
from execution.models import TaskProgressReport
from offers.models import Bid, BidStatus
from tasks.choices import TaskStatus
from tasks.models import Task, TaskCategory


class EmployerTaskMonitoringAPITests(APITestCase):
    def setUp(self):
        now = timezone.now()
        employer_role, _ = Role.objects.get_or_create(
            code="EMPLOYER", defaults={"name": "Employer"},
        )
        executor_role, _ = Role.objects.get_or_create(
            code="EXECUTOR", defaults={"name": "Executor"},
        )
        self.employer = User.objects.create_user(
            phone="09120001601", full_name="Task Employer", phone_verified_at=now,
        )
        self.other_employer = User.objects.create_user(
            phone="09120001602", full_name="Another Employer", phone_verified_at=now,
        )
        self.worker = User.objects.create_user(
            phone="09120001603", full_name="Assigned Worker", phone_verified_at=now,
        )
        UserRole.objects.create(user=self.employer, role=employer_role)
        UserRole.objects.create(user=self.other_employer, role=employer_role)
        UserRole.objects.create(user=self.worker, role=executor_role)
        self.profile = ExecutorProfile.objects.create(
            user=self.worker, verification_status="APPROVED", profile_status="ACTIVE",
        )
        category = TaskCategory.objects.create(name="Design")
        self.task = Task.objects.create(
            employer_user=self.employer, category=category,
            title="Shop design", description="Design mobile pages",
            status=TaskStatus.ASSIGNED, estimated_duration_minutes=120,
            wage_budget_amount=18000000, currency_code="IRR",
            execution_window_start_at=now - timedelta(hours=1),
            execution_window_end_at=now + timedelta(days=7),
            proposal_deadline_at=now - timedelta(days=1),
            delivery_criteria="Design files",
        )
        self.bid = Bid.objects.create(
            task=self.task, executor_profile=self.profile,
            status=BidStatus.ACCEPTED, proposed_wage_amount=18000000,
            proposed_duration_minutes=120, message="I can do it",
        )
        self.executor_url = reverse("employer-assigned-executor", kwargs={"task_id": self.task.pk})
        self.reports_url = reverse("employer-task-progress-reports", kwargs={"task_id": self.task.pk})
        self.client.force_authenticate(user=self.employer)

    def test_assigned_executor_available_but_phone_is_hidden_before_start(self):
        response = self.client.get(self.executor_url)
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["full_name"], "Assigned Worker")
        self.assertEqual(str(response.data["executor_profile_id"]), str(self.profile.pk))
        self.assertIsNone(response.data["phone"])
        self.assertFalse(response.data["can_view_phone"])
        self.assertNotIn("email", response.data)
        self.assertEqual(response["Cache-Control"], "private, no-store")

    def test_phone_available_after_start(self):
        self.task.status = TaskStatus.IN_PROGRESS
        self.task.save(update_fields=["status"])
        response = self.client.get(self.executor_url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["phone"], self.worker.phone)
        self.assertTrue(response.data["can_view_phone"])

    def test_employer_can_read_assigned_worker_reports(self):
        self.task.status = TaskStatus.IN_PROGRESS
        self.task.save(update_fields=["status"])
        report = TaskProgressReport.objects.create(
            task=self.task, executor_profile=self.profile,
            progress_percent=50, description="Completed wireframes", on_schedule=True,
        )
        response = self.client.get(self.reports_url)
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(str(response.data["results"][0]["report_id"]), str(report.pk))
        self.assertEqual(response.data["results"][0]["progress_percent"], 50)
        self.assertEqual(response.data["results"][0]["description"], "Completed wireframes")
        self.assertEqual(response["Cache-Control"], "private, no-store")

    def test_no_reports_returns_empty_page(self):
        response = self.client.get(self.reports_url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 0)
        self.assertEqual(response.data["results"], [])

    def test_other_employer_and_worker_cannot_access_task_data(self):
        self.client.force_authenticate(user=self.other_employer)
        self.assertEqual(self.client.get(self.executor_url).status_code, 404)
        self.assertEqual(self.client.get(self.reports_url).status_code, 404)
        self.client.force_authenticate(user=self.worker)
        self.assertEqual(self.client.get(self.executor_url).status_code, 403)
        self.assertEqual(self.client.get(self.reports_url).status_code, 403)

    def test_anonymous_user_cannot_read_task_data(self):
        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.get(self.executor_url).status_code, 401)
        self.assertEqual(self.client.get(self.reports_url).status_code, 401)

    def test_no_accepted_bid_is_not_assigned(self):
        self.bid.status = BidStatus.REJECTED
        self.bid.save(update_fields=["status"])
        self.assertEqual(self.client.get(self.executor_url).status_code, 404)
        self.assertEqual(self.client.get(self.reports_url).status_code, 404)

    def test_reports_are_read_only_for_employer(self):
        response = self.client.post(
            self.reports_url,
            {"progress_percent": 75, "description": "Trying to forge report", "on_schedule": True},
            format="json",
        )
        self.assertEqual(response.status_code, 405)
