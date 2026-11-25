"""Validation and private storage for purchase receipt images."""

from uuid import uuid4

from django.conf import settings
from django.core.files.storage import FileSystemStorage
from PIL import Image, UnidentifiedImageError
from rest_framework.exceptions import ValidationError

MAX_RECEIPTS = 3
MAX_RECEIPT_BYTES = 5 * 1024 * 1024
MAX_RECEIPT_PIXELS = 16_000_000
ALLOWED_FORMATS = {
    "JPEG": ("image/jpeg", ".jpg"),
    "PNG": ("image/png", ".png"),
    "WEBP": ("image/webp", ".webp"),
}


def private_receipt_storage():
    # Use a dedicated private root, not MEDIA_ROOT / public upload URLs.
    return FileSystemStorage(location=settings.PRIVATE_MEDIA_ROOT, base_url=None)


def validated_receipt(upload):
    if upload.size < 1 or upload.size > MAX_RECEIPT_BYTES:
        raise ValidationError({"receipts": "Each receipt must be an image of at most 5 MB."})
    upload.seek(0)
    try:
        with Image.open(upload) as image:
            file_format = image.format
            width, height = image.size
            if width < 1 or height < 1 or width * height > MAX_RECEIPT_PIXELS:
                raise ValidationError({"receipts": "Invalid receipt dimensions (max 16 megapixels)."})
            image.verify()
    except ValidationError:
        raise
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError,
            Image.DecompressionBombWarning, ValueError) as exc:
        raise ValidationError({"receipts": "The receipt must be a valid JPEG, PNG or WebP image."}) from exc
    finally:
        upload.seek(0)
    if file_format not in ALLOWED_FORMATS:
        raise ValidationError({"receipts": "Only JPEG, PNG and WebP are accepted."})
    mime, extension = ALLOWED_FORMATS[file_format]
    return upload, mime, extension


def new_receipt_key(*, task_id, claim_id, extension):
    return f"expense-receipts/{task_id}/{claim_id}/{uuid4().hex}{extension}"
