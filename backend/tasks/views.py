"""API views for task creation, publication, and task catalog endpoints."""

from uuid import UUID
import math

from django.db.models import BooleanField, Exists, OuterRef, Prefetch, Q
from django.db.models.expressions import RawSQL
from django.shortcuts import get_object_or_404
from django.utils import timezone

from rest_framework import status
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.generics import (
    GenericAPIView,
    ListAPIView,
    ListCreateAPIView,
    RetrieveAPIView,
)
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from drf_spectacular.utils import (
    OpenApiParameter,
    OpenApiTypes,
    extend_schema,
    extend_schema_view,
    OpenApiResponse,
)

from .choices import TaskStatus
from .models import Skill, Task, TaskCategory, TaskLocation
from .pagination import TaskDiscoveryPagination
from .permissions import IsEmployer

from .serializers import (
    SkillSerializer,
    TaskCategorySerializer,
    TaskCreateSerializer,
    TaskDiscoverySerializer,
    TaskReadSerializer,
    TaskUpdateSerializer,
    TaskActionResponseSerializer
)

from .task_management import cancel_employer_task
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
        .prefetch_related(
            "required_skills__skill",
            "locations",
        )
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
            .prefetch_related("required_skills__skill", "locations")
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


# ============================================================
# 5. DISCOVERY PERMISSIONS AND FILTERS
# ============================================================

# Public discovery does not require login or a worker verification status.
# Task creation, management, and bidding retain their own permissions.


DISCOVERY_PARAMETERS = [
    OpenApiParameter(
        "search", OpenApiTypes.STR, OpenApiParameter.QUERY,
        description="Search task title OR description (case-insensitive).",
    ),
    OpenApiParameter(
        "title", OpenApiTypes.STR, OpenApiParameter.QUERY,
        description="Search task title (case-insensitive).",
    ),
    OpenApiParameter(
        "description", OpenApiTypes.STR, OpenApiParameter.QUERY,
        description="Search task description (case-insensitive).",
    ),
    OpenApiParameter(
        "category_id", OpenApiTypes.UUID, OpenApiParameter.QUERY,
        description="Match tasks directly in this active category.",
    ),
    OpenApiParameter(
        "min_budget", OpenApiTypes.INT, OpenApiParameter.QUERY,
        description="Minimum executor wage in IRR.",
    ),
    OpenApiParameter(
        "max_budget", OpenApiTypes.INT, OpenApiParameter.QUERY,
        description="Maximum executor wage in IRR.",
    ),
    OpenApiParameter(
        "city", OpenApiTypes.STR, OpenApiParameter.QUERY,
        description="Filter by task location city.",
    ),
    OpenApiParameter(
        "region", OpenApiTypes.STR, OpenApiParameter.QUERY,
        description="Filter by task location region.",
    ),
    OpenApiParameter(
        "latitude", OpenApiTypes.NUMBER, OpenApiParameter.QUERY,
        description="Search center latitude; requires longitude and radius_meters.",
    ),
    OpenApiParameter(
        "longitude", OpenApiTypes.NUMBER, OpenApiParameter.QUERY,
        description="Search center longitude; requires latitude and radius_meters.",
    ),
    OpenApiParameter(
        "radius_meters", OpenApiTypes.NUMBER, OpenApiParameter.QUERY,
        description="Positive distance in meters; requires latitude and longitude.",
    ),
    OpenApiParameter(
        "ordering", OpenApiTypes.STR, OpenApiParameter.QUERY,
        description=(
            "published_at, -published_at, wage_budget_amount, "
            "-wage_budget_amount, estimated_duration_minutes, "
            "-estimated_duration_minutes, proposal_deadline_at, "
            "-proposal_deadline_at"
        ),
    ),
]

# The category is already fixed by the path on category-task endpoints.
CATEGORY_TASK_PARAMETERS = [
    param for param in DISCOVERY_PARAMETERS if param.name != "category_id"
]


class TaskDiscoveryQueryMixin:
    """Select public, open, non-expired tasks and apply validated filters."""

    ORDERING_FIELDS = {
        "published_at", "-published_at",
        "wage_budget_amount", "-wage_budget_amount",
        "estimated_duration_minutes", "-estimated_duration_minutes",
        "proposal_deadline_at", "-proposal_deadline_at",
    }
    BIGINT_MAX = 2**63 - 1

    def discoverable_queryset(self):
        now = timezone.now()
        public_locations = TaskLocation.objects.only(
            "task_location_id", "task_id", "location_type",
            "stop_order", "city", "region",
        ).order_by("stop_order", "task_location_id")

        return (
            Task.objects.filter(
                status=TaskStatus.OPEN,
                published_at__isnull=False,
                proposal_deadline_at__gt=now,
                execution_window_end_at__gt=now,
                category__is_active=True,
            )
            # An optional final deadline must not have passed either.
            .filter(Q(deadline_at__isnull=True) | Q(deadline_at__gt=now))
            .select_related("category")
            .prefetch_related(
                "required_skills__skill",
                Prefetch("locations", queryset=public_locations),
            )
        )

    def _nonnegative_int(self, name):
        value = self.request.query_params.get(name)
        if value is None:
            return None
        try:
            number = int(value)
        except (TypeError, ValueError):
            raise ValidationError({name: "A non-negative integer is required."})
        if number < 0 or number > self.BIGINT_MAX:
            raise ValidationError({name: "Amount is out of range."})
        return number

    def _float_param(self, name):
        raw = self.request.query_params.get(name)
        try:
            number = float(raw)
        except (TypeError, ValueError):
            raise ValidationError({name: "A valid number is required."})
        if not math.isfinite(number):
            raise ValidationError({name: "A finite number is required."})
        return number

    def apply_discovery_filters(self, queryset, *, allow_category=True):
        params = self.request.query_params

        search = params.get("search", "").strip()
        if search:
            queryset = queryset.filter(
                Q(title__icontains=search) | Q(description__icontains=search)
            )

        title = params.get("title", "").strip()
        if title:
            queryset = queryset.filter(title__icontains=title)

        description = params.get("description", "").strip()
        if description:
            queryset = queryset.filter(description__icontains=description)

        if allow_category and "category_id" in params:
            try:
                category_id = UUID(params["category_id"])
            except (TypeError, ValueError, AttributeError):
                raise ValidationError({"category_id": "A valid UUID is required."})
            if not TaskCategory.objects.filter(
                category_id=category_id, is_active=True
            ).exists():
                raise ValidationError({
                    "category_id": "Category does not exist or is inactive."
                })
            queryset = queryset.filter(category_id=category_id)

        min_budget = self._nonnegative_int("min_budget")
        max_budget = self._nonnegative_int("max_budget")
        if min_budget is not None and max_budget is not None:
            if min_budget > max_budget:
                raise ValidationError({
                    "budget": "min_budget cannot exceed max_budget."
                })
        if min_budget is not None:
            queryset = queryset.filter(wage_budget_amount__gte=min_budget)
        if max_budget is not None:
            queryset = queryset.filter(wage_budget_amount__lte=max_budget)

        # Use one correlated location subquery, so city, region and radius
        # must match the SAME stop (and cannot duplicate tasks).
        location_filter_requested = any(
            key in params for key in (
                "city", "region", "latitude", "longitude", "radius_meters"
            )
        )
        if location_filter_requested:
            matching_locations = TaskLocation.objects.filter(
                task_id=OuterRef("pk")
            )
            city = params.get("city", "").strip()
            region = params.get("region", "").strip()
            if city:
                matching_locations = matching_locations.filter(city__icontains=city)
            if region:
                matching_locations = matching_locations.filter(region__icontains=region)

            geo_keys = ("latitude", "longitude", "radius_meters")
            if any(key in params for key in geo_keys):
                if not all(key in params for key in geo_keys):
                    raise ValidationError({
                        "location": "latitude, longitude and radius_meters are required together."
                    })

                latitude = self._float_param("latitude")
                longitude = self._float_param("longitude")
                radius = self._float_param("radius_meters")
                if not -90 <= latitude <= 90:
                    raise ValidationError({"latitude": "Must be between -90 and 90."})
                if not -180 <= longitude <= 180:
                    raise ValidationError({"longitude": "Must be between -180 and 180."})
                if not 0 < radius <= 20_000_000:
                    raise ValidationError({
                        "radius_meters": "Must be greater than 0 and at most 20000000."
                    })

                # PostGIS handles geography distances in METERS.
                # Bound parameters prevent SQL injection.
                matching_locations = matching_locations.annotate(
                    is_nearby=RawSQL(
                        "ST_DWithin(approximate_point, "
                        "ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography, %s)",
                        [longitude, latitude, radius],
                        output_field=BooleanField(),
                    )
                ).filter(is_nearby=True)

            queryset = queryset.filter(Exists(matching_locations))

        ordering = params.get("ordering", "-published_at")
        if ordering not in self.ORDERING_FIELDS:
            raise ValidationError({"ordering": "Unsupported ordering field."})
        return queryset.order_by(ordering, "task_id")


# ============================================================
# 6. SUBCATEGORIES
# ============================================================

@extend_schema_view(
    get=extend_schema(
        operation_id="task_subcategories_list",
        tags=["Task Catalog"],
        summary="List direct active subcategories",
        responses=TaskCategorySerializer(many=True),
    ),
)
class TaskSubcategoryListView(ListAPIView):
    permission_classes = [AllowAny]
    serializer_class = TaskCategorySerializer

    def get_queryset(self):
        parent = get_object_or_404(
            TaskCategory,
            category_id=self.kwargs["category_id"],
            is_active=True,
        )
        return (
            TaskCategory.objects.filter(parent_category=parent, is_active=True)
            .select_related("parent_category")
            .order_by("name", "category_id")
        )


# ============================================================
# 7. TASK DISCOVERY LIST, DETAILS, AND CATEGORY TASKS
# ============================================================

@extend_schema_view(
    get=extend_schema(
        operation_id="discoverable_tasks_list",
        auth=[],  # Public endpoint in generated OpenAPI/Swagger.
        tags=["Task Discovery"],
        summary="Browse open, non-expired tasks",
        parameters=DISCOVERY_PARAMETERS,
        responses=TaskDiscoverySerializer(many=True),
    ),
)
class TaskDiscoveryListView(TaskDiscoveryQueryMixin, ListAPIView):
    permission_classes = [AllowAny]
    authentication_classes = []  # Public read-only endpoint; ignore expired browser JWTs.
    serializer_class = TaskDiscoverySerializer
    pagination_class = TaskDiscoveryPagination

    def get_queryset(self):
        return self.apply_discovery_filters(self.discoverable_queryset())


@extend_schema_view(
    get=extend_schema(
        operation_id="discoverable_task_detail",
        auth=[],  # Public endpoint in generated OpenAPI/Swagger.
        tags=["Task Discovery"],
        summary="Details of an available task",
        responses=TaskDiscoverySerializer,
    ),
)
class TaskDiscoveryDetailView(TaskDiscoveryQueryMixin, RetrieveAPIView):
    permission_classes = [AllowAny]
    authentication_classes = []  # Public read-only endpoint; ignore expired browser JWTs.
    serializer_class = TaskDiscoverySerializer
    lookup_field = "task_id"
    lookup_url_kwarg = "task_id"

    def get_queryset(self):
        return self.discoverable_queryset()


@extend_schema_view(
    get=extend_schema(
        operation_id="category_available_tasks_list",
        auth=[],  # Public endpoint in generated OpenAPI/Swagger.
        tags=["Task Discovery"],
        summary="List available tasks directly in a category",
        parameters=CATEGORY_TASK_PARAMETERS,
        responses=TaskDiscoverySerializer(many=True),
    ),
)
class CategoryTaskListView(TaskDiscoveryQueryMixin, ListAPIView):
    permission_classes = [AllowAny]
    authentication_classes = []  # Public read-only endpoint; ignore expired browser JWTs.
    serializer_class = TaskDiscoverySerializer
    pagination_class = TaskDiscoveryPagination

    def get_queryset(self):
        category = get_object_or_404(
            TaskCategory,
            category_id=self.kwargs["category_id"],
            is_active=True,
        )
        queryset = self.discoverable_queryset().filter(category=category)
        return self.apply_discovery_filters(queryset, allow_category=False)

class EmployerTaskDetailView(GenericAPIView):

    permission_classes = [
        IsAuthenticated,
        IsEmployer,
    ]

    serializer_class = TaskUpdateSerializer

    lookup_field = "task_id"
    lookup_url_kwarg = "task_id"

    def get_queryset(self):

        return (
            Task.objects.filter(
                employer_user=self.request.user
            )
            .select_related("category")
            .prefetch_related(
                "required_skills__skill",
                "locations",
            )
        )

    @extend_schema(
        tags=["Tasks"],
        operation_id="employer_task_update",
        summary="Update an employer task",
        request=TaskUpdateSerializer,
        responses={
            200: TaskReadSerializer,
            400: OpenApiResponse(
                description="Invalid task data."
            ),
            401: OpenApiResponse(
                description="Authentication required."
            ),
            403: OpenApiResponse(
                description="Employer permission required."
            ),
            404: OpenApiResponse(
                description="Task not found."
            ),
            409: OpenApiResponse(
                description="Task cannot be edited."
            ),
        },
    )
    def patch(self, request, *args, **kwargs):

        task = self.get_object()

        serializer = self.get_serializer(
            task,
            data=request.data,
            partial=True,
        )

        serializer.is_valid(raise_exception=True)

        updated_task = serializer.save()

        updated_task.refresh_from_db()

        response_serializer = TaskReadSerializer(
            updated_task,
            context=self.get_serializer_context(),
        )

        return Response(
            response_serializer.data,
            status=status.HTTP_200_OK,
        )


class EmployerTaskCancelView(GenericAPIView):

    permission_classes = [
        IsAuthenticated,
        IsEmployer,
    ]

    serializer_class = TaskActionResponseSerializer

    lookup_field = "task_id"
    lookup_url_kwarg = "task_id"

    def get_queryset(self):

        return Task.objects.filter(
            employer_user=self.request.user
        )

    @extend_schema(
        tags=["Tasks"],
        operation_id="employer_task_cancel",
        summary="Cancel an employer task",
        request=None,
        responses={
            200: TaskActionResponseSerializer,
            401: OpenApiResponse(
                description="Authentication required."
            ),
            403: OpenApiResponse(
                description="Employer permission required."
            ),
            404: OpenApiResponse(
                description="Task not found."
            ),
            409: OpenApiResponse(
                description="Task cannot be cancelled."
            ),
        },
    )
    def post(self, request, *args, **kwargs):

        task = self.get_object()

        updated_task = cancel_employer_task(
            task_id=task.task_id,
            employer=request.user,
        )

        serializer = TaskActionResponseSerializer(
            updated_task
        )

        return Response(
            serializer.data,
            status=status.HTTP_200_OK,
        )