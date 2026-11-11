from rest_framework import serializers

from tasks.models import TaskCategory
from .models import ExecutorProfile


class PreferredCategoryReadSerializer(serializers.ModelSerializer):

    class Meta:
        model = TaskCategory
        fields = [
            "category_id",
            "name",
            "description",
        ]


class WorkerPreferencesReadSerializer(serializers.ModelSerializer):

    preferred_categories = PreferredCategoryReadSerializer(
        many=True,
        read_only=True,
    )

    class Meta:
        model = ExecutorProfile
        fields = [
            "work_interests",
            "preferred_categories",
        ]


class WorkerPreferencesUpdateSerializer(serializers.Serializer):

    work_interests = serializers.ListField(
        child=serializers.CharField(
            max_length=100,
            allow_blank=False,
            trim_whitespace=True,
        ),
        required=False,
        allow_empty=True,
        max_length=30,
    )

    preferred_category_ids = serializers.ListField(
        child=serializers.UUIDField(),
        required=False,
        allow_empty=True,
        max_length=50,
    )

    def to_internal_value(self, data):

        allowed_fields = {
            "work_interests",
            "preferred_category_ids",
        }

        if hasattr(data, "keys"):

            unsupported = set(data.keys()) - allowed_fields

            if unsupported:
                raise serializers.ValidationError({
                    field: ["This field cannot be updated."]
                    for field in unsupported
                })

        return super().to_internal_value(data)

    def validate_work_interests(self, value):

        normalized = [
            interest.strip()
            for interest in value
        ]

        normalized_values = [
            interest.casefold()
            for interest in normalized
        ]

        if len(normalized_values) != len(set(normalized_values)):
            raise serializers.ValidationError(
                "Duplicate work interests are not allowed."
            )

        return normalized

    def validate_preferred_category_ids(self, value):

        if len(value) != len(set(value)):
            raise serializers.ValidationError(
                "Duplicate categories are not allowed."
            )

        categories = TaskCategory.objects.filter(
            category_id__in=value,
            is_active=True,
        )

        category_map = {
            category.category_id: category
            for category in categories
        }

        missing_categories = [
            str(category_id)
            for category_id in value
            if category_id not in category_map
        ]

        if missing_categories:
            raise serializers.ValidationError(
                "One or more categories do not exist or are inactive."
            )

        return [
            category_map[category_id]
            for category_id in value
        ]

    def validate(self, attrs):

        if not attrs:
            raise serializers.ValidationError({
                "non_field_errors": [
                    "At least one preference field must be provided."
                ]
            })

        return attrs