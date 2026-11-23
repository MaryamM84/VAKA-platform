"""Executor workspace authorization and transactional actions."""
from rest_framework.exceptions import NotFound, PermissionDenied
from accounts.models import ExecutorProfile, UserRole
from tasks.choices import TaskStatus


ACTIVE_EXECUTION_STATUSES = frozenset({
    TaskStatus.IN_PROGRESS, TaskStatus.SUBMITTED, TaskStatus.APPROVED,
    TaskStatus.DISPUTED, TaskStatus.CANCELLATION_REVIEW,
})


def approved_executor_profile(*, user):
    """Never authorize a non-current or unverified worker by stale bid alone."""
    if user is None or not user.is_authenticated or not user.is_active:
        raise PermissionDenied("An active executor account is required.")
    if not UserRole.objects.filter(user_id=user.pk, role__code="EXECUTOR").exists():
        raise PermissionDenied("The EXECUTOR role is required.")
    profile = ExecutorProfile.objects.filter(
        user_id=user.pk, profile_status="ACTIVE",
        verification_status=ExecutorProfile.VerificationStatus.APPROVED,
    ).first()
    if profile is None:
        raise PermissionDenied("An active, verified executor profile is required.")
    return profile
