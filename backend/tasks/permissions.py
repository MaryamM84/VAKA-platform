"""Task-specific access rules; independent of unfinished signup/login endpoints."""
from rest_framework.permissions import BasePermission

from accounts.models import UserRole


class IsEmployer(BasePermission):
    message = "An active user with the EMPLOYER role is required."

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated or not user.is_active:
            return False
        return UserRole.objects.filter(
            user_id=user.pk,
            role__code="EMPLOYER",
        ).exists()
