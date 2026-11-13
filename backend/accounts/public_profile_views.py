from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.generics import RetrieveAPIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .models import ExecutorProfile, User
from .public_profile_serializers import PublicWorkerProfileSerializer


class PublicWorkerProfileView(RetrieveAPIView):
    permission_classes = [AllowAny]
    serializer_class = PublicWorkerProfileSerializer
    lookup_field = "executor_profile_id"
    lookup_url_kwarg = "profile_id"

    def get_queryset(self):
        return (
            ExecutorProfile.objects.filter(
                verification_status=ExecutorProfile.VerificationStatus.APPROVED,
                profile_status="ACTIVE",
                user__account_status=User.AccountStatus.ACTIVE,
                user__phone_verified_at__isnull=False,
            )
            .select_related("user")
            .prefetch_related("worker_skills__skill")
        )

    @extend_schema(
        tags=["Public Worker Profiles"],
        summary="Get a public worker profile",
        description=(
            "Returns an active, approved executor profile. Phone numbers, "
            "email addresses and private verification documents are not exposed. "
            "province and city represent the executor's configured service area. "
            "Rating fields are null until the review data model is available."
        ),
        responses={
            200: PublicWorkerProfileSerializer,
            404: OpenApiResponse(description="Public worker profile not found."),
        },
    )
    def retrieve(self, request, *args, **kwargs):
        profile = self.get_object()
        serializer = self.get_serializer(
            profile,
            context={"request": request},
        )
        return Response(serializer.data, status=status.HTTP_200_OK)
