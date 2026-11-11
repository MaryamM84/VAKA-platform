
from pathlib import Path
from uuid import uuid4

from django.db import transaction

from rest_framework.exceptions import ValidationError

from .models import (
    ExecutorProfile,
    WorkerVerificationDocument,
)
from django.utils import timezone


@transaction.atomic
def upload_worker_verification_document(
    *,
    user,
    document_type,
    uploaded_file,
    mime_type,
):

    profile, _ = ExecutorProfile.objects.get_or_create(
        user=user,
    )

    profile = ExecutorProfile.objects.select_for_update().get(
        pk=profile.pk,
    )

    if profile.verification_status in [
        ExecutorProfile.VerificationStatus.PENDING,
        ExecutorProfile.VerificationStatus.APPROVED,
    ]:
        raise ValidationError({
            "verification_status": [
                "Documents cannot be modified while the "
                "application is pending or approved."
            ]
        })

    original_file_name = uploaded_file.name.replace("\\", "/")
    original_file_name = original_file_name.rsplit("/", 1)[-1]

    original_file_name = "".join(
        char for char in original_file_name
        if char.isprintable()
    ).strip()

    if not original_file_name:
        original_file_name = "document"

    original_file_name = original_file_name[:255]

    extension = Path(original_file_name).suffix.lower()

    uploaded_file.name = f"{uuid4().hex}{extension}"

    document = WorkerVerificationDocument(
        executor_profile=profile,
        document_type=document_type,
        original_file_name=original_file_name,
        mime_type=mime_type,
        size_bytes=uploaded_file.size,
    )

    document.file = uploaded_file

    try:
        document.save()

    except Exception:
        if document.file and document.file.name:
            document.file.storage.delete(
                document.file.name
            )

        raise

    return document


@transaction.atomic
def submit_worker_verification_application(*, user):

    profile, _ = ExecutorProfile.objects.get_or_create(
        user=user,
    )

    profile = ExecutorProfile.objects.select_for_update().get(
        pk=profile.pk,
    )

    if (
        profile.verification_status
        == ExecutorProfile.VerificationStatus.PENDING
    ):
        raise ValidationError({
            "verification_status": [
                "Your application is already pending review."
            ]
        })

    if (
        profile.verification_status
        == ExecutorProfile.VerificationStatus.APPROVED
    ):
        raise ValidationError({
            "verification_status": [
                "Your application has already been approved."
            ]
        })

    has_documents = WorkerVerificationDocument.objects.filter(
        executor_profile=profile,
    ).exists()

    if not has_documents:
        raise ValidationError({
            "documents": [
                "Upload at least one verification document "
                "before submitting your application."
            ]
        })

    profile.verification_status = (
        ExecutorProfile.VerificationStatus.PENDING
    )

    profile.application_submitted_at = timezone.now()

    profile.reviewed_at = None
    profile.reviewed_by_user = None
    profile.approved_at = None
    profile.rejection_reason = None

    profile.save(
        update_fields=[
            "verification_status",
            "application_submitted_at",
            "reviewed_at",
            "reviewed_by_user",
            "approved_at",
            "rejection_reason",
            "updated_at",
        ]
    )

    return profile
