"""Business rules for private executor identity, documents and submission."""
from pathlib import Path
from uuid import uuid4

from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework.exceptions import APIException, NotFound, ValidationError

from .models import ExecutorProfile, WorkerVerificationDocument, WorkerVerificationIdentity
from .worker_verification_pii import encrypt, decrypt, national_code_digest, normalized_national_code, normalized_iban, normalized_mobile

class VerificationConflict(APIException):
    status_code = 409
    default_detail = "Verification is locked in the current state."
    default_code = "verification_conflict"

def _editable(profile):
    if profile.verification_status in (
        ExecutorProfile.VerificationStatus.PENDING,
        ExecutorProfile.VerificationStatus.APPROVED,
    ):
        raise VerificationConflict("Identity and documents are locked while pending or approved.")

def identity_to_payload(details):
    return {
        "first_name": details.first_name,
        "last_name": details.last_name,
        "national_code": decrypt(details.national_code_encrypted),
        "birth_date": details.birth_date,
        "iban": decrypt(details.iban_encrypted),
        "mobile": details.mobile,
        "updated_at": details.updated_at,
    }

@transaction.atomic
def save_worker_verification_identity(*, user, data):
    profile, _ = ExecutorProfile.objects.get_or_create(user=user)
    profile = ExecutorProfile.objects.select_for_update().get(pk=profile.pk)
    _editable(profile)
    digest = national_code_digest(data["national_code"])
    values = {
        "first_name": data["first_name"],
        "last_name": data["last_name"],
        "birth_date": data["birth_date"],
        "mobile": data["mobile"],
        "national_code_encrypted": encrypt(data["national_code"]),
        "national_code_hash": digest,
        "national_code_last4": data["national_code"][-4:],
        "iban_encrypted": encrypt(data["iban"]),
        "iban_last4": data["iban"][-4:],
    }
    try:
        with transaction.atomic():
            obj = WorkerVerificationIdentity.objects.select_for_update().filter(executor_profile=profile).first()
            if obj is None:
                obj = WorkerVerificationIdentity.objects.create(executor_profile=profile, **values)
            else:
                for key, value in values.items():
                    setattr(obj, key, value)
                obj.save(update_fields=[*values.keys(), "updated_at"])
    except IntegrityError:
        if WorkerVerificationIdentity.objects.filter(national_code_hash=digest).exclude(executor_profile=profile).exists():
            raise ValidationError({"national_code": ["This national code is already registered."]})
        raise
    return obj

@transaction.atomic
def upload_worker_verification_document(*, user, document_type, uploaded_file, mime_type):
    profile, _ = ExecutorProfile.objects.get_or_create(user=user)
    profile = ExecutorProfile.objects.select_for_update().get(pk=profile.pk)
    _editable(profile)
    original_name = uploaded_file.name.replace("\\", "/").rsplit("/", 1)[-1]
    original_name = "".join(char for char in original_name if char.isprintable()).strip()[:255] or "document"
    ext = Path(original_name).suffix.lower()
    uploaded_file.name = f"{uuid4().hex}{ext}"
    previous = (WorkerVerificationDocument.objects.filter(
        executor_profile=profile, document_type=document_type,
    ).order_by("-uploaded_at").first())
    if previous is not None:
        old_file_name = previous.file.name if previous.file else None
        document = previous
    else:
        old_file_name = None
        document = WorkerVerificationDocument(executor_profile=profile, document_type=document_type)
    document.original_file_name = original_name
    document.mime_type = mime_type
    document.size_bytes = uploaded_file.size
    document.file = uploaded_file
    try:
        document.save()
    except Exception:
        filename = document.file.name if document.file else None
        if filename and filename != old_file_name and document.file.storage.exists(filename):
            document.file.storage.delete(filename)
        raise
    new_file_name = document.file.name if document.file else None
    if old_file_name and old_file_name != new_file_name:
        storage = document.file.storage
        transaction.on_commit(lambda: storage.delete(old_file_name))
    return document

@transaction.atomic
def delete_worker_verification_document(*, user, document_id):
    profile = ExecutorProfile.objects.select_for_update().filter(user=user).first()
    if profile is None:
        raise NotFound("Document not found.")
    _editable(profile)
    doc = WorkerVerificationDocument.objects.filter(executor_profile=profile, document_id=document_id).first()
    if doc is None:
        raise NotFound("Document not found.")
    name = doc.file.name if doc.file else None
    storage = doc.file.storage
    doc.delete()
    if name:
        transaction.on_commit(lambda: storage.delete(name))

@transaction.atomic
def submit_worker_verification_application(*, user):
    profile, _ = ExecutorProfile.objects.get_or_create(user=user)
    profile = ExecutorProfile.objects.select_for_update().get(pk=profile.pk)
    _editable(profile)
    details = WorkerVerificationIdentity.objects.filter(executor_profile=profile).first()
    if details is None:
        raise ValidationError({"identity": ["Save your identity form before submitting."]})
    # Validate persisted data too: the verified phone may have changed since PUT.
    if (details.mobile != normalized_mobile(user.phone)
        or user.phone_verified_at is None
        or details.birth_date > timezone.localdate()):
        raise ValidationError({"identity": ["Saved identity information must be updated."]})
    try:
        normalized_national_code(decrypt(details.national_code_encrypted))
        normalized_iban(decrypt(details.iban_encrypted))
    except ValueError:
        raise ValidationError({"identity": ["Saved identity information is invalid."]})
    required = {"NATIONAL_CARD_FRONT", "NATIONAL_CARD_BACK"}
    actual = set(WorkerVerificationDocument.objects.filter(
        executor_profile=profile, document_type__in=required,
    ).values_list("document_type", flat=True))
    if missing := required - actual:
        raise ValidationError({"documents": ["Missing identity document(s): " + ", ".join(sorted(missing))]})
    profile.verification_status = ExecutorProfile.VerificationStatus.PENDING
    profile.application_submitted_at = timezone.now()
    profile.reviewed_at = None
    profile.reviewed_by_user = None
    profile.approved_at = None
    profile.rejection_reason = None
    profile.save(update_fields=[
        "verification_status", "application_submitted_at", "reviewed_at",
        "reviewed_by_user", "approved_at", "rejection_reason", "updated_at",
    ])
    return profile
