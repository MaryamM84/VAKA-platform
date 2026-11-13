
from django.core.files.uploadedfile import SimpleUploadedFile
def new_test_png(name="national-card.png"):
    from io import BytesIO
    from PIL import Image
    buf = BytesIO()
    Image.new("RGB", (3, 3), (123, 45, 67)).save(buf, "PNG")
    return SimpleUploadedFile(name, buf.getvalue(), content_type="image/png")


from django.urls import reverse
from django.utils import timezone
from django.test import override_settings

from rest_framework import status
from rest_framework.test import APITestCase, APIClient

from accounts.models import (
    User,
    Role,
    UserRole,
    ExecutorProfile,
    WorkerVerificationDocument,
)


TEST_FERNET = "e2NeeKHZKKOBso4UwLtFkyDfzvoDQ70zGwV4qEGfeEc="
TEST_HMAC = "test-only-hmac-key-for-verification-tests-abcdefgh123456789"

@override_settings(
    VERIFICATION_PII_ENCRYPTION_KEY=TEST_FERNET,
    VERIFICATION_PII_HASH_KEY=TEST_HMAC,
)
class WorkerVerificationLifecycleTests(APITestCase):

    def setUp(self):

        self.applicant = User.objects.create_user(
            phone="09120000701",
            full_name="Lifecycle Applicant",
            password="Strong-test-password-123!",
            phone_verified_at=timezone.now(),
        )

        self.admin = User.objects.create_user(
            phone="09120000702",
            full_name="Lifecycle Admin",
            password="Strong-test-password-123!",
            phone_verified_at=timezone.now(),
        )

        self.admin_role = Role.objects.get(
            code="ADMIN",
        )

        UserRole.objects.get_or_create(
            user=self.admin,
            role=self.admin_role,
        )

        self.employer_role, _ = Role.objects.get_or_create(
            code="EMPLOYER",
            defaults={"name": "Employer"},
        )

        UserRole.objects.get_or_create(
            user=self.applicant,
            role=self.employer_role,
        )

        self.applicant_client = APIClient()
        self.admin_client = APIClient()

        self.applicant_client.force_authenticate(
            user=self.applicant,
        )

        self.admin_client.force_authenticate(
            user=self.admin,
        )

        self.status_url = reverse(
            "profile:worker-verification-status"
        )

        self.identity_url = reverse("profile:worker-verification-identity")
        self.submit_url = reverse(
            "profile:worker-verification-submit"
        )

        self.upload_url = reverse(
            "profile:worker-verification-document-upload"
        )

        self.admin_list_url = reverse(
            "worker_verification_admin:list"
        )

        self.file_content = new_test_png().read()

    def make_pdf(self):
        return SimpleUploadedFile(
            "identity.png", self.file_content, content_type="image/png",
        )

    def tearDown(self):

        for document in WorkerVerificationDocument.objects.filter(
            executor_profile__user=self.applicant,
        ):

            if document.file and document.file.name:
                document.file.storage.delete(
                    document.file.name,
                )

        super().tearDown()

    def test_complete_worker_verification_lifecycle(self):

        # 1. Initial verification status

        response = self.applicant_client.get(
            self.status_url,
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.assertEqual(
            response.data["verification_status"],
            "NOT_SUBMITTED",
        )

        # 2. Upload verification document

        identity_response = self.applicant_client.put(self.identity_url, {
            "first_name": "Test", "last_name": "Applicant",
            "national_code": "1234567891", "birth_date": "2000-01-15",
            "iban": "IR820540102680020817909002",
            "mobile": self.applicant.phone,
        }, format="json")
        self.assertEqual(identity_response.status_code, 200, identity_response.data)

        for kind in ("NATIONAL_CARD_FRONT", "NATIONAL_CARD_BACK"):
            response = self.applicant_client.post(
                self.upload_url,
                {"document_type": kind, "file": self.make_pdf()},
                format="multipart",
            )
            self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)

        profile = ExecutorProfile.objects.get(
            user=self.applicant,
        )

        document = WorkerVerificationDocument.objects.filter(
            executor_profile=profile,
        ).first()

        # 3. Submit application

        response = self.applicant_client.post(
            self.submit_url,
            {},
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
            response.data,
        )

        self.assertEqual(
            response.data["verification_status"],
            "PENDING",
        )

        # 4. Admin lists pending applications

        response = self.admin_client.get(
            self.admin_list_url,
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.assertEqual(
            len(response.data),
            1,
        )

        # 5. Admin views application details

        detail_url = reverse(
            "worker_verification_admin:detail",
            kwargs={
                "executor_profile_id": profile.pk,
            },
        )

        response = self.admin_client.get(
            detail_url,
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.assertEqual(
            len(response.data["documents"]),
            2,
        )

        # 6. Admin downloads document

        download_url = reverse(
            "worker_verification_admin:document-download",
            kwargs={
                "executor_profile_id": profile.pk,
                "document_id": document.pk,
            },
        )

        response = self.admin_client.get(
            download_url,
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        downloaded_content = b"".join(
            response.streaming_content
        )

        self.assertEqual(
            downloaded_content,
            self.file_content,
        )

        # 7. Admin rejects first application

        reject_url = reverse(
            "worker_verification_admin:reject",
            kwargs={
                "executor_profile_id": profile.pk,
            },
        )

        response = self.admin_client.post(
            reject_url,
            {
                "reason": "Please upload a clearer identity document.",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
            response.data,
        )

        profile.refresh_from_db()

        self.assertEqual(
            profile.verification_status,
            "REJECTED",
        )

        # 8. Applicant sees rejection reason

        response = self.applicant_client.get(
            self.status_url,
        )

        self.assertEqual(
            response.data["verification_status"],
            "REJECTED",
        )

        self.assertEqual(
            response.data["rejection_reason"],
            "Please upload a clearer identity document.",
        )

        # Rejected application should no longer be pending

        response = self.admin_client.get(
            self.admin_list_url,
        )

        self.assertEqual(
            len(response.data),
            0,
        )

        # 9. Applicant resubmits application

        response = self.applicant_client.post(
            self.submit_url,
            {},
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
            response.data,
        )

        self.assertEqual(
            response.data["verification_status"],
            "PENDING",
        )

        # 10. Admin approves second application

        approve_url = reverse(
            "worker_verification_admin:approve",
            kwargs={
                "executor_profile_id": profile.pk,
            },
        )

        response = self.admin_client.post(
            approve_url,
            {},
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
            response.data,
        )

        profile.refresh_from_db()

        self.assertEqual(
            profile.verification_status,
            "APPROVED",
        )

        self.assertEqual(
            profile.reviewed_by_user,
            self.admin,
        )

        self.assertIsNotNone(
            profile.approved_at,
        )

        self.assertIsNone(
            profile.rejection_reason,
        )

        # 11. Executor role must be activated

        executor_role = Role.objects.get(
            code="EXECUTOR",
        )

        executor_user_role = UserRole.objects.get(
            user=self.applicant,
            role=executor_role,
        )

        self.assertEqual(
            executor_user_role.assigned_by_user,
            self.admin,
        )

        # Existing employer role must remain

        self.assertTrue(
            UserRole.objects.filter(
                user=self.applicant,
                role=self.employer_role,
            ).exists()
        )

        # 12. Applicant sees approved status

        response = self.applicant_client.get(
            self.status_url,
        )

        self.assertEqual(
            response.data["verification_status"],
            "APPROVED",
        )

        # 13. Approved application cannot be submitted again

        response = self.applicant_client.post(
            self.submit_url,
            {},
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_409_CONFLICT,
        )

        # Final database state

        profile.refresh_from_db()

        self.assertEqual(
            profile.verification_status,
            "APPROVED",
        )
