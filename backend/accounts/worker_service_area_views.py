from drf_spectacular.utils import extend_schema, OpenApiResponse

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import ExecutorProfile

from .worker_service_area_serializers import (
    WorkerServiceAreaSerializer,
)

from .worker_service_area_services import (
    update_worker_service_area,
)


class WorkerServiceAreaView(APIView):

    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Worker Preferences"],
        summary="Get current worker service area",
        responses={
            200: WorkerServiceAreaSerializer,
        },
    )
    def get(self, request):

        profile = ExecutorProfile.objects.filter(
            user=request.user,
        ).first()

        if profile is None:

            return Response(
                {
                    "service_area_city": "",
                    "service_area_region": "",
                    "service_area_latitude": None,
                    "service_area_longitude": None,
                    "service_area_radius_km": None,
                },
                status=status.HTTP_200_OK,
            )

        serializer = WorkerServiceAreaSerializer(
            instance=profile,
        )

        return Response(
            serializer.data,
            status=status.HTTP_200_OK,
        )

    @extend_schema(
        tags=["Worker Preferences"],
        summary="Update current worker service area",
        request=WorkerServiceAreaSerializer,
        responses={
            200: WorkerServiceAreaSerializer,
            400: OpenApiResponse(
                description="Invalid service area information."
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

        serializer = WorkerServiceAreaSerializer(
            instance=profile,
            data=request.data,
            partial=True,
        )

        serializer.is_valid(
            raise_exception=True,
        )

        profile = update_worker_service_area(
            user=request.user,
            changes=serializer.validated_data,
        )

        response_serializer = WorkerServiceAreaSerializer(
            instance=profile,
        )

        return Response(
            response_serializer.data,
            status=status.HTTP_200_OK,
        )