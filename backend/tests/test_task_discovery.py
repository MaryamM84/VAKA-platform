"""T2-03 integration tests. Run against the project's PostGIS test database."""

from datetime import timedelta

from django.db import connection
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import ExecutorProfile, Role, UserRole
from tasks.choices import TaskStatus
from tasks.models import Task, TaskCategory
from tests.test_tasks_api import APITestDataMixin


class TaskDiscoveryTests(APITestDataMixin, APITestCase):
    def setUp(self):
        self.employer_role = Role.objects.create(code="EMPLOYER", name="Employer")
        self.executor_role = Role.objects.create(code="EXECUTOR", name="Executor")
        self.owner = self.make_employer("09128880001")
        self.viewer = self.make_employer("09128880002")
        self.category = self.make_category("Housework")
        self.other_category = self.make_category("Delivery")
        self.list_url = reverse("task-discovery-list")
        self.client.force_authenticate(user=self.viewer)

    def make_open_task(self, *, title="Clean a room", description="Need careful cleaning",
                       category=None, budget=100000, locations=None):
        self.client.force_authenticate(user=self.owner)
        payload = self.valid_task_payload(category=category or self.category)
        payload.update({
            "title": title,
            "description": description,
            "wage_budget_amount": budget,
            "locations": locations if locations is not None else [
                self.location(1, "Tehran", "Central", 35.7035, 51.4103)
            ],
        })
        created = self.client.post(reverse("task-list-create"), payload, format="json")
        self.assertEqual(created.status_code, status.HTTP_201_CREATED, created.data)
        task_id = created.data["task_id"]
        published = self.client.post(reverse("task-publish", kwargs={"task_id": task_id}))
        self.assertEqual(published.status_code, status.HTTP_200_OK, published.data)
        self.client.force_authenticate(user=self.viewer)
        return Task.objects.get(pk=task_id)

    @staticmethod
    def location(order, city, region, lat, lon):
        return {
            "location_type": "SERVICE",
            "stop_order": order,
            "city": city,
            "region": region,
            "latitude": lat,
            "longitude": lon,
        }

    def results(self, **query):
        response = self.client.get(self.list_url, query)
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        return response.data["results"]

    def test_category_catalog_and_direct_subcategory_listing(self):
        child = self.make_category("Deep cleaning", parent=self.category)
        self.make_category("Hidden", is_active=False, parent=self.category)
        self.client.force_authenticate(user=None)
        catalog = self.client.get(reverse("task-category-list"))
        subcats = self.client.get(
            reverse("task-category-subcategories", kwargs={"category_id": self.category.pk})
        )
        self.assertEqual(catalog.status_code, 200)
        self.assertEqual(subcats.status_code, 200)
        self.assertEqual([str(row["category_id"]) for row in subcats.data], [str(child.pk)])

    def test_subcategory_parent_must_be_active(self):
        self.category.is_active = False
        self.category.save(update_fields=["is_active"])
        response = self.client.get(reverse(
            "task-category-subcategories", kwargs={"category_id": self.category.pk}
        ))
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_only_open_published_tasks_are_listed(self):
        visible = self.make_open_task(title="Visible")
        cancelled = self.make_open_task(title="Cancelled")
        assigned = self.make_open_task(title="Assigned")
        expired = self.make_open_task(title="Expired")
        draft = self.make_open_task(title="Draft again")
        Task.objects.filter(pk=cancelled.pk).update(status=TaskStatus.CANCELLED)
        Task.objects.filter(pk=assigned.pk).update(status=TaskStatus.ASSIGNED)
        Task.objects.filter(pk=expired.pk).update(status=TaskStatus.EXPIRED)
        Task.objects.filter(pk=draft.pk).update(status=TaskStatus.DRAFT, published_at=None)
        self.assertEqual([r["task_id"] for r in self.results()], [str(visible.pk)])

    def test_all_time_based_expirations_are_excluded(self):
        visible = self.make_open_task(title="Visible")
        proposal_over = self.make_open_task(title="Proposal overdue")
        execution_over = self.make_open_task(title="Execution overdue")
        final_deadline_over = self.make_open_task(title="Final deadline overdue")
        yesterday = timezone.now() - timedelta(days=1)
        Task.objects.filter(pk=proposal_over.pk).update(proposal_deadline_at=yesterday)
        Task.objects.filter(pk=execution_over.pk).update(
            execution_window_start_at=yesterday - timedelta(days=1),
            execution_window_end_at=yesterday,
        )
        Task.objects.filter(pk=final_deadline_over.pk).update(deadline_at=yesterday)
        self.assertEqual([r["task_id"] for r in self.results()], [str(visible.pk)])

    def test_inactive_category_excludes_tasks(self):
        task = self.make_open_task(category=self.other_category)
        TaskCategory.objects.filter(pk=self.other_category.pk).update(is_active=False)
        self.assertFalse(any(r["task_id"] == str(task.pk) for r in self.results()))

    def test_detail_does_not_leak_private_location_or_employer_id(self):
        task = self.make_open_task()
        response = self.client.get(reverse("task-discovery-detail", kwargs={"task_id": task.pk}))
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        data = response.data
        self.assertEqual(data["task_id"], str(task.pk))
        self.assertIn("locations", data)
        self.assertEqual(data["locations"][0]["city"], "Tehran")
        for private in ("exact_point", "approximate_point", "location_notes",
                        "exact_address_ciphertext", "employer_user_id"):
            self.assertNotIn(private, str(data))

    def test_hidden_or_own_task_details_return_404(self):
        task = self.make_open_task()
        self.client.force_authenticate(user=self.owner)
        self.assertEqual(self.client.get(reverse(
            "task-discovery-detail", kwargs={"task_id": task.pk}
        )).status_code, 404)
        self.client.force_authenticate(user=self.viewer)
        Task.objects.filter(pk=task.pk).update(status=TaskStatus.ASSIGNED)
        self.assertEqual(self.client.get(reverse(
            "task-discovery-detail", kwargs={"task_id": task.pk}
        )).status_code, 404)

    def test_search_title_description_and_combined_search(self):
        kitchen = self.make_open_task(title="Repair kitchen shelf", description="Broken wood")
        sofa = self.make_open_task(title="Wash sofa", description="Kitchen stains")
        self.assertEqual([r["task_id"] for r in self.results(title="kItChEn")], [str(kitchen.pk)])
        self.assertEqual([r["task_id"] for r in self.results(description="Kitchen")], [str(sofa.pk)])
        self.assertEqual({r["task_id"] for r in self.results(search="Kitchen")},
                         {str(kitchen.pk), str(sofa.pk)})

    def test_category_and_budget_filters(self):
        small = self.make_open_task(title="Small", budget=100000)
        self.make_open_task(title="Other", category=self.other_category, budget=100000)
        self.make_open_task(title="Large", budget=900000)
        response = self.results(category_id=str(self.category.pk), min_budget=100000,
                                max_budget=200000)
        self.assertEqual([r["task_id"] for r in response], [str(small.pk)])

    def test_city_region_and_radius_are_combined_on_same_location(self):
        task = self.make_open_task(locations=[
            self.location(1, "Tehran", "North", 36.5, 53.0),
            self.location(2, "Shiraz", "Central", 35.7035, 51.4103),
        ])
        self.assertEqual(self.results(city="Tehran", latitude=35.70,
                                      longitude=51.41, radius_meters=2000), [])
        self.assertEqual([r["task_id"] for r in self.results(
            city="Shiraz", region="Central", latitude=35.70,
            longitude=51.41, radius_meters=2000
        )], [str(task.pk)])

    def test_postgis_radius_filter_uses_geography_meters(self):
        near = self.make_open_task(title="Near")
        self.make_open_task(title="Far", locations=[
            self.location(1, "Tehran", "Far", 36.0, 52.0)
        ])
        data = self.results(latitude=35.70, longitude=51.41, radius_meters=1500)
        self.assertEqual([r["task_id"] for r in data], [str(near.pk)])

    def test_location_is_persisted_in_postgis_with_private_exact_coordinates(self):
        task = self.make_open_task(locations=[
            self.location(1, "Tehran", "Central", 35.7035, 51.4103)
        ])
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT ST_X(approximate_point::geometry), ST_Y(approximate_point::geometry), "
                "ST_X(exact_point::geometry), ST_Y(exact_point::geometry) "
                "FROM task_locations WHERE task_id = %s::uuid",
                [str(task.pk)],
            )
            values = cursor.fetchone()
        self.assertAlmostEqual(values[0], 51.41)
        self.assertAlmostEqual(values[1], 35.70)
        self.assertAlmostEqual(values[2], 51.4103)
        self.assertAlmostEqual(values[3], 35.7035)

    def test_invalid_numeric_and_geo_filters_return_400(self):
        for query in (
            {"min_budget": "-1"},
            {"min_budget": "200", "max_budget": "100"},
            {"category_id": "wrong"},
            {"latitude": "35.7"},
            {"latitude": "nan", "longitude": "51", "radius_meters": "100"},
            {"latitude": "91", "longitude": "51", "radius_meters": "100"},
            {"latitude": "35", "longitude": "51", "radius_meters": "0"},
            {"ordering": "status"},
        ):
            with self.subTest(query=query):
                self.assertEqual(self.client.get(self.list_url, query).status_code, 400)

    def test_sorting_and_pagination(self):
        for i in range(12):
            self.make_open_task(title=f"Task {i}", budget=1000 + i)
        response = self.client.get(self.list_url, {"ordering": "wage_budget_amount", "page_size": 5})
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["count"], 12)
        self.assertEqual(len(response.data["results"]), 5)
        self.assertEqual([r["wage_budget_amount"] for r in response.data["results"]],
                         [1000, 1001, 1002, 1003, 1004])
        response = self.client.get(self.list_url, {"page_size": 999})
        self.assertEqual(len(response.data["results"]), 12)  # max_page_size is 50

    def test_category_tasks_only_match_exact_category(self):
        direct = self.make_open_task(category=self.category)
        child = self.make_category("Child", parent=self.category)
        self.make_open_task(title="Child task", category=child)
        result = self.client.get(reverse(
            "task-category-tasks", kwargs={"category_id": self.category.pk}
        ))
        self.assertEqual(result.status_code, 200)
        self.assertEqual([r["task_id"] for r in result.data["results"]], [str(direct.pk)])

    def test_discovery_authorization_for_unapproved_and_approved_executors(self):
        self.make_open_task()
        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.get(self.list_url).status_code, 401)
        executor = self.make_user("09128880003")
        UserRole.objects.create(user=executor, role=self.executor_role)
        profile = ExecutorProfile.objects.create(user=executor)
        self.client.force_authenticate(user=executor)
        self.assertEqual(self.client.get(self.list_url).status_code, 403)
        profile.verification_status = ExecutorProfile.VerificationStatus.APPROVED
        profile.profile_status = "ACTIVE"
        profile.save(update_fields=["verification_status", "profile_status"])
        self.assertEqual(self.client.get(self.list_url).status_code, 200)
