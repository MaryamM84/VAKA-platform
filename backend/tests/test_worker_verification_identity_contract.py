"""Contract tests for the separate identity-save and bodyless submit workflow."""
from io import BytesIO
from django.test import override_settings
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from django.utils import timezone
from PIL import Image
from rest_framework.test import APITestCase, APIClient
from accounts.models import User, WorkerVerificationIdentity, WorkerVerificationDocument
from accounts.worker_verification_pii import decrypt

FERNET = "e2NeeKHZKKOBso4UwLtFkyDfzvoDQ70zGwV4qEGfeEc="
HMAC = "test-only-hmac-key-for-verification-tests-abcdefgh123456789"
IBAN = "IR820540102680020817909002"

def image_file():
    buf = BytesIO()
    Image.new("RGB", (2, 2), (100, 150, 200)).save(buf, format="PNG")
    return SimpleUploadedFile("national.png", buf.getvalue(), content_type="image/png")

@override_settings(VERIFICATION_PII_ENCRYPTION_KEY=FERNET, VERIFICATION_PII_HASH_KEY=HMAC)
class WorkerVerificationIdentityContractTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(phone="09123334455", full_name="User", phone_verified_at=timezone.now())
        self.client.force_authenticate(user=self.user)
        self.identity_url = reverse("profile:worker-verification-identity")
        self.upload_url = reverse("profile:worker-verification-document-upload")
        self.submit_url = reverse("profile:worker-verification-submit")
        self.status_url = reverse("profile:worker-verification-status")
        self.form = {
            "first_name": "Mina", "last_name": "Sample",
            "national_code": "1234567891", "birth_date": "2000-01-15",
            "iban": IBAN, "mobile": self.user.phone,
        }

    def tearDown(self):
        for doc in WorkerVerificationDocument.objects.all():
            if doc.file and doc.file.name:
                doc.file.storage.delete(doc.file.name)
        super().tearDown()

    def test_identity_put_get_persistence_and_encryption(self):
        response = self.client.put(self.identity_url, self.form, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["first_name"], "Mina")
        self.assertEqual(self.client.get(self.identity_url).data["national_code"], self.form["national_code"])
        details = WorkerVerificationIdentity.objects.get(executor_profile__user=self.user)
        self.assertEqual(decrypt(details.national_code_encrypted), self.form["national_code"])
        self.assertNotEqual(details.iban_encrypted, IBAN)
        self.assertIn("no-store", response["Cache-Control"])

    def test_submit_requires_saved_identity(self):
        response = self.client.post(self.submit_url, {}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("identity", response.data)

    def test_submit_requires_both_sides(self):
        self.assertEqual(self.client.put(self.identity_url, self.form, format="json").status_code, 200)
        self.client.post(self.upload_url, {"document_type": "NATIONAL_CARD_FRONT", "file": image_file()}, format="multipart")
        response = self.client.post(self.submit_url, {}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("documents", response.data)

    def test_submit_without_body_succeeds_with_complete_form(self):
        self.assertEqual(self.client.put(self.identity_url, self.form, format="json").status_code, 200)
        for kind in ("NATIONAL_CARD_FRONT", "NATIONAL_CARD_BACK"):
            response = self.client.post(self.upload_url, {"document_type": kind, "file": image_file()}, format="multipart")
            self.assertEqual(response.status_code, 201, response.data)
        response = self.client.post(self.submit_url, {}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["verification_status"], "PENDING")
        self.assertTrue(response.data["identity_saved"])
        self.assertNotIn(self.form["national_code"], str(response.data))
        self.assertEqual(self.client.post(self.submit_url, {}, format="json").status_code, 409)
        self.assertEqual(self.client.put(self.identity_url, self.form, format="json").status_code, 409)

    def test_invalid_mobile_and_checksum_are_rejected(self):
        invalid = {**self.form, "mobile": "09120000000"}
        self.assertEqual(self.client.put(self.identity_url, invalid, format="json").status_code, 400)
        invalid = {**self.form, "national_code": "1111111111"}
        self.assertEqual(self.client.put(self.identity_url, invalid, format="json").status_code, 400)

    def test_owner_only_and_document_delete(self):
        self.client.put(self.identity_url, self.form, format="json")
        saved = self.client.post(self.upload_url, {"document_type": "NATIONAL_CARD_FRONT", "file": image_file()}, format="multipart")
        self.assertEqual(saved.status_code, 201, saved.data)
        other = User.objects.create_user(phone="09123334456", full_name="Other", phone_verified_at=timezone.now())
        client = APIClient()
        client.force_authenticate(user=other)
        self.assertEqual(client.get(self.identity_url).status_code, 404)
        path = reverse("profile:worker-verification-document-delete", kwargs={"document_id": saved.data["document_id"]})
        self.assertEqual(client.delete(path).status_code, 404)
        self.assertEqual(self.client.delete(path).status_code, 204)
