
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
from rest_framework.test import APITestCase

from accounts.models import (
    User,
    ExecutorProfile,
    WorkerVerificationDocument,
)


TEST_FERNET = "e2NeeKHZKKOBso4UwLtFkyDfzvoDQ70zGwV4qEGfeEc="
TEST_HMAC = "test-only-hmac-key-for-verification-tests-abcdefgh123456789"

@override_settings(
    VERIFICATION_PII_ENCRYPTION_KEY=TEST_FERNET,
    VERIFICATION_PII_HASH_KEY=TEST_HMAC,
)
class WorkerVerificationApplicationAPITests(APITestCase):

    def setUp(self):

        self.user = User.objects.create_user(
            phone="09120000601",
            full_name="Verification Applicant",
            password="Strong-test-password-123!",
            phone_verified_at=timezone.now(),
        )

        self.client.force_authenticate(
            user=self.user,
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

    def save_identity(self):
        return self.client.put(self.identity_url, {
            "first_name": "Test", "last_name": "Applicant",
            "national_code": "1234567891", "birth_date": "2000-01-15",
            "iban": "IR820540102680020817909002",
            "mobile": self.user.phone,
        }, format="json")

    def upload_document(self):
        identity_response = self.save_identity()
        self.assertEqual(identity_response.status_code, 200, identity_response.data)
        responses = []
        for kind in ("NATIONAL_CARD_FRONT", "NATIONAL_CARD_BACK"):
            response = self.client.post(self.upload_url, {
                "document_type": kind, "file": new_test_png(),
            }, format="multipart")
            self.assertEqual(response.status_code, 201, response.data)
            responses.append(response)
        return responses[0]

    def tearDown(self):

        for document in WorkerVerificationDocument.objects.all():

            if document.file and document.file.name:
                document.file.storage.delete(
                    document.file.name,
                )

        super().tearDown()

    def test_anonymous_user_cannot_get_verification_status(self):

        self.client.force_authenticate(user=None)

        response = self.client.get(self.status_url)

        self.assertEqual(
            response.status_code,
            status.HTTP_401_UNAUTHORIZED,
        )

    def test_anonymous_user_cannot_submit_application(self):

        self.client.force_authenticate(user=None)

        response = self.client.post(
            self.submit_url,
            {},
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_401_UNAUTHORIZED,
        )

    def test_user_without_profile_gets_not_submitted_status(self):

        response = self.client.get(self.status_url)

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.assertEqual(
            response.data["verification_status"],
            "NOT_SUBMITTED",
        )

        self.assertEqual(
            response.data["documents"],
            [],
        )

    def test_application_cannot_be_submitted_without_documents(self):
        self.save_identity()

        response = self.client.post(
            self.submit_url,
            {},
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

        self.assertIn(
            "documents",
            response.data,
        )

    def test_user_can_submit_application_with_documents(self):

        self.upload_document()

        response = self.client.post(
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

        self.assertIsNotNone(
            response.data["application_submitted_at"],
        )

        profile = ExecutorProfile.objects.get(
            user=self.user,
        )

        self.assertEqual(
            profile.verification_status,
            "PENDING",
        )

    def test_status_api_returns_uploaded_documents(self):

        self.upload_document()

        response = self.client.get(self.status_url)

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.assertEqual(
            len(response.data["documents"]),
            2,
        )

        self.assertEqual(
            response.data["documents"][0]["document_type"],
            "NATIONAL_CARD_FRONT",
        )

        self.assertNotIn(
            "file",
            response.data["documents"][0],
        )

    def test_pending_application_cannot_be_submitted_again(self):

        profile = ExecutorProfile.objects.create(
            user=self.user,
            verification_status=(
                ExecutorProfile.VerificationStatus.PENDING
            ),
            application_submitted_at=timezone.now(),
        )

        response = self.client.post(
            self.submit_url,
            {},
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_409_CONFLICT,
        )

        profile.refresh_from_db()

        self.assertEqual(
            profile.verification_status,
            "PENDING",
        )

    def test_approved_application_cannot_be_submitted_again(self):

        ExecutorProfile.objects.create(
            user=self.user,
            verification_status=(
                ExecutorProfile.VerificationStatus.APPROVED
            ),
            approved_at=timezone.now(),
        )

        response = self.client.post(
            self.submit_url,
            {},
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_409_CONFLICT,
        )

    def test_rejected_application_can_be_resubmitted(self):

        self.upload_document()

        reviewer = User.objects.create_user(
            phone="09120000602",
            full_name="Verification Reviewer",
            password="Strong-test-password-123!",
            phone_verified_at=timezone.now(),
        )

        profile = ExecutorProfile.objects.get(
            user=self.user,
        )

        profile.verification_status = (
            ExecutorProfile.VerificationStatus.REJECTED
        )

        profile.reviewed_by_user = reviewer
        profile.reviewed_at = timezone.now()
        profile.rejection_reason = "Invalid identity document."

        profile.save()

        response = self.client.post(
            self.submit_url,
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
            "PENDING",
        )

        self.assertIsNotNone(
            profile.application_submitted_at,
        )

        self.assertIsNone(
            profile.reviewed_by_user,
        )

        self.assertIsNone(
            profile.reviewed_at,
        )

        self.assertIsNone(
            profile.approved_at,
        )

        self.assertIsNone(
            profile.rejection_reason,
        )

    def test_user_cannot_see_another_users_documents(self):

        other_user = User.objects.create_user(
            phone="09120000603",
            full_name="Another Applicant",
            password="Strong-test-password-123!",
            phone_verified_at=timezone.now(),
        )

        from rest_framework.test import APIClient

        other_client = APIClient()

        other_client.force_authenticate(
            user=other_user,
        )

        other_client.post(
            self.upload_url,
            {
                "document_type": "NATIONAL_CARD_FRONT",
                "file": new_test_png(),
            },
            format="multipart",
        )

        response = self.client.get(self.status_url)

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.assertEqual(
            response.data["documents"],
            [],
        )
