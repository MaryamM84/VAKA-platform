
from django.db import transaction
from django.utils import timezone

from rest_framework.exceptions import (
    NotFound,
    ValidationError,
)

from .models import (
    ExecutorProfile,
    Role,
    UserRole,
)


def get_pending_verification_profile(executor_profile_id):

    try:
        profile = (
            ExecutorProfile.objects
            .select_for_update()
            .select_related("user")
            .get(pk=executor_profile_id)
        )

    except ExecutorProfile.DoesNotExist:
        raise NotFound(
            "Worker verification application not found."
        )

    if (
        profile.verification_status
        != ExecutorProfile.VerificationStatus.PENDING
    ):
        raise ValidationError({
            "verification_status": [
                "Only pending applications can be reviewed."
            ]
        })

    return profile


@transaction.atomic
def approve_worker_verification(
    *,
    executor_profile_id,
    reviewer,
):

    profile = get_pending_verification_profile(
        executor_profile_id,
    )

    executor_role, _ = Role.objects.get_or_create(
        code="EXECUTOR",
        defaults={
            "name": "Executor",
            "description": "Verified service provider.",
        },
    )

    UserRole.objects.get_or_create(
        user=profile.user,
        role=executor_role,
        defaults={
            "assigned_by_user": reviewer,
        },
    )

    now = timezone.now()

    profile.verification_status = (
        ExecutorProfile.VerificationStatus.APPROVED
    )

    profile.reviewed_by_user = reviewer
    profile.reviewed_at = now
    profile.approved_at = now
    profile.rejection_reason = None

    profile.save(
        update_fields=[
            "verification_status",
            "reviewed_by_user",
            "reviewed_at",
            "approved_at",
            "rejection_reason",
            "updated_at",
        ]
    )

    return profile


@transaction.atomic
def reject_worker_verification(
    *,
    executor_profile_id,
    reviewer,
    reason,
):

    reason = reason.strip()

    if not reason:
        raise ValidationError({
            "reason": ["Rejection reason is required."]
        })

    profile = get_pending_verification_profile(
        executor_profile_id,
    )

    profile.verification_status = (
        ExecutorProfile.VerificationStatus.REJECTED
    )

    profile.reviewed_by_user = reviewer
    profile.reviewed_at = timezone.now()
    profile.approved_at = None
    profile.rejection_reason = reason

    profile.save(
        update_fields=[
            "verification_status",
            "reviewed_by_user",
            "reviewed_at",
            "approved_at",
            "rejection_reason",
            "updated_at",
        ]
    )

    return profile
