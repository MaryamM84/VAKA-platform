from datetime import timedelta

from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import ExecutorProfile, User, WorkerServiceNeighborhood
from offers.models import Bid, BidStatus
from tasks.choices import TaskStatus
from tasks.models import Task, TaskCategory


class WorkerStatisticsAPITests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            phone="09120000901", full_name="Worker Stats", password="Test12345!",
            phone_verified_at=timezone.now(),
        )
        self.other = User.objects.create_user(
            phone="09120000902", full_name="Other Worker", password="Test12345!",
            phone_verified_at=timezone.now(),
        )
        self.employer = User.objects.create_user(
            phone="09120000903", full_name="Employer", password="Test12345!",
            phone_verified_at=timezone.now(),
        )
        self.url = reverse("profile:my-worker-statistics")
        self.client.force_authenticate(user=self.user)
        self.category = TaskCategory.objects.create(name="Worker Statistics Test Category")

    def make_task(self, *, task_status, title):
        now = timezone.now()
        return Task.objects.create(
            employer_user=self.employer,
            category=self.category,
            title=title,
            description="Task for stats tests",
            status=task_status,
            estimated_duration_minutes=60,
            wage_budget_amount=500000,
            currency_code="IRR",
            execution_window_start_at=now + timedelta(days=1),
            execution_window_end_at=now + timedelta(days=1, hours=2),
            proposal_deadline_at=now + timedelta(hours=12),
            delivery_criteria="Finished",
        )

    def make_bid(self, profile, task, bid_status):
        return Bid.objects.create(
            executor_profile=profile,
            task=task,
            status=bid_status,
            proposed_wage_amount=100000,
            proposed_duration_minutes=60,
            message="Ready",
        )

    def test_anonymous_cannot_get_statistics(self):
        self.client.force_authenticate(user=None)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_no_profile_returns_zero_counts_and_unavailable_metrics(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data["submitted_bids_count"], 0)
        self.assertEqual(response.data["completed_tasks_count"], 0)
        self.assertIsNone(response.data["average_rating"])
        self.assertIsNone(response.data["received_offers_count"])
        self.assertEqual(response.data["profile_completion_percent"], 13)
        self.assertFalse(ExecutorProfile.objects.filter(user=self.user).exists())

    def test_completed_count_requires_accepted_bid_and_completed_task(self):
        profile = ExecutorProfile.objects.create(user=self.user)
        other_profile = ExecutorProfile.objects.create(user=self.other)
        finished = self.make_task(task_status=TaskStatus.COMPLETED, title="Finished")
        ongoing = self.make_task(task_status=TaskStatus.IN_PROGRESS, title="Ongoing")
        inactive_bid = self.make_task(task_status=TaskStatus.COMPLETED, title="No accepted bid")
        other_finished = self.make_task(task_status=TaskStatus.COMPLETED, title="Other worker's task")
        self.make_bid(profile, finished, BidStatus.ACCEPTED)
        self.make_bid(profile, ongoing, BidStatus.ACCEPTED)
        self.make_bid(profile, inactive_bid, BidStatus.ACTIVE)
        self.make_bid(other_profile, other_finished, BidStatus.ACCEPTED)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data["submitted_bids_count"], 3)
        self.assertEqual(response.data["completed_tasks_count"], 1)

    def test_coverage_settings_increase_profile_completion(self):
        profile = ExecutorProfile.objects.create(user=self.user)
        before = self.client.get(self.url).data["profile_completion_percent"]
        profile.service_area_city = "Tehran"
        profile.save(update_fields=["service_area_city"])
        with_city = self.client.get(self.url).data["profile_completion_percent"]
        self.assertGreater(with_city, before)
        WorkerServiceNeighborhood.objects.create(executor_profile=profile, name="Vanak")
        with_neighborhood = self.client.get(self.url).data["profile_completion_percent"]
        self.assertGreater(with_neighborhood, with_city)

    def test_entire_city_counts_as_coverage(self):
        profile = ExecutorProfile.objects.create(
            user=self.user, service_area_city="Tehran", covers_entire_city=True
        )
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["profile_completion_percent"], 38)
