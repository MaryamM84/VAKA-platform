from django.urls import reverse
from django.utils import timezone

from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import (
    User,
    ExecutorProfile,
    WorkerAvailability,
)

from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

from django.contrib.auth import get_user_model
from django.db import close_old_connections, connection
from django.test import TransactionTestCase

from rest_framework.test import APIClient


class WorkerAvailabilityAPITests(APITestCase):

    def setUp(self):

        self.user = User.objects.create_user(
            phone="09120000401",
            full_name="Availability User",
            password="Strong-test-password-123!",
            phone_verified_at=timezone.now(),
        )

        self.url = reverse(
            "profile:my-worker-availability"
        )

        self.client.force_authenticate(
            user=self.user
        )

    def make_user(self, phone):

        return User.objects.create_user(
            phone=phone,
            full_name="Other Worker",
            password="Strong-test-password-123!",
            phone_verified_at=timezone.now(),
        )

    def create_slot(
        self,
        user=None,
        weekday=0,
        start_time="09:00",
        end_time="12:00",
    ):

        user = user or self.user

        profile, _ = ExecutorProfile.objects.get_or_create(
            user=user,
        )

        return WorkerAvailability.objects.create(
            executor_profile=profile,
            weekday=weekday,
            start_time=start_time,
            end_time=end_time,
        )

    def detail_url(self, slot):

        return reverse(
            "profile:my-worker-availability-detail",
            kwargs={
                "availability_id": slot.availability_id,
            },
        )

    def test_anonymous_user_cannot_get_availability(self):

        self.client.force_authenticate(user=None)

        response = self.client.get(self.url)

        self.assertEqual(
            response.status_code,
            status.HTTP_401_UNAUTHORIZED,
        )

    def test_anonymous_user_cannot_create_availability(self):

        self.client.force_authenticate(user=None)

        response = self.client.post(
            self.url,
            {
                "weekday": 0,
                "start_time": "09:00",
                "end_time": "12:00",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_401_UNAUTHORIZED,
        )

    def test_get_availability_without_profile_returns_defaults(self):

        response = self.client.get(self.url)

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.assertEqual(
            response.data["availability_timezone"],
            "UTC",
        )

        self.assertEqual(
            response.data["slots"],
            [],
        )

        self.assertFalse(
            ExecutorProfile.objects.filter(
                user=self.user
            ).exists()
        )

    def test_user_can_create_availability_slot(self):

        response = self.client.post(
            self.url,
            {
                "weekday": 0,
                "start_time": "09:00",
                "end_time": "12:00",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_201_CREATED,
            response.data,
        )

        self.assertEqual(
            WorkerAvailability.objects.count(),
            1,
        )

        self.assertEqual(
            response.data["weekday"],
            0,
        )

    def test_invalid_weekday_is_rejected(self):

        response = self.client.post(
            self.url,
            {
                "weekday": 7,
                "start_time": "09:00",
                "end_time": "12:00",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_end_time_equal_start_time_is_rejected(self):

        response = self.client.post(
            self.url,
            {
                "weekday": 0,
                "start_time": "09:00",
                "end_time": "09:00",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_overnight_slot_is_rejected(self):

        response = self.client.post(
            self.url,
            {
                "weekday": 0,
                "start_time": "22:00",
                "end_time": "02:00",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_overlapping_slot_is_rejected(self):

        self.create_slot(
            weekday=0,
            start_time="09:00",
            end_time="12:00",
        )

        response = self.client.post(
            self.url,
            {
                "weekday": 0,
                "start_time": "11:00",
                "end_time": "13:00",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

        self.assertEqual(
            WorkerAvailability.objects.count(),
            1,
        )

    def test_adjacent_slots_are_allowed(self):

        self.create_slot(
            weekday=0,
            start_time="09:00",
            end_time="12:00",
        )

        response = self.client.post(
            self.url,
            {
                "weekday": 0,
                "start_time": "12:00",
                "end_time": "15:00",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_201_CREATED,
        )

        self.assertEqual(
            WorkerAvailability.objects.count(),
            2,
        )

    def test_same_time_on_different_weekdays_is_allowed(self):

        self.create_slot(
            weekday=0,
            start_time="09:00",
            end_time="12:00",
        )

        response = self.client.post(
            self.url,
            {
                "weekday": 1,
                "start_time": "09:00",
                "end_time": "12:00",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_201_CREATED,
        )

    def test_user_sees_only_own_availability(self):

        own_slot = self.create_slot(
            weekday=0,
        )

        other_user = self.make_user("09120000402")

        other_slot = self.create_slot(
            user=other_user,
            weekday=1,
        )

        response = self.client.get(self.url)

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.assertEqual(
            len(response.data["slots"]),
            1,
        )

        self.assertEqual(
            str(response.data["slots"][0]["availability_id"]),
            str(own_slot.availability_id),
        )

        self.assertNotEqual(
            str(response.data["slots"][0]["availability_id"]),
            str(other_slot.availability_id),
        )

    def test_user_can_update_own_slot(self):

        slot = self.create_slot()

        response = self.client.patch(
            self.detail_url(slot),
            {
                "start_time": "10:00",
                "end_time": "13:00",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
            response.data,
        )

        slot.refresh_from_db()

        self.assertEqual(
            slot.start_time.strftime("%H:%M"),
            "10:00",
        )

        self.assertEqual(
            slot.end_time.strftime("%H:%M"),
            "13:00",
        )

    def test_update_to_overlapping_slot_is_rejected(self):

        self.create_slot(
            weekday=0,
            start_time="09:00",
            end_time="12:00",
        )

        second_slot = self.create_slot(
            weekday=0,
            start_time="13:00",
            end_time="15:00",
        )

        response = self.client.patch(
            self.detail_url(second_slot),
            {
                "start_time": "11:00",
                "end_time": "14:00",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

        second_slot.refresh_from_db()

        self.assertEqual(
            second_slot.start_time.strftime("%H:%M"),
            "13:00",
        )

    def test_user_cannot_update_another_users_slot(self):

        other_user = self.make_user("09120000403")

        other_slot = self.create_slot(
            user=other_user,
        )

        response = self.client.patch(
            self.detail_url(other_slot),
            {
                "start_time": "10:00",
                "end_time": "13:00",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_404_NOT_FOUND,
        )

        other_slot.refresh_from_db()

        self.assertEqual(
            other_slot.start_time.strftime("%H:%M"),
            "09:00",
        )

    def test_user_can_delete_own_slot(self):

        slot = self.create_slot()

        response = self.client.delete(
            self.detail_url(slot),
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_204_NO_CONTENT,
        )

        self.assertFalse(
            WorkerAvailability.objects.filter(
                pk=slot.pk
            ).exists()
        )

    def test_user_cannot_delete_another_users_slot(self):

        other_user = self.make_user("09120000404")

        other_slot = self.create_slot(
            user=other_user,
        )

        response = self.client.delete(
            self.detail_url(other_slot),
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_404_NOT_FOUND,
        )

        self.assertTrue(
            WorkerAvailability.objects.filter(
                pk=other_slot.pk
            ).exists()
        )

    def test_user_can_update_timezone(self):

        response = self.client.patch(
            self.url,
            {
                "availability_timezone": "UTC",
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
            profile.availability_timezone,
            "UTC",
        )

    def test_invalid_timezone_is_rejected(self):

        response = self.client.patch(
            self.url,
            {
                "availability_timezone": "Mars/Olympus_Mons",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_empty_timezone_patch_is_rejected(self):

        response = self.client.patch(
            self.url,
            {},
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_timezone_endpoint_rejects_unsupported_fields(self):

        response = self.client.patch(
            self.url,
            {
                "weekday": 0,
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_weekday_values_follow_iranian_week_order(self):
        
        expected_days = {
            "SATURDAY": 0,
            "SUNDAY": 1,
            "MONDAY": 2,
            "TUESDAY": 3,
            "WEDNESDAY": 4,
            "THURSDAY": 5,
            "FRIDAY": 6,
        }
    
        for day, expected_value in expected_days.items():
        
            self.assertEqual(
                getattr(WorkerAvailability.Weekday, day),
                expected_value,
            )


class WorkerAvailabilityConcurrencyTests(TransactionTestCase):

    def setUp(self):
        self.user = User.objects.create_user(
            phone="09120000991",
            full_name="Concurrency Test User",
            password="Strong-test-password-123!",
            phone_verified_at=timezone.now(),
        )

        self.profile = ExecutorProfile.objects.create(
            user=self.user,
        )

        self.user_id = self.user.pk

        self.url = reverse(
            "profile:my-worker-availability"
        )

        self.start_barrier = Barrier(2)

    def create_availability_request(self):

        close_old_connections()

        try:
            user = User.objects.get(
                pk=self.user_id,
            )

            client = APIClient()

            client.force_authenticate(
                user=user,
            )

            self.start_barrier.wait(timeout=15)

            response = client.post(
                self.url,
                {
                    "weekday": 0,
                    "start_time": "09:00",
                    "end_time": "12:00",
                },
                format="json",
            )

            return response.status_code, response.data

        finally:
            close_old_connections()

    def test_concurrent_overlapping_availability_requests(self):

        if connection.vendor != "postgresql":
            self.skipTest(
                "This concurrency test must run on PostgreSQL."
            )

        with ThreadPoolExecutor(max_workers=2) as executor:

            futures = [
                executor.submit(
                    self.create_availability_request
                )
                for _ in range(2)
            ]

            results = [
                future.result(timeout=30)
                for future in futures
            ]

        response_statuses = [
            result[0]
            for result in results
        ]

        self.assertCountEqual(
            response_statuses,
            [
                status.HTTP_201_CREATED,
                status.HTTP_400_BAD_REQUEST,
            ],
        )

        rejected_response = next(
            data
            for code, data in results
            if code == status.HTTP_400_BAD_REQUEST
        )

        self.assertIn(
            "non_field_errors",
            rejected_response,
        )

        self.assertIn(
            "overlaps",
            str(rejected_response).lower(),
        )

        saved_slots = WorkerAvailability.objects.filter(
            executor_profile=self.profile,
        ).count()

        self.assertEqual(
            saved_slots,
            1,
        )
