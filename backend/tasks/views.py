"""API views for task creation, publication, and task catalog endpoints."""

from uuid import UUID

from django.db.models import Q

from rest_framework import status
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.generics import (
    GenericAPIView,
    ListAPIView,
    ListCreateAPIView,
)
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from drf_spectacular.utils import (
    OpenApiParameter,
    OpenApiTypes,
    extend_schema,
    extend_schema_view,
)

from .models import Skill, Task, TaskCategory
from .permissions import IsEmployer

from .serializers import (
    SkillSerializer,
    TaskCategorySerializer,
    TaskCreateSerializer,
    TaskReadSerializer,
)

from .services import publish_task


# ============================================================
# 1. TASK LIST AND CREATE
# ============================================================

@extend_schema_view(
    get=extend_schema(
        operation_id="tasks_list",
        tags=["Tasks"],
        summary="List tasks created by the authenticated employer",
        description=(
            "Returns all tasks created by the current authenticated user. "
            "Tasks belonging to other users are never included."
        ),
        responses=TaskReadSerializer(many=True),
    ),
    post=extend_schema(
        operation_id="tasks_create",
        tags=["Tasks"],
        summary="Create a task draft",
        description=(
            "Creates a task in DRAFT status. The employer and initial "
            "status are assigned by the server and cannot be supplied "
            "by the client."
        ),
        request=TaskCreateSerializer,
        responses={
            201: TaskCreateSerializer,
        },
    ),
)
class TaskListCreateView(ListCreateAPIView):
    """
    GET: List tasks belonging to the current employer.
    POST: Create a new task draft.
    """

    permission_classes = [
        IsAuthenticated,
        IsEmployer,
    ]

    def get_queryset(self):
        return (
            Task.objects.filter(
                employer_user=self.request.user
            )
            .select_related("category")
            .prefetch_related("required_skills__skill")
            .order_by("-created_at", "-task_id")
        )

    def get_serializer_class(self):
        if self.request.method == "POST":
            return TaskCreateSerializer

        return TaskReadSerializer


    def perform_create(self, serializer):
        serializer.save(
            employer_user=self.request.user
        )


# ============================================================
# 2. PUBLISH TASK
# ============================================================

@extend_schema_view(
    post=extend_schema(
        operation_id="task_publish",
        tags=["Tasks"],
        summary="Publish a task draft",
        description=(
            "Publishes a valid task draft owned by the authenticated "
            "employer. The task transitions from DRAFT to OPEN. "
            "The server sets published_at and records the status history."
        ),
        request=None,
        responses={
            200: TaskReadSerializer,
        },
    ),
)
class TaskPublishView(GenericAPIView):
    """
    Publish an existing task draft.

    Only the employer who owns the task can publish it.
    """

    permission_classes = [
        IsAuthenticated,
        IsEmployer,
    ]

    serializer_class = TaskReadSerializer

    lookup_field = "task_id"
    lookup_url_kwarg = "task_id"

    def get_queryset(self):
        """
        Return only tasks belonging to the authenticated employer.

        This prevents an employer from accessing another employer's task.
        """

        return (
            Task.objects.filter(
                employer_user=self.request.user
            )
            .select_related("category")
            .prefetch_related("required_skills__skill")
        )

    def post(self, request, *args, **kwargs):

        # Retrieve the task using an owner-restricted queryset.
        # Another employer's task returns 404.
        task = self.get_object()

        try:
            published_task = publish_task(
                task_id=task.task_id,
                employer=request.user,
            )

        except Task.DoesNotExist:
            # Handles a possible concurrent deletion.
            raise NotFound("Task not found.")

        # Return the complete updated task.
        serializer = self.get_serializer(
            published_task
        )

        return Response(
            serializer.data,
            status=status.HTTP_200_OK,
        )


# ============================================================
# 3. TASK CATEGORY LIST
# ============================================================

@extend_schema_view(
    get=extend_schema(
        operation_id="task_categories_list",
        tags=["Task Catalog"],
        summary="List active task categories",
        description=(
            "Returns active task categories, including their parent category "
            "when present."
        ),
        responses=TaskCategorySerializer(many=True),
    )
)
class TaskCategoryListView(ListAPIView):

    permission_classes = [
        AllowAny,
    ]

    serializer_class = TaskCategorySerializer

    def get_queryset(self):
        return (
            TaskCategory.objects.filter(
                is_active=True
            )
            .select_related("parent_category")
            .order_by(
                "parent_category__name",
                "name",
            )
        )


@extend_schema_view(
    get=extend_schema(
        operation_id="skills_list",
        tags=["Task Catalog"],
        summary="List skills",
        description=(
            "Returns skills belonging to active categories and global skills. "
            "Optionally filter by category_id. Global skills (category=null) "
            "remain available when a category filter is supplied."
        ),
        parameters=[
            OpenApiParameter(
                name="category_id",
                type=OpenApiTypes.UUID,
                location=OpenApiParameter.QUERY,
                required=False,
                description="Optional category UUID used to filter skills.",
            )
        ],
        responses=SkillSerializer(many=True),
    )
)
class SkillListView(ListAPIView):

    permission_classes = [
        AllowAny,
    ]

    serializer_class = SkillSerializer

    def get_queryset(self):

        queryset = (
            Skill.objects.select_related("category")
            .filter(
                Q(category__isnull=True)
                | Q(category__is_active=True)
            )
        )

        category_id = self.request.query_params.get(
            "category_id"
        )

        if category_id is not None:

            try:
                category_uuid = UUID(category_id)

            except (TypeError, ValueError, AttributeError):
                raise ValidationError(
                    {
                        "category_id": (
                            "A valid UUID must be provided."
                        )
                    }
                )

            category_is_active = TaskCategory.objects.filter(
                category_id=category_uuid,
                is_active=True,
            ).exists()

            if not category_is_active:
                raise ValidationError(
                    {
                        "category_id": (
                            "The selected category does not exist or is inactive."
                        )
                    }
                )

            queryset = queryset.filter(
                Q(category_id=category_uuid)
                | Q(category__isnull=True)
            )

        return queryset.order_by(
            "category__name",
            "name",
        )