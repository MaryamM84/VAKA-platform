"""End-to-end regression tests for receipted expense reimbursement."""

from datetime import timedelta
from uuid import uuid4
from io import BytesIO
from tempfile import TemporaryDirectory

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.utils import timezone
from PIL import Image
from rest_framework.test import APITransactionTestCase

from accounts.models import ExecutorProfile, Role, User, UserRole
from offers.models import Bid, BidStatus
from payments.expense_models import ExpenseClaim, ExpenseClaimStatus, ExpenseReceipt
from payments.hold_gateway import read_verified_held_reservation
from payments.models import Wallet, WalletTransaction, WalletTransactionType
from payments.services import reserve_funds_for_bid
from tasks.choices import TaskStatus
from tasks.models import Task, TaskCategory


class ExpenseClaimTests(APITransactionTestCase):
    def setUp(self):
        self.temp_dir = TemporaryDirectory()
        self.addCleanup(self.temp_dir.cleanup)
        override = override_settings(PRIVATE_MEDIA_ROOT=self.temp_dir.name)
        override.enable()
        self.addCleanup(override.disable)

        now = timezone.now()
        employer_role, _ = Role.objects.get_or_create(
            code="EMPLOYER", defaults={"name": "Employer"},
        )
        executor_role, _ = Role.objects.get_or_create(
            code="EXECUTOR", defaults={"name": "Executor"},
        )
        self.employer = User.objects.create_user(
            phone="09129990011", full_name="Receipt Employer", phone_verified_at=now,
        )
        self.worker = User.objects.create_user(
            phone="09129990012", full_name="Receipt Worker", phone_verified_at=now,
        )
        self.outsider = User.objects.create_user(
            phone="09129990013", full_name="Receipt Outsider", phone_verified_at=now,
        )
        UserRole.objects.create(user=self.employer, role=employer_role)
        UserRole.objects.create(user=self.worker, role=executor_role)
        self.worker_profile = ExecutorProfile.objects.create(
            user=self.worker, verification_status="APPROVED", profile_status="ACTIVE",
        )
        self.category = TaskCategory.objects.create(name="Flower delivery")
        self.task = Task.objects.create(
            employer_user=self.employer, category=self.category,
            title="Buy flowers", description="Buy and deliver two bouquets",
            status=TaskStatus.ASSIGNED, estimated_duration_minutes=120,
            wage_budget_amount=3_000_000, item_cost_cap_amount=20_000_000,
            receipt_required=True, currency_code="IRR",
            execution_window_start_at=now - timedelta(hours=1),
            execution_window_end_at=now + timedelta(days=2),
            proposal_deadline_at=now - timedelta(days=1),
            delivery_criteria="Deliver the flowers with receipt",
        )
        self.bid = Bid.objects.create(
            task=self.task, executor_profile=self.worker_profile, status=BidStatus.ACTIVE,
            proposed_wage_amount=3_000_000, proposed_duration_minutes=120,
            message="Will buy and deliver flowers",
        )
        self.employer_wallet = Wallet.objects.create(
            user=self.employer, available_balance=30_000_000,
            reserved_balance=0, currency_code="IRR",
        )
        self.reservation, _event = reserve_funds_for_bid(
            employer=self.employer, task=self.task, bid=self.bid,
            idempotency_key="expense-fixture-hold",
        )
        self.bid.status = BidStatus.ACCEPTED
        self.bid.save(update_fields=["status"])
        self.list_url = f"/api/tasks/{self.task.pk}/expense-claims/"
        self.client.force_authenticate(user=self.worker)

    def _image(self, filename="receipt.png"):
        data = BytesIO()
        Image.new("RGB", (20, 20), "white").save(data, format="PNG")
        return SimpleUploadedFile(filename, data.getvalue(), content_type="image/png")

    def _submit(self, amount=17_000_000):
        return self.client.post(self.list_url, {
            "amount_irr": str(amount),
            "description": "Two bouquets and wrapping",
            "receipts": [self._image()],
        }, format="multipart")

    def _approval_url(self, claim_id):
        return f"{self.list_url}{claim_id}/approve/"

    def _rejection_url(self, claim_id):
        return f"{self.list_url}{claim_id}/reject/"

    def test_worker_uploads_receipt_without_transferring_money(self):
        response = self._submit()
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["status"], "PENDING")
        self.assertEqual(response.data["amount_irr"], 17_000_000)
        self.assertEqual(len(response.data["receipts"]), 1)
        self.assertIn("/expense-claims/", response.data["receipts"][0]["url"])
        self.assertEqual(ExpenseReceipt.objects.count(), 1)
        self.employer_wallet.refresh_from_db()
        self.assertEqual(self.employer_wallet.available_balance, 7_000_000)
        self.assertEqual(self.employer_wallet.reserved_balance, 23_000_000)
        self.assertFalse(Wallet.objects.filter(user=self.worker).exists())

    def test_approved_claim_moves_only_expense_from_escrow_once(self):
        submitted = self._submit()
        self.assertEqual(submitted.status_code, 201, submitted.data)
        claim_id = submitted.data["claim_id"]
        self.client.force_authenticate(user=self.employer)
        approved = self.client.post(self._approval_url(claim_id))
        self.assertEqual(approved.status_code, 200, approved.data)
        self.assertEqual(approved.data["status"], "APPROVED")

        self.employer_wallet.refresh_from_db()
        worker_wallet = Wallet.objects.get(user=self.worker)
        self.assertEqual(self.employer_wallet.available_balance, 7_000_000)
        self.assertEqual(self.employer_wallet.reserved_balance, 6_000_000)
        self.assertEqual(worker_wallet.available_balance, 17_000_000)
        self.assertEqual(worker_wallet.reserved_balance, 0)
        claim = ExpenseClaim.objects.get(pk=claim_id)
        self.assertIsNotNone(claim.employer_debit_id)
        self.assertIsNotNone(claim.worker_credit_id)
        self.assertEqual(WalletTransaction.objects.filter(
            transaction_type=WalletTransactionType.EXPENSE_REIMBURSEMENT,
        ).count(), 2)
        # Starting the task must still see the *remaining* wage+expense hold.
        self.assertIsNotNone(read_verified_held_reservation(
            task_id=self.task.pk, bid_id=self.bid.pk,
        ))

        repeated = self.client.post(self._approval_url(claim_id))
        self.assertEqual(repeated.status_code, 200, repeated.data)
        self.assertEqual(WalletTransaction.objects.filter(
            transaction_type=WalletTransactionType.EXPENSE_REIMBURSEMENT,
        ).count(), 2)
        self.employer_wallet.refresh_from_db()
        worker_wallet.refresh_from_db()
        self.assertEqual(self.employer_wallet.reserved_balance, 6_000_000)
        self.assertEqual(worker_wallet.available_balance, 17_000_000)

    def test_rejection_does_not_transfer_and_frees_claim_capacity(self):
        claim_id = self._submit().data["claim_id"]
        self.client.force_authenticate(user=self.employer)
        rejected = self.client.post(self._rejection_url(claim_id), {
            "reason": "The receipt is unreadable",
        }, format="json")
        self.assertEqual(rejected.status_code, 200, rejected.data)
        self.assertEqual(rejected.data["status"], "REJECTED")
        self.assertEqual(self.client.post(self._approval_url(claim_id)).status_code, 409)
        self.assertEqual(WalletTransaction.objects.filter(
            transaction_type=WalletTransactionType.EXPENSE_REIMBURSEMENT,
        ).count(), 0)
        self.client.force_authenticate(user=self.worker)
        self.assertEqual(self._submit().status_code, 201)  # rejected claim no longer consumes cap

    def test_pending_and_approved_claims_cannot_exceed_purchase_cap(self):
        self.assertEqual(self._submit(17_000_000).status_code, 201)
        self.assertEqual(self._submit(4_000_000).status_code, 409)
        self.assertEqual(self._submit(3_000_000).status_code, 201)

    def test_other_worker_and_employer_cannot_submit_or_approve(self):
        claim_id = self._submit().data["claim_id"]
        self.assertEqual(self.client.post(self._approval_url(claim_id)).status_code, 403)
        self.client.force_authenticate(user=self.employer)
        self.assertEqual(self._submit().status_code, 403)
        self.client.force_authenticate(user=self.outsider)
        self.assertEqual(self.client.get(self.list_url).status_code, 404)
        self.assertEqual(self.client.post(self._approval_url(claim_id)).status_code, 403)
        self.assertEqual(self.client.post(self._rejection_url(claim_id), {
            "reason": "Fake review",
        }, format="json").status_code, 403)

    def test_receipts_are_private_and_authorized_to_both_parties(self):
        uploaded = self._submit()
        receipt_url = uploaded.data["receipts"][0]["url"]
        # Absolute URL can be used by DRF client with same path.
        from urllib.parse import urlsplit
        path = urlsplit(receipt_url).path
        worker_response = self.client.get(path)
        self.assertEqual(worker_response.status_code, 200)
        worker_response.close()
        self.client.force_authenticate(user=self.employer)
        employer_response = self.client.get(path)
        self.assertEqual(employer_response.status_code, 200)
        self.assertEqual(employer_response["Cache-Control"], "private, no-store")
        employer_response.close()
        self.client.force_authenticate(user=self.outsider)
        self.assertEqual(self.client.get(path).status_code, 404)
        self.client.force_authenticate(user=None)
        self.assertIn(self.client.get(path).status_code, (401, 403))

    def test_invalid_receipt_and_unknown_field_are_rejected(self):
        bad = self.client.post(self.list_url, {
            "amount_irr": "17000000", "description": "Flowers",
            "receipts": [SimpleUploadedFile("fake.png", b"not-an-image", content_type="image/png")],
        }, format="multipart")
        self.assertEqual(bad.status_code, 400)
        unknown = self.client.post(self.list_url, {
            "amount_irr": "17000000", "description": "Flowers",
            "receipts": [self._image()], "status": "APPROVED",
        }, format="multipart")
        self.assertEqual(unknown.status_code, 400)
        self.assertEqual(ExpenseClaim.objects.count(), 0)

    def test_approval_after_task_completed_is_blocked(self):
        claim_id = self._submit().data["claim_id"]
        self.task.status = TaskStatus.COMPLETED
        self.task.save(update_fields=["status"])
        self.client.force_authenticate(user=self.employer)
        self.assertEqual(self.client.post(self._approval_url(claim_id)).status_code, 409)
        self.assertEqual(ExpenseClaim.objects.get(pk=claim_id).status, ExpenseClaimStatus.PENDING)


    def test_worker_and_employer_can_list_expense_claims(self):
        response = self._submit()
        self.assertEqual(response.status_code, 201, response.data)
        worker_list = self.client.get(self.list_url)
        self.assertEqual(worker_list.status_code, 200, worker_list.data)
        self.assertEqual(worker_list.data["count"], 1)
        self.assertEqual(worker_list.data["results"][0]["claim_id"], response.data["claim_id"])
        self.client.force_authenticate(user=self.employer)
        employer_list = self.client.get(self.list_url)
        self.assertEqual(employer_list.status_code, 200, employer_list.data)
        self.assertEqual(employer_list.data["count"], 1)

    def test_three_receipt_images_can_be_uploaded(self):
        response = self.client.post(self.list_url, {
            "amount_irr": "1000000",
            "description": "Purchase with three receipts",
            "receipts": [self._image(f"receipt-{index}.png") for index in range(3)],
        }, format="multipart")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(len(response.data["receipts"]), 3)
        self.assertEqual(ExpenseReceipt.objects.count(), 3)

    def test_more_than_three_receipts_is_rejected(self):
        response = self.client.post(self.list_url, {
            "amount_irr": "1000000",
            "description": "Too many receipts",
            "receipts": [self._image(f"receipt-{index}.png") for index in range(4)],
        }, format="multipart")
        self.assertEqual(response.status_code, 400, response.data)
        self.assertEqual(ExpenseClaim.objects.count(), 0)

    def test_invalid_amount_values_are_rejected(self):
        for amount in (0, -1, 2**63):
            with self.subTest(amount=amount):
                response = self._submit(amount)
                self.assertEqual(response.status_code, 400, response.data)
        self.assertEqual(ExpenseClaim.objects.count(), 0)

    def test_receipt_is_required(self):
        response = self.client.post(self.list_url, {
            "amount_irr": "1000000", "description": "Missing proof",
        }, format="multipart")
        self.assertEqual(response.status_code, 400, response.data)
        self.assertEqual(ExpenseClaim.objects.count(), 0)

    def test_blank_description_is_rejected(self):
        response = self.client.post(self.list_url, {
            "amount_irr": "1000000", "description": "   ",
            "receipts": [self._image()],
        }, format="multipart")
        self.assertEqual(response.status_code, 400, response.data)
        self.assertEqual(ExpenseClaim.objects.count(), 0)

    def test_claim_before_assignment_is_blocked(self):
        self.task.status = TaskStatus.OPEN
        self.task.save(update_fields=["status"])
        self.assertEqual(self._submit().status_code, 409)
        self.assertEqual(ExpenseClaim.objects.count(), 0)

    def test_claim_after_task_submission_is_blocked(self):
        self.task.status = TaskStatus.SUBMITTED
        self.task.save(update_fields=["status"])
        self.assertEqual(self._submit().status_code, 409)
        self.assertEqual(ExpenseClaim.objects.count(), 0)

    def test_inactive_worker_profile_cannot_claim(self):
        self.worker_profile.profile_status = "INACTIVE"
        self.worker_profile.save(update_fields=["profile_status"])
        self.assertEqual(self._submit().status_code, 403)
        self.assertEqual(ExpenseClaim.objects.count(), 0)

    def test_unfunded_escrow_blocks_claim(self):
        self.reservation.status = "FAILED"
        self.reservation.save(update_fields=["status"])
        self.assertEqual(self._submit().status_code, 409)
        self.assertEqual(ExpenseClaim.objects.count(), 0)

    def test_reject_requires_reason_and_is_idempotent_for_same_reason(self):
        claim_id = self._submit().data["claim_id"]
        self.client.force_authenticate(user=self.employer)
        self.assertEqual(self.client.post(self._rejection_url(claim_id), {
            "reason": "  ",
        }, format="json").status_code, 400)
        first = self.client.post(self._rejection_url(claim_id), {
            "reason": "Incorrect amount",
        }, format="json")
        self.assertEqual(first.status_code, 200, first.data)
        replay = self.client.post(self._rejection_url(claim_id), {
            "reason": "Incorrect amount",
        }, format="json")
        self.assertEqual(replay.status_code, 200, replay.data)
        conflict = self.client.post(self._rejection_url(claim_id), {
            "reason": "Changed reason",
        }, format="json")
        self.assertEqual(conflict.status_code, 409)
        self.assertEqual(WalletTransaction.objects.filter(
            transaction_type=WalletTransactionType.EXPENSE_REIMBURSEMENT,
        ).count(), 0)

    def test_approved_claim_cannot_be_rejected(self):
        claim_id = self._submit().data["claim_id"]
        self.client.force_authenticate(user=self.employer)
        self.assertEqual(self.client.post(self._approval_url(claim_id)).status_code, 200)
        rejected = self.client.post(self._rejection_url(claim_id), {
            "reason": "Too late",
        }, format="json")
        self.assertEqual(rejected.status_code, 409)
        self.assertEqual(ExpenseClaim.objects.get(pk=claim_id).status, ExpenseClaimStatus.APPROVED)

    def test_multiple_claims_settle_without_touching_reserved_wage(self):
        first_id = self._submit(12_000_000).data["claim_id"]
        second_id = self._submit(8_000_000).data["claim_id"]
        self.client.force_authenticate(user=self.employer)
        self.assertEqual(self.client.post(self._approval_url(first_id)).status_code, 200)
        self.assertEqual(self.client.post(self._approval_url(second_id)).status_code, 200)
        self.employer_wallet.refresh_from_db()
        self.assertEqual(self.employer_wallet.reserved_balance, 3_000_000)
        self.assertEqual(Wallet.objects.get(user=self.worker).available_balance, 20_000_000)
        self.assertEqual(WalletTransaction.objects.filter(
            transaction_type=WalletTransactionType.EXPENSE_REIMBURSEMENT,
        ).count(), 4)
        self.assertIsNotNone(read_verified_held_reservation(
            task_id=self.task.pk, bid_id=self.bid.pk,
        ))

    def test_worker_balance_overflow_rolls_back_entire_approval(self):
        claim_id = self._submit().data["claim_id"]
        Wallet.objects.create(
            user=self.worker, currency_code="IRR",
            available_balance=2**63 - 1,
            reserved_balance=0,
        )
        self.client.force_authenticate(user=self.employer)
        response = self.client.post(self._approval_url(claim_id))
        self.assertEqual(response.status_code, 409, response.data)
        self.assertEqual(ExpenseClaim.objects.get(pk=claim_id).status, ExpenseClaimStatus.PENDING)
        self.employer_wallet.refresh_from_db()
        self.assertEqual(self.employer_wallet.reserved_balance, 23_000_000)
        self.assertEqual(WalletTransaction.objects.filter(
            transaction_type=WalletTransactionType.EXPENSE_REIMBURSEMENT,
        ).count(), 0)

    def test_receipt_ids_cannot_be_guessed_for_another_file(self):
        uploaded = self._submit()
        claim_id = uploaded.data["claim_id"]
        guessed = f"{self.list_url}{claim_id}/receipts/{uuid4()}/"
        self.assertEqual(self.client.get(guessed).status_code, 404)
        self.client.force_authenticate(user=self.employer)
        self.assertEqual(self.client.get(guessed).status_code, 404)

    def test_unauthenticated_users_cannot_read_receipt_or_claims(self):
        uploaded = self._submit()
        from urllib.parse import urlsplit
        receipt_path = urlsplit(uploaded.data["receipts"][0]["url"]).path
        self.client.force_authenticate(user=None)
        self.assertIn(self.client.get(self.list_url).status_code, (401, 403))
        self.assertIn(self.client.get(receipt_path).status_code, (401, 403))

    def test_receipt_response_does_not_expose_private_storage_key(self):
        uploaded = self._submit()
        self.assertEqual(uploaded.status_code, 201)
        receipt_data = uploaded.data["receipts"][0]
        self.assertNotIn("storage_key", receipt_data)
        self.assertNotIn("private_media", receipt_data["url"])
        self.assertTrue(receipt_data["url"].endswith("/"))
