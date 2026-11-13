"""Private worker-verification input and response schemas."""
import re
from pathlib import Path

from django.utils import timezone
from PIL import Image, UnidentifiedImageError
from rest_framework import serializers

from .models import ExecutorProfile, WorkerVerificationDocument
from .worker_verification_pii import (
    normalized_national_code, normalized_iban, normalized_mobile, ascii_digits,
)

MAX_DOCUMENT_SIZE = 5 * 1024 * 1024
DOCUMENT_TYPES = ("NATIONAL_CARD_FRONT", "NATIONAL_CARD_BACK")
IMAGE_MIME = {"JPEG":"image/jpeg", "PNG":"image/png", "WEBP":"image/webp"}
IMAGE_EXT = {"JPEG": {".jpg", ".jpeg"}, "PNG": {".png"}, "WEBP": {".webp"}}

def detect_document_mime_type(uploaded_file):
    ext = Path(uploaded_file.name).suffix.lower()
    try:
        uploaded_file.seek(0)
        with Image.open(uploaded_file) as image:
            kind = image.format
            if kind not in IMAGE_MIME or ext not in IMAGE_EXT[kind]:
                raise serializers.ValidationError("Unsupported document image type.")
            if image.width * image.height > 16_000_000:
                raise serializers.ValidationError("Image dimensions are too large.")
            image.verify()
        return IMAGE_MIME[kind]
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError):
        raise serializers.ValidationError("Invalid image content.")
    finally:
        uploaded_file.seek(0)

class WorkerVerificationDocumentUploadSerializer(serializers.Serializer):
    document_type = serializers.ChoiceField(choices=DOCUMENT_TYPES)
    file = serializers.FileField(allow_empty_file=False, max_length=255)

    def to_internal_value(self, data):
        if hasattr(data, "keys"):
            extra = set(data.keys()) - {"document_type", "file"}
            if extra:
                raise serializers.ValidationError({field: ["Unknown field."] for field in extra})
        return super().to_internal_value(data)

    def validate_file(self, value):
        if value.size < 1 or value.size > MAX_DOCUMENT_SIZE:
            raise serializers.ValidationError("Document size must be 1 byte to 5 MB.")
        return value

    def validate(self, attrs):
        attrs["mime_type"] = detect_document_mime_type(attrs["file"])
        return attrs

class WorkerVerificationDocumentReadSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkerVerificationDocument
        fields = ["document_id", "document_type", "original_file_name", "mime_type", "size_bytes", "uploaded_at"]
        read_only_fields = fields

class WorkerVerificationIdentitySerializer(serializers.Serializer):
    first_name = serializers.CharField(max_length=80, trim_whitespace=True)
    last_name = serializers.CharField(max_length=100, trim_whitespace=True)
    national_code = serializers.CharField(max_length=32)
    birth_date = serializers.DateField(input_formats=["%Y-%m-%d"])
    iban = serializers.CharField(max_length=40)
    mobile = serializers.CharField(max_length=32)

    def to_internal_value(self, data):
        if hasattr(data, "keys"):
            extra = set(data.keys()) - set(self.fields)
            if extra:
                raise serializers.ValidationError({field: ["Unknown field."] for field in extra})
        return super().to_internal_value(data)

    def validate_national_code(self, value):
        try:
            return normalized_national_code(value)
        except ValueError as exc:
            raise serializers.ValidationError(str(exc))

    def validate_iban(self, value):
        try:
            return normalized_iban(value)
        except ValueError as exc:
            raise serializers.ValidationError(str(exc))

    def validate_mobile(self, value):
        try:
            return normalized_mobile(value)
        except ValueError as exc:
            raise serializers.ValidationError(str(exc))

    def validate_birth_date(self, value):
        if value > timezone.localdate():
            raise serializers.ValidationError("Birth date cannot be in the future.")
        return value

    def validate(self, attrs):
        user = self.context["request"].user
        try:
            registered_phone = normalized_mobile(user.phone)
        except ValueError:
            raise serializers.ValidationError({"mobile": ["The account mobile is invalid."]})
        if attrs["mobile"] != registered_phone or user.phone_verified_at is None:
            raise serializers.ValidationError({"mobile": ["Mobile must match the verified account phone."]})
        return attrs

class WorkerVerificationIdentityReadSerializer(WorkerVerificationIdentitySerializer):
    updated_at = serializers.DateTimeField(read_only=True)

class WorkerVerificationStatusSerializer(serializers.Serializer):
    verification_status = serializers.ChoiceField(choices=ExecutorProfile.VerificationStatus.choices)
    application_submitted_at = serializers.DateTimeField(allow_null=True)
    reviewed_at = serializers.DateTimeField(allow_null=True)
    approved_at = serializers.DateTimeField(allow_null=True)
    rejection_reason = serializers.CharField(allow_null=True, allow_blank=True)
    documents = WorkerVerificationDocumentReadSerializer(many=True)
    identity_saved = serializers.BooleanField()
    national_code_masked = serializers.CharField(allow_null=True)
    iban_masked = serializers.CharField(allow_null=True)
