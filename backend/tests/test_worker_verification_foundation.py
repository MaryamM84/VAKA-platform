
from types import SimpleNamespace

from django.test import TestCase
from django.utils import timezone

from accounts.models import (
    User,
    Role,
    UserRole,
    ExecutorProfile,
)

from accounts.permissions import IsVerificationAdmin


class WorkerVerificationFoundationTests(TestCase):

    def setUp(self):

        self.user = User.objects.create_user(
            phone="09120000801",
            full_name="Verification Applicant",
            password="Strong-test-password-123!",
            phone_verified_at=timezone.now(),
        )

        self.admin_user = User.objects.create_user(
            phone="09120000802",
            full_name="Verification Admin",
            password="Strong-test-password-123!",
            phone_verified_at=timezone.now(),
        )

        self.permission = IsVerificationAdmin()

    def test_admin_role_is_created(self):

        role = Role.objects.get(
            code="ADMIN",
        )

        self.assertEqual(
            role.name,
            "Platform Administrator",
        )

    def test_regular_user_cannot_review_verification(self):

        request = SimpleNamespace(
            user=self.user,
        )

        self.assertFalse(
            self.permission.has_permission(
                request,
                None,
            )
        )

    def test_admin_role_can_review_verification(self):

        admin_role = Role.objects.get(
            code="ADMIN",
        )

        UserRole.objects.create(
            user=self.admin_user,
            role=admin_role,
        )

        request = SimpleNamespace(
            user=self.admin_user,
        )

        self.assertTrue(
            self.permission.has_permission(
                request,
                None,
            )
        )

    def test_rejected_application_can_store_reviewer(self):

        profile = ExecutorProfile.objects.create(
            user=self.user,
            verification_status=(
                ExecutorProfile.VerificationStatus.REJECTED
            ),
            reviewed_by_user=self.admin_user,
            reviewed_at=timezone.now(),
            rejection_reason="Invalid identity document.",
        )

        profile.refresh_from_db()

        self.assertEqual(
            profile.reviewed_by_user,
            self.admin_user,
        )

        self.assertEqual(
            profile.verification_status,
            "REJECTED",
        )

        self.assertIsNotNone(
            profile.reviewed_at,
        )

        self.assertEqual(
            profile.rejection_reason,
            "Invalid identity document.",
        )
