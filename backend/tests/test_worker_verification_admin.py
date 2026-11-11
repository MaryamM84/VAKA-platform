
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from django.utils import timezone

from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import (
    User,
    Role,
    UserRole,
    ExecutorProfile,
    WorkerVerificationDocument,
)


class WorkerVerificationAdminAPITests(APITestCase):

    def setUp(self):

        self.admin = User.objects.create_user(
            phone="09120000501",
            full_name="Verification Admin",
            password="Strong-test-password-123!",
            phone_verified_at=timezone.now(),
        )

        self.applicant = User.objects.create_user(
            phone="09120000502",
            full_name="Worker Applicant",
            password="Strong-test-password-123!",
            phone_verified_at=timezone.now(),
        )

        self.admin_role, _ = Role.objects.get_or_create(
            code="ADMIN",
            defaults={"name": "Platform Administrator"},
        )

        self.employer_role, _ = Role.objects.get_or_create(
            code="EMPLOYER",
            defaults={"name": "Employer"},
        )

        UserRole.objects.get_or_create(
            user=self.admin,
            role=self.admin_role,
        )

        UserRole.objects.get_or_create(
            user=self.applicant,
            role=self.employer_role,
        )

        self.profile = ExecutorProfile.objects.create(
            user=self.applicant,
            verification_status=(
                ExecutorProfile.VerificationStatus.PENDING
            ),
            application_submitted_at=timezone.now(),
        )

        self.list_url = reverse(
            "worker_verification_admin:list"
        )

        self.detail_url = reverse(
            "worker_verification_admin:detail",
            kwargs={
                "executor_profile_id": self.profile.pk,
            },
        )

        self.approve_url = reverse(
            "worker_verification_admin:approve",
            kwargs={
                "executor_profile_id": self.profile.pk,
            },
        )

        self.reject_url = reverse(
            "worker_verification_admin:reject",
            kwargs={
                "executor_profile_id": self.profile.pk,
            },
        )

        self.client.force_authenticate(
            user=self.admin,
        )

        self.file_content = (
            b"%PDF-1.4\n"
            b"1 0 obj\n"
            b"<< /Type /Catalog >>\n"
            b"endobj\n"
            b"%%EOF"
        )

    def create_document(self):

        return WorkerVerificationDocument.objects.create(
            executor_profile=self.profile,
            document_type="NATIONAL_ID",
            file=SimpleUploadedFile(
                "identity.pdf",
                self.file_content,
                content_type="application/pdf",
            ),
            original_file_name="identity.pdf",
            mime_type="application/pdf",
            size_bytes=len(self.file_content),
        )

    def tearDown(self):

        for document in WorkerVerificationDocument.objects.all():

            if document.file and document.file.name:
                document.file.delete(save=False)

        super().tearDown()

    def test_anonymous_user_cannot_list_applications(self):

        self.client.force_authenticate(user=None)

        response = self.client.get(self.list_url)

        self.assertEqual(
            response.status_code,
            status.HTTP_401_UNAUTHORIZED,
        )

    def test_regular_user_cannot_list_applications(self):

        self.client.force_authenticate(
            user=self.applicant,
        )

        response = self.client.get(self.list_url)

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

    def test_admin_can_list_pending_applications(self):

        response = self.client.get(self.list_url)

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
            response.data,
        )

        self.assertEqual(
            len(response.data),
            1,
        )

        self.assertEqual(
            response.data[0]["verification_status"],
            "PENDING",
        )

    def test_admin_can_view_application_details(self):

        self.create_document()

        response = self.client.get(self.detail_url)

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
            response.data,
        )

        self.assertEqual(
            response.data["applicant"]["phone"],
            self.applicant.phone,
        )

        self.assertEqual(
            len(response.data["documents"]),
            1,
        )

        self.assertNotIn(
            "file",
            response.data["documents"][0],
        )

    def test_admin_can_download_private_document(self):

        document = self.create_document()

        url = reverse(
            "worker_verification_admin:document-download",
            kwargs={
                "executor_profile_id": self.profile.pk,
                "document_id": document.pk,
            },
        )

        response = self.client.get(url)

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.assertIn(
            "attachment",
            response["Content-Disposition"],
        )

        downloaded_content = b"".join(
            response.streaming_content
        )

        self.assertEqual(
            downloaded_content,
            self.file_content,
        )

    def test_regular_user_cannot_download_document(self):

        document = self.create_document()

        url = reverse(
            "worker_verification_admin:document-download",
            kwargs={
                "executor_profile_id": self.profile.pk,
                "document_id": document.pk,
            },
        )

        self.client.force_authenticate(
            user=self.applicant,
        )

        response = self.client.get(url)

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

    def test_admin_can_approve_application(self):

        response = self.client.post(
            self.approve_url,
            {},
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
            response.data,
        )

        self.profile.refresh_from_db()

        self.assertEqual(
            self.profile.verification_status,
            "APPROVED",
        )

        self.assertEqual(
            self.profile.reviewed_by_user,
            self.admin,
        )

        self.assertIsNotNone(
            self.profile.reviewed_at,
        )

        self.assertIsNotNone(
            self.profile.approved_at,
        )

        self.assertTrue(
            UserRole.objects.filter(
                user=self.applicant,
                role__code="EXECUTOR",
            ).exists()
        )

    def test_approval_preserves_existing_employer_role(self):

        self.client.post(
            self.approve_url,
            {},
            format="json",
        )

        self.assertTrue(
            UserRole.objects.filter(
                user=self.applicant,
                role__code="EMPLOYER",
            ).exists()
        )

    def test_executor_role_records_approving_admin(self):

        self.client.post(
            self.approve_url,
            {},
            format="json",
        )

        executor_user_role = UserRole.objects.get(
            user=self.applicant,
            role__code="EXECUTOR",
        )

        self.assertEqual(
            executor_user_role.assigned_by_user,
            self.admin,
        )

    def test_non_pending_application_cannot_be_approved(self):

        self.profile.verification_status = (
            ExecutorProfile.VerificationStatus.REJECTED
        )

        self.profile.save(
            update_fields=["verification_status"]
        )

        response = self.client.post(
            self.approve_url,
            {},
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_admin_can_reject_application(self):

        response = self.client.post(
            self.reject_url,
            {
                "reason": "Invalid identity document.",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
            response.data,
        )

        self.profile.refresh_from_db()

        self.assertEqual(
            self.profile.verification_status,
            "REJECTED",
        )

        self.assertEqual(
            self.profile.rejection_reason,
            "Invalid identity document.",
        )

        self.assertEqual(
            self.profile.reviewed_by_user,
            self.admin,
        )

        self.assertIsNotNone(
            self.profile.reviewed_at,
        )

        self.assertIsNone(
            self.profile.approved_at,
        )

    def test_rejection_requires_reason(self):

        response = self.client.post(
            self.reject_url,
            {"reason": ""},
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

        self.profile.refresh_from_db()

        self.assertEqual(
            self.profile.verification_status,
            "PENDING",
        )

    def test_non_pending_application_cannot_be_rejected(self):

        self.profile.verification_status = (
            ExecutorProfile.VerificationStatus.APPROVED
        )

        self.profile.save(
            update_fields=["verification_status"]
        )

        response = self.client.post(
            self.reject_url,
            {"reason": "Invalid document."},
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_unknown_application_returns_404(self):

        url = reverse(
            "worker_verification_admin:detail",
            kwargs={
                "executor_profile_id": (
                    "00000000-0000-0000-0000-000000000001"
                ),
            },
        )

        response = self.client.get(url)

        self.assertEqual(
            response.status_code,
            status.HTTP_404_NOT_FOUND,
        )
