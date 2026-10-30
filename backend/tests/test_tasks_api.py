"""Integration tests for the task and task-catalog HTTP APIs."""

import base64
from datetime import timedelta

from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import Role, User, UserRole
from tasks.choices import TaskSkillSource, TaskStatus
from tasks.models import (
    Skill,
    Task,
    TaskCategory,
    TaskRequiredSkill,
    TaskStatusHistory,
)


class APITestDataMixin:
    """Shared factories for the custom user and task domain models."""


    def make_user(self, phone, *, account_status=User.AccountStatus.ACTIVE):
        return User.objects.create_user(
            phone=phone,
            full_name=f"User {phone}",
            password="Strong-test-password-123!",
            account_status=account_status,
            phone_verified_at=timezone.now(),
        )


    def make_employer(self, phone="09120000001", *, account_status=User.AccountStatus.ACTIVE):
        user = self.make_user(phone, account_status=account_status)
        UserRole.objects.create(user=user, role=self.employer_role)
        return user

    def make_category(self, name="Home Services", *, is_active=True, parent=None):
        return TaskCategory.objects.create(
            name=name,
            is_active=is_active,
            parent_category=parent,
        )

    def make_skill(self, name, *, category=None):
        return Skill.objects.create(name=name, category=category)

    def valid_task_payload(self, *, category=None):
        now = timezone.now()
        return {
            "category_id": str(category.pk if category else self.category.pk),
            "title": "Repair a kitchen cabinet",
            "description": "Repair the damaged cabinet door and hinges.",
            "estimated_duration_minutes": 90,
            "wage_budget_amount": 2500000,
            "execution_window_start_at": (now + timedelta(days=1)).isoformat(),
            "execution_window_end_at": (now + timedelta(days=2)).isoformat(),
            "proposal_deadline_at": (now + timedelta(hours=12)).isoformat(),
            "delivery_criteria": "The cabinet door opens and closes correctly.",
        }


class TaskEndpointPermissionTests(APITestDataMixin, APITestCase):
    def setUp(self):
        self.employer_role = Role.objects.create(code="EMPLOYER", name="Employer")
        self.category = self.make_category()
        self.url = reverse("task-list-create")

    def test_task_endpoint_rejects_anonymous_get_and_post(self):
        get_response = self.client.get(self.url)
        post_response = self.client.post(self.url, self.valid_task_payload(), format="json")

        self.assertEqual(get_response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(post_response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_basic_authentication_allows_an_active_employer(self):
        employer = self.make_employer("09120000005")
        token = base64.b64encode(
            f"{employer.phone}:Strong-test-password-123!".encode("utf-8")
        ).decode("ascii")
        self.client.credentials(HTTP_AUTHORIZATION=f"Basic {token}")

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, [])

    def test_task_endpoint_rejects_authenticated_user_without_employer_role(self):
        user = self.make_user("09120000002")
        self.client.force_authenticate(user=user)

        get_response = self.client.get(self.url)
        post_response = self.client.post(self.url, self.valid_task_payload(), format="json")

        self.assertEqual(get_response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(post_response.status_code, status.HTTP_403_FORBIDDEN)

    def test_task_endpoint_rejects_suspended_employer(self):
        employer = self.make_employer(
            "09120000003",
            account_status=User.AccountStatus.SUSPENDED,
        )
        self.client.force_authenticate(user=employer)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_task_endpoint_rejects_deleted_employer(self):
        employer = self.make_employer(
            "09120000004",
            account_status=User.AccountStatus.DELETED,
        )
        self.client.force_authenticate(user=employer)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class TaskCreateAPITests(APITestDataMixin, APITestCase):
    def setUp(self):
        self.employer_role = Role.objects.create(code="EMPLOYER", name="Employer")
        self.employer = self.make_employer()
        self.client.force_authenticate(user=self.employer)
        self.category = self.make_category()
        self.url = reverse("task-list-create")

    def test_employer_can_create_task_as_draft(self):
        response = self.client.post(
            self.url,
            self.valid_task_payload(),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(Task.objects.count(), 1)

        task = Task.objects.get()
        self.assertEqual(task.employer_user, self.employer)
        self.assertEqual(task.category, self.category)
        self.assertEqual(task.status, TaskStatus.DRAFT)
        self.assertEqual(task.currency_code, "IRR")
        self.assertFalse(task.receipt_required)
        self.assertIsNone(task.item_cost_cap_amount)
        self.assertIsNone(task.deadline_at)
        self.assertEqual(response.data["status"], TaskStatus.DRAFT)
        self.assertEqual(response.data["employer_user_id"], str(self.employer.pk))
        self.assertEqual(response.data["category_name"], self.category.name)

        history = TaskStatusHistory.objects.get(task=task)
        self.assertIsNone(history.from_status)
        self.assertEqual(history.to_status, TaskStatus.DRAFT)
        self.assertEqual(history.changed_by_user, self.employer)
        self.assertEqual(history.reason, "Task draft created")

    def test_employer_can_create_task_with_category_and_global_skills(self):
        category_skill = self.make_skill("Cabinet repair", category=self.category)
        global_skill = self.make_skill("Customer communication")
        payload = self.valid_task_payload()
        payload["required_skills"] = [
            {"skill_id": str(category_skill.pk), "importance": 2},
            {"skill_id": str(global_skill.pk), "importance": 1},
        ]

        response = self.client.post(self.url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        task = Task.objects.get()
        required_skills = TaskRequiredSkill.objects.filter(task=task)
        self.assertEqual(required_skills.count(), 2)
        self.assertEqual(
            set(required_skills.values_list("skill_id", flat=True)),
            {category_skill.pk, global_skill.pk},
        )
        self.assertEqual(
            set(required_skills.values_list("source", flat=True)),
            {TaskSkillSource.MANUAL},
        )

    def test_numeric_field_boundaries_are_accepted(self):
        payload = self.valid_task_payload()
        payload.update({
            "estimated_duration_minutes": 1,
            "wage_budget_amount": 0,
            "item_cost_cap_amount": 0,
        })

        response = self.client.post(self.url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        task = Task.objects.get()
        self.assertEqual(task.estimated_duration_minutes, 1)
        self.assertEqual(task.wage_budget_amount, 0)
        self.assertEqual(task.item_cost_cap_amount, 0)

    def test_numeric_upper_boundaries_are_accepted(self):
        payload = self.valid_task_payload()
        payload.update({
            "estimated_duration_minutes": 300,
            "wage_budget_amount": 2**63 - 1,
            "item_cost_cap_amount": 2**63 - 1,
        })

        response = self.client.post(self.url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        task = Task.objects.get()
        self.assertEqual(task.estimated_duration_minutes, 300)
        self.assertEqual(task.wage_budget_amount, 2**63 - 1)
        self.assertEqual(task.item_cost_cap_amount, 2**63 - 1)

    def test_required_skill_importance_accepts_smallint_boundaries(self):
        skill = self.make_skill("Cabinet repair", category=self.category)
        for importance in (-32768, 32767):
            with self.subTest(importance=importance):
                payload = self.valid_task_payload()
                payload["required_skills"] = [
                    {"skill_id": str(skill.pk), "importance": importance}
                ]
                response = self.client.post(self.url, payload, format="json")
                self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)

        self.assertEqual(Task.objects.count(), 2)
        self.assertEqual(
            set(TaskRequiredSkill.objects.values_list("importance", flat=True)),
            {-32768, 32767},
        )

    def test_bigint_overflow_is_rejected(self):
        for field_name in ("wage_budget_amount", "item_cost_cap_amount"):
            with self.subTest(field=field_name):
                payload = self.valid_task_payload()
                payload[field_name] = 2**63
                response = self.client.post(self.url, payload, format="json")
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertIn(field_name, response.data)

        self.assertEqual(Task.objects.count(), 0)

    def test_invalid_category_uuid_is_rejected(self):
        payload = self.valid_task_payload()
        payload["category_id"] = "not-a-uuid"

        response = self.client.post(self.url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("category_id", response.data)
        self.assertEqual(Task.objects.count(), 0)

    def test_required_skills_are_optional(self):
        response = self.client.post(self.url, self.valid_task_payload(), format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(TaskRequiredSkill.objects.count(), 0)

    def test_client_cannot_override_server_managed_fields(self):
        forbidden_fields = {
            "task_id": "00000000-0000-0000-0000-000000000001",
            "employer_user_id": "00000000-0000-0000-0000-000000000002",
            "status": TaskStatus.OPEN,
            "currency_code": "USD",
            "created_at": timezone.now().isoformat(),
        }

        for field_name, value in forbidden_fields.items():
            with self.subTest(field=field_name):
                payload = self.valid_task_payload()
                payload[field_name] = value
                response = self.client.post(self.url, payload, format="json")

                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertIn(field_name, response.data)

        self.assertEqual(Task.objects.count(), 0)

    def test_unknown_top_level_field_is_rejected(self):
        payload = self.valid_task_payload()
        payload["unexpected"] = "not allowed"

        response = self.client.post(self.url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("unexpected", response.data)
        self.assertEqual(Task.objects.count(), 0)

    def test_unknown_nested_required_skill_field_is_rejected(self):
        skill = self.make_skill("Cabinet repair", category=self.category)
        payload = self.valid_task_payload()
        payload["required_skills"] = [
            {"skill_id": str(skill.pk), "importance": 1, "is_admin": True}
        ]

        response = self.client.post(self.url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("is_admin", response.data["required_skills"][0])
        self.assertEqual(Task.objects.count(), 0)

    def test_duration_must_be_between_one_and_three_hundred_minutes(self):
        for duration in (0, 301):
            with self.subTest(duration=duration):
                payload = self.valid_task_payload()
                payload["estimated_duration_minutes"] = duration
                response = self.client.post(self.url, payload, format="json")
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertIn("estimated_duration_minutes", response.data)

        self.assertEqual(Task.objects.count(), 0)

    def test_wage_and_optional_item_cap_cannot_be_negative(self):
        for field_name in ("wage_budget_amount", "item_cost_cap_amount"):
            with self.subTest(field=field_name):
                payload = self.valid_task_payload()
                payload[field_name] = -1
                response = self.client.post(self.url, payload, format="json")
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertIn(field_name, response.data)

        self.assertEqual(Task.objects.count(), 0)

    def test_execution_window_end_must_be_after_start(self):
        now = timezone.now()
        for end_at in (now - timedelta(seconds=1), now):
            with self.subTest(end_at=end_at):
                payload = self.valid_task_payload()
                payload["execution_window_start_at"] = now.isoformat()
                payload["execution_window_end_at"] = end_at.isoformat()
                response = self.client.post(self.url, payload, format="json")
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertIn("execution_window_end_at", response.data)

        self.assertEqual(Task.objects.count(), 0)

    def test_inactive_category_cannot_be_used_to_create_task(self):
        inactive_category = self.make_category("Inactive category", is_active=False)
        payload = self.valid_task_payload(category=inactive_category)

        response = self.client.post(self.url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Task.objects.count(), 0)

    def test_skill_from_another_category_is_rejected(self):
        another_category = self.make_category("Electrical work")
        other_skill = self.make_skill("Wiring", category=another_category)
        payload = self.valid_task_payload()
        payload["required_skills"] = [
            {"skill_id": str(other_skill.pk), "importance": 1}
        ]

        response = self.client.post(self.url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("required_skills", response.data)
        self.assertEqual(Task.objects.count(), 0)

    def test_duplicate_required_skill_is_rejected(self):
        skill = self.make_skill("Cabinet repair", category=self.category)
        payload = self.valid_task_payload()
        payload["required_skills"] = [
            {"skill_id": str(skill.pk), "importance": 1},
            {"skill_id": str(skill.pk), "importance": 2},
        ]

        response = self.client.post(self.url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("required_skills", response.data)
        self.assertEqual(Task.objects.count(), 0)

    def test_required_skill_importance_must_fit_smallint(self):
        skill = self.make_skill("Cabinet repair", category=self.category)
        for importance in (-32769, 32768):
            with self.subTest(importance=importance):
                payload = self.valid_task_payload()
                payload["required_skills"] = [
                    {"skill_id": str(skill.pk), "importance": importance}
                ]
                response = self.client.post(self.url, payload, format="json")
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertIn("required_skills", response.data)

        self.assertEqual(Task.objects.count(), 0)

    def test_unknown_skill_id_is_rejected(self):
        payload = self.valid_task_payload()
        payload["required_skills"] = [
            {
                "skill_id": "00000000-0000-0000-0000-000000000099",
                "importance": 1,
            }
        ]

        response = self.client.post(self.url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("required_skills", response.data)
        self.assertEqual(Task.objects.count(), 0)

    def test_missing_required_fields_are_rejected(self):
        response = self.client.post(self.url, {}, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(response.data)
        self.assertEqual(Task.objects.count(), 0)


class TaskListAPITests(APITestDataMixin, APITestCase):
    def setUp(self):
        self.employer_role = Role.objects.create(code="EMPLOYER", name="Employer")
        self.employer = self.make_employer("09120000011")
        self.other_employer = self.make_employer("09120000012")
        self.client.force_authenticate(user=self.employer)
        self.category = self.make_category()
        self.url = reverse("task-list-create")

    def create_task(self, employer, title):
        payload = self.valid_task_payload()
        payload["title"] = title
        payload.pop("category_id")
        return Task.objects.create(
            employer_user=employer,
            category=self.category,
            **payload,
        )

    def test_employer_sees_only_tasks_they_created(self):
        own_task = self.create_task(self.employer, "My task")
        self.create_task(self.other_employer, "Another employer task")

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["task_id"], str(own_task.pk))
        self.assertEqual(response.data[0]["title"], "My task")
        self.assertEqual(response.data[0]["employer_user_id"], str(self.employer.pk))

    def test_list_includes_required_skill_details(self):
        task = self.create_task(self.employer, "Task with skill")
        skill = self.make_skill("Cabinet repair", category=self.category)
        TaskRequiredSkill.objects.create(
            task=task,
            skill=skill,
            importance=3,
            source=TaskSkillSource.MANUAL,
        )

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data[0]["required_skills"], [
            {
                "skill_id": str(skill.pk),
                "skill_name": skill.name,
                "importance": 3,
                "source": TaskSkillSource.MANUAL,
            }
        ])

    def test_task_endpoint_does_not_allow_update_or_delete_methods(self):
        for method in ("put", "patch", "delete"):
            with self.subTest(method=method):
                response = getattr(self.client, method)(self.url, {}, format="json")
                self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

    def test_task_list_is_empty_when_employer_has_no_tasks(self):
        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, [])


class TaskCategoryCatalogAPITests(APITestDataMixin, APITestCase):
    def setUp(self):
        self.url = reverse("task-category-list")

    def test_categories_endpoint_is_public_and_returns_only_active_categories(self):
        parent = self.make_category("Home", is_active=True)
        child = self.make_category("Cleaning", is_active=True, parent=parent)
        inactive = self.make_category("Archived", is_active=False)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        returned_ids = {row["category_id"] for row in response.data}
        self.assertEqual(returned_ids, {str(parent.pk), str(child.pk)})
        child_data = next(row for row in response.data if row["category_id"] == str(child.pk))
        self.assertEqual(child_data["parent_category_id"], str(parent.pk))
        self.assertEqual(child_data["parent_category_name"], parent.name)
        self.assertNotIn(str(inactive.pk), returned_ids)

    def test_categories_endpoint_is_read_only(self):
        response = self.client.post(self.url, {"name": "Injected"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
        self.assertEqual(TaskCategory.objects.count(), 0)


class SkillCatalogAPITests(APITestDataMixin, APITestCase):
    def setUp(self):
        self.url = reverse("skill-list")
        self.category_a = self.make_category("Home services")
        self.category_b = self.make_category("Electrical")
        self.inactive_category = self.make_category("Inactive", is_active=False)
        self.skill_a = self.make_skill("Cleaning", category=self.category_a)
        self.skill_b = self.make_skill("Wiring", category=self.category_b)
        self.inactive_skill = self.make_skill("Archived skill", category=self.inactive_category)
        self.global_skill = self.make_skill("Communication")

    def test_skills_endpoint_is_public_and_excludes_skills_from_inactive_categories(self):
        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        returned_ids = {row["skill_id"] for row in response.data}
        self.assertEqual(
            returned_ids,
            {str(self.skill_a.pk), str(self.skill_b.pk), str(self.global_skill.pk)},
        )
        self.assertNotIn(str(self.inactive_skill.pk), returned_ids)

    def test_category_filter_returns_category_skills_and_global_skills(self):
        response = self.client.get(self.url, {"category_id": str(self.category_a.pk)})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        returned_ids = {row["skill_id"] for row in response.data}
        self.assertEqual(returned_ids, {str(self.skill_a.pk), str(self.global_skill.pk)})
        self.assertNotIn(str(self.skill_b.pk), returned_ids)

    def test_invalid_category_uuid_returns_400(self):
        response = self.client.get(self.url, {"category_id": "not-a-uuid"})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("category_id", response.data)

    def test_nonexistent_category_returns_400(self):
        response = self.client.get(
            self.url,
            {"category_id": "00000000-0000-0000-0000-000000000099"},
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("category_id", response.data)

    def test_inactive_category_filter_returns_400(self):
        response = self.client.get(
            self.url,
            {"category_id": str(self.inactive_category.pk)},
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("category_id", response.data)

    def test_skills_endpoint_is_read_only(self):
        response = self.client.post(self.url, {"name": "Injected"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
        self.assertEqual(Skill.objects.count(), 4)
