from datetime import timedelta

from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import ExecutorProfile, User, WorkerSkill
from offers.models import Bid, BidStatus
from tasks.choices import TaskStatus
from tasks.models import Skill, Task, TaskCategory


class PublicWorkerProfileAPITests(APITestCase):
    def setUp(self):
        now = timezone.now()
        self.user = User.objects.create_user(
            phone="09128880001",
            full_name="Public Worker",
            password="Strong-test-password-123!",
            phone_verified_at=now,
        )
        self.profile = ExecutorProfile.objects.create(
            user=self.user,
            bio="Experienced electrician",
            service_area_region="Tehran Province",
            service_area_city="Tehran",
            verification_status=ExecutorProfile.VerificationStatus.APPROVED,
            profile_status="ACTIVE",
        )
        self.url = reverse(
            "public-worker-profile",
            kwargs={"profile_id": self.profile.pk},
        )

    def test_public_profile_returns_public_fields_and_avatar_selection(self):
        self.user.avatar_key = "preset:avatar_4"
        self.user.save(update_fields=["avatar_key"])

        category = TaskCategory.objects.create(name="Electrical")
        skill = Skill.objects.create(name="Wiring", category=category)
        WorkerSkill.objects.create(
            executor_profile=self.profile,
            skill=skill,
            proficiency_level=WorkerSkill.ProficiencyLevel.ADVANCED,
            experience_years=5,
        )

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data["profile_id"], str(self.profile.pk))
        self.assertEqual(response.data["full_name"], "Public Worker")
        self.assertEqual(response.data["avatar_id"], "avatar_4")
        self.assertEqual(response.data["avatar_type"], "preset")
        self.assertIsNone(response.data["avatar_url"])
        self.assertEqual(response.data["province"], "Tehran Province")
        self.assertEqual(response.data["city"], "Tehran")
        self.assertEqual(response.data["skills"][0]["name"], "Wiring")
        self.assertEqual(response.data["skills"][0]["experience_years"], 5)
        self.assertEqual(response.data["completed_tasks_count"], 0)
        self.assertEqual(response.data["active_tasks_count"], 0)
        self.assertIsNone(response.data["average_rating"])
        self.assertIsNone(response.data["rating_count"])
        self.assertNotIn("phone", response.data)
        self.assertNotIn("email", response.data)

    def test_public_profile_counts_completed_and_active_accepted_tasks(self):
        employer = User.objects.create_user(
            phone="09128880002",
            full_name="Employer",
            password="Strong-test-password-123!",
            phone_verified_at=timezone.now(),
        )
        category = TaskCategory.objects.create(name="Home services")
        now = timezone.now()

        completed = Task.objects.create(
            employer_user=employer,
            category=category,
            title="Completed task",
            description="Completed",
            status=TaskStatus.COMPLETED,
            estimated_duration_minutes=60,
            wage_budget_amount=100000,
            execution_window_start_at=now + timedelta(days=1),
            execution_window_end_at=now + timedelta(days=1, hours=2),
            proposal_deadline_at=now + timedelta(hours=12),
            delivery_criteria="Done",
        )
        active = Task.objects.create(
            employer_user=employer,
            category=category,
            title="Active task",
            description="Active",
            status=TaskStatus.IN_PROGRESS,
            estimated_duration_minutes=60,
            wage_budget_amount=100000,
            execution_window_start_at=now + timedelta(days=1),
            execution_window_end_at=now + timedelta(days=1, hours=2),
            proposal_deadline_at=now + timedelta(hours=12),
            delivery_criteria="Done",
        )
        for task in (completed, active):
            Bid.objects.create(
                task=task,
                executor_profile=self.profile,
                proposed_wage_amount=90000,
                proposed_duration_minutes=50,
                message="I can do this task.",
                status=BidStatus.ACCEPTED,
            )

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["completed_tasks_count"], 1)
        self.assertEqual(response.data["active_tasks_count"], 1)

    def test_unapproved_or_inactive_worker_profile_is_not_public(self):
        self.profile.verification_status = ExecutorProfile.VerificationStatus.PENDING
        self.profile.save(update_fields=["verification_status", "updated_at"])

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_unknown_profile_returns_not_found(self):
        url = reverse(
            "public-worker-profile",
            kwargs={"profile_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"},
        )
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
