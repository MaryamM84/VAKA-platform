from django.shortcuts import get_object_or_404

from drf_spectacular.utils import (
    extend_schema,
    OpenApiResponse,
)

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    ExecutorProfile,
    WorkerAvailability,
)

from .worker_availability_serializers import (
    WorkerAvailabilityReadSerializer,
    WorkerAvailabilityWriteSerializer,
    WorkerAvailabilityTimezoneSerializer,
    WorkerAvailabilityCollectionSerializer,
)

from .worker_availability_services import (
    update_availability_timezone,
    create_worker_availability,
    update_worker_availability,
    delete_worker_availability,
)


class WorkerAvailabilityCollectionView(APIView):

    permission_classes = [IsAuthenticated]

    def get_collection_data(self, profile):

        if profile is None:

            return {
                "availability_timezone": "UTC",
                "slots": [],
            }

        slots = (
            WorkerAvailability.objects
            .filter(executor_profile=profile)
            .order_by(
                "weekday",
                "start_time",
            )
        )

        serializer = WorkerAvailabilityReadSerializer(
            slots,
            many=True,
        )

        return {
            "availability_timezone": profile.availability_timezone,
            "slots": serializer.data,
        }

    @extend_schema(
        tags=["Worker Preferences"],
        summary="Get current worker availability",
        responses={
            200: WorkerAvailabilityCollectionSerializer,
        },
    )
    def get(self, request):

        profile = ExecutorProfile.objects.filter(
            user=request.user,
        ).first()

        return Response(
            self.get_collection_data(profile),
            status=status.HTTP_200_OK,
        )

    @extend_schema(
        tags=["Worker Preferences"],
        summary="Add an availability slot",
        request=WorkerAvailabilityWriteSerializer,
        responses={
            201: WorkerAvailabilityReadSerializer,
            400: OpenApiResponse(
                description="Invalid or overlapping availability slot."
            ),
            401: OpenApiResponse(
                description="Authentication required."
            ),
        },
    )
    def post(self, request):

        serializer = WorkerAvailabilityWriteSerializer(
            data=request.data,
        )

        serializer.is_valid(
            raise_exception=True,
        )

        slot = create_worker_availability(
            user=request.user,
            changes=serializer.validated_data,
        )

        response_serializer = WorkerAvailabilityReadSerializer(
            slot,
        )

        return Response(
            response_serializer.data,
            status=status.HTTP_201_CREATED,
        )

    @extend_schema(
        tags=["Worker Preferences"],
        summary="Update worker availability timezone",
        request=WorkerAvailabilityTimezoneSerializer,
        responses={
            200: WorkerAvailabilityCollectionSerializer,
            400: OpenApiResponse(
                description="Invalid timezone."
            ),
        },
    )
    def patch(self, request):

        serializer = WorkerAvailabilityTimezoneSerializer(
            data=request.data,
        )

        serializer.is_valid(
            raise_exception=True,
        )

        profile = update_availability_timezone(
            user=request.user,
            timezone_name=serializer.validated_data[
                "availability_timezone"
            ],
        )

        return Response(
            self.get_collection_data(profile),
            status=status.HTTP_200_OK,
        )


class WorkerAvailabilityDetailView(APIView):

    permission_classes = [IsAuthenticated]

    def get_owned_slot(self, user, availability_id):

        return get_object_or_404(
            WorkerAvailability.objects.filter(
                executor_profile__user=user,
            ),
            availability_id=availability_id,
        )

    @extend_schema(
        tags=["Worker Preferences"],
        summary="Update an availability slot",
        request=WorkerAvailabilityWriteSerializer,
        responses={
            200: WorkerAvailabilityReadSerializer,
            400: OpenApiResponse(
                description="Invalid or overlapping availability slot."
            ),
            404: OpenApiResponse(
                description="Availability slot not found."
            ),
        },
    )
    def patch(self, request, availability_id):

        slot = self.get_owned_slot(
            request.user,
            availability_id,
        )

        serializer = WorkerAvailabilityWriteSerializer(
            instance=slot,
            data=request.data,
            partial=True,
        )

        serializer.is_valid(
            raise_exception=True,
        )

        slot = update_worker_availability(
            user=request.user,
            availability_id=availability_id,
            changes=serializer.validated_data,
        )

        response_serializer = WorkerAvailabilityReadSerializer(
            slot,
        )

        return Response(
            response_serializer.data,
            status=status.HTTP_200_OK,
        )

    @extend_schema(
        tags=["Worker Preferences"],
        summary="Delete an availability slot",
        responses={
            204: OpenApiResponse(
                description="Availability slot deleted successfully."
            ),
            404: OpenApiResponse(
                description="Availability slot not found."
            ),
        },
    )
    def delete(self, request, availability_id):

        delete_worker_availability(
            user=request.user,
            availability_id=availability_id,
        )

        return Response(
            status=status.HTTP_204_NO_CONTENT,
        )