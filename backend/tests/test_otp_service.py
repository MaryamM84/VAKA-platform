"""Unit tests for OTP generation, storage, verification, and SMS delivery."""

from datetime import timedelta
from unittest.mock import Mock, patch

import requests
from django.test import TestCase, override_settings
from django.utils import timezone

from accounts.models import OTPChallenge, User
from accounts.otp import (
    OTPCooldown,
    OTPDeliveryError,
    hash_otp,
    normalize_phone,
    send_otp,
    send_sms,
    verify_otp,
)


PASSWORD = "Strong-test-password-123!"


class OTPPhoneNormalizationTests(TestCase):
    def test_supported_iranian_phone_formats_are_normalized(self):
        values = (
            "09123456789",
            "+989123456789",
            "00989123456789",
            "989123456789",
            "+98 912 345 6789",
            "0912-345-6789",
        )

        for value in values:
            with self.subTest(value=value):
                self.assertEqual(normalize_phone(value), "09123456789")

    def test_invalid_phone_formats_raise_value_error(self):
        values = (
            "08123456789",
            "0912345678",
            "091234567890",
            "+14155552671",
            "abcdefghijk",
        )

        for value in values:
            with self.subTest(value=value):
                with self.assertRaises(ValueError):
                    normalize_phone(value)


class OTPServiceTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            phone="09123456789",
            full_name="OTP Test User",
            password=PASSWORD,
        )

    def make_challenge(
        self,
        purpose=OTPChallenge.Purpose.REGISTER,
        code="12345",
        *,
        expires_at=None,
        last_sent_at=None,
        attempts=0,
    ):
        now = timezone.now()
        return OTPChallenge.objects.create(
            user=self.user,
            purpose=purpose,
            code_hash=hash_otp(self.user, purpose, code),
            expires_at=expires_at or now + timedelta(minutes=3),
            last_sent_at=last_sent_at or now,
            attempts=attempts,
        )

    def test_hash_otp_is_deterministic_and_does_not_store_plaintext(self):
        digest_1 = hash_otp(
            self.user,
            OTPChallenge.Purpose.REGISTER,
            "12345",
        )
        digest_2 = hash_otp(
            self.user,
            OTPChallenge.Purpose.REGISTER,
            "12345",
        )

        self.assertEqual(digest_1, digest_2)
        self.assertEqual(len(digest_1), 64)
        self.assertNotEqual(digest_1, "12345")

    @patch("accounts.otp.send_sms")
    def test_send_otp_creates_hashed_challenge_and_sends_code(self, mock_send_sms):
        send_otp(self.user, OTPChallenge.Purpose.REGISTER)

        challenge = OTPChallenge.objects.get(
            user=self.user,
            purpose=OTPChallenge.Purpose.REGISTER,
        )
        mock_send_sms.assert_called_once()

        sent_phone, sent_code = mock_send_sms.call_args.args
        self.assertEqual(sent_phone, self.user.phone)
        self.assertEqual(len(sent_code), 5)
        self.assertEqual(
            challenge.code_hash,
            hash_otp(self.user, OTPChallenge.Purpose.REGISTER, sent_code),
        )
        self.assertNotEqual(challenge.code_hash, sent_code)
        self.assertGreater(challenge.expires_at, timezone.now())
        self.assertEqual(challenge.attempts, 0)

    def test_send_otp_rejects_invalid_purpose(self):
        with self.assertRaises(ValueError):
            send_otp(self.user, "INVALID_PURPOSE")

    @patch("accounts.otp.send_sms")
    def test_send_otp_blocks_resend_during_cooldown(self, mock_send_sms):
        self.make_challenge(
            last_sent_at=timezone.now(),
        )

        with self.assertRaises(OTPCooldown):
            send_otp(self.user, OTPChallenge.Purpose.REGISTER)

        mock_send_sms.assert_not_called()

    @patch("accounts.otp.send_sms")
    def test_send_otp_resets_existing_challenge_after_cooldown(self, mock_send_sms):
        challenge = self.make_challenge(
            code="11111",
            last_sent_at=timezone.now() - timedelta(seconds=61),
            attempts=3,
        )

        send_otp(self.user, OTPChallenge.Purpose.REGISTER)

        challenge.refresh_from_db()
        mock_send_sms.assert_called_once()
        sent_code = mock_send_sms.call_args.args[1]

        self.assertEqual(challenge.attempts, 0)
        self.assertEqual(
            challenge.code_hash,
            hash_otp(self.user, OTPChallenge.Purpose.REGISTER, sent_code),
        )
        self.assertGreater(challenge.expires_at, timezone.now())

    @patch(
        "accounts.otp.send_sms",
        side_effect=OTPDeliveryError("SMS provider unavailable."),
    )
    def test_send_otp_invalidates_challenge_when_delivery_fails(self, mock_send_sms):
        with self.assertRaises(OTPDeliveryError):
            send_otp(self.user, OTPChallenge.Purpose.REGISTER)

        challenge = OTPChallenge.objects.get(
            user=self.user,
            purpose=OTPChallenge.Purpose.REGISTER,
        )
        self.assertLessEqual(challenge.expires_at, timezone.now())
        self.assertLess(
            challenge.last_sent_at,
            timezone.now() - timedelta(seconds=59),
        )

    def test_verify_otp_accepts_valid_registration_code_and_verifies_phone(self):
        self.make_challenge(
            purpose=OTPChallenge.Purpose.REGISTER,
            code="12345",
        )

        result = verify_otp(
            self.user,
            OTPChallenge.Purpose.REGISTER,
            "12345",
        )

        self.assertTrue(result)
        self.user.refresh_from_db()
        self.assertIsNotNone(self.user.phone_verified_at)
        self.assertFalse(
            OTPChallenge.objects.filter(
                user=self.user,
                purpose=OTPChallenge.Purpose.REGISTER,
            ).exists()
        )

    def test_verify_otp_accepts_valid_login_code_and_consumes_challenge(self):
        User.objects.filter(pk=self.user.pk).update(
            phone_verified_at=timezone.now()
        )
        self.user.refresh_from_db()
        original_verified_at = self.user.phone_verified_at

        self.make_challenge(
            purpose=OTPChallenge.Purpose.LOGIN,
            code="54321",
        )

        result = verify_otp(
            self.user,
            OTPChallenge.Purpose.LOGIN,
            "54321",
        )

        self.assertTrue(result)
        self.user.refresh_from_db()
        self.assertEqual(self.user.phone_verified_at, original_verified_at)
        self.assertFalse(
            OTPChallenge.objects.filter(
                user=self.user,
                purpose=OTPChallenge.Purpose.LOGIN,
            ).exists()
        )

    def test_verify_otp_rejects_wrong_code_and_increments_attempts(self):
        challenge = self.make_challenge(code="12345")

        result = verify_otp(
            self.user,
            OTPChallenge.Purpose.REGISTER,
            "54321",
        )

        self.assertFalse(result)
        challenge.refresh_from_db()
        self.assertEqual(challenge.attempts, 1)

    def test_verify_otp_rejects_expired_code_without_incrementing_attempts(self):
        challenge = self.make_challenge(
            code="12345",
            expires_at=timezone.now() - timedelta(seconds=1),
        )

        result = verify_otp(
            self.user,
            OTPChallenge.Purpose.REGISTER,
            "12345",
        )

        self.assertFalse(result)
        challenge.refresh_from_db()
        self.assertEqual(challenge.attempts, 0)

    @override_settings(OTP_MAX_ATTEMPTS=5)
    def test_verify_otp_blocks_correct_code_after_maximum_attempts(self):
        challenge = self.make_challenge(
            code="12345",
            attempts=5,
        )

        result = verify_otp(
            self.user,
            OTPChallenge.Purpose.REGISTER,
            "12345",
        )

        self.assertFalse(result)
        challenge.refresh_from_db()
        self.assertEqual(challenge.attempts, 5)

    def test_verify_otp_returns_false_when_challenge_does_not_exist(self):
        result = verify_otp(
            self.user,
            OTPChallenge.Purpose.REGISTER,
            "12345",
        )

        self.assertFalse(result)

    def test_registration_otp_cannot_be_used_for_login(self):
        self.make_challenge(
            purpose=OTPChallenge.Purpose.REGISTER,
            code="12345",
        )

        result = verify_otp(
            self.user,
            OTPChallenge.Purpose.LOGIN,
            "12345",
        )

        self.assertFalse(result)
        self.assertTrue(
            OTPChallenge.objects.filter(
                user=self.user,
                purpose=OTPChallenge.Purpose.REGISTER,
            ).exists()
        )


class SMSSenderTests(TestCase):
    @override_settings(
        FERZZ_API_TOKEN="test-ferzz-token",
        FERZZ_API_URL="https://sms-provider.example.test/send",
        FERZZ_SMS_CODE_FIELD="code",
    )
    @patch("accounts.otp.requests.post")
    def test_send_sms_sends_expected_payload(self, mock_post):
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"status": 200}
        mock_post.return_value = mock_response

        send_sms("09123456789", "12345")

        mock_post.assert_called_once()
        args, kwargs = mock_post.call_args
        self.assertEqual(args[0], "https://sms-provider.example.test/send")
        self.assertEqual(
            kwargs["json"],
            {
                "token": "test-ferzz-token",
                "destination": "989123456789",
                "action": "sms",
                "payload": {"code": "12345"},
            },
        )
        self.assertEqual(kwargs["timeout"], (3, 10))

    @override_settings(FERZZ_API_TOKEN="")
    def test_send_sms_rejects_missing_provider_token(self):
        with self.assertRaises(OTPDeliveryError):
            send_sms("09123456789", "12345")

    @override_settings(
        FERZZ_API_TOKEN="test-ferzz-token",
        FERZZ_API_URL="https://sms-provider.example.test/send",
    )
    @patch("accounts.otp.requests.post")
    def test_send_sms_rejects_provider_error_response(self, mock_post):
        mock_response = Mock()
        mock_response.status_code = 503
        mock_response.json.return_value = {"status": 503}
        mock_post.return_value = mock_response

        with self.assertRaises(OTPDeliveryError):
            send_sms("09123456789", "12345")

    @override_settings(
        FERZZ_API_TOKEN="test-ferzz-token",
        FERZZ_API_URL="https://sms-provider.example.test/send",
    )
    @patch("accounts.otp.requests.post", side_effect=requests.Timeout)
    def test_send_sms_translates_network_errors(self, mock_post):
        with self.assertRaises(OTPDeliveryError):
            send_sms("09123456789", "12345")

        mock_post.assert_called_once()
