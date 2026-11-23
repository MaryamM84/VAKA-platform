from unittest.mock import Mock, patch

from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import User
from payments.models import (
    Wallet,
    WalletDeposit,
    WalletDepositStatus,
    WalletTransaction,
    WalletTransactionDirection,
    WalletTransactionType,
)
from payments.services import PaymentGatewayUnavailable


class WalletAPITests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            phone="09122001001",
            full_name="Wallet API User",
            phone_verified_at=timezone.now(),
        )
        self.other_user = User.objects.create_user(
            phone="09122001002",
            full_name="Another Wallet User",
            phone_verified_at=timezone.now(),
        )
        self.wallet = Wallet.objects.create(
            user=self.user,
            currency_code="IRR",
            available_balance=87500,
            reserved_balance=12000,
        )
        self.other_wallet = Wallet.objects.create(
            user=self.other_user,
            currency_code="IRR",
            available_balance=100000,
        )
        self.client.force_authenticate(user=self.user)

    def create_deposit_ledger_entry(self, *, wallet, key, amount=1000):
        return WalletTransaction.objects.create(
            wallet=wallet,
            transaction_type=WalletTransactionType.DEPOSIT,
            direction=WalletTransactionDirection.CREDIT,
            amount=amount,
            available_balance_delta=amount,
            reserved_balance_delta=0,
            currency_code=wallet.currency_code,
            idempotency_key=key,
            description="Test deposit",
        )

    def test_wallet_summary_returns_total_available_and_reserved_balances(self):
        response = self.client.get("/api/wallet/summary/")

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data["total_balance"], 99500)
        self.assertEqual(response.data["available_balance"], 87500)
        self.assertEqual(response.data["reserved_balance"], 12000)
        self.assertEqual(response.data["currency_code"], "IRR")

    def test_wallet_summary_creates_an_empty_wallet_for_a_new_user(self):
        new_user = User.objects.create_user(
            phone="09122001003",
            full_name="New Wallet User",
            phone_verified_at=timezone.now(),
        )
        self.client.force_authenticate(user=new_user)

        response = self.client.get("/api/wallet/summary/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["total_balance"], 0)
        self.assertEqual(response.data["available_balance"], 0)
        self.assertEqual(response.data["reserved_balance"], 0)
        self.assertTrue(Wallet.objects.filter(user=new_user).exists())

    def test_transactions_are_paginated_and_scoped_to_current_wallet(self):
        for index in range(12):
            self.create_deposit_ledger_entry(
                wallet=self.wallet,
                key=f"wallet-tx-{index}",
                amount=1000 + index,
            )
        self.create_deposit_ledger_entry(
            wallet=self.other_wallet,
            key="other-user-tx",
        )

        response = self.client.get("/api/wallet/transactions/?page=1&page_size=5")

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data["count"], 12)
        self.assertEqual(len(response.data["results"]), 5)
        self.assertIsNotNone(response.data["next"])
        self.assertIsNone(response.data["previous"])

    def test_transactions_can_be_filtered_by_type(self):
        self.create_deposit_ledger_entry(wallet=self.wallet, key="filter-deposit")
        response = self.client.get("/api/wallet/transactions/?type=DEPOSIT")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["type"], "DEPOSIT")

    def test_invalid_transaction_type_filter_is_rejected(self):
        response = self.client.get("/api/wallet/transactions/?type=NOT_A_TYPE")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_transaction_detail_is_scoped_to_current_user(self):
        own = self.create_deposit_ledger_entry(wallet=self.wallet, key="own-detail")
        other = self.create_deposit_ledger_entry(wallet=self.other_wallet, key="other-detail")

        own_response = self.client.get(f"/api/wallet/transactions/{own.pk}/")
        other_response = self.client.get(f"/api/wallet/transactions/{other.pk}/")

        self.assertEqual(own_response.status_code, status.HTTP_200_OK)
        self.assertEqual(other_response.status_code, status.HTTP_404_NOT_FOUND)

    def test_deposit_requires_idempotency_key(self):
        response = self.client.post(
            "/api/wallet/deposit/",
            {"amount": 500000},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_deposit_fails_closed_without_a_configured_gateway(self):
        with patch(
            "payments.services.get_payment_gateway",
            side_effect=PaymentGatewayUnavailable(),
        ):
            response = self.client.post(
                "/api/wallet/deposit/",
                {"amount": 500000},
                format="json",
                HTTP_IDEMPOTENCY_KEY="deposit-no-provider",
            )

        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertFalse(WalletDeposit.objects.filter(idempotency_key="deposit-no-provider").exists())

    def test_deposit_returns_provider_link_without_crediting_wallet(self):
        gateway = Mock()
        gateway.create_payment_link.return_value = {
            "provider": "test-provider",
            "provider_reference": "provider-ref-001",
            "payment_url": "https://payments.example.test/pay/001",
            "expires_at": None,
        }
        with patch("payments.services.get_payment_gateway", return_value=gateway):
            response = self.client.post(
                "/api/wallet/deposit/",
                {"amount": 500000},
                format="json",
                HTTP_IDEMPOTENCY_KEY="deposit-valid-001",
            )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data["status"], WalletDepositStatus.PENDING)
        self.assertEqual(response.data["amount"], 500000)
        self.assertTrue(response.data["payment_url"].startswith("https://"))
        self.wallet.refresh_from_db()
        self.assertEqual(self.wallet.available_balance, 87500)
        self.assertEqual(self.wallet.reserved_balance, 12000)
        self.assertEqual(WalletDeposit.objects.count(), 1)
        gateway.create_payment_link.assert_called_once()

    def test_deposit_idempotency_replays_existing_payment_link(self):
        gateway = Mock()
        gateway.create_payment_link.return_value = {
            "provider": "test-provider",
            "provider_reference": "provider-ref-002",
            "payment_url": "https://payments.example.test/pay/002",
            "expires_at": None,
        }
        with patch("payments.services.get_payment_gateway", return_value=gateway):
            first = self.client.post(
                "/api/wallet/deposit/",
                {"amount": 250000},
                format="json",
                HTTP_IDEMPOTENCY_KEY="deposit-replay-001",
            )
            second = self.client.post(
                "/api/wallet/deposit/",
                {"amount": 250000},
                format="json",
                HTTP_IDEMPOTENCY_KEY="deposit-replay-001",
            )

        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        self.assertEqual(first.data["deposit_id"], second.data["deposit_id"])
        gateway.create_payment_link.assert_called_once()
        self.assertEqual(WalletDeposit.objects.count(), 1)

    def test_deposit_key_cannot_be_reused_with_a_different_amount(self):
        gateway = Mock()
        gateway.create_payment_link.return_value = {
            "provider": "test-provider",
            "provider_reference": "provider-ref-003",
            "payment_url": "https://payments.example.test/pay/003",
            "expires_at": None,
        }
        with patch("payments.services.get_payment_gateway", return_value=gateway):
            self.client.post(
                "/api/wallet/deposit/",
                {"amount": 250000},
                format="json",
                HTTP_IDEMPOTENCY_KEY="deposit-key-mismatch",
            )
            response = self.client.post(
                "/api/wallet/deposit/",
                {"amount": 300000},
                format="json",
                HTTP_IDEMPOTENCY_KEY="deposit-key-mismatch",
            )

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(WalletDeposit.objects.count(), 1)
