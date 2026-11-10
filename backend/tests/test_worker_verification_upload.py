
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from django.utils import timezone

from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import (
    User,
    ExecutorProfile,
    WorkerVerificationDocument,
)


class WorkerVerificationUploadTests(APITestCase):

    def setUp(self):

        self.user = User.objects.create_user(
            phone="09120000701",
            full_name="Verification User",
            password="Strong-test-password-123!",
            phone_verified_at=timezone.now(),
        )

        self.client.force_authenticate(
            user=self.user,
        )

        self.url = reverse(
            "profile:worker-verification-document-upload"
        )

    def make_pdf(self, name="identity.pdf", content=None):

        if content is None:
            content = (
                b"%PDF-1.4\n"
                b"1 0 obj\n"
                b"<< /Type /Catalog >>\n"
                b"endobj\n"
                b"%%EOF"
            )

        return SimpleUploadedFile(
            name,
            content,
            content_type="application/pdf",
        )

    def upload_document(self, file=None, document_type="NATIONAL_ID"):

        return self.client.post(
            self.url,
            {
                "document_type": document_type,
                "file": file or self.make_pdf(),
            },
            format="multipart",
        )

    def tearDown(self):

        for document in WorkerVerificationDocument.objects.filter(
            executor_profile__user=self.user,
        ):
            if document.file and document.file.name:
                document.file.storage.delete(
                    document.file.name
                )

        super().tearDown()

    def test_user_can_upload_valid_pdf(self):

        response = self.upload_document()

        self.assertEqual(
            response.status_code,
            status.HTTP_201_CREATED,
            response.data,
        )

        document = WorkerVerificationDocument.objects.get()

        self.assertEqual(
            document.document_type,
            "NATIONAL_ID",
        )

        self.assertEqual(
            document.mime_type,
            "application/pdf",
        )

        self.assertTrue(
            document.file.storage.exists(
                document.file.name
            )
        )

        self.assertNotIn("file", response.data)

    def test_anonymous_user_cannot_upload_document(self):

        self.client.force_authenticate(user=None)

        response = self.upload_document()

        self.assertEqual(
            response.status_code,
            status.HTTP_401_UNAUTHORIZED,
        )

    def test_invalid_file_content_is_rejected(self):

        invalid_file = SimpleUploadedFile(
            "identity.pdf",
            b"This is not a valid PDF file.",
            content_type="application/pdf",
        )

        response = self.upload_document(
            file=invalid_file,
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

        self.assertEqual(
            WorkerVerificationDocument.objects.count(),
            0,
        )

    def test_file_extension_mismatch_is_rejected(self):

        invalid_file = self.make_pdf(
            name="identity.jpg",
        )

        response = self.upload_document(
            file=invalid_file,
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

        self.assertEqual(
            WorkerVerificationDocument.objects.count(),
            0,
        )

    def test_file_larger_than_10mb_is_rejected(self):

        content = (
            b"%PDF-1.4\n"
            + b"A" * (10 * 1024 * 1024)
        )

        oversized_file = self.make_pdf(
            content=content,
        )

        response = self.upload_document(
            file=oversized_file,
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

        self.assertEqual(
            WorkerVerificationDocument.objects.count(),
            0,
        )

    def test_empty_document_type_is_rejected(self):

        response = self.upload_document(
            document_type="",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_user_cannot_choose_another_profile(self):

        response = self.client.post(
            self.url,
            {
                "document_type": "NATIONAL_ID",
                "file": self.make_pdf(),
                "executor_profile_id": "another-profile",
            },
            format="multipart",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_upload_is_rejected_while_application_is_pending(self):

        ExecutorProfile.objects.create(
            user=self.user,
            verification_status=(
                ExecutorProfile.VerificationStatus.PENDING
            ),
        )

        response = self.upload_document()

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

        self.assertEqual(
            WorkerVerificationDocument.objects.count(),
            0,
        )

    def test_upload_is_allowed_after_rejection(self):

        ExecutorProfile.objects.create(
            user=self.user,
            verification_status=(
                ExecutorProfile.VerificationStatus.REJECTED
            ),
        )

        response = self.upload_document()

        self.assertEqual(
            response.status_code,
            status.HTTP_201_CREATED,
            response.data,
        )

    def test_upload_is_rejected_after_approval(self):

        ExecutorProfile.objects.create(
            user=self.user,
            verification_status=(
                ExecutorProfile.VerificationStatus.APPROVED
            ),
        )

        response = self.upload_document()

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

        self.assertEqual(
            WorkerVerificationDocument.objects.count(),
            0,
        )

    def test_private_document_has_no_public_url(self):

        response = self.upload_document()

        self.assertEqual(
            response.status_code,
            status.HTTP_201_CREATED,
            response.data,
        )

        document = WorkerVerificationDocument.objects.get()

        self.assertNotIn("file", response.data)

        with self.assertRaises(ValueError):
            document.file.url
