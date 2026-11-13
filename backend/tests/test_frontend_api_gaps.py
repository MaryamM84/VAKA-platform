from datetime import timedelta

from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import (
    User,
    Role,
    UserRole,
    ExecutorProfile,
)
from offers.models import (
    Bid,
    BidStatus,
    BidStatusHistory,
)
from tasks.models import (
    Task,
    TaskCategory,
    TaskStatusHistory,
)
from tasks.choices import TaskStatus


class ProfileDemographicsAPITests(APITestCase):

    def setUp(self):

        self.user = User.objects.create_user(
            phone="09129993001",
            full_name="Test User",
            phone_verified_at=timezone.now(),
        )

        self.client.force_authenticate(user=self.user)
        self.url = "/api/profile/me/"

    def test_profile_contains_new_fields(self):

        response = self.client.get(self.url)

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        self.assertIn("birth_date", response.data)
        self.assertIn("province_id", response.data)
        self.assertIn("city_id", response.data)

    def test_update_profile_fields(self):

        response = self.client.patch(
            self.url,
            {
                "birth_date": "1998-05-20",
                "province_id": "12",
                "city_id": "1205",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
            response.data,
        )

        self.user.refresh_from_db()

        self.assertEqual(self.user.province_id, "12")
        self.assertEqual(self.user.city_id, "1205")
        self.assertEqual(
            self.user.birth_date.isoformat(),
            "1998-05-20",
        )

    def test_changing_province_clears_city(self):

        self.user.province_id = "12"
        self.user.city_id = "1205"
        self.user.save(
            update_fields=["province_id", "city_id"]
        )

        response = self.client.patch(
            self.url,
            {"province_id": "13"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)

        self.user.refresh_from_db()

        self.assertEqual(self.user.province_id, "13")
        self.assertIsNone(self.user.city_id)

    def test_future_birth_date_is_rejected(self):

        future = timezone.localdate() + timedelta(days=1)

        response = self.client.patch(
            self.url,
            {"birth_date": future.isoformat()},
            format="json",
        )

        self.assertEqual(response.status_code, 400)


class EmployerBidDecisionAPITests(APITestCase):

    def setUp(self):

        employer_role, _ = Role.objects.get_or_create(
            code="EMPLOYER",
            defaults={"name": "Employer"},
        )

        executor_role, _ = Role.objects.get_or_create(
            code="EXECUTOR",
            defaults={"name": "Executor"},
        )

        self.employer = User.objects.create_user(
            phone="09129994001",
            full_name="Employer",
            phone_verified_at=timezone.now(),
        )

        UserRole.objects.create(
            user=self.employer,
            role=employer_role,
        )

        self.executor = User.objects.create_user(
            phone="09129994002",
            full_name="Worker One",
            phone_verified_at=timezone.now(),
        )

        UserRole.objects.create(
            user=self.executor,
            role=executor_role,
        )

        self.profile = ExecutorProfile.objects.create(
            user=self.executor,
            verification_status="APPROVED",
            profile_status="ACTIVE",
        )

        self.executor_two = User.objects.create_user(
            phone="09129994003",
            full_name="Worker Two",
            phone_verified_at=timezone.now(),
        )

        UserRole.objects.create(
            user=self.executor_two,
            role=executor_role,
        )

        self.profile_two = ExecutorProfile.objects.create(
            user=self.executor_two,
            verification_status="APPROVED",
            profile_status="ACTIVE",
        )

        self.category = TaskCategory.objects.create(
            name="Test Category"
        )

        now = timezone.now()

        self.task = Task.objects.create(
            employer_user=self.employer,
            category=self.category,
            title="Test Task",
            description="Test Description",
            status=TaskStatus.OPEN,
            estimated_duration_minutes=60,
            wage_budget_amount=1000000,
            currency_code="IRR",
            execution_window_start_at=now + timedelta(days=1),
            execution_window_end_at=now + timedelta(days=2),
            proposal_deadline_at=now + timedelta(hours=12),
            delivery_criteria="Test Criteria",
            published_at=now,
        )

        self.bid = Bid.objects.create(
            task=self.task,
            executor_profile=self.profile,
            proposed_wage_amount=500000,
            proposed_duration_minutes=60,
            message="Test Bid",
        )

        self.bid_two = Bid.objects.create(
            task=self.task,
            executor_profile=self.profile_two,
            proposed_wage_amount=600000,
            proposed_duration_minutes=60,
            message="Second Bid",
        )

        self.client.force_authenticate(user=self.employer)

    def test_accept_bid(self):

        response = self.client.post(
            f"/api/offers/employer/bids/{self.bid.pk}/accept/",
            {},
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
            response.data,
        )

        self.bid.refresh_from_db()
        self.bid_two.refresh_from_db()
        self.task.refresh_from_db()

        self.assertEqual(self.bid.status, BidStatus.ACCEPTED)
        self.assertEqual(self.bid_two.status, BidStatus.REJECTED)
        self.assertEqual(self.task.status, TaskStatus.ASSIGNED)

        self.assertTrue(
            TaskStatusHistory.objects.filter(
                task=self.task,
                to_status=TaskStatus.ASSIGNED,
            ).exists()
        )

    def test_reject_bid(self):

        response = self.client.post(
            f"/api/offers/employer/bids/{self.bid.pk}/reject/",
            {},
            format="json",
        )

        self.assertEqual(response.status_code, 200)

        self.bid.refresh_from_db()
        self.task.refresh_from_db()

        self.assertEqual(self.bid.status, BidStatus.REJECTED)
        self.assertEqual(self.task.status, TaskStatus.OPEN)

        self.assertTrue(
            BidStatusHistory.objects.filter(
                bid=self.bid,
                to_status=BidStatus.REJECTED,
            ).exists()
        )

    def test_accepting_same_bid_twice_fails(self):

        url = (
            f"/api/offers/employer/bids/"
            f"{self.bid.pk}/accept/"
        )

        first_response = self.client.post(
            url, {}, format="json"
        )

        second_response = self.client.post(
            url, {}, format="json"
        )

        self.assertEqual(first_response.status_code, 200)
        self.assertEqual(second_response.status_code, 409)

    def test_executor_cannot_accept_bid(self):

        self.client.force_authenticate(user=self.executor)

        response = self.client.post(
            f"/api/offers/employer/bids/{self.bid.pk}/accept/",
            {},
            format="json",
        )

        self.assertEqual(response.status_code, 403)

    def test_worker_bid_list_includes_task_context(self):

        self.client.force_authenticate(user=self.executor)

        response = self.client.get("/api/offers/bids/")

        self.assertEqual(response.status_code, 200)

        self.assertEqual(len(response.data), 1)

        bid_data = response.data[0]

        self.assertEqual(
            bid_data["task_title"],
            self.task.title,
        )

        self.assertEqual(
            bid_data["employer_name"],
            self.employer.full_name,
        )

        self.assertEqual(
            bid_data["task_currency_code"],
            self.task.currency_code,
        )


class EmployerTaskManagementAPITests(APITestCase):

    def setUp(self):

        role, _ = Role.objects.get_or_create(
            code="EMPLOYER",
            defaults={"name": "Employer"},
        )

        self.employer = User.objects.create_user(
            phone="09129995001",
            full_name="Employer",
            phone_verified_at=timezone.now(),
        )

        UserRole.objects.create(
            user=self.employer,
            role=role,
        )

        self.category = TaskCategory.objects.create(
            name="Task Test Category"
        )

        now = timezone.now()

        self.task = Task.objects.create(
            employer_user=self.employer,
            category=self.category,
            title="Original Task",
            description="Original Description",
            status=TaskStatus.DRAFT,
            estimated_duration_minutes=60,
            wage_budget_amount=1000000,
            currency_code="IRR",
            execution_window_start_at=now + timedelta(days=1),
            execution_window_end_at=now + timedelta(days=2),
            proposal_deadline_at=now + timedelta(hours=12),
            delivery_criteria="Test Criteria",
        )

        self.client.force_authenticate(user=self.employer)

    def test_edit_draft_task(self):

        response = self.client.patch(
            f"/api/tasks/{self.task.pk}/",
            {
                "title": "Updated Task",
                "wage_budget_amount": 2000000,
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
            response.data,
        )

        self.task.refresh_from_db()

        self.assertEqual(self.task.title, "Updated Task")
        self.assertEqual(self.task.wage_budget_amount, 2000000)

    def test_cancel_draft_task(self):

        response = self.client.post(
            f"/api/tasks/{self.task.pk}/cancel/",
            {},
            format="json",
        )

        self.assertEqual(response.status_code, 200)

        self.task.refresh_from_db()

        self.assertEqual(
            self.task.status,
            TaskStatus.CANCELLED,
        )

    def test_cannot_edit_assigned_task(self):

        self.task.status = TaskStatus.ASSIGNED
        self.task.save(update_fields=["status"])

        response = self.client.patch(
            f"/api/tasks/{self.task.pk}/",
            {"title": "Should Fail"},
            format="json",
        )

        self.assertEqual(response.status_code, 409)

    def test_assigned_task_requires_cancellation_review(self):

        self.task.status = TaskStatus.ASSIGNED
        self.task.save(update_fields=["status"])

        response = self.client.post(
            f"/api/tasks/{self.task.pk}/cancel/",
            {},
            format="json",
        )

        self.assertEqual(response.status_code, 200)

        self.task.refresh_from_db()

        self.assertEqual(
            self.task.status,
            TaskStatus.CANCELLATION_REVIEW,
        )

    def test_cannot_update_task_status_directly(self):

        response = self.client.patch(
            f"/api/tasks/{self.task.pk}/",
            {"status": TaskStatus.OPEN},
            format="json",
        )

        self.assertEqual(response.status_code, 400)