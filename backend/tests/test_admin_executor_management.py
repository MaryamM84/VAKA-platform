"""Admin executor list and historical verification application API tests."""
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from accounts.models import ExecutorProfile, Role, User, UserRole


class AdminExecutorManagementAPITests(APITestCase):
    def setUp(self):
        admin_role, _ = Role.objects.get_or_create(
            code="ADMIN", defaults={"name": "Administrator"},
        )
        executor_role, _ = Role.objects.get_or_create(
            code="EXECUTOR", defaults={"name": "Executor"},
        )
        self.admin = User.objects.create_user(
            phone="09120001401", full_name="Admin", phone_verified_at=timezone.now(),
        )
        self.outsider = User.objects.create_user(
            phone="09120001402", full_name="Outsider", phone_verified_at=timezone.now(),
        )
        UserRole.objects.create(user=self.admin, role=admin_role)
        now = timezone.now()
        self.worker = User.objects.create_user(
            phone="09120001403", full_name="Approved Worker", phone_verified_at=now,
        )
        UserRole.objects.create(user=self.worker, role=executor_role)
        self.approved = ExecutorProfile.objects.create(
            user=self.worker, verification_status="APPROVED",
            application_submitted_at=now, reviewed_at=now, approved_at=now,
        )
        self.pending = ExecutorProfile.objects.create(
            user=User.objects.create_user(phone="09120001404", full_name="Pending"),
            verification_status="PENDING", application_submitted_at=now,
        )
        self.rejected = ExecutorProfile.objects.create(
            user=User.objects.create_user(phone="09120001405", full_name="Rejected"),
            verification_status="REJECTED", application_submitted_at=now,
            reviewed_at=now, rejection_reason="Insufficient documents",
        )
        self.not_submitted = ExecutorProfile.objects.create(
            user=User.objects.create_user(phone="09120001406", full_name="Draft"),
            verification_status="NOT_SUBMITTED",
        )
        self.executor_url = reverse("admin-executor-list")
        self.applications_url = reverse("worker_verification_admin:applications")
        self.legacy_url = reverse("worker_verification_admin:list")
        self.client.force_authenticate(user=self.admin)

    def test_executor_list_only_contains_approved_role_holders(self):
        response = self.client.get(self.executor_url)
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["count"], 1)
        row = response.data["results"][0]
        self.assertEqual(str(row["executor_profile_id"]), str(self.approved.pk))
        self.assertEqual(row["full_name"], "Approved Worker")
        self.assertEqual(row["completed_tasks_count"], 0)
        self.assertNotIn("national_code_encrypted", row)
        self.assertEqual(response["Cache-Control"], "private, no-store")

    def test_applications_support_status_filters_and_exclude_drafts(self):
        for status_filter, expected_status, count in [
            ("ALL", None, 3),
            ("PENDING", "PENDING", 1),
            ("APPROVED", "APPROVED", 1),
            ("REJECTED", "REJECTED", 1),
        ]:
            response = self.client.get(self.applications_url, {"status": status_filter})
            self.assertEqual(response.status_code, 200, response.data)
            self.assertEqual(response.data["count"], count)
            if expected_status:
                self.assertEqual(response.data["results"][0]["verification_status"], expected_status)
        rejected = self.client.get(self.applications_url, {"status": "REJECTED"})
        self.assertEqual(rejected.data["results"][0]["rejection_reason"], "Insufficient documents")

    def test_applications_pagination(self):
        response = self.client.get(self.applications_url, {"page_size": 1})
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["count"], 3)
        self.assertEqual(len(response.data["results"]), 1)
        self.assertIsNotNone(response.data["next"])

    def test_invalid_status_returns_400(self):
        response = self.client.get(self.applications_url, {"status": "NOT_SUBMITTED"})
        self.assertEqual(response.status_code, 400)

    def test_legacy_pending_endpoint_still_returns_bare_list(self):
        response = self.client.get(self.legacy_url)
        self.assertEqual(response.status_code, 200, response.data)
        self.assertIsInstance(response.data, list)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["verification_status"], "PENDING")

    def test_non_admin_and_anonymous_cannot_read_lists(self):
        for user, expected_code in [(self.outsider, 403), (None, 401)]:
            self.client.force_authenticate(user=user)
            self.assertEqual(self.client.get(self.executor_url).status_code, expected_code)
            self.assertEqual(self.client.get(self.applications_url).status_code, expected_code)
