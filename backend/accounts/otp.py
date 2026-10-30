import hmac
import re
import secrets
from datetime import timedelta

import requests

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from django.utils.crypto import salted_hmac

from accounts.models import OTPChallenge


class OTPError(Exception):
    pass


class OTPCooldown(OTPError):
    pass


class OTPDeliveryError(OTPError):
    pass


def normalize_phone(phone):
    phone = re.sub(r"[\s-]", "", str(phone).strip())

    if phone.startswith("+98"):
        phone = "0" + phone[3:]
    elif phone.startswith("0098"):
        phone = "0" + phone[4:]
    elif phone.startswith("98"):
        phone = "0" + phone[2:]

    if not re.fullmatch(r"09[0-9]{9}", phone):
        raise ValueError("Invalid Iranian mobile number.")

    return phone


def hash_otp(user, purpose, code):
    return salted_hmac(
        "vaka.otp.v1",
        f"{user.pk}:{purpose}:{code}",
        algorithm="sha256",
    ).hexdigest()


def send_sms(phone, code):
    token = settings.FERZZ_API_TOKEN

    if not token:
        raise OTPDeliveryError("Ferzz API token is not configured.")

    destination = "98" + normalize_phone(phone)[1:]

    payload = {
        "token": token,
        "destination": destination,
        "action": "sms",
        "payload": {
            settings.FERZZ_SMS_CODE_FIELD: code,
        },
    }

    try:
        response = requests.post(
            settings.FERZZ_API_URL,
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=(3, 10),
        )
        result = response.json()

    except (requests.RequestException, ValueError) as exc:
        raise OTPDeliveryError("SMS provider unavailable.") from exc

    if (
        response.status_code != 200
        or not isinstance(result, dict)
        or result.get("status") != 200
    ):
        raise OTPDeliveryError("SMS provider rejected request.")


def send_otp(user, purpose):
    if purpose not in OTPChallenge.Purpose.values:
        raise ValueError("Invalid OTP purpose.")

    now = timezone.now()
    code_length = settings.OTP_CODE_LENGTH

    code = str(secrets.randbelow(10 ** code_length)).zfill(
        code_length
    )

    code_digest = hash_otp(user, purpose, code)

    with transaction.atomic():
        challenge, created = (
            OTPChallenge.objects.select_for_update().get_or_create(
                user=user,
                purpose=purpose,
                defaults={
                    "code_hash": code_digest,
                    "expires_at": now + timedelta(
                        seconds=settings.OTP_EXPIRY_SECONDS
                    ),
                    "last_sent_at": now,
                    "attempts": 0,
                },
            )
        )

        if not created:
            cooldown = timedelta(
                seconds=settings.OTP_RESEND_COOLDOWN_SECONDS
            )

            if now - challenge.last_sent_at < cooldown:
                raise OTPCooldown("Please wait before requesting again.")

            challenge.code_hash = code_digest
            challenge.expires_at = now + timedelta(
                seconds=settings.OTP_EXPIRY_SECONDS
            )
            challenge.last_sent_at = now
            challenge.attempts = 0

            challenge.save(
                update_fields=[
                    "code_hash",
                    "expires_at",
                    "last_sent_at",
                    "attempts",
                ]
            )

    try:
        send_sms(user.phone, code)

    except OTPDeliveryError:
        OTPChallenge.objects.filter(
            pk=challenge.pk,
            code_hash=code_digest,
        ).update(
            expires_at=timezone.now(),
            last_sent_at=now - timedelta(
                seconds=settings.OTP_RESEND_COOLDOWN_SECONDS
            ),
        )
        raise


def verify_otp(user, purpose, code):
    if purpose not in OTPChallenge.Purpose.values:
        return False

    now = timezone.now()

    with transaction.atomic():
        challenge = (
            OTPChallenge.objects.select_for_update()
            .filter(user=user, purpose=purpose)
            .first()
        )

        if challenge is None:
            return False

        if now >= challenge.expires_at:
            return False

        if challenge.attempts >= settings.OTP_MAX_ATTEMPTS:
            return False

        expected_hash = hash_otp(user, purpose, code)

        if not hmac.compare_digest(
            challenge.code_hash,
            expected_hash,
        ):
            challenge.attempts += 1
            challenge.save(update_fields=["attempts"])
            return False

        challenge.delete()

        if purpose == OTPChallenge.Purpose.REGISTER:
            type(user).objects.filter(
                pk=user.pk,
                phone_verified_at__isnull=True,
            ).update(phone_verified_at=now)

    return True