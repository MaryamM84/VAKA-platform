from decimal import Decimal

from django.urls import reverse
from django.utils import timezone

from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import User, ExecutorProfile


class WorkerServiceAreaAPITests(APITestCase):

    def setUp(self):

        self.user = User.objects.create_user(
            phone="09120000301",
            full_name="Service Area User",
            password="Strong-test-password-123!",
            phone_verified_at=timezone.now(),
        )

        self.url = reverse(
            "profile:my-service-area"
        )

        self.client.force_authenticate(
            user=self.user
        )

    def test_anonymous_user_cannot_get_service_area(self):

        self.client.force_authenticate(user=None)

        response = self.client.get(self.url)

        self.assertEqual(
            response.status_code,
            status.HTTP_401_UNAUTHORIZED,
        )

    def test_anonymous_user_cannot_update_service_area(self):

        self.client.force_authenticate(user=None)

        response = self.client.patch(
            self.url,
            {"service_area_city": "Tehran"},
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_401_UNAUTHORIZED,
        )

    def test_get_service_area_without_profile_returns_defaults(self):

        response = self.client.get(self.url)

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.assertEqual(
            response.data["service_area_city"],
            "",
        )

        self.assertIsNone(
            response.data["service_area_latitude"]
        )

        self.assertIsNone(
            response.data["service_area_longitude"]
        )

        self.assertIsNone(
            response.data["service_area_radius_km"]
        )

        self.assertFalse(
            ExecutorProfile.objects.filter(
                user=self.user
            ).exists()
        )

    def test_user_can_update_city_and_region(self):

        response = self.client.patch(
            self.url,
            {
                "service_area_city": "Tehran",
                "service_area_region": "Tehran Province",
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
            profile.service_area_city,
            "Tehran",
        )

        self.assertEqual(
            profile.service_area_region,
            "Tehran Province",
        )

    def test_user_can_set_valid_coordinates(self):

        response = self.client.patch(
            self.url,
            {
                "service_area_latitude": "35.689200",
                "service_area_longitude": "51.389000",
                "service_area_radius_km": 25,
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
            profile.service_area_latitude,
            Decimal("35.689200"),
        )

        self.assertEqual(
            profile.service_area_longitude,
            Decimal("51.389000"),
        )

        self.assertEqual(
            profile.service_area_radius_km,
            25,
        )

    def test_latitude_above_90_is_rejected(self):

        response = self.client.patch(
            self.url,
            {
                "service_area_latitude": "91",
                "service_area_longitude": "51",
                "service_area_radius_km": 10,
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_latitude_below_minus_90_is_rejected(self):

        response = self.client.patch(
            self.url,
            {
                "service_area_latitude": "-91",
                "service_area_longitude": "51",
                "service_area_radius_km": 10,
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_longitude_above_180_is_rejected(self):

        response = self.client.patch(
            self.url,
            {
                "service_area_latitude": "35",
                "service_area_longitude": "181",
                "service_area_radius_km": 10,
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_longitude_below_minus_180_is_rejected(self):

        response = self.client.patch(
            self.url,
            {
                "service_area_latitude": "35",
                "service_area_longitude": "-181",
                "service_area_radius_km": 10,
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_incomplete_coordinate_group_is_rejected(self):

        response = self.client.patch(
            self.url,
            {
                "service_area_latitude": "35.689200",
                "service_area_longitude": "51.389000",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_radius_without_coordinates_is_rejected(self):

        response = self.client.patch(
            self.url,
            {
                "service_area_radius_km": 20,
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_user_can_clear_existing_coordinates(self):

        ExecutorProfile.objects.create(
            user=self.user,
            service_area_latitude=Decimal("35.689200"),
            service_area_longitude=Decimal("51.389000"),
            service_area_radius_km=20,
        )

        response = self.client.patch(
            self.url,
            {
                "service_area_latitude": None,
                "service_area_longitude": None,
                "service_area_radius_km": None,
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

        self.assertIsNone(
            profile.service_area_latitude
        )

        self.assertIsNone(
            profile.service_area_longitude
        )

        self.assertIsNone(
            profile.service_area_radius_km
        )

    def test_partial_coordinate_update_preserves_existing_values(self):

        ExecutorProfile.objects.create(
            user=self.user,
            service_area_latitude=Decimal("35.689200"),
            service_area_longitude=Decimal("51.389000"),
            service_area_radius_km=20,
        )

        response = self.client.patch(
            self.url,
            {
                "service_area_latitude": "36.000000",
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
            profile.service_area_latitude,
            Decimal("36.000000"),
        )

        self.assertEqual(
            profile.service_area_longitude,
            Decimal("51.389000"),
        )

        self.assertEqual(
            profile.service_area_radius_km,
            20,
        )

    def test_zero_radius_is_rejected(self):

        response = self.client.patch(
            self.url,
            {
                "service_area_latitude": "35",
                "service_area_longitude": "51",
                "service_area_radius_km": 0,
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
    def test_entire_city_defaults_to_false(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIs(response.data["covers_entire_city"], False)

    def test_enable_entire_city_after_choosing_city(self):
        response = self.client.patch(
            self.url,
            {"service_area_city": "Tehran", "covers_entire_city": True},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertTrue(response.data["covers_entire_city"])
        self.assertTrue(ExecutorProfile.objects.get(user=self.user).covers_entire_city)

    def test_cannot_enable_entire_city_without_city(self):
        response = self.client.patch(self.url, {"covers_entire_city": True}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("service_area_city", response.data)

    def test_cannot_clear_city_while_entire_city_enabled(self):
        self.client.patch(
            self.url,
            {"service_area_city": "Tehran", "covers_entire_city": True},
            format="json",
        )
        response = self.client.patch(self.url, {"service_area_city": ""}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_can_disable_entire_city(self):
        self.client.patch(
            self.url,
            {"service_area_city": "Tehran", "covers_entire_city": True},
            format="json",
        )
        response = self.client.patch(self.url, {"covers_entire_city": False}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data["covers_entire_city"])
