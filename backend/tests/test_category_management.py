"""T2-03 authorized category management tests."""

from django.urls import reverse
from rest_framework.test import APITestCase

from accounts.models import Role, UserRole
from tasks.models import TaskCategory
from tests.test_tasks_api import APITestDataMixin


class CategoryManagementTests(APITestDataMixin, APITestCase):
    def setUp(self):
        self.employer_role = Role.objects.create(code="EMPLOYER", name="Employer")
        self.admin_role = Role.objects.create(code="ADMIN", name="Administrator")
        self.employer = self.make_employer("09129990001")
        self.admin = self.make_user("09129990002")
        UserRole.objects.create(user=self.admin, role=self.admin_role)
        self.parent = self.make_category("Housework")
        self.list_url = reverse("task-category-manage-list-create")
        self.client.force_authenticate(user=self.admin)

    def detail(self, category):
        return reverse("task-category-manage-detail", kwargs={"category_id": category.pk})

    def test_anonymous_and_employer_cannot_manage_categories(self):
        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.post(self.list_url, {"name": "Secret"}).status_code, 401)
        self.client.force_authenticate(user=self.employer)
        self.assertEqual(self.client.post(self.list_url, {"name": "Secret"}).status_code, 403)
        self.assertEqual(self.client.patch(self.detail(self.parent), {"name": "No"}).status_code, 403)
        self.assertEqual(TaskCategory.objects.count(), 1)

    def test_admin_creates_top_level_category_and_subcategory(self):
        created = self.client.post(self.list_url, {"name": "Transport"}, format="json")
        self.assertEqual(created.status_code, 201, created.data)
        child = self.client.post(self.list_url, {
            "name": "Furniture", "parent_category_id": str(self.parent.pk)
        }, format="json")
        self.assertEqual(child.status_code, 201, child.data)
        self.assertEqual(TaskCategory.objects.get(pk=child.data["category_id"]).parent_category_id,
                         self.parent.pk)

    def test_admin_can_read_update_and_deactivate(self):
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, 200)
        response = self.client.patch(self.detail(self.parent), {
            "name": "Home Help", "description": "Updated", "is_active": False,
        }, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.parent.refresh_from_db()
        self.assertEqual(self.parent.name, "Home Help")
        self.assertFalse(self.parent.is_active)
        public = self.client.get(reverse("task-category-list"))
        self.assertEqual(public.status_code, 200)
        self.assertNotIn(str(self.parent.pk), [str(c["category_id"]) for c in public.data])

    def test_category_cannot_be_its_own_parent_or_create_cycle(self):
        child = self.make_category("Child", parent=self.parent)
        response = self.client.patch(self.detail(self.parent), {
            "parent_category_id": str(self.parent.pk)
        }, format="json")
        self.assertEqual(response.status_code, 400)
        response = self.client.patch(self.detail(self.parent), {
            "parent_category_id": str(child.pk)
        }, format="json")
        self.assertEqual(response.status_code, 400)

    def test_inactive_parent_or_deactivation_with_active_children_is_rejected(self):
        child = self.make_category("Child", parent=self.parent)
        response = self.client.patch(self.detail(self.parent), {
            "is_active": False
        }, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(self.client.patch(self.detail(child), {
            "is_active": False
        }, format="json").status_code, 200)
        self.assertEqual(self.client.patch(self.detail(self.parent), {
            "is_active": False
        }, format="json").status_code, 200)
        response = self.client.post(self.list_url, {
            "name": "Not allowed", "parent_category_id": str(self.parent.pk)
        }, format="json")
        self.assertEqual(response.status_code, 400)

    def test_unknown_fields_and_hard_delete_are_forbidden(self):
        response = self.client.post(self.list_url, {
            "name": "Books", "admin_override": True
        }, format="json")
        self.assertEqual(response.status_code, 400)
        response = self.client.delete(self.detail(self.parent))
        self.assertEqual(response.status_code, 405)
