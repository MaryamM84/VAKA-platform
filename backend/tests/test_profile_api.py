from django.utils import timezone

from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import User, ExecutorProfile


class ProfileAPITests(APITestCase):

    def setUp(self):

        self.user = User.objects.create_user(
            phone="09120000111",
            full_name="Original Name",
            password="Strong-test-password-123!",
        )

        User.objects.filter(pk=self.user.pk).update(
            phone_verified_at=timezone.now()
        )

        self.user.refresh_from_db()

        self.url = "/api/profile/me/"

        self.client.force_authenticate(
            user=self.user
        )

    def test_get_current_user_profile(self):

        response = self.client.get(self.url)

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.assertEqual(
            response.data["phone"],
            self.user.phone,
        )

        self.assertEqual(
            response.data["full_name"],
            "Original Name",
        )

        self.assertIsNone(response.data["bio"])

        self.assertEqual(
            response.data["verification_status"],
            "NOT_SUBMITTED",
        )

        self.assertFalse(
            ExecutorProfile.objects.filter(
                user=self.user
            ).exists()
        )

    def test_update_personal_profile(self):

        payload = {
            "full_name": "Updated Name",
            "email": "updated@example.com",
        }

        response = self.client.patch(
            self.url,
            payload,
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.user.refresh_from_db()

        self.assertEqual(
            self.user.full_name,
            "Updated Name",
        )

        self.assertEqual(
            self.user.email,
            "updated@example.com",
        )

    def test_update_bio_creates_executor_profile(self):

        response = self.client.patch(
            self.url,
            {
                "bio": "Experienced home service worker",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        profile = ExecutorProfile.objects.get(
            user=self.user
        )

        self.assertEqual(
            profile.bio,
            "Experienced home service worker",
        )

        self.assertEqual(
            profile.verification_status,
            "NOT_SUBMITTED",
        )

    def test_empty_bio_is_allowed(self):

        response = self.client.patch(
            self.url,
            {
                "bio": "",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        profile = ExecutorProfile.objects.get(
            user=self.user
        )

        self.assertEqual(profile.bio, "")

    def test_phone_cannot_be_updated(self):

        response = self.client.patch(
            self.url,
            {
                "phone": "09120000999",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

        self.user.refresh_from_db()

        self.assertEqual(
            self.user.phone,
            "09120000111",
        )

    def test_verification_status_cannot_be_updated(self):

        response = self.client.patch(
            self.url,
            {
                "verification_status": "APPROVED",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_invalid_email_is_rejected(self):

        response = self.client.patch(
            self.url,
            {
                "email": "invalid-email",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_duplicate_email_is_rejected(self):

        other_user = User.objects.create_user(
            phone="09120000112",
            full_name="Other User",
            password="Strong-test-password-123!",
        )

        other_user.email = "taken@example.com"
        other_user.save(update_fields=["email"])

        response = self.client.patch(
            self.url,
            {
                "email": "taken@example.com",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_unauthenticated_user_cannot_access_profile(self):

        self.client.force_authenticate(user=None)

        response = self.client.get(self.url)

        self.assertEqual(
            response.status_code,
            status.HTTP_401_UNAUTHORIZED,
        )