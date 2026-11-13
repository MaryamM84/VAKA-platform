"""Validation and reversible encryption for private verification identity data."""
import hashlib
import hmac
import re

from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured

_DIGITS = str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789")

def ascii_digits(value):
    return str(value).translate(_DIGITS)

def normalized_national_code(value):
    value = re.sub(r"[\s-]", "", ascii_digits(value))
    if not re.fullmatch(r"[0-9]{10}", value) or len(set(value)) == 1:
        raise ValueError("Invalid national code.")
    weighted_sum = sum(int(value[i]) * (10-i) for i in range(9))
    rem = weighted_sum % 11
    if int(value[-1]) != (rem if rem < 2 else 11-rem):
        raise ValueError("Invalid national code checksum.")
    return value

def normalized_iban(value):
    value = re.sub(r"[\s-]", "", ascii_digits(value)).upper()
    if not re.fullmatch(r"IR[0-9]{24}", value):
        raise ValueError("IBAN must be IR followed by 24 digits.")
    moved = value[4:] + value[:4]
    rem = 0
    for letter in moved:
        digits = str(ord(letter)-55) if letter.isalpha() else letter
        for digit in digits:
            rem = (rem*10 + int(digit)) % 97
    if rem != 1:
        raise ValueError("Invalid IBAN checksum.")
    return value

def normalized_mobile(value):
    value = re.sub(r"[\s-]", "", ascii_digits(value))
    if not re.fullmatch(r"09[0-9]{9}", value):
        raise ValueError("Invalid mobile number.")
    return value

def _fernet():
    key = settings.VERIFICATION_PII_ENCRYPTION_KEY
    if not key:
        raise ImproperlyConfigured("Verification encryption key is not configured.")
    try:
        return Fernet(key.encode("ascii"))
    except (ValueError, UnicodeEncodeError) as exc:
        raise ImproperlyConfigured("Verification encryption key is invalid.") from exc

def encrypt(value):
    return _fernet().encrypt(value.encode("utf-8")).decode("ascii")

def decrypt(value):
    try:
        return _fernet().decrypt(value.encode("ascii")).decode("utf-8")
    except (InvalidToken, UnicodeDecodeError) as exc:
        raise ImproperlyConfigured("Unable to decrypt verification data.") from exc

def national_code_digest(value):
    key = settings.VERIFICATION_PII_HASH_KEY
    if len(key.encode("utf-8")) < 32:
        raise ImproperlyConfigured("Verification HMAC key must be at least 32 bytes.")
    return hmac.new(key.encode("utf-8"), value.encode("ascii"), hashlib.sha256).hexdigest()

def masked_national_code(last4):
    return "******" + last4

def masked_iban(last4):
    return "IR" + "*"*20 + last4
