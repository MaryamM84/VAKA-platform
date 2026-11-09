from uuid import uuid4

from django.urls import reverse
from django.utils import timezone

from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import (
    User,
    ExecutorProfile,
    WorkerSkill,
)

from tasks.models import (
    Skill,
    TaskCategory,
)


class WorkerSkillsAPITests(APITestCase):

    def setUp(self):

        self.user = self.make_user("09120000121")

        self.category = TaskCategory.objects.create(
            name="Electrical Services",
            is_active=True,
        )

        self.skill = Skill.objects.create(
            category=self.category,
            name="Electrical Installation",
            description="Electrical installation and repair",
        )

        self.url = reverse(
            "profile:my-worker-skills"
        )

        self.client.force_authenticate(
            user=self.user
        )

    def make_user(self, phone):

        return User.objects.create_user(
            phone=phone,
            full_name=f"User {phone}",
            password="Strong-test-password-123!",
            phone_verified_at=timezone.now(),
        )

    def create_worker_skill(
        self,
        user,
        skill=None,
        proficiency_level=WorkerSkill.ProficiencyLevel.BEGINNER,
        experience_years=0,
    ):

        profile, _ = ExecutorProfile.objects.get_or_create(
            user=user,
        )

        return WorkerSkill.objects.create(
            executor_profile=profile,
            skill=skill or self.skill,
            proficiency_level=proficiency_level,
            experience_years=experience_years,
        )

    def detail_url(self, worker_skill):

        return reverse(
            "profile:my-worker-skill-detail",
            kwargs={
                "worker_skill_id": worker_skill.worker_skill_id,
            },
        )

    def test_anonymous_user_cannot_access_skills(self):

        self.client.force_authenticate(user=None)

        get_response = self.client.get(self.url)

        post_response = self.client.post(
            self.url,
            {
                "skill_id": str(self.skill.pk),
            },
            format="json",
        )

        self.assertEqual(
            get_response.status_code,
            status.HTTP_401_UNAUTHORIZED,
        )

        self.assertEqual(
            post_response.status_code,
            status.HTTP_401_UNAUTHORIZED,
        )

    def test_get_skills_without_profile_returns_empty_list(self):

        response = self.client.get(self.url)

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.assertEqual(response.data, [])

        self.assertFalse(
            ExecutorProfile.objects.filter(
                user=self.user
            ).exists()
        )

    def test_user_can_only_see_own_skills(self):

        own_skill = self.create_worker_skill(self.user)

        other_user = self.make_user("09120000122")

        other_skill = self.create_worker_skill(other_user)

        response = self.client.get(self.url)

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.assertEqual(len(response.data), 1)

        self.assertEqual(
            str(response.data[0]["worker_skill_id"]),
            str(own_skill.worker_skill_id),
        )

        self.assertNotEqual(
            str(response.data[0]["worker_skill_id"]),
            str(other_skill.worker_skill_id),
        )

    def test_user_can_add_skill(self):

        payload = {
            "skill_id": str(self.skill.pk),
            "proficiency_level": "ADVANCED",
            "experience_years": 4,
        }

        response = self.client.post(
            self.url,
            payload,
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_201_CREATED,
            response.data,
        )

        profile = ExecutorProfile.objects.get(
            user=self.user
        )

        worker_skill = WorkerSkill.objects.get(
            executor_profile=profile,
            skill=self.skill,
        )

        self.assertEqual(
            worker_skill.proficiency_level,
            "ADVANCED",
        )

        self.assertEqual(
            worker_skill.experience_years,
            4,
        )

        self.assertEqual(
            response.data["skill"]["name"],
            self.skill.name,
        )

    def test_duplicate_skill_is_rejected(self):

        self.client.post(
            self.url,
            {"skill_id": str(self.skill.pk)},
            format="json",
        )

        response = self.client.post(
            self.url,
            {"skill_id": str(self.skill.pk)},
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

        self.assertEqual(WorkerSkill.objects.count(), 1)

    def test_nonexistent_skill_is_rejected(self):

        response = self.client.post(
            self.url,
            {
                "skill_id": str(uuid4()),
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

        self.assertEqual(WorkerSkill.objects.count(), 0)

    def test_skill_from_inactive_category_is_rejected(self):

        inactive_category = TaskCategory.objects.create(
            name="Inactive Services",
            is_active=False,
        )

        inactive_skill = Skill.objects.create(
            category=inactive_category,
            name="Inactive Skill",
        )

        response = self.client.post(
            self.url,
            {
                "skill_id": str(inactive_skill.pk),
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_invalid_proficiency_level_is_rejected(self):

        response = self.client.post(
            self.url,
            {
                "skill_id": str(self.skill.pk),
                "proficiency_level": "MASTER",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_experience_above_60_is_rejected(self):

        response = self.client.post(
            self.url,
            {
                "skill_id": str(self.skill.pk),
                "experience_years": 61,
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_negative_experience_is_rejected(self):

        response = self.client.post(
            self.url,
            {
                "skill_id": str(self.skill.pk),
                "experience_years": -1,
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_user_can_update_own_skill(self):

        worker_skill = self.create_worker_skill(
            self.user,
            experience_years=2,
        )

        response = self.client.patch(
            self.detail_url(worker_skill),
            {
                "proficiency_level": "EXPERT",
                "experience_years": 8,
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
            response.data,
        )

        worker_skill.refresh_from_db()

        self.assertEqual(
            worker_skill.proficiency_level,
            "EXPERT",
        )

        self.assertEqual(
            worker_skill.experience_years,
            8,
        )

    def test_user_cannot_change_catalog_skill_id(self):

        worker_skill = self.create_worker_skill(self.user)

        response = self.client.patch(
            self.detail_url(worker_skill),
            {
                "skill_id": str(uuid4()),
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_user_cannot_update_another_users_skill(self):

        other_user = self.make_user("09120000123")

        other_skill = self.create_worker_skill(other_user)

        response = self.client.patch(
            self.detail_url(other_skill),
            {
                "proficiency_level": "EXPERT",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_404_NOT_FOUND,
        )

        other_skill.refresh_from_db()

        self.assertEqual(
            other_skill.proficiency_level,
            "BEGINNER",
        )

    def test_empty_patch_is_rejected(self):

        worker_skill = self.create_worker_skill(self.user)

        response = self.client.patch(
            self.detail_url(worker_skill),
            {},
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_user_can_delete_own_skill(self):

        worker_skill = self.create_worker_skill(self.user)

        response = self.client.delete(
            self.detail_url(worker_skill)
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_204_NO_CONTENT,
        )

        self.assertFalse(
            WorkerSkill.objects.filter(
                pk=worker_skill.pk
            ).exists()
        )

    def test_user_cannot_delete_another_users_skill(self):

        other_user = self.make_user("09120000124")

        other_skill = self.create_worker_skill(other_user)

        response = self.client.delete(
            self.detail_url(other_skill)
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_404_NOT_FOUND,
        )

        self.assertTrue(
            WorkerSkill.objects.filter(
                pk=other_skill.pk
            ).exists()
        )