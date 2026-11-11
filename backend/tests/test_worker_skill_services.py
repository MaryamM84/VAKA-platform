from datetime import timedelta

from django.db import IntegrityError
from django.test import TestCase
from django.utils import timezone

from accounts.models import ExecutorProfile, User, WorkerSkill
from accounts.worker_skill_services import (
    add_worker_skill,
    delete_worker_skill,
    update_worker_skill,
)
from tasks.models import Skill, TaskCategory


class WorkerSkillServiceTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            phone="09120000501",
            full_name="Test Worker",
            password="Strong-test-password-123!",
            phone_verified_at=timezone.now(),
        )
        self.category = TaskCategory.objects.create(
            name="Service Test Category",
            is_active=True,
        )
        self.skill = Skill.objects.create(
            category=self.category,
            name="Electrical Installation",
        )
        self.other_skill = Skill.objects.create(
            category=self.category,
            name="Painting",
        )

    def create_existing_worker_skill(
        self,
        *,
        user=None,
        skill=None,
        proficiency_level=WorkerSkill.ProficiencyLevel.BEGINNER,
        experience_years=1,
    ):
        profile, _ = ExecutorProfile.objects.get_or_create(
            user=user or self.user,
        )
        return WorkerSkill.objects.create(
            executor_profile=profile,
            skill=skill or self.skill,
            proficiency_level=proficiency_level,
            experience_years=experience_years,
        )

    def test_add_skill_creates_executor_profile_if_missing(self):
        self.assertFalse(
            ExecutorProfile.objects.filter(user=self.user).exists()
        )

        worker_skill = add_worker_skill(
            user=self.user,
            skill=self.skill,
            proficiency_level=WorkerSkill.ProficiencyLevel.ADVANCED,
            experience_years=4,
        )

        self.assertTrue(
            ExecutorProfile.objects.filter(user=self.user).exists()
        )
        self.assertEqual(worker_skill.executor_profile.user_id, self.user.pk)
        self.assertEqual(worker_skill.skill_id, self.skill.pk)
        self.assertEqual(worker_skill.proficiency_level, "ADVANCED")
        self.assertEqual(worker_skill.experience_years, 4)
        self.assertEqual(WorkerSkill.objects.count(), 1)

    def test_add_skill_reuses_existing_executor_profile(self):
        profile = ExecutorProfile.objects.create(user=self.user)

        worker_skill = add_worker_skill(
            user=self.user,
            skill=self.skill,
            proficiency_level=WorkerSkill.ProficiencyLevel.BEGINNER,
            experience_years=0,
        )

        self.assertEqual(worker_skill.executor_profile_id, profile.pk)
        self.assertEqual(
            ExecutorProfile.objects.filter(user=self.user).count(),
            1,
        )

    def test_add_different_skills_to_same_profile(self):
        first = add_worker_skill(
            user=self.user,
            skill=self.skill,
            proficiency_level=WorkerSkill.ProficiencyLevel.BEGINNER,
            experience_years=0,
        )
        second = add_worker_skill(
            user=self.user,
            skill=self.other_skill,
            proficiency_level=WorkerSkill.ProficiencyLevel.EXPERT,
            experience_years=8,
        )

        self.assertEqual(first.executor_profile_id, second.executor_profile_id)
        self.assertEqual(WorkerSkill.objects.count(), 2)

    def test_add_duplicate_skill_raises_integrity_error(self):
        self.create_existing_worker_skill()

        with self.assertRaises(IntegrityError):
            add_worker_skill(
                user=self.user,
                skill=self.skill,
                proficiency_level=WorkerSkill.ProficiencyLevel.EXPERT,
                experience_years=5,
            )

        self.assertEqual(WorkerSkill.objects.count(), 1)

    def test_same_catalog_skill_can_belong_to_different_users(self):
        other_user = User.objects.create_user(
            phone="09120000502",
            full_name="Second Worker",
            password="Strong-test-password-123!",
            phone_verified_at=timezone.now(),
        )

        first = add_worker_skill(
            user=self.user,
            skill=self.skill,
            proficiency_level=WorkerSkill.ProficiencyLevel.BEGINNER,
            experience_years=1,
        )
        second = add_worker_skill(
            user=other_user,
            skill=self.skill,
            proficiency_level=WorkerSkill.ProficiencyLevel.EXPERT,
            experience_years=7,
        )

        self.assertNotEqual(first.executor_profile_id, second.executor_profile_id)
        self.assertEqual(WorkerSkill.objects.count(), 2)

    def test_update_skill_changes_only_requested_field(self):
        worker_skill = self.create_existing_worker_skill(
            proficiency_level=WorkerSkill.ProficiencyLevel.BEGINNER,
            experience_years=2,
        )

        updated = update_worker_skill(
            worker_skill=worker_skill,
            changes={"proficiency_level": WorkerSkill.ProficiencyLevel.EXPERT},
        )
        worker_skill.refresh_from_db()

        self.assertEqual(updated.pk, worker_skill.pk)
        self.assertEqual(worker_skill.proficiency_level, "EXPERT")
        self.assertEqual(worker_skill.experience_years, 2)

    def test_update_skill_changes_multiple_fields(self):
        worker_skill = self.create_existing_worker_skill()

        update_worker_skill(
            worker_skill=worker_skill,
            changes={
                "proficiency_level": WorkerSkill.ProficiencyLevel.INTERMEDIATE,
                "experience_years": 6,
            },
        )
        worker_skill.refresh_from_db()

        self.assertEqual(worker_skill.proficiency_level, "INTERMEDIATE")
        self.assertEqual(worker_skill.experience_years, 6)

    def test_update_skill_preserves_fields_changed_in_database(self):
        worker_skill = self.create_existing_worker_skill(
            proficiency_level=WorkerSkill.ProficiencyLevel.BEGINNER,
            experience_years=1,
        )
        WorkerSkill.objects.filter(pk=worker_skill.pk).update(
            experience_years=9,
        )

        update_worker_skill(
            worker_skill=worker_skill,
            changes={"proficiency_level": WorkerSkill.ProficiencyLevel.ADVANCED},
        )
        worker_skill.refresh_from_db()

        self.assertEqual(worker_skill.experience_years, 9)
        self.assertEqual(worker_skill.proficiency_level, "ADVANCED")

    def test_update_skill_updates_timestamp(self):
        worker_skill = self.create_existing_worker_skill()
        previous_time = timezone.now() - timedelta(days=1)
        WorkerSkill.objects.filter(pk=worker_skill.pk).update(
            updated_at=previous_time,
        )

        update_worker_skill(
            worker_skill=worker_skill,
            changes={"experience_years": 3},
        )
        worker_skill.refresh_from_db()

        self.assertGreater(worker_skill.updated_at, previous_time)

    def test_update_invalid_experience_rolls_back(self):
        worker_skill = self.create_existing_worker_skill(
            proficiency_level=WorkerSkill.ProficiencyLevel.BEGINNER,
            experience_years=2,
        )

        with self.assertRaises(IntegrityError):
            update_worker_skill(
                worker_skill=worker_skill,
                changes={
                    "proficiency_level": WorkerSkill.ProficiencyLevel.EXPERT,
                    "experience_years": 61,
                },
            )

        worker_skill.refresh_from_db()
        self.assertEqual(worker_skill.proficiency_level, "BEGINNER")
        self.assertEqual(worker_skill.experience_years, 2)

    def test_delete_skill_preserves_profile_and_other_skills(self):
        first = self.create_existing_worker_skill(skill=self.skill)
        second = self.create_existing_worker_skill(skill=self.other_skill)
        profile_id = first.executor_profile_id
        first_id = first.pk

        result = delete_worker_skill(worker_skill=first)

        self.assertIsNone(result)
        self.assertFalse(WorkerSkill.objects.filter(pk=first_id).exists())
        self.assertTrue(WorkerSkill.objects.filter(pk=second.pk).exists())
        self.assertTrue(ExecutorProfile.objects.filter(pk=profile_id).exists())
        self.assertEqual(WorkerSkill.objects.count(), 1)
