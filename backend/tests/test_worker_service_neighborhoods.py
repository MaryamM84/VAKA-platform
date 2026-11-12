from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import User, ExecutorProfile, WorkerServiceNeighborhood


class WorkerServiceNeighborhoodAPITests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            phone="09120000801", full_name="Worker 1", password="Test12345!",
            phone_verified_at=timezone.now(),
        )
        self.other = User.objects.create_user(
            phone="09120000802", full_name="Worker 2", password="Test12345!",
            phone_verified_at=timezone.now(),
        )
        self.url = reverse("profile:my-service-neighborhoods")
        self.area_url = reverse("profile:my-service-area")
        self.client.force_authenticate(user=self.user)

    def add(self, name):
        return self.client.post(self.url, {"name": name}, format="json")

    def test_anonymous_cannot_list_add_or_delete(self):
        other_profile = ExecutorProfile.objects.create(user=self.other, service_area_city="Tehran")
        neighborhood = WorkerServiceNeighborhood.objects.create(executor_profile=other_profile, name="Vanak")
        delete_url = reverse("profile:my-service-neighborhood-detail", args=[neighborhood.pk])
        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.get(self.url).status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(self.add("Vanak").status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(self.client.delete(delete_url).status_code, status.HTTP_401_UNAUTHORIZED)

    def test_get_without_profile_is_empty_and_does_not_create_profile(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, [])
        self.assertFalse(ExecutorProfile.objects.filter(user=self.user).exists())

    def test_city_required_to_add_neighborhood(self):
        response = self.add("Vanak")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("service_area_city", response.data)
        self.assertFalse(WorkerServiceNeighborhood.objects.exists())

    def test_add_list_and_delete_multiple_neighborhoods(self):
        self.client.patch(self.area_url, {"service_area_city": "Tehran"}, format="json")
        first = self.add("  Vanak  ")
        second = self.add("Saadatabad")
        self.assertEqual(first.status_code, status.HTTP_201_CREATED, first.data)
        self.assertEqual(first.data["name"], "Vanak")
        self.assertEqual(second.status_code, status.HTTP_201_CREATED)
        listed = self.client.get(self.url)
        self.assertEqual(listed.status_code, status.HTTP_200_OK)
        self.assertEqual({x["name"] for x in listed.data}, {"Vanak", "Saadatabad"})
        delete_url = reverse("profile:my-service-neighborhood-detail", args=[first.data["neighborhood_id"]])
        removed = self.client.delete(delete_url)
        self.assertEqual(removed.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual([x["name"] for x in self.client.get(self.url).data], ["Saadatabad"])

    def test_duplicate_names_case_insensitive_are_rejected(self):
        self.client.patch(self.area_url, {"service_area_city": "Tehran"}, format="json")
        self.assertEqual(self.add("Vanak").status_code, status.HTTP_201_CREATED)
        self.assertEqual(self.add("vanak").status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(WorkerServiceNeighborhood.objects.count(), 1)

    def test_blank_unknown_and_missing_name_are_rejected(self):
        self.client.patch(self.area_url, {"service_area_city": "Tehran"}, format="json")
        for payload in ({"name": "  "}, {"name": "Vanak", "user_id": "spoof"}, {}):
            with self.subTest(payload=payload):
                response = self.client.post(self.url, payload, format="json")
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST, response.data)

    def test_cannot_delete_or_see_another_users_neighborhoods(self):
        other_profile = ExecutorProfile.objects.create(user=self.other, service_area_city="Tehran")
        other_neighborhood = WorkerServiceNeighborhood.objects.create(
            executor_profile=other_profile, name="Private Neighborhood"
        )
        self.assertEqual(self.client.get(self.url).data, [])
        delete_url = reverse("profile:my-service-neighborhood-detail", args=[other_neighborhood.pk])
        self.assertEqual(self.client.delete(delete_url).status_code, status.HTTP_404_NOT_FOUND)
        self.assertTrue(WorkerServiceNeighborhood.objects.filter(pk=other_neighborhood.pk).exists())

    def test_changing_city_clears_old_neighborhoods(self):
        self.client.patch(self.area_url, {"service_area_city": "Tehran"}, format="json")
        self.add("Vanak")
        response = self.client.patch(self.area_url, {"service_area_city": "Karaj"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(self.client.get(self.url).data, [])

    def test_same_city_casing_preserves_neighborhoods(self):
        self.client.patch(self.area_url, {"service_area_city": "Tehran"}, format="json")
        self.add("Vanak")
        self.client.patch(self.area_url, {"service_area_city": "tehran"}, format="json")
        self.assertEqual(WorkerServiceNeighborhood.objects.count(), 1)

    def test_entire_city_toggle_preserves_saved_neighborhoods(self):
        self.client.patch(self.area_url, {"service_area_city": "Tehran"}, format="json")
        self.add("Vanak")
        response = self.client.patch(self.area_url, {"covers_entire_city": True}, format="json")
        self.assertTrue(response.data["covers_entire_city"])
        self.assertEqual(len(self.client.get(self.url).data), 1)
