"""Simulated deposit mode on the existing /api/wallet/deposit/ endpoint."""
from unittest.mock import patch

from django.test import override_settings
from django.utils import timezone
from django.db import IntegrityError
from rest_framework.test import APITestCase

from accounts.models import User
from payments.models import (
    Wallet, WalletDeposit, WalletDepositStatus, WalletTransaction,
    WalletTransactionDirection, WalletTransactionType,
)


@override_settings(VAKA_WALLET_DEPOSIT_MODE="SIMULATED", DEBUG=True)
class SimulatedWalletDepositTests(APITestCase):
    url = "/api/wallet/deposit/"

    def setUp(self):
        self.user = User.objects.create_user(
            phone="09122009901", full_name="Simulated Wallet User",
            phone_verified_at=timezone.now(),
        )
        self.client.force_authenticate(user=self.user)

    def deposit(self, amount=13_000_000, key="demo-deposit-001"):
        return self.client.post(
            self.url, {"amount": amount}, format="json",
            HTTP_IDEMPOTENCY_KEY=key,
        )

    def test_deposit_credits_balance_with_ledger_and_receipt(self):
        response = self.deposit()
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["status"], WalletDepositStatus.SUCCEEDED)
        self.assertEqual(response.data["amount"], 13_000_000)
        self.assertEqual(response.data["payment_url"], "")
        wallet = Wallet.objects.get(user=self.user)
        self.assertEqual(wallet.available_balance, 13_000_000)
        self.assertEqual(wallet.reserved_balance, 0)
        deposit = WalletDeposit.objects.get(wallet=wallet)
        self.assertEqual(deposit.provider, "VAKA_SIMULATED")
        self.assertIsNotNone(deposit.confirmed_at)
        entry = WalletTransaction.objects.get(wallet=wallet)
        self.assertEqual(deposit.ledger_transaction_id, entry.pk)
        self.assertEqual(entry.transaction_type, WalletTransactionType.DEPOSIT)
        self.assertEqual(entry.direction, WalletTransactionDirection.CREDIT)
        self.assertEqual(entry.available_balance_delta, 13_000_000)
        self.assertEqual(entry.reserved_balance_delta, 0)
        self.assertIn("SIMULATED", entry.description)

    def test_retry_same_key_does_not_double_credit(self):
        first = self.deposit()
        second = self.deposit()
        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 200, second.data)
        self.assertEqual(first.data["deposit_id"], second.data["deposit_id"])
        self.assertEqual(Wallet.objects.get(user=self.user).available_balance, 13_000_000)
        self.assertEqual(WalletTransaction.objects.count(), 1)
        self.assertEqual(WalletDeposit.objects.count(), 1)

    def test_new_key_creates_new_credit(self):
        self.assertEqual(self.deposit(1000, "new-key-1").status_code, 201)
        self.assertEqual(self.deposit(2000, "new-key-2").status_code, 201)
        self.assertEqual(Wallet.objects.get(user=self.user).available_balance, 3000)
        self.assertEqual(WalletTransaction.objects.count(), 2)

    def test_same_key_different_amount_is_conflict(self):
        self.deposit(1000, "reused-key")
        response = self.deposit(2000, "reused-key")
        self.assertEqual(response.status_code, 409)
        self.assertEqual(Wallet.objects.get(user=self.user).available_balance, 1000)
        self.assertEqual(WalletTransaction.objects.count(), 1)

    def test_other_mode_key_cannot_be_replayed_as_simulated(self):
        wallet = Wallet.objects.create(user=self.user)
        WalletDeposit.objects.create(
            wallet=wallet, amount=1000, currency_code="IRR",
            status=WalletDepositStatus.PENDING, provider="some-provider",
            idempotency_key="existing-real-key",
            request_hash="irrelevant",
        )
        response = self.deposit(1000, "existing-real-key")
        self.assertEqual(response.status_code, 409)
        self.assertEqual(wallet.transactions.count(), 0)

    def test_missing_idempotency_key_is_rejected(self):
        response = self.client.post(self.url, {"amount": 1000}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertFalse(Wallet.objects.filter(user=self.user).exists())

    def test_bad_amount_and_over_cap_rejected(self):
        for i, amount in enumerate((0, -1, 100_000_001, "invalid")):
            with self.subTest(amount=amount):
                response = self.deposit(amount, f"bad-{i}")
                self.assertEqual(response.status_code, 400, response.data)
        self.assertFalse(WalletDeposit.objects.exists())
        self.assertFalse(WalletTransaction.objects.exists())

    def test_anonymous_user_cannot_credit_wallet(self):
        self.client.force_authenticate(user=None)
        response = self.deposit()
        self.assertEqual(response.status_code, 401)
        self.assertFalse(WalletDeposit.objects.exists())

    def test_debug_false_disables_simulated_credits(self):
        with override_settings(DEBUG=False):
            response = self.deposit()
        self.assertEqual(response.status_code, 503)
        self.assertFalse(WalletDeposit.objects.exists())
        self.assertFalse(WalletTransaction.objects.exists())

    def test_gateway_mode_still_needs_real_provider(self):
        with override_settings(VAKA_WALLET_DEPOSIT_MODE="GATEWAY"):
            with patch("payments.services.get_payment_gateway") as gateway:
                from payments.services import PaymentGatewayUnavailable
                gateway.side_effect = PaymentGatewayUnavailable()
                response = self.deposit()
                gateway.assert_called_once()
        self.assertEqual(response.status_code, 503)
        self.assertFalse(WalletTransaction.objects.exists())

    def test_only_authenticated_users_wallet_is_credited(self):
        other_user = User.objects.create_user(
            phone="09122009902", full_name="Other Wallet User",
            phone_verified_at=timezone.now(),
        )
        other_wallet = Wallet.objects.create(user=other_user, available_balance=1234)
        self.assertEqual(self.deposit(2000).status_code, 201)
        other_wallet.refresh_from_db()
        self.assertEqual(other_wallet.available_balance, 1234)
        self.assertFalse(WalletTransaction.objects.filter(wallet=other_wallet).exists())

    def test_ledger_failure_rolls_back_deposit_and_balance(self):
        with patch("payments.services.WalletTransaction.save", side_effect=IntegrityError("simulated failure")):
            with self.assertRaises(IntegrityError):
                self.deposit(1000)
        self.assertFalse(WalletDeposit.objects.exists())
        self.assertFalse(WalletTransaction.objects.exists())
        self.assertFalse(Wallet.objects.filter(user=self.user).exists())
