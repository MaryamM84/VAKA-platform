
from rest_framework.permissions import BasePermission

from .models import UserRole


class IsVerificationAdmin(BasePermission):

    message = (
        "Only an administrator can review "
        "worker verification requests."
    )

    def has_permission(self, request, view):

        user = request.user

        if (
            not user
            or not user.is_authenticated
            or not user.is_active
        ):
            return False

        return UserRole.objects.filter(
            user_id=user.pk,
            role__code="ADMIN",
        ).exists()
