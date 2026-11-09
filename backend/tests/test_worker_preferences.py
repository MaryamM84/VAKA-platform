from django.urls import reverse
from django.utils import timezone

from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import (
    User,
    ExecutorProfile,
)

from tasks.models import TaskCategory


class WorkerPreferencesAPITests(APITestCase):

    def setUp(self):

        self.user = User.objects.create_user(
            phone="09120000201",
            full_name="Preferences Test User",
            password="Strong-test-password-123!",
            phone_verified_at=timezone.now(),
        )

        self.category = TaskCategory.objects.create(
            name="Electrical Services",
            description="Electrical installation and repair",
            is_active=True,
        )

        self.second_category = TaskCategory.objects.create(
            name="Home Maintenance",
            description="General home maintenance",
            is_active=True,
        )

        self.inactive_category = TaskCategory.objects.create(
            name="Inactive Services",
            is_active=False,
        )

        self.url = reverse(
            "profile:my-worker-preferences"
        )

        self.client.force_authenticate(
            user=self.user
        )

    def test_anonymous_user_cannot_access_preferences(self):

        self.client.force_authenticate(user=None)

        response = self.client.get(self.url)

        self.assertEqual(
            response.status_code,
            status.HTTP_401_UNAUTHORIZED,
        )

    def test_get_preferences_without_profile_returns_defaults(self):

        response = self.client.get(self.url)

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.assertEqual(
            response.data["work_interests"],
            [],
        )

        self.assertEqual(
            response.data["preferred_categories"],
            [],
        )

        self.assertFalse(
            ExecutorProfile.objects.filter(
                user=self.user
            ).exists()
        )

    def test_user_can_update_work_interests(self):

        payload = {
            "work_interests": [
                "Electrical installation",
                "Home maintenance",
                "Appliance repair",
            ]
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

        profile = ExecutorProfile.objects.get(
            user=self.user
        )

        self.assertEqual(
            profile.work_interests,
            payload["work_interests"],
        )

    def test_work_interests_are_trimmed(self):

        response = self.client.patch(
            self.url,
            {
                "work_interests": [
                    "  Electrical installation  ",
                    " Home maintenance ",
                ]
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
            profile.work_interests,
            [
                "Electrical installation",
                "Home maintenance",
            ],
        )

    def test_duplicate_work_interests_are_rejected(self):

        response = self.client.patch(
            self.url,
            {
                "work_interests": [
                    "Electrical installation",
                    "electrical installation",
                ]
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_blank_work_interest_is_rejected(self):

        response = self.client.patch(
            self.url,
            {
                "work_interests": [
                    "Electrical installation",
                    "   ",
                ]
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_user_can_select_preferred_categories(self):

        payload = {
            "preferred_category_ids": [
                str(self.category.category_id),
                str(self.second_category.category_id),
            ]
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

        profile = ExecutorProfile.objects.get(
            user=self.user
        )

        selected_categories = list(
            profile.preferred_categories.order_by("name")
        )

        self.assertEqual(
            len(selected_categories),
            2,
        )

        self.assertEqual(
            {
                category.category_id
                for category in selected_categories
            },
            {
                self.category.category_id,
                self.second_category.category_id,
            },
        )

    def test_user_can_clear_preferred_categories(self):

        profile = ExecutorProfile.objects.create(
            user=self.user,
        )

        profile.preferred_categories.add(
            self.category,
            self.second_category,
        )

        response = self.client.patch(
            self.url,
            {
                "preferred_category_ids": [],
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.assertEqual(
            profile.preferred_categories.count(),
            0,
        )

    def test_nonexistent_category_is_rejected(self):

        from uuid import uuid4

        response = self.client.patch(
            self.url,
            {
                "preferred_category_ids": [
                    str(uuid4()),
                ]
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_inactive_category_is_rejected(self):

        response = self.client.patch(
            self.url,
            {
                "preferred_category_ids": [
                    str(self.inactive_category.category_id),
                ]
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_duplicate_category_ids_are_rejected(self):

        category_id = str(self.category.category_id)

        response = self.client.patch(
            self.url,
            {
                "preferred_category_ids": [
                    category_id,
                    category_id,
                ]
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_unsupported_fields_are_rejected(self):

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

    def test_empty_patch_is_rejected(self):

        response = self.client.patch(
            self.url,
            {},
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_user_can_update_interests_and_categories_together(self):

        response = self.client.patch(
            self.url,
            {
                "work_interests": [
                    "Electrical installation",
                    "Home maintenance",
                ],
                "preferred_category_ids": [
                    str(self.category.category_id),
                ],
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
            len(profile.work_interests),
            2,
        )

        self.assertEqual(
            profile.preferred_categories.count(),
            1,
        )