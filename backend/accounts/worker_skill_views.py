from django.db import IntegrityError
from django.shortcuts import get_object_or_404

from drf_spectacular.utils import extend_schema, OpenApiResponse

from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import ExecutorProfile, WorkerSkill

from .worker_skill_serializers import (
    WorkerSkillReadSerializer,
    WorkerSkillCreateSerializer,
    WorkerSkillUpdateSerializer,
)

from .worker_skill_services import (
    add_worker_skill,
    update_worker_skill,
    delete_worker_skill,
)


class MyWorkerSkillsView(APIView):

    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Worker Skills"],
        summary="Get current user's skills",
        responses={
            200: WorkerSkillReadSerializer(many=True),
        },
    )
    def get(self, request):

        profile = ExecutorProfile.objects.filter(
            user=request.user
        ).first()

        if profile is None:
            return Response(
                [],
                status=status.HTTP_200_OK,
            )

        skills = (
            WorkerSkill.objects
            .filter(executor_profile=profile)
            .select_related(
                "skill",
                "skill__category",
            )
            .order_by("created_at", "worker_skill_id")
        )

        serializer = WorkerSkillReadSerializer(
            skills,
            many=True,
        )

        return Response(
            serializer.data,
            status=status.HTTP_200_OK,
        )

    @extend_schema(
        tags=["Worker Skills"],
        summary="Add a skill to current user's profile",
        request=WorkerSkillCreateSerializer,
        responses={
            201: WorkerSkillReadSerializer,
            400: OpenApiResponse(
                description="Invalid skill or duplicate skill."
            ),
            401: OpenApiResponse(
                description="Authentication required."
            ),
        },
    )
    def post(self, request):

        serializer = WorkerSkillCreateSerializer(
            data=request.data,
            context={"request": request},
        )

        serializer.is_valid(raise_exception=True)

        try:

            worker_skill = add_worker_skill(
                user=request.user,
                skill=serializer.validated_data["skill_id"],
                proficiency_level=serializer.validated_data[
                    "proficiency_level"
                ],
                experience_years=serializer.validated_data[
                    "experience_years"
                ],
            )

        except IntegrityError:
            raise ValidationError({
                "skill_id": "This skill is already in your profile."
            })

        response_serializer = WorkerSkillReadSerializer(
            worker_skill
        )

        return Response(
            response_serializer.data,
            status=status.HTTP_201_CREATED,
        )


class MyWorkerSkillDetailView(APIView):

    permission_classes = [IsAuthenticated]

    def get_owned_skill(self, user, worker_skill_id):

        return get_object_or_404(
            WorkerSkill.objects.select_related(
                "skill",
                "skill__category",
            ).filter(
                executor_profile__user=user,
            ),
            worker_skill_id=worker_skill_id,
        )

    @extend_schema(
        tags=["Worker Skills"],
        summary="Update current user's skill",
        request=WorkerSkillUpdateSerializer,
        responses={
            200: WorkerSkillReadSerializer,
            400: OpenApiResponse(
                description="Invalid skill information."
            ),
            404: OpenApiResponse(
                description="Skill not found."
            ),
        },
    )
    def patch(self, request, worker_skill_id):

        worker_skill = self.get_owned_skill(
            request.user,
            worker_skill_id,
        )

        serializer = WorkerSkillUpdateSerializer(
            data=request.data,
            partial=True,
        )

        serializer.is_valid(raise_exception=True)

        worker_skill = update_worker_skill(
            worker_skill=worker_skill,
            changes=serializer.validated_data,
        )

        response_serializer = WorkerSkillReadSerializer(
            worker_skill
        )

        return Response(
            response_serializer.data,
            status=status.HTTP_200_OK,
        )

    @extend_schema(
        tags=["Worker Skills"],
        summary="Delete current user's skill",
        responses={
            204: OpenApiResponse(
                description="Skill successfully deleted."
            ),
            404: OpenApiResponse(
                description="Skill not found."
            ),
        },
    )
    def delete(self, request, worker_skill_id):

        worker_skill = self.get_owned_skill(
            request.user,
            worker_skill_id,
        )

        delete_worker_skill(
            worker_skill=worker_skill,
        )

        return Response(
            status=status.HTTP_204_NO_CONTENT,
        )