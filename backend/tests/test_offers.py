from datetime import timedelta
from unittest.mock import patch

from django.db import IntegrityError
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import ExecutorProfile, Role, User, UserRole
from offers.models import Bid, BidStatus, BidStatusHistory
from offers.services import submit_bid
from tasks.choices import TaskStatus
from tasks.models import Task, TaskCategory


BIDS_URL = "/api/offers/bids/"
BIGINT_MAX = (2 ** 63) - 1


class BidAPITestBase(APITestCase):
    """Shared factories and authentication helpers."""

    password = "Test-Password-123!"

    @classmethod
    def setUpTestData(cls):
        cls.executor_role, _ = Role.objects.get_or_create(
            code="EXECUTOR",
            defaults={
                "name": "Executor",
                "description": "Task executor role",
            },
        )

        cls.category = TaskCategory.objects.create(
            name="Bidding API test category",
            description="Category used by offers API tests",
            is_active=True,
        )

    def create_user(
        self,
        *,
        phone,
        verified=True,
        account_status=User.AccountStatus.ACTIVE,
        full_name=None,
    ):
        return User.objects.create_user(
            phone=phone,
            full_name=full_name or phone,
            password=self.password,
            account_status=account_status,
            phone_verified_at=timezone.now() if verified else None,
        )

    def create_executor(
        self,
        *,
        phone,
        verified=True,
        account_status=User.AccountStatus.ACTIVE,
        verification_status=ExecutorProfile.VerificationStatus.APPROVED,
        profile_status="ACTIVE",
        assign_role=True,
    ):
        user = self.create_user(
            phone=phone,
            verified=verified,
            account_status=account_status,
        )

        if assign_role:
            UserRole.objects.create(
                user=user,
                role=self.executor_role,
            )

        profile = ExecutorProfile.objects.create(
            user=user,
            verification_status=verification_status,
            profile_status=profile_status,
            approved_at=(
                timezone.now()
                if verification_status
                == ExecutorProfile.VerificationStatus.APPROVED
                else None
            ),
        )

        return user, profile

    def create_task(
        self,
        *,
        employer=None,
        status_value=TaskStatus.OPEN,
        proposal_deadline=None,
        title="Bidding test task",
    ):
        now = timezone.now()

        if employer is None:
            employer = self.create_user(
                phone=f"employer-{Task.objects.count()}@test.invalid",
            )

        return Task.objects.create(
            employer_user=employer,
            category=self.category,
            title=title,
            description="Task description for bidding API tests.",
            status=status_value,
            estimated_duration_minutes=60,
            wage_budget_amount=5_000_000,
            currency_code="IRR",
            receipt_required=False,
            execution_window_start_at=now + timedelta(hours=2),
            execution_window_end_at=now + timedelta(hours=5),
            proposal_deadline_at=(
                proposal_deadline
                if proposal_deadline is not None
                else now + timedelta(days=2)
            ),
            delivery_criteria="Complete the task and provide confirmation.",
        )

    def create_bid(
        self,
        *,
        profile,
        task,
        amount=2_500_000,
        duration=120,
        message="I can complete this task.",
        expires_at=None,
        bid_status=BidStatus.ACTIVE,
    ):
        return Bid.objects.create(
            task=task,
            executor_profile=profile,
            proposed_wage_amount=amount,
            proposed_duration_minutes=duration,
            message=message,
            expires_at=expires_at,
            status=bid_status,
        )

    def authenticate_as(self, user):
        self.client.force_authenticate(user=user)

    def submit_payload(
        self,
        task,
        *,
        amount=2_500_000,
        duration=120,
        message="I can complete this task.",
        expires_at=None,
        **extra,
    ):
        payload = {
            "task_id": str(task.pk),
            "proposed_wage_amount": amount,
            "proposed_duration_minutes": duration,
            "message": message,
            "expires_at": (
                expires_at.isoformat().replace("+00:00", "Z")
                if expires_at is not None
                else None
            ),
        }
        payload.update(extra)
        return payload

    def assert_api_error(self, response, expected_status):
        self.assertEqual(
            response.status_code,
            expected_status,
            getattr(response, "data", response.content),
        )


class BidSubmissionAPITests(BidAPITestBase):
    """POST /api/offers/bids/ tests."""

    def setUp(self):
        self.executor, self.executor_profile = self.create_executor(
            phone="09120000001",
        )
        self.employer = self.create_user(phone="09120000002")
        self.task = self.create_task(employer=self.employer)
        self.authenticate_as(self.executor)

    def test_submit_bid_success_creates_bid_and_initial_history(self):
        response = self.client.post(
            BIDS_URL,
            self.submit_payload(self.task),
            format="json",
        )

        self.assert_api_error(response, status.HTTP_201_CREATED)

        bid = Bid.objects.get(bid_id=response.data["bid_id"])

        self.assertEqual(bid.task_id, self.task.pk)
        self.assertEqual(
            bid.executor_profile_id,
            self.executor_profile.pk,
        )
        self.assertEqual(bid.proposed_wage_amount, 2_500_000)
        self.assertEqual(bid.proposed_duration_minutes, 120)
        self.assertEqual(bid.message, "I can complete this task.")
        self.assertEqual(bid.status, BidStatus.ACTIVE)

        history = BidStatusHistory.objects.filter(bid=bid)
        self.assertEqual(history.count(), 1)

        initial_history = history.get()
        self.assertIsNone(initial_history.from_status)
        self.assertEqual(initial_history.to_status, BidStatus.ACTIVE)
        self.assertEqual(initial_history.changed_by_user, self.executor)

    def test_submit_bid_requires_authentication(self):
        self.client.force_authenticate(user=None)

        response = self.client.post(
            BIDS_URL,
            self.submit_payload(self.task),
            format="json",
        )

        self.assert_api_error(response, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(Bid.objects.count(), 0)

    def test_non_executor_cannot_submit_bid(self):
        ordinary_user = self.create_user(phone="09120000003")
        self.authenticate_as(ordinary_user)

        response = self.client.post(
            BIDS_URL,
            self.submit_payload(self.task),
            format="json",
        )

        self.assert_api_error(response, status.HTTP_403_FORBIDDEN)
        self.assertEqual(Bid.objects.count(), 0)

    def test_executor_without_profile_cannot_submit_bid(self):
        user = self.create_user(phone="09120000004")
        UserRole.objects.create(user=user, role=self.executor_role)
        self.authenticate_as(user)

        response = self.client.post(
            BIDS_URL,
            self.submit_payload(self.task),
            format="json",
        )

        self.assert_api_error(response, status.HTTP_403_FORBIDDEN)
        self.assertEqual(Bid.objects.count(), 0)

    def test_unverified_phone_cannot_submit_bid(self):
        user, _profile = self.create_executor(
            phone="09120000005",
            verified=False,
        )
        self.authenticate_as(user)

        response = self.client.post(
            BIDS_URL,
            self.submit_payload(self.task),
            format="json",
        )

        self.assert_api_error(response, status.HTTP_403_FORBIDDEN)
        self.assertEqual(Bid.objects.count(), 0)

    def test_suspended_account_cannot_submit_bid(self):
        user, _profile = self.create_executor(
            phone="09120000006",
            account_status=User.AccountStatus.SUSPENDED,
        )
        self.authenticate_as(user)

        response = self.client.post(
            BIDS_URL,
            self.submit_payload(self.task),
            format="json",
        )

        self.assert_api_error(response, status.HTTP_403_FORBIDDEN)
        self.assertEqual(Bid.objects.count(), 0)

    def test_pending_executor_profile_cannot_submit_bid(self):
        user, _profile = self.create_executor(
            phone="09120000007",
            verification_status=ExecutorProfile.VerificationStatus.PENDING,
        )
        self.authenticate_as(user)

        response = self.client.post(
            BIDS_URL,
            self.submit_payload(self.task),
            format="json",
        )

        self.assert_api_error(response, status.HTTP_403_FORBIDDEN)
        self.assertEqual(Bid.objects.count(), 0)

    def test_rejected_executor_profile_cannot_submit_bid(self):
        user, _profile = self.create_executor(
            phone="09120000008",
            verification_status=ExecutorProfile.VerificationStatus.REJECTED,
        )
        self.authenticate_as(user)

        response = self.client.post(
            BIDS_URL,
            self.submit_payload(self.task),
            format="json",
        )

        self.assert_api_error(response, status.HTTP_403_FORBIDDEN)
        self.assertEqual(Bid.objects.count(), 0)

    def test_inactive_executor_profile_cannot_submit_bid(self):
        user, _profile = self.create_executor(
            phone="09120000009",
            profile_status="INACTIVE",
        )
        self.authenticate_as(user)

        response = self.client.post(
            BIDS_URL,
            self.submit_payload(self.task),
            format="json",
        )

        self.assert_api_error(response, status.HTTP_403_FORBIDDEN)
        self.assertEqual(Bid.objects.count(), 0)

    def test_executor_cannot_bid_on_own_task(self):
        own_task = self.create_task(employer=self.executor)

        response = self.client.post(
            BIDS_URL,
            self.submit_payload(own_task),
            format="json",
        )

        self.assert_api_error(response, status.HTTP_403_FORBIDDEN)
        self.assertFalse(Bid.objects.filter(task=own_task).exists())

    def test_task_must_exist(self):
        response = self.client.post(
            BIDS_URL,
            {
                **self.submit_payload(self.task),
                "task_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
            },
            format="json",
        )

        self.assert_api_error(response, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Bid.objects.count(), 0)

    def test_task_must_be_open(self):
        closed_task = self.create_task(
            employer=self.employer,
            status_value=TaskStatus.ASSIGNED,
        )

        response = self.client.post(
            BIDS_URL,
            self.submit_payload(closed_task),
            format="json",
        )

        self.assert_api_error(response, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(Bid.objects.filter(task=closed_task).exists())

    def test_proposal_deadline_must_be_in_future(self):
        expired_task = self.create_task(
            employer=self.employer,
            proposal_deadline=timezone.now() - timedelta(seconds=1),
        )

        response = self.client.post(
            BIDS_URL,
            self.submit_payload(expired_task),
            format="json",
        )

        self.assert_api_error(response, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(Bid.objects.filter(task=expired_task).exists())

    def test_negative_proposed_amount_is_rejected(self):
        response = self.client.post(
            BIDS_URL,
            self.submit_payload(self.task, amount=-1),
            format="json",
        )

        self.assert_api_error(response, status.HTTP_400_BAD_REQUEST)

    def test_amount_above_bigint_max_is_rejected(self):
        response = self.client.post(
            BIDS_URL,
            self.submit_payload(self.task, amount=BIGINT_MAX + 1),
            format="json",
        )

        self.assert_api_error(response, status.HTTP_400_BAD_REQUEST)

    def test_zero_amount_is_allowed_by_current_business_rules(self):
        response = self.client.post(
            BIDS_URL,
            self.submit_payload(self.task, amount=0),
            format="json",
        )

        self.assert_api_error(response, status.HTTP_201_CREATED)
        self.assertEqual(response.data["proposed_wage_amount"], 0)

    def test_duration_below_minimum_is_rejected(self):
        response = self.client.post(
            BIDS_URL,
            self.submit_payload(self.task, duration=0),
            format="json",
        )

        self.assert_api_error(response, status.HTTP_400_BAD_REQUEST)

    def test_duration_above_maximum_is_rejected(self):
        response = self.client.post(
            BIDS_URL,
            self.submit_payload(self.task, duration=301),
            format="json",
        )

        self.assert_api_error(response, status.HTTP_400_BAD_REQUEST)

    def test_duration_boundaries_are_accepted(self):
        response_min = self.client.post(
            BIDS_URL,
            self.submit_payload(self.task, duration=1),
            format="json",
        )
        self.assert_api_error(response_min, status.HTTP_201_CREATED)

        another_task = self.create_task(
            employer=self.employer,
            title="Second boundary task",
        )
        response_max = self.client.post(
            BIDS_URL,
            self.submit_payload(another_task, duration=300),
            format="json",
        )
        self.assert_api_error(response_max, status.HTTP_201_CREATED)

    def test_blank_or_whitespace_message_is_rejected(self):
        for message in ("", "   ", "\n\t"):
            with self.subTest(message=repr(message)):
                response = self.client.post(
                    BIDS_URL,
                    self.submit_payload(self.task, message=message),
                    format="json",
                )
                self.assert_api_error(
                    response,
                    status.HTTP_400_BAD_REQUEST,
                )

    def test_message_is_trimmed(self):
        response = self.client.post(
            BIDS_URL,
            self.submit_payload(self.task, message="  Hello employer  "),
            format="json",
        )

        self.assert_api_error(response, status.HTTP_201_CREATED)
        self.assertEqual(response.data["message"], "Hello employer")

    def test_expiration_in_past_is_rejected(self):
        response = self.client.post(
            BIDS_URL,
            self.submit_payload(
                self.task,
                expires_at=timezone.now() - timedelta(minutes=1),
            ),
            format="json",
        )

        self.assert_api_error(response, status.HTTP_400_BAD_REQUEST)

    def test_expiration_after_task_proposal_deadline_is_rejected(self):
        response = self.client.post(
            BIDS_URL,
            self.submit_payload(
                self.task,
                expires_at=timezone.now() + timedelta(days=3),
            ),
            format="json",
        )

        self.assert_api_error(response, status.HTTP_400_BAD_REQUEST)

    def test_future_expiration_before_task_deadline_is_accepted(self):
        expiration = timezone.now() + timedelta(hours=12)

        response = self.client.post(
            BIDS_URL,
            self.submit_payload(self.task, expires_at=expiration),
            format="json",
        )

        self.assert_api_error(response, status.HTTP_201_CREATED)
        self.assertIsNotNone(response.data["expires_at"])

    def test_null_expiration_is_allowed(self):
        response = self.client.post(
            BIDS_URL,
            self.submit_payload(self.task, expires_at=None),
            format="json",
        )

        self.assert_api_error(response, status.HTTP_201_CREATED)
        self.assertIsNone(response.data["expires_at"])

    def test_executor_can_bid_on_different_tasks(self):
        first = self.client.post(
            BIDS_URL,
            self.submit_payload(self.task),
            format="json",
        )
        self.assert_api_error(first, status.HTTP_201_CREATED)

        second_task = self.create_task(
            employer=self.employer,
            title="Another task",
        )
        second = self.client.post(
            BIDS_URL,
            self.submit_payload(second_task),
            format="json",
        )
        self.assert_api_error(second, status.HTTP_201_CREATED)

        self.assertEqual(
            Bid.objects.filter(
                executor_profile=self.executor_profile,
            ).count(),
            2,
        )

    def test_same_executor_cannot_submit_two_bids_for_same_task(self):
        first = self.client.post(
            BIDS_URL,
            self.submit_payload(self.task),
            format="json",
        )
        self.assert_api_error(first, status.HTTP_201_CREATED)

        second = self.client.post(
            BIDS_URL,
            self.submit_payload(
                self.task,
                amount=3_000_000,
            ),
            format="json",
        )
        self.assert_api_error(second, status.HTTP_400_BAD_REQUEST)

        self.assertEqual(
            Bid.objects.filter(
                task=self.task,
                executor_profile=self.executor_profile,
            ).count(),
            1,
        )

    def test_different_executors_can_bid_on_same_task(self):
        first = self.client.post(
            BIDS_URL,
            self.submit_payload(self.task),
            format="json",
        )
        self.assert_api_error(first, status.HTTP_201_CREATED)

        other_executor, other_profile = self.create_executor(
            phone="09120000010",
        )
        self.authenticate_as(other_executor)

        second = self.client.post(
            BIDS_URL,
            self.submit_payload(self.task, amount=3_000_000),
            format="json",
        )
        self.assert_api_error(second, status.HTTP_201_CREATED)

        self.assertEqual(
            Bid.objects.filter(task=self.task).count(),
            2,
        )

    def test_client_cannot_set_status_or_executor_or_task_fields(self):
        response = self.client.post(
            BIDS_URL,
            self.submit_payload(
                self.task,
                status=BidStatus.ACCEPTED,
                executor_profile_id=str(self.executor_profile.pk),
            ),
            format="json",
        )

        self.assert_api_error(response, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Bid.objects.count(), 0)


class MyBidsListAPITests(BidAPITestBase):
    """GET /api/offers/bids/ tests."""

    def setUp(self):
        self.executor, self.profile = self.create_executor(
            phone="09120000101",
        )
        self.other_executor, self.other_profile = self.create_executor(
            phone="09120000102",
        )
        self.employer = self.create_user(phone="09120000103")
        self.task_one = self.create_task(employer=self.employer)
        self.task_two = self.create_task(
            employer=self.employer,
            title="Second task",
        )
        self.authenticate_as(self.executor)

    def test_list_endpoint_is_routed_and_returns_only_own_bids(self):
        own_bid_one = self.create_bid(
            profile=self.profile,
            task=self.task_one,
        )
        own_bid_two = self.create_bid(
            profile=self.profile,
            task=self.task_two,
        )
        other_bid = self.create_bid(
            profile=self.other_profile,
            task=self.create_task(
                employer=self.employer,
                title="Other executor task",
            ),
        )

        response = self.client.get(BIDS_URL)

        self.assert_api_error(response, status.HTTP_200_OK)

        returned_ids = {
            item["bid_id"]
            for item in response.data
        }

        self.assertEqual(
            returned_ids,
            {str(own_bid_one.pk), str(own_bid_two.pk)},
        )
        self.assertNotIn(str(other_bid.pk), returned_ids)

    def test_list_includes_task_context_required_by_frontend(self):
        bid = self.create_bid(profile=self.profile, task=self.task_one)

        response = self.client.get(BIDS_URL)

        self.assert_api_error(response, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        item = response.data[0]
        self.assertEqual(item["bid_id"], str(bid.pk))
        self.assertEqual(item["task_title"], self.task_one.title)
        self.assertEqual(item["employer_name"], self.employer.full_name)
        self.assertEqual(item["task_currency_code"], self.task_one.currency_code)

    def test_list_returns_empty_array_when_executor_has_no_bids(self):
        response = self.client.get(BIDS_URL)

        self.assert_api_error(response, status.HTTP_200_OK)
        self.assertEqual(response.data, [])

    def test_list_requires_authentication(self):
        self.client.force_authenticate(user=None)

        response = self.client.get(BIDS_URL)

        self.assert_api_error(response, status.HTTP_401_UNAUTHORIZED)

    def test_non_executor_cannot_list_executor_bids(self):
        ordinary_user = self.create_user(phone="09120000104")
        self.authenticate_as(ordinary_user)

        response = self.client.get(BIDS_URL)

        self.assert_api_error(response, status.HTTP_403_FORBIDDEN)


class MyBidDetailAPITests(BidAPITestBase):
    """GET /api/offers/bids/<bid_id>/ tests."""

    def setUp(self):
        self.executor, self.profile = self.create_executor(
            phone="09120000201",
        )
        self.other_executor, self.other_profile = self.create_executor(
            phone="09120000202",
        )
        self.employer = self.create_user(phone="09120000203")
        self.task = self.create_task(employer=self.employer)
        self.own_bid = self.create_bid(
            profile=self.profile,
            task=self.task,
        )
        self.other_bid = self.create_bid(
            profile=self.other_profile,
            task=self.task,
        )
        self.authenticate_as(self.executor)

    def detail_url(self, bid):
        return f"{BIDS_URL}{bid.pk}/"

    def test_owner_can_retrieve_bid_detail(self):
        response = self.client.get(self.detail_url(self.own_bid))

        self.assert_api_error(response, status.HTTP_200_OK)
        self.assertEqual(response.data["bid_id"], str(self.own_bid.pk))
        self.assertEqual(
            response.data["executor_profile_id"],
            str(self.profile.pk),
        )
        self.assertEqual(
            response.data["proposed_wage_amount"],
            self.own_bid.proposed_wage_amount,
        )

    def test_executor_cannot_retrieve_another_executors_bid(self):
        response = self.client.get(self.detail_url(self.other_bid))

        self.assert_api_error(response, status.HTTP_404_NOT_FOUND)

    def test_nonexistent_bid_returns_404(self):
        response = self.client.get(
            f"{BIDS_URL}aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/"
        )

        self.assert_api_error(response, status.HTTP_404_NOT_FOUND)

    def test_detail_requires_authentication(self):
        self.client.force_authenticate(user=None)

        response = self.client.get(self.detail_url(self.own_bid))

        self.assert_api_error(response, status.HTTP_401_UNAUTHORIZED)

    def test_non_executor_cannot_retrieve_bid_detail(self):
        ordinary_user = self.create_user(phone="09120000204")
        self.authenticate_as(ordinary_user)

        response = self.client.get(self.detail_url(self.own_bid))

        self.assert_api_error(response, status.HTTP_403_FORBIDDEN)


class MyBidUpdateAPITests(BidAPITestBase):
    """PATCH /api/offers/bids/<bid_id>/ tests."""

    def setUp(self):
        self.executor, self.profile = self.create_executor(
            phone="09120000301",
        )
        self.other_executor, self.other_profile = self.create_executor(
            phone="09120000302",
        )
        self.employer = self.create_user(phone="09120000303")
        self.task = self.create_task(employer=self.employer)
        self.bid = self.create_bid(
            profile=self.profile,
            task=self.task,
            expires_at=timezone.now() + timedelta(hours=12),
        )
        self.authenticate_as(self.executor)

    def detail_url(self, bid=None):
        bid = bid or self.bid
        return f"{BIDS_URL}{bid.pk}/"

    def test_owner_can_update_allowed_fields(self):
        response = self.client.patch(
            self.detail_url(),
            {
                "proposed_wage_amount": 3_000_000,
                "proposed_duration_minutes": 150,
                "message": "Updated proposal message",
            },
            format="json",
        )

        self.assert_api_error(response, status.HTTP_200_OK)

        self.bid.refresh_from_db()
        self.assertEqual(self.bid.proposed_wage_amount, 3_000_000)
        self.assertEqual(self.bid.proposed_duration_minutes, 150)
        self.assertEqual(self.bid.message, "Updated proposal message")
        self.assertEqual(self.bid.status, BidStatus.ACTIVE)
        self.assertEqual(self.bid.task_id, self.task.pk)
        self.assertEqual(self.bid.executor_profile_id, self.profile.pk)

    def test_update_does_not_create_status_history_entry(self):
        before_count = BidStatusHistory.objects.filter(
            bid=self.bid,
        ).count()

        response = self.client.patch(
            self.detail_url(),
            {"proposed_wage_amount": 3_100_000},
            format="json",
        )

        self.assert_api_error(response, status.HTTP_200_OK)

        after_count = BidStatusHistory.objects.filter(
            bid=self.bid,
        ).count()

        self.assertEqual(after_count, before_count)

    def test_other_executor_cannot_update_bid(self):
        self.authenticate_as(self.other_executor)

        response = self.client.patch(
            self.detail_url(),
            {"proposed_wage_amount": 1},
            format="json",
        )

        self.assert_api_error(response, status.HTTP_404_NOT_FOUND)

        self.bid.refresh_from_db()
        self.assertEqual(self.bid.proposed_wage_amount, 2_500_000)

    def test_update_requires_authentication(self):
        self.client.force_authenticate(user=None)

        response = self.client.patch(
            self.detail_url(),
            {"proposed_wage_amount": 3_000_000},
            format="json",
        )

        self.assert_api_error(response, status.HTTP_401_UNAUTHORIZED)

    def test_non_executor_cannot_update_bid(self):
        ordinary_user = self.create_user(phone="09120000304")
        self.authenticate_as(ordinary_user)

        response = self.client.patch(
            self.detail_url(),
            {"proposed_wage_amount": 3_000_000},
            format="json",
        )

        self.assert_api_error(response, status.HTTP_403_FORBIDDEN)

    def test_empty_patch_is_rejected(self):
        response = self.client.patch(
            self.detail_url(),
            {},
            format="json",
        )

        self.assert_api_error(response, status.HTTP_400_BAD_REQUEST)

    def test_unknown_or_protected_fields_are_rejected(self):
        """
        Expected to expose the current serializer gap:
        BidUpdateSerializer does not inherit RejectUnexpectedFieldsMixin.
        """
        response = self.client.patch(
            self.detail_url(),
            {
                "proposed_wage_amount": 3_000_000,
                "status": BidStatus.ACCEPTED,
                "task_id": str(self.task.pk),
                "executor_profile_id": str(self.profile.pk),
            },
            format="json",
        )

        self.assert_api_error(response, status.HTTP_400_BAD_REQUEST)

        self.bid.refresh_from_db()
        self.assertEqual(self.bid.status, BidStatus.ACTIVE)
        self.assertEqual(self.bid.proposed_wage_amount, 2_500_000)

    def test_status_cannot_be_changed_through_patch(self):
        response = self.client.patch(
            self.detail_url(),
            {"status": BidStatus.ACCEPTED},
            format="json",
        )

        self.assert_api_error(response, status.HTTP_400_BAD_REQUEST)

        self.bid.refresh_from_db()
        self.assertEqual(self.bid.status, BidStatus.ACTIVE)

    def test_task_and_executor_cannot_be_changed_through_patch(self):
        other_task = self.create_task(
            employer=self.employer,
            title="Protected target task",
        )
        other_executor, other_profile = self.create_executor(
            phone="09120000305",
        )

        response = self.client.patch(
            self.detail_url(),
            {
                "task_id": str(other_task.pk),
                "executor_profile_id": str(other_profile.pk),
            },
            format="json",
        )

        # Empty effective update must be rejected.
        self.assert_api_error(response, status.HTTP_400_BAD_REQUEST)

        self.bid.refresh_from_db()
        self.assertEqual(self.bid.task_id, self.task.pk)
        self.assertEqual(
            self.bid.executor_profile_id,
            self.profile.pk,
        )

    def test_negative_amount_is_rejected(self):
        response = self.client.patch(
            self.detail_url(),
            {"proposed_wage_amount": -1},
            format="json",
        )

        self.assert_api_error(response, status.HTTP_400_BAD_REQUEST)

    def test_amount_above_bigint_max_is_rejected(self):
        response = self.client.patch(
            self.detail_url(),
            {"proposed_wage_amount": BIGINT_MAX + 1},
            format="json",
        )

        self.assert_api_error(response, status.HTTP_400_BAD_REQUEST)

    def test_duration_outside_range_is_rejected(self):
        for duration in (0, 301):
            with self.subTest(duration=duration):
                response = self.client.patch(
                    self.detail_url(),
                    {"proposed_duration_minutes": duration},
                    format="json",
                )
                self.assert_api_error(
                    response,
                    status.HTTP_400_BAD_REQUEST,
                )

    def test_blank_message_is_rejected(self):
        response = self.client.patch(
            self.detail_url(),
            {"message": "   "},
            format="json",
        )

        self.assert_api_error(response, status.HTTP_400_BAD_REQUEST)

    def test_past_expiration_is_rejected(self):
        response = self.client.patch(
            self.detail_url(),
            {
                "expires_at": (
                    timezone.now() - timedelta(minutes=1)
                ).isoformat()
            },
            format="json",
        )

        self.assert_api_error(response, status.HTTP_400_BAD_REQUEST)

    def test_expiration_after_task_deadline_is_rejected(self):
        response = self.client.patch(
            self.detail_url(),
            {
                "expires_at": (
                    timezone.now() + timedelta(days=3)
                ).isoformat()
            },
            format="json",
        )

        self.assert_api_error(response, status.HTTP_400_BAD_REQUEST)

    def test_expiration_can_be_cleared_with_null(self):
        response = self.client.patch(
            self.detail_url(),
            {"expires_at": None},
            format="json",
        )

        self.assert_api_error(response, status.HTTP_200_OK)

        self.bid.refresh_from_db()
        self.assertIsNone(self.bid.expires_at)

    def test_existing_expiration_is_preserved_when_not_submitted(self):
        original_expiration = self.bid.expires_at

        response = self.client.patch(
            self.detail_url(),
            {"message": "Only message changed"},
            format="json",
        )

        self.assert_api_error(response, status.HTTP_200_OK)

        self.bid.refresh_from_db()
        self.assertEqual(self.bid.expires_at, original_expiration)

    def test_bid_with_non_active_status_cannot_be_updated(self):
        for bid_status in (
            BidStatus.ACCEPTED,
            BidStatus.REJECTED,
            BidStatus.WITHDRAWN,
            BidStatus.EXPIRED,
        ):
            with self.subTest(bid_status=bid_status):
                Bid.objects.filter(pk=self.bid.pk).update(
                    status=bid_status,
                )

                response = self.client.patch(
                    self.detail_url(),
                    {"proposed_wage_amount": 3_000_000},
                    format="json",
                )

                self.assert_api_error(
                    response,
                    status.HTTP_400_BAD_REQUEST,
                )

        Bid.objects.filter(pk=self.bid.pk).update(
            status=BidStatus.ACTIVE,
        )

    def test_bid_on_non_open_task_cannot_be_updated(self):
        Task.objects.filter(pk=self.task.pk).update(
            status=TaskStatus.ASSIGNED,
        )

        response = self.client.patch(
            self.detail_url(),
            {"proposed_wage_amount": 3_000_000},
            format="json",
        )

        self.assert_api_error(response, status.HTTP_400_BAD_REQUEST)

    def test_bid_cannot_be_updated_after_proposal_deadline(self):
        Task.objects.filter(pk=self.task.pk).update(
            proposal_deadline_at=timezone.now() - timedelta(seconds=1),
        )

        response = self.client.patch(
            self.detail_url(),
            {"proposed_wage_amount": 3_000_000},
            format="json",
        )

        self.assert_api_error(response, status.HTTP_400_BAD_REQUEST)

    def test_expired_bid_cannot_be_updated(self):
        Bid.objects.filter(pk=self.bid.pk).update(
            expires_at=timezone.now() - timedelta(seconds=1),
        )

        response = self.client.patch(
            self.detail_url(),
            {"proposed_wage_amount": 3_000_000},
            format="json",
        )

        self.assert_api_error(response, status.HTTP_400_BAD_REQUEST)

    def test_unapproved_executor_cannot_update_bid(self):
        ExecutorProfile.objects.filter(pk=self.profile.pk).update(
            verification_status=ExecutorProfile.VerificationStatus.PENDING,
        )

        response = self.client.patch(
            self.detail_url(),
            {"proposed_wage_amount": 3_000_000},
            format="json",
        )

        self.assert_api_error(response, status.HTTP_403_FORBIDDEN)

    def test_inactive_executor_profile_cannot_update_bid(self):
        ExecutorProfile.objects.filter(pk=self.profile.pk).update(
            profile_status="INACTIVE",
        )

        response = self.client.patch(
            self.detail_url(),
            {"proposed_wage_amount": 3_000_000},
            format="json",
        )

        self.assert_api_error(response, status.HTTP_403_FORBIDDEN)


class BidTransactionAndConstraintTests(BidAPITestBase):
    """Database-level invariants relevant to bid submission."""

    def setUp(self):
        self.executor, self.profile = self.create_executor(
            phone="09120000401",
        )
        self.employer = self.create_user(phone="09120000402")
        self.task = self.create_task(employer=self.employer)
        self.authenticate_as(self.executor)

    def test_bid_has_one_initial_status_history_after_successful_submission(self):
        response = self.client.post(
            BIDS_URL,
            self.submit_payload(self.task),
            format="json",
        )

        self.assert_api_error(response, status.HTTP_201_CREATED)

        bid = Bid.objects.get(pk=response.data["bid_id"])

        self.assertEqual(
            BidStatusHistory.objects.filter(bid=bid).count(),
            1,
        )

    def test_submission_rolls_back_bid_if_initial_history_creation_fails(self):
        with patch(
            "offers.services.BidStatusHistory.objects.create",
            side_effect=IntegrityError("simulated history insert failure"),
        ):
            with self.assertRaises(IntegrityError):
                submit_bid(
                    user=self.executor,
                    task=self.task,
                    proposed_wage_amount=2_500_000,
                    proposed_duration_minutes=120,
                    message="Atomicity test",
                    expires_at=None,
                )

        self.assertFalse(
            Bid.objects.filter(
                task=self.task,
                executor_profile=self.profile,
            ).exists()
        )

    def test_bid_database_rejects_negative_amount(self):
        with self.assertRaises(IntegrityError):
            with self.atomic_block():
                Bid.objects.create(
                    task=self.task,
                    executor_profile=self.profile,
                    proposed_wage_amount=-1,
                    proposed_duration_minutes=60,
                    message="Invalid direct database insert",
                    status=BidStatus.ACTIVE,
                )

    def test_bid_database_rejects_duration_outside_range(self):
        with self.assertRaises(IntegrityError):
            with self.atomic_block():
                Bid.objects.create(
                    task=self.task,
                    executor_profile=self.profile,
                    proposed_wage_amount=100,
                    proposed_duration_minutes=301,
                    message="Invalid direct database insert",
                    status=BidStatus.ACTIVE,
                )

    @staticmethod
    def atomic_block():
        from django.db import transaction
        return transaction.atomic()

EMPLOYER_BIDS_URL = "/api/offers/employer/bids/"

EMPLOYER_TASK_BIDS_URL = (
    "/api/offers/employer/tasks/{task_id}/bids/"
)

EMPLOYER_BID_DETAIL_URL = (
    "/api/offers/employer/bids/{bid_id}/"
)


class EmployerBidReviewAPITests(BidAPITestBase):
    """
    Tests for employer bid review APIs.
    """

    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()

        cls.employer_role, _ = Role.objects.get_or_create(
            code="EMPLOYER",
            defaults={
                "name": "Employer",
                "description": "Task employer role",
            },
        )

    def create_employer(self, *, phone):
        user = self.create_user(phone=phone)

        UserRole.objects.create(
            user=user,
            role=self.employer_role,
        )

        return user

    def setUp(self):

        self.employer = self.create_employer(
            phone="09121110001",
        )

        self.other_employer = self.create_employer(
            phone="09121110002",
        )

        self.executor, self.executor_profile = self.create_executor(
            phone="09121110003",
        )

        self.executor.full_name = "Test Executor"
        self.executor.save(update_fields=["full_name"])

        self.executor_profile.bio = "Experienced task executor"
        self.executor_profile.save(update_fields=["bio"])

        self.own_task = self.create_task(
            employer=self.employer,
            title="Employer own task",
        )

        self.second_own_task = self.create_task(
            employer=self.employer,
            title="Employer second task",
        )

        self.other_task = self.create_task(
            employer=self.other_employer,
            title="Another employer task",
        )

        self.own_bid = self.create_bid(
            profile=self.executor_profile,
            task=self.own_task,
            amount=3_000_000,
            duration=90,
            message="I can complete this task.",
        )

        self.second_own_bid = self.create_bid(
            profile=self.executor_profile,
            task=self.second_own_task,
            amount=3_500_000,
            duration=100,
            message="I can complete the second task.",
        )

        self.other_bid = self.create_bid(
            profile=self.executor_profile,
            task=self.other_task,
            amount=4_000_000,
            duration=120,
            message="This belongs to another employer.",
        )

        self.authenticate_as(self.employer)

    def test_employer_can_list_all_own_received_bids(self):

        response = self.client.get(EMPLOYER_BIDS_URL)

        self.assert_api_error(response, status.HTTP_200_OK)

        self.assertEqual(len(response.data), 2)

        returned_ids = {
            item["bid_id"]
            for item in response.data
        }

        self.assertEqual(
            returned_ids,
            {
                str(self.own_bid.pk),
                str(self.second_own_bid.pk),
            },
        )

    def test_employer_list_contains_executor_and_bid_information(self):

        response = self.client.get(EMPLOYER_BIDS_URL)

        self.assert_api_error(response, status.HTTP_200_OK)

        bid_data = next(
            item
            for item in response.data
            if item["bid_id"] == str(self.own_bid.pk)
        )

        self.assertEqual(
            bid_data["task_title"],
            self.own_task.title,
        )

        self.assertEqual(
            bid_data["executor_name"],
            self.executor.full_name,
        )

        self.assertEqual(
            bid_data["executor_bio"],
            self.executor_profile.bio,
        )

        self.assertEqual(
            bid_data["executor_verification_status"],
            ExecutorProfile.VerificationStatus.APPROVED,
        )

        self.assertEqual(
            bid_data["proposed_wage_amount"],
            3_000_000,
        )

        self.assertEqual(
            bid_data["proposed_duration_minutes"],
            90,
        )

    def test_employer_cannot_see_other_employers_bids(self):

        response = self.client.get(EMPLOYER_BIDS_URL)

        self.assert_api_error(response, status.HTTP_200_OK)

        returned_ids = {
            item["bid_id"]
            for item in response.data
        }

        self.assertNotIn(
            str(self.other_bid.pk),
            returned_ids,
        )

    def test_employer_can_list_bids_for_one_owned_task(self):

        url = EMPLOYER_TASK_BIDS_URL.format(
            task_id=self.own_task.pk,
        )

        response = self.client.get(url)

        self.assert_api_error(response, status.HTTP_200_OK)

        self.assertEqual(len(response.data), 1)

        self.assertEqual(
            response.data[0]["bid_id"],
            str(self.own_bid.pk),
        )

    def test_employer_cannot_access_another_employers_task_bids(self):

        url = EMPLOYER_TASK_BIDS_URL.format(
            task_id=self.other_task.pk,
        )

        response = self.client.get(url)

        self.assert_api_error(
            response,
            status.HTTP_404_NOT_FOUND,
        )

    def test_employer_can_view_own_bid_details(self):

        url = EMPLOYER_BID_DETAIL_URL.format(
            bid_id=self.own_bid.pk,
        )

        response = self.client.get(url)

        self.assert_api_error(response, status.HTTP_200_OK)

        self.assertEqual(
            response.data["bid_id"],
            str(self.own_bid.pk),
        )

        self.assertEqual(
            response.data["task_description"],
            self.own_task.description,
        )

        self.assertEqual(
            response.data["task_wage_budget_amount"],
            self.own_task.wage_budget_amount,
        )

        self.assertEqual(
            response.data["executor_bio"],
            self.executor_profile.bio,
        )

    def test_employer_cannot_view_other_employers_bid_details(self):

        url = EMPLOYER_BID_DETAIL_URL.format(
            bid_id=self.other_bid.pk,
        )

        response = self.client.get(url)

        self.assert_api_error(
            response,
            status.HTTP_404_NOT_FOUND,
        )

    def test_executor_cannot_access_employer_bid_apis(self):

        self.authenticate_as(self.executor)

        response = self.client.get(EMPLOYER_BIDS_URL)

        self.assert_api_error(
            response,
            status.HTTP_403_FORBIDDEN,
        )

    def test_employer_bid_apis_require_authentication(self):

        self.client.force_authenticate(user=None)

        response = self.client.get(EMPLOYER_BIDS_URL)

        self.assert_api_error(
            response,
            status.HTTP_401_UNAUTHORIZED,
        )
