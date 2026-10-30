"""Integration tests for VAKA registration, login, OTP, and JWT APIs."""

from datetime import timedelta
import json
from unittest.mock import patch

from django.core.cache import cache
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework.throttling import ScopedRateThrottle
from rest_framework_simplejwt.tokens import AccessToken, RefreshToken

from accounts.models import OTPChallenge, Role, User, UserRole
from accounts.otp import OTPDeliveryError, hash_otp


PASSWORD = "Strong-test-password-123!"

TEST_THROTTLE_RATES = {
    "register": "1000/hour",
    "otp_send": "1000/hour",
    "otp_verify": "1000/hour",
}


@patch.object(ScopedRateThrottle, "THROTTLE_RATES", TEST_THROTTLE_RATES)
class AuthenticationAPITests(APITestCase):
    """End-to-end tests for the public authentication endpoints."""

    @classmethod
    def setUpTestData(cls):
        cls.employer_role = Role.objects.create(
            code="EMPLOYER",
            name="Employer",
        )

    def setUp(self):
        cache.clear()
        self.sent_sms = []
        self.sms_patcher = patch(
            "accounts.otp.send_sms",
            side_effect=self.capture_sms,
        )
        self.mock_send_sms = self.sms_patcher.start()
        self.addCleanup(self.sms_patcher.stop)

        self.register_url = "/api/auth/register/"
        self.register_verify_url = "/api/auth/register/verify-otp/"
        self.password_login_url = "/api/auth/login/password/"
        self.otp_login_send_url = "/api/auth/login/otp/send/"
        self.otp_login_verify_url = "/api/auth/login/otp/verify/"
        self.otp_resend_url = "/api/auth/otp/resend/"
        self.refresh_url = "/api/auth/token/refresh/"
        self.verify_token_url = "/api/auth/token/verify/"
        self.tasks_url = "/api/tasks/"

    def capture_sms(self, phone, code):
        """Capture outgoing OTP messages without calling the real SMS provider."""
        self.sent_sms.append((phone, code))

    def registration_payload(self, phone="09120000001"):
        return {
            "phone": phone,
            "password": PASSWORD,
            "password_confirm": PASSWORD,
        }

    def make_user(
        self,
        phone="09120000010",
        *,
        password=PASSWORD,
        verified=True,
        account_status=User.AccountStatus.ACTIVE,
        employer=False,
    ):
        user = User.objects.create_user(
            phone=phone,
            full_name=f"Test user {phone}",
            password=password,
            account_status=account_status,
        )

        if verified:
            User.objects.filter(pk=user.pk).update(
                phone_verified_at=timezone.now()
            )
            user.refresh_from_db()

        if employer:
            UserRole.objects.create(
                user=user,
                role=self.employer_role,
            )

        return user

    def make_challenge(
        self,
        user,
        purpose,
        code="12345",
        *,
        expires_at=None,
        last_sent_at=None,
        attempts=0,
    ):
        now = timezone.now()
        return OTPChallenge.objects.create(
            user=user,
            purpose=purpose,
            code_hash=hash_otp(user, purpose, code),
            expires_at=expires_at or now + timedelta(minutes=3),
            last_sent_at=last_sent_at or now,
            attempts=attempts,
        )

    def assert_auth_response(self, response, user):
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)
        self.assertIn("user", response.data)
        self.assertEqual(response.data["user"]["phone"], user.phone)
        self.assertEqual(str(response.data["user"]["user_id"]), str(user.pk))
        self.assertNotIn("password", response.data["user"])
        self.assertNotIn("code", response.data)

        access = AccessToken(response.data["access"])
        self.assertEqual(str(access["user_id"]), str(user.pk))

    # ------------------------------------------------------------------
    # Registration
    # ------------------------------------------------------------------

    def test_register_creates_unverified_user_and_sends_registration_otp(self):
        response = self.client.post(
            self.register_url,
            self.registration_payload(),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertTrue(response.data["requires_verification"])

        user = User.objects.get(phone="09120000001")
        self.assertIsNone(user.phone_verified_at)
        self.assertFalse(user.is_active)

        self.assertTrue(
            UserRole.objects.filter(
                user=user,
                role__code="EMPLOYER",
            ).exists()
        )

        challenge = OTPChallenge.objects.get(
            user=user,
            purpose=OTPChallenge.Purpose.REGISTER,
        )
        self.assertEqual(len(challenge.code_hash), 64)
        self.assertEqual(len(self.sent_sms), 1)
        self.assertEqual(self.sent_sms[0][0], user.phone)
        self.assertEqual(len(self.sent_sms[0][1]), 5)

    def test_register_normalizes_international_phone_number(self):
        payload = self.registration_payload("+98 912 000 0002")

        response = self.client.post(
            self.register_url,
            payload,
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertTrue(User.objects.filter(phone="09120000002").exists())
        self.assertEqual(self.sent_sms[0][0], "09120000002")

    def test_register_rejects_duplicate_phone_number(self):
        self.make_user(phone="09120000003")

        response = self.client.post(
            self.register_url,
            self.registration_payload("09120000003"),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("phone", response.data)

    def test_register_rejects_invalid_phone_number(self):
        response = self.client.post(
            self.register_url,
            self.registration_payload("08123456789"),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("phone", response.data)

    def test_register_rejects_mismatched_passwords(self):
        payload = self.registration_payload()
        payload["password_confirm"] = "Different-password-123!"

        response = self.client.post(self.register_url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("password_confirm", response.data)

    def test_register_rejects_numeric_only_password(self):
        payload = self.registration_payload()
        payload["password"] = "12345678"
        payload["password_confirm"] = "12345678"

        response = self.client.post(self.register_url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("password", response.data)

    def test_register_rejects_too_short_password(self):
        payload = self.registration_payload()
        payload["password"] = "Ab1!"
        payload["password_confirm"] = "Ab1!"

        response = self.client.post(self.register_url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("password", response.data)

    def test_register_rejects_missing_required_fields(self):
        response = self.client.post(
            self.register_url,
            {},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(response.data)
        self.assertEqual(User.objects.count(), 0)

    def test_register_rejects_unsupported_fields(self):
        payload = self.registration_payload()
        payload["is_superuser"] = True

        response = self.client.post(self.register_url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("is_superuser", response.data)
        self.assertEqual(User.objects.count(), 0)

    def test_register_returns_503_when_sms_provider_fails(self):
        self.mock_send_sms.side_effect = OTPDeliveryError("Provider unavailable.")

        response = self.client.post(
            self.register_url,
            self.registration_payload("09120000004"),
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_503_SERVICE_UNAVAILABLE,
            response.data,
        )
        self.assertTrue(User.objects.filter(phone="09120000004").exists())

        user = User.objects.get(phone="09120000004")
        challenge = OTPChallenge.objects.get(
            user=user,
            purpose=OTPChallenge.Purpose.REGISTER,
        )
        self.assertLessEqual(challenge.expires_at, timezone.now())

    # ------------------------------------------------------------------
    # Registration OTP verification
    # ------------------------------------------------------------------

    def test_register_otp_verification_activates_user_and_returns_jwt(self):
        register_response = self.client.post(
            self.register_url,
            self.registration_payload("09120000005"),
            format="json",
        )
        self.assertEqual(register_response.status_code, status.HTTP_201_CREATED)

        user = User.objects.get(phone="09120000005")
        code = self.sent_sms[-1][1]

        response = self.client.post(
            self.register_verify_url,
            {"phone": user.phone, "code": code},
            format="json",
        )

        self.assert_auth_response(response, user)

        user.refresh_from_db()
        self.assertIsNotNone(user.phone_verified_at)
        self.assertTrue(user.is_active)
        self.assertIsNotNone(user.last_login)
        self.assertFalse(
            OTPChallenge.objects.filter(
                user=user,
                purpose=OTPChallenge.Purpose.REGISTER,
            ).exists()
        )

    def test_register_otp_rejects_wrong_code_and_increments_attempts(self):
        self.client.post(
            self.register_url,
            self.registration_payload("09120000006"),
            format="json",
        )
        user = User.objects.get(phone="09120000006")
        real_code = self.sent_sms[-1][1]
        wrong_code = "00000" if real_code != "00000" else "00001"

        response = self.client.post(
            self.register_verify_url,
            {"phone": user.phone, "code": wrong_code},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        challenge = OTPChallenge.objects.get(
            user=user,
            purpose=OTPChallenge.Purpose.REGISTER,
        )
        self.assertEqual(challenge.attempts, 1)

    def test_register_otp_rejects_expired_code(self):
        user = self.make_user(
            phone="09120000007",
            verified=False,
        )
        self.make_challenge(
            user,
            OTPChallenge.Purpose.REGISTER,
            expires_at=timezone.now() - timedelta(seconds=1),
        )

        response = self.client.post(
            self.register_verify_url,
            {"phone": user.phone, "code": "12345"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_register_otp_rejects_unknown_phone(self):
        response = self.client.post(
            self.register_verify_url,
            {"phone": "09120000008", "code": "12345"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_register_otp_rejects_already_verified_user(self):
        user = self.make_user(phone="09120000009", verified=True)

        response = self.client.post(
            self.register_verify_url,
            {"phone": user.phone, "code": "12345"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_register_otp_rejects_invalid_code_format(self):
        for code in ("1234", "123456", "12a45"):
            with self.subTest(code=code):
                response = self.client.post(
                    self.register_verify_url,
                    {"phone": "09120000011", "code": code},
                    format="json",
                )
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_registration_otp_cannot_be_used_twice(self):
        self.client.post(
            self.register_url,
            self.registration_payload("09120000012"),
            format="json",
        )
        user = User.objects.get(phone="09120000012")
        code = self.sent_sms[-1][1]

        first_response = self.client.post(
            self.register_verify_url,
            {"phone": user.phone, "code": code},
            format="json",
        )
        second_response = self.client.post(
            self.register_verify_url,
            {"phone": user.phone, "code": code},
            format="json",
        )

        self.assertEqual(first_response.status_code, status.HTTP_200_OK)
        self.assertEqual(second_response.status_code, status.HTTP_403_FORBIDDEN)

    # ------------------------------------------------------------------
    # Password login
    # ------------------------------------------------------------------

    def test_password_login_success_returns_access_and_refresh_tokens(self):
        user = self.make_user(phone="09120000013")

        response = self.client.post(
            self.password_login_url,
            {"phone": user.phone, "password": PASSWORD},
            format="json",
        )

        self.assert_auth_response(response, user)
        user.refresh_from_db()
        self.assertIsNotNone(user.last_login)

    def test_password_login_rejects_wrong_password_and_unknown_phone(self):
        user = self.make_user(phone="09120000014")

        wrong_password_response = self.client.post(
            self.password_login_url,
            {"phone": user.phone, "password": "Wrong-password-123!"},
            format="json",
        )
        unknown_phone_response = self.client.post(
            self.password_login_url,
            {"phone": "09120000015", "password": PASSWORD},
            format="json",
        )

        self.assertEqual(
            wrong_password_response.status_code,
            status.HTTP_403_FORBIDDEN,
        )
        self.assertEqual(
            unknown_phone_response.status_code,
            status.HTTP_403_FORBIDDEN,
        )
        self.assertEqual(
            wrong_password_response.data,
            unknown_phone_response.data,
        )

    def test_password_login_rejects_unverified_account(self):
        user = self.make_user(
            phone="09120000016",
            verified=False,
        )

        response = self.client.post(
            self.password_login_url,
            {"phone": user.phone, "password": PASSWORD},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_password_login_rejects_suspended_and_deleted_accounts(self):
        for index, account_status in enumerate(
            (User.AccountStatus.SUSPENDED, User.AccountStatus.DELETED),
            start=17,
        ):
            with self.subTest(account_status=account_status):
                user = self.make_user(
                    phone=f"091200000{index}",
                    account_status=account_status,
                )
                response = self.client.post(
                    self.password_login_url,
                    {"phone": user.phone, "password": PASSWORD},
                    format="json",
                )
                self.assertEqual(
                    response.status_code,
                    status.HTTP_403_FORBIDDEN,
                )

    def test_password_login_rejects_invalid_phone(self):
        response = self.client.post(
            self.password_login_url,
            {"phone": "12345", "password": PASSWORD},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("phone", response.data)

    def test_password_login_requires_phone_and_password(self):
        response = self.client.post(
            self.password_login_url,
            {"phone": "09120000018"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("password", response.data)

    # ------------------------------------------------------------------
    # OTP login: request and verify
    # ------------------------------------------------------------------

    def test_otp_login_send_creates_login_challenge_for_active_user(self):
        user = self.make_user(phone="09120000019")

        response = self.client.post(
            self.otp_login_send_url,
            {"phone": user.phone},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        self.assertEqual(len(self.sent_sms), 1)
        self.assertEqual(self.sent_sms[0][0], user.phone)
        self.assertTrue(
            OTPChallenge.objects.filter(
                user=user,
                purpose=OTPChallenge.Purpose.LOGIN,
            ).exists()
        )

    def test_otp_login_send_rejects_invalid_phone(self):
        response = self.client.post(
            self.otp_login_send_url,
            {"phone": "12345"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(self.sent_sms, [])

    def test_otp_login_send_does_not_reveal_unknown_or_unverified_accounts(self):
        unknown_response = self.client.post(
            self.otp_login_send_url,
            {"phone": "09120000020"},
            format="json",
        )

        unverified_user = self.make_user(
            phone="09120000021",
            verified=False,
        )
        unverified_response = self.client.post(
            self.otp_login_send_url,
            {"phone": unverified_user.phone},
            format="json",
        )

        self.assertEqual(unknown_response.status_code, status.HTTP_202_ACCEPTED)
        self.assertEqual(unverified_response.status_code, status.HTTP_202_ACCEPTED)
        self.assertEqual(unknown_response.data, unverified_response.data)
        self.assertEqual(self.sent_sms, [])
        self.assertFalse(
            OTPChallenge.objects.filter(user=unverified_user).exists()
        )

    def test_otp_login_send_respects_resend_cooldown(self):
        user = self.make_user(phone="09120000022")
        self.make_challenge(
            user,
            OTPChallenge.Purpose.LOGIN,
            last_sent_at=timezone.now(),
        )

        response = self.client.post(
            self.otp_login_send_url,
            {"phone": user.phone},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        self.assertEqual(self.sent_sms, [])

    def test_otp_login_send_handles_sms_provider_failure_without_account_disclosure(self):
        user = self.make_user(phone="09120000023")
        self.mock_send_sms.side_effect = OTPDeliveryError("Provider unavailable.")

        response = self.client.post(
            self.otp_login_send_url,
            {"phone": user.phone},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        challenge = OTPChallenge.objects.get(
            user=user,
            purpose=OTPChallenge.Purpose.LOGIN,
        )
        self.assertLessEqual(challenge.expires_at, timezone.now())

    def test_otp_login_verify_success_returns_jwt_and_consumes_challenge(self):
        user = self.make_user(phone="09120000024")
        self.make_challenge(
            user,
            OTPChallenge.Purpose.LOGIN,
            code="54321",
        )

        response = self.client.post(
            self.otp_login_verify_url,
            {"phone": user.phone, "code": "54321"},
            format="json",
        )

        self.assert_auth_response(response, user)
        self.assertFalse(
            OTPChallenge.objects.filter(
                user=user,
                purpose=OTPChallenge.Purpose.LOGIN,
            ).exists()
        )

    def test_otp_login_verify_rejects_wrong_code_and_increments_attempts(self):
        user = self.make_user(phone="09120000025")
        self.make_challenge(
            user,
            OTPChallenge.Purpose.LOGIN,
            code="54321",
        )

        response = self.client.post(
            self.otp_login_verify_url,
            {"phone": user.phone, "code": "12345"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        challenge = OTPChallenge.objects.get(
            user=user,
            purpose=OTPChallenge.Purpose.LOGIN,
        )
        self.assertEqual(challenge.attempts, 1)

    def test_otp_login_verify_rejects_expired_code(self):
        user = self.make_user(phone="09120000026")
        self.make_challenge(
            user,
            OTPChallenge.Purpose.LOGIN,
            code="54321",
            expires_at=timezone.now() - timedelta(seconds=1),
        )

        response = self.client.post(
            self.otp_login_verify_url,
            {"phone": user.phone, "code": "54321"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_otp_login_verify_rejects_unknown_and_unverified_users(self):
        unknown_response = self.client.post(
            self.otp_login_verify_url,
            {"phone": "09120000027", "code": "12345"},
            format="json",
        )

        unverified_user = self.make_user(
            phone="09120000028",
            verified=False,
        )
        unverified_response = self.client.post(
            self.otp_login_verify_url,
            {"phone": unverified_user.phone, "code": "12345"},
            format="json",
        )

        self.assertEqual(unknown_response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(unverified_response.status_code, status.HTTP_403_FORBIDDEN)

    def test_otp_login_verify_rejects_invalid_code_format(self):
        response = self.client.post(
            self.otp_login_verify_url,
            {"phone": "09120000029", "code": "abcde"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # ------------------------------------------------------------------
    # OTP resend
    # ------------------------------------------------------------------

    def test_registration_otp_resend_works_after_cooldown(self):
        user = self.make_user(
            phone="09120000030",
            verified=False,
        )
        old_challenge = self.make_challenge(
            user,
            OTPChallenge.Purpose.REGISTER,
            code="11111",
            last_sent_at=timezone.now() - timedelta(seconds=61),
            attempts=2,
        )

        response = self.client.post(
            self.otp_resend_url,
            {"phone": user.phone, "purpose": OTPChallenge.Purpose.REGISTER},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        self.assertEqual(len(self.sent_sms), 1)

        old_challenge.refresh_from_db()
        new_code = self.sent_sms[0][1]
        self.assertEqual(old_challenge.attempts, 0)
        self.assertEqual(
            old_challenge.code_hash,
            hash_otp(user, OTPChallenge.Purpose.REGISTER, new_code),
        )
        self.assertGreater(old_challenge.expires_at, timezone.now())

    def test_login_otp_resend_works_after_cooldown(self):
        user = self.make_user(phone="09120000037")
        challenge = self.make_challenge(
            user,
            OTPChallenge.Purpose.LOGIN,
            code="11111",
            last_sent_at=timezone.now() - timedelta(seconds=61),
            attempts=2,
        )

        response = self.client.post(
            self.otp_resend_url,
            {"phone": user.phone, "purpose": OTPChallenge.Purpose.LOGIN},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        self.assertEqual(len(self.sent_sms), 1)
        challenge.refresh_from_db()
        self.assertEqual(challenge.attempts, 0)
        self.assertEqual(
            challenge.code_hash,
            hash_otp(user, OTPChallenge.Purpose.LOGIN, self.sent_sms[0][1]),
        )

    def test_otp_resend_for_unknown_phone_does_not_disclose_account_existence(self):
        response = self.client.post(
            self.otp_resend_url,
            {"phone": "09120000031", "purpose": OTPChallenge.Purpose.LOGIN},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        self.assertEqual(self.sent_sms, [])

    def test_otp_resend_rejects_invalid_purpose(self):
        response = self.client.post(
            self.otp_resend_url,
            {"phone": "09120000032", "purpose": "PASSWORD_RESET"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # ------------------------------------------------------------------
    # JWT token management and protected endpoints
    # ------------------------------------------------------------------

    def test_refresh_and_verify_jwt_tokens(self):
        user = self.make_user(phone="09120000033")
        login_response = self.client.post(
            self.password_login_url,
            {"phone": user.phone, "password": PASSWORD},
            format="json",
        )
        self.assertEqual(login_response.status_code, status.HTTP_200_OK)

        refresh_response = self.client.post(
            self.refresh_url,
            {"refresh": login_response.data["refresh"]},
            format="json",
        )

        self.assertEqual(refresh_response.status_code, status.HTTP_200_OK)
        self.assertIn("access", refresh_response.data)

        verify_response = self.client.post(
            self.verify_token_url,
            {"token": refresh_response.data["access"]},
            format="json",
        )
        self.assertEqual(verify_response.status_code, status.HTTP_200_OK)

    def test_refresh_endpoint_rejects_invalid_refresh_token(self):
        response = self.client.post(
            self.refresh_url,
            {"refresh": "not-a-valid-refresh-token"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_token_verify_rejects_invalid_token(self):
        response = self.client.post(
            self.verify_token_url,
            {"token": "not-a-valid-token"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_access_token_authenticates_user_on_protected_tasks_endpoint(self):
        user = self.make_user(
            phone="09120000034",
            employer=True,
        )
        login_response = self.client.post(
            self.password_login_url,
            {"phone": user.phone, "password": PASSWORD},
            format="json",
        )
        self.assertEqual(login_response.status_code, status.HTTP_200_OK)

        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {login_response.data['access']}"
        )
        response = self.client.get(self.tasks_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, [])

    def test_expired_access_token_is_rejected_by_protected_endpoint(self):
        user = self.make_user(
            phone="09120000038",
            employer=True,
        )
        token = AccessToken.for_user(user)
        token["exp"] = int(timezone.now().timestamp()) - 10

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {str(token)}")
        response = self.client.get(self.tasks_url)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_expired_refresh_token_is_rejected(self):
        user = self.make_user(phone="09120000039")
        refresh = RefreshToken.for_user(user)
        refresh["exp"] = int(timezone.now().timestamp()) - 10

        response = self.client.post(
            self.refresh_url,
            {"refresh": str(refresh)},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_suspending_user_invalidates_an_existing_access_token(self):
        user = self.make_user(
            phone="09120000040",
            employer=True,
        )
        login_response = self.client.post(
            self.password_login_url,
            {"phone": user.phone, "password": PASSWORD},
            format="json",
        )
        self.assertEqual(login_response.status_code, status.HTTP_200_OK)

        User.objects.filter(pk=user.pk).update(
            account_status=User.AccountStatus.SUSPENDED
        )
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {login_response.data['access']}"
        )

        response = self.client.get(self.tasks_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_protected_tasks_endpoint_rejects_missing_and_invalid_tokens(self):
        anonymous_response = self.client.get(self.tasks_url)
        self.assertEqual(
            anonymous_response.status_code,
            status.HTTP_401_UNAUTHORIZED,
        )

        self.client.credentials(HTTP_AUTHORIZATION="Bearer invalid-token")
        invalid_token_response = self.client.get(self.tasks_url)
        self.assertEqual(
            invalid_token_response.status_code,
            status.HTTP_401_UNAUTHORIZED,
        )

def test_openapi_schema_contains_authentication_endpoints(self):
    response = self.client.get(
        "/api/schema/",
        HTTP_ACCEPT="application/vnd.oai.openapi+json",
    )

    self.assertEqual(
        response.status_code,
        status.HTTP_200_OK,
        response.content[:500],
    )

    schema = response.data

    self.assertIsInstance(schema, dict)
    self.assertIn("paths", schema)

    schema_paths = schema["paths"]

    expected_paths = (
        "/api/auth/register/",
        "/api/auth/register/verify-otp/",
        "/api/auth/login/password/",
        "/api/auth/login/otp/send/",
        "/api/auth/login/otp/verify/",
        "/api/auth/otp/resend/",
        "/api/auth/token/refresh/",
        "/api/auth/token/verify/",
    )

    for path in expected_paths:
        with self.subTest(path=path):
            self.assertIn(path, schema_paths)


THROTTLED_RATES = {
    "register": "1/hour",
    "otp_send": "1/hour",
    "otp_verify": "1/hour",
}


@patch.object(ScopedRateThrottle, "THROTTLE_RATES", THROTTLED_RATES)
class AuthenticationThrottleTests(APITestCase):
    """Verify configured rate limits for registration and OTP scopes."""

    @classmethod
    def setUpTestData(cls):
        Role.objects.create(code="EMPLOYER", name="Employer")

    def setUp(self):
        cache.clear()
        self.sms_patcher = patch("accounts.otp.send_sms")
        self.sms_patcher.start()
        self.addCleanup(self.sms_patcher.stop)

    def make_verified_user(self, phone):
        user = User.objects.create_user(
            phone=phone,
            full_name="Throttle test user",
            password=PASSWORD,
        )
        User.objects.filter(pk=user.pk).update(
            phone_verified_at=timezone.now()
        )
        user.refresh_from_db()
        return user

    def test_register_throttle_returns_429_after_configured_limit(self):
        payload_1 = {
            "phone": "09120000035",
            "password": PASSWORD,
            "password_confirm": PASSWORD,
        }
        payload_2 = {
            "phone": "09120000036",
            "password": PASSWORD,
            "password_confirm": PASSWORD,
        }

        first_response = self.client.post(
            "/api/auth/register/",
            payload_1,
            format="json",
        )
        second_response = self.client.post(
            "/api/auth/register/",
            payload_2,
            format="json",
        )

        self.assertEqual(first_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second_response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

    def test_otp_send_throttle_returns_429_after_configured_limit(self):
        user = self.make_verified_user("09120000041")

        first_response = self.client.post(
            "/api/auth/login/otp/send/",
            {"phone": user.phone},
            format="json",
        )
        second_response = self.client.post(
            "/api/auth/login/otp/send/",
            {"phone": user.phone},
            format="json",
        )

        self.assertEqual(first_response.status_code, status.HTTP_202_ACCEPTED)
        self.assertEqual(second_response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

    def test_otp_verify_throttle_returns_429_after_configured_limit(self):
        user = self.make_verified_user("09120000042")
        OTPChallenge.objects.create(
            user=user,
            purpose=OTPChallenge.Purpose.LOGIN,
            code_hash=hash_otp(user, OTPChallenge.Purpose.LOGIN, "12345"),
            expires_at=timezone.now() + timedelta(minutes=3),
            last_sent_at=timezone.now(),
            attempts=0,
        )

        first_response = self.client.post(
            "/api/auth/login/otp/verify/",
            {"phone": user.phone, "code": "54321"},
            format="json",
        )
        second_response = self.client.post(
            "/api/auth/login/otp/verify/",
            {"phone": user.phone, "code": "54321"},
            format="json",
        )

        self.assertEqual(first_response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(second_response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
