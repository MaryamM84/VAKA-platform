from django.db import transaction
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema, OpenApiResponse
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import ExecutorProfile, WorkerServiceNeighborhood
from .worker_service_neighborhood_serializers import (
    WorkerServiceNeighborhoodCreateSerializer,
    WorkerServiceNeighborhoodReadSerializer,
)


class WorkerServiceNeighborhoodListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Worker Preferences"],
        summary="List selected service-area neighborhoods",
        responses={200: WorkerServiceNeighborhoodReadSerializer(many=True)},
    )
    def get(self, request):
        neighborhoods = WorkerServiceNeighborhood.objects.filter(
            executor_profile__user=request.user,
        ).order_by("name", "neighborhood_id")
        return Response(
            WorkerServiceNeighborhoodReadSerializer(neighborhoods, many=True).data
        )

    @extend_schema(
        tags=["Worker Preferences"],
        summary="Add a neighborhood to the current service-area city",
        request=WorkerServiceNeighborhoodCreateSerializer,
        responses={
            201: WorkerServiceNeighborhoodReadSerializer,
            400: OpenApiResponse(description="City missing, duplicate or invalid neighborhood."),
            401: OpenApiResponse(description="Authentication required."),
        },
    )
    @transaction.atomic
    def post(self, request):
        serializer = WorkerServiceNeighborhoodCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Lock the profile to serialize additions and city changes.
        profile, _ = ExecutorProfile.objects.get_or_create(user=request.user)
        profile = ExecutorProfile.objects.select_for_update().get(pk=profile.pk)
        if not profile.service_area_city.strip():
            raise ValidationError({
                "service_area_city": ["Select a city before adding neighborhoods."]
            })
        name = serializer.validated_data["name"]
        if profile.service_neighborhoods.filter(name__iexact=name).exists():
            raise ValidationError({"name": ["This neighborhood is already selected."]})

        neighborhood = WorkerServiceNeighborhood.objects.create(
            executor_profile=profile,
            name=name,
        )
        return Response(
            WorkerServiceNeighborhoodReadSerializer(neighborhood).data,
            status=status.HTTP_201_CREATED,
        )


class WorkerServiceNeighborhoodDetailView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Worker Preferences"],
        summary="Remove a selected neighborhood",
        responses={
            204: OpenApiResponse(description="Neighborhood removed."),
            404: OpenApiResponse(description="Neighborhood not found."),
        },
    )
    def delete(self, request, neighborhood_id):
        neighborhood = get_object_or_404(
            WorkerServiceNeighborhood.objects.filter(
                executor_profile__user=request.user,
            ),
            neighborhood_id=neighborhood_id,
        )
        neighborhood.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
