
from pathlib import Path

from rest_framework import serializers

from .models import (ExecutorProfile,WorkerVerificationDocument,)


MAX_DOCUMENT_SIZE = 10 * 1024 * 1024


def detect_document_mime_type(uploaded_file):

    extension = Path(uploaded_file.name).suffix.lower()

    uploaded_file.seek(0)
    signature = uploaded_file.read(8)
    uploaded_file.seek(0)

    if extension == ".pdf" and signature.startswith(b"%PDF-"):
        return "application/pdf"

    if extension in {".jpg", ".jpeg"} and signature.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"

    if extension == ".png" and signature == b"\x89PNG\r\n\x1a\n":
        return "image/png"

    raise serializers.ValidationError(
        "Unsupported file type or invalid file content. "
        "Only valid PDF, JPEG and PNG files are accepted."
    )


class WorkerVerificationDocumentUploadSerializer(
    serializers.Serializer
):

    document_type = serializers.CharField(
        max_length=40,
        trim_whitespace=True,
    )

    file = serializers.FileField(
        allow_empty_file=False,
        max_length=255,
    )

    def to_internal_value(self, data):

        allowed_fields = {
            "document_type",
            "file",
        }

        if hasattr(data, "keys"):

            unsupported = set(data.keys()) - allowed_fields

            if unsupported:
                raise serializers.ValidationError({
                    field: [
                        "This field cannot be provided."
                    ]
                    for field in unsupported
                })

        return super().to_internal_value(data)

    def validate_file(self, value):

        if value.size > MAX_DOCUMENT_SIZE:
            raise serializers.ValidationError(
                "Maximum file size is 10 MB."
            )

        if value.size == 0:
            raise serializers.ValidationError(
                "Empty files are not allowed."
            )

        return value

    def validate(self, attrs):

        attrs["mime_type"] = detect_document_mime_type(
            attrs["file"]
        )

        return attrs


class WorkerVerificationDocumentReadSerializer(
    serializers.ModelSerializer
):

    class Meta:
        model = WorkerVerificationDocument

        fields = [
            "document_id",
            "document_type",
            "original_file_name",
            "mime_type",
            "size_bytes",
            "uploaded_at",
        ]

        read_only_fields = fields


class WorkerVerificationStatusSerializer(serializers.Serializer):

    verification_status = serializers.ChoiceField(
        choices=ExecutorProfile.VerificationStatus.choices,
    )

    application_submitted_at = serializers.DateTimeField(
        allow_null=True,
    )

    reviewed_at = serializers.DateTimeField(
        allow_null=True,
    )

    approved_at = serializers.DateTimeField(
        allow_null=True,
    )

    rejection_reason = serializers.CharField(
        allow_null=True,
        allow_blank=True,
    )

    documents = WorkerVerificationDocumentReadSerializer(
        many=True,
    )
