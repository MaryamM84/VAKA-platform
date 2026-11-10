"""Restricted API for managing category hierarchy and activity flags.

Public category listing in tasks.views intentionally remains read-only.
"""

from django.db import transaction
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import serializers
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateAPIView
from rest_framework.permissions import BasePermission, IsAuthenticated

from accounts.models import UserRole
from .models import TaskCategory
from .serializers import RejectUnexpectedFieldsMixin, TaskCategorySerializer


class IsCategoryManager(BasePermission):
    """Require a verified, active account explicitly assigned the ADMIN role."""

    message = "An active account with the ADMIN role is required."

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and user.is_active
            and UserRole.objects.filter(user=user, role__code="ADMIN").exists()
        )


class CategoryWriteSerializer(RejectUnexpectedFieldsMixin, serializers.ModelSerializer):
    # Field name matches the existing public catalog API and ERD.
    parent_category_id = serializers.PrimaryKeyRelatedField(
        source="parent_category",
        queryset=TaskCategory.objects.filter(is_active=True),
        allow_null=True,
        required=False,
    )

    class Meta:
        model = TaskCategory
        fields = [
            "category_id", "name", "description", "parent_category_id", "is_active",
        ]
        read_only_fields = ["category_id"]

    def validate(self, attrs):
        instance = self.instance
        parent = attrs.get(
            "parent_category",
            instance.parent_category if instance is not None else None,
        )
        active = attrs.get(
            "is_active",
            instance.is_active if instance is not None else True,
        )

        if parent is not None and not parent.is_active:
            raise serializers.ValidationError({
                "parent_category_id": "The parent category must be active."
            })

        # Reject A -> A and A -> B -> ... -> A cycles.
        visited = set()
        cursor = parent
        while cursor is not None:
            if (instance is not None and cursor.pk == instance.pk) or cursor.pk in visited:
                raise serializers.ValidationError({
                    "parent_category_id": "Circular category hierarchies are not allowed."
                })
            visited.add(cursor.pk)
            cursor = cursor.parent_category

        # Avoid active children under an inactive parent when deactivating.
        if instance is not None and not active:
            if instance.children.filter(is_active=True).exists():
                raise serializers.ValidationError({
                    "is_active": "Deactivate active child categories first."
                })

        return attrs


@extend_schema_view(
    get=extend_schema(
        tags=["Category Management"],
        summary="List categories for authorized managers (including inactive)",
        responses=TaskCategorySerializer(many=True),
    ),
    post=extend_schema(
        tags=["Category Management"],
        summary="Create a category or subcategory (ADMIN only)",
        request=CategoryWriteSerializer,
        responses={201: CategoryWriteSerializer},
    ),
)
class CategoryManageListCreateView(ListCreateAPIView):
    permission_classes = [IsAuthenticated, IsCategoryManager]

    def get_serializer_class(self):
        return CategoryWriteSerializer if self.request.method == "POST" else TaskCategorySerializer

    def get_queryset(self):
        return TaskCategory.objects.select_related("parent_category").order_by(
            "name", "category_id"
        )


@extend_schema_view(
    get=extend_schema(
        tags=["Category Management"],
        summary="Retrieve a category for authorized management",
        responses=TaskCategorySerializer,
    ),
    patch=extend_schema(
        tags=["Category Management"],
        summary="Partially edit or deactivate a category (ADMIN only)",
        request=CategoryWriteSerializer,
        responses=CategoryWriteSerializer,
    ),
    put=extend_schema(
        tags=["Category Management"],
        summary="Replace editable category fields (ADMIN only)",
        request=CategoryWriteSerializer,
        responses=CategoryWriteSerializer,
    ),
)
class CategoryManageDetailView(RetrieveUpdateAPIView):
    permission_classes = [IsAuthenticated, IsCategoryManager]
    lookup_field = "category_id"
    lookup_url_kwarg = "category_id"

    def get_serializer_class(self):
        return TaskCategorySerializer if self.request.method == "GET" else CategoryWriteSerializer

    def get_queryset(self):
        return TaskCategory.objects.select_related("parent_category")

    @transaction.atomic
    def patch(self, request, *args, **kwargs):
        return super().patch(request, *args, **kwargs)

    @transaction.atomic
    def put(self, request, *args, **kwargs):
        return super().put(request, *args, **kwargs)
