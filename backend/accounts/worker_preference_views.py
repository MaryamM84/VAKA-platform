from django.db.models import Prefetch

from drf_spectacular.utils import (
    extend_schema,
    OpenApiResponse,
)

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from tasks.models import TaskCategory

from .models import ExecutorProfile

from .worker_preference_serializers import (
    WorkerPreferencesReadSerializer,
    WorkerPreferencesUpdateSerializer,
)

from .worker_preference_services import (
    update_worker_preferences,
)


class WorkerPreferencesView(APIView):

    permission_classes = [IsAuthenticated]

    def get_profile(self, user):

        return (
            ExecutorProfile.objects
            .prefetch_related(
                Prefetch(
                    "preferred_categories",
                    queryset=TaskCategory.objects.order_by("name"),
                )
            )
            .filter(user=user)
            .first()
        )

    @extend_schema(
        tags=["Worker Preferences"],
        summary="Get current worker preferences",
        responses={
            200: WorkerPreferencesReadSerializer,
            401: OpenApiResponse(
                description="Authentication required."
            ),
        },
    )
    def get(self, request):

        profile = self.get_profile(request.user)

        if profile is None:

            return Response(
                {
                    "work_interests": [],
                    "preferred_categories": [],
                },
                status=status.HTTP_200_OK,
            )

        serializer = WorkerPreferencesReadSerializer(
            profile,
        )

        return Response(
            serializer.data,
            status=status.HTTP_200_OK,
        )

    @extend_schema(
        tags=["Worker Preferences"],
        summary="Update current worker preferences",
        request=WorkerPreferencesUpdateSerializer,
        responses={
            200: WorkerPreferencesReadSerializer,
            400: OpenApiResponse(
                description="Invalid preference information."
            ),
            401: OpenApiResponse(
                description="Authentication required."
            ),
        },
    )
    def patch(self, request):

        profile = ExecutorProfile.objects.filter(
            user=request.user,
        ).first()

        serializer = WorkerPreferencesUpdateSerializer(
            instance=profile,
            data=request.data,
            partial=True,
        )

        serializer.is_valid(
            raise_exception=True,
        )

        profile = update_worker_preferences(
            user=request.user,
            changes=serializer.validated_data,
        )

        profile = self.get_profile(request.user)

        response_serializer = WorkerPreferencesReadSerializer(
            profile,
        )

        return Response(
            response_serializer.data,
            status=status.HTTP_200_OK,
        )