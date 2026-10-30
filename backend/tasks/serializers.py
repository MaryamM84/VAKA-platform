"""Serializers for task creation, task listing, categories, and skills."""

from rest_framework import serializers

from .models import (
    Skill,
    Task,
    TaskCategory,
    TaskRequiredSkill,
)
from .services import create_task_draft


BIGINT_MAX = 2**63 - 1
SMALLINT_MIN = -(2**15)
SMALLINT_MAX = (2**15) - 1


class RejectUnexpectedFieldsMixin:
    """Reject fields that are read-only or not explicitly supported by an API."""

    def to_internal_value(self, data):
        if not hasattr(data, "keys"):
            raise serializers.ValidationError("Expected a JSON object.")

        allowed_fields = {
            name
            for name, field in self.fields.items()
            if not field.read_only
        }
        unexpected_fields = set(data.keys()) - allowed_fields

        if unexpected_fields:
            raise serializers.ValidationError(
                {
                    field_name: ["This field is not accepted by this endpoint."]
                    for field_name in sorted(unexpected_fields)
                }
            )

        return super().to_internal_value(data)


class TaskCategorySerializer(serializers.ModelSerializer):
    """Read-only representation of a task category."""

    parent_category_id = serializers.UUIDField(read_only=True, allow_null=True)
    parent_category_name = serializers.CharField(
        source="parent_category.name",
        read_only=True,
        allow_null=True,
    )

    class Meta:
        model = TaskCategory
        fields = [
            "category_id",
            "name",
            "description",
            "parent_category_id",
            "parent_category_name",
        ]


class SkillSerializer(serializers.ModelSerializer):
    """Read-only representation of a skill."""

    category_id = serializers.UUIDField(read_only=True, allow_null=True)
    category_name = serializers.CharField(
        source="category.name",
        read_only=True,
        allow_null=True,
    )

    class Meta:
        model = Skill
        fields = [
            "skill_id",
            "name",
            "description",
            "category_id",
            "category_name",
        ]


class RequiredSkillInputSerializer(
    RejectUnexpectedFieldsMixin,
    serializers.Serializer,
):
    """Input format for a skill required by a new task."""

    skill_id = serializers.PrimaryKeyRelatedField(
        source="skill",
        queryset=Skill.objects.select_related("category").all(),
    )
    # The FS/ERD defines this as SMALLINT but does not define a business scale.
    # Validate the database range without inventing a 1-to-5 scale.
    importance = serializers.IntegerField(
        min_value=SMALLINT_MIN,
        max_value=SMALLINT_MAX,
    )


class TaskCreateSerializer(
    RejectUnexpectedFieldsMixin,
    serializers.ModelSerializer,
):
    """Create a task draft. Ownership and initial status are server-controlled."""

    task_id = serializers.UUIDField(read_only=True)
    employer_user_id = serializers.UUIDField(read_only=True)

    category_id = serializers.PrimaryKeyRelatedField(
        source="category",
        queryset=TaskCategory.objects.filter(is_active=True),
    )
    category_name = serializers.CharField(
        source="category.name",
        read_only=True,
    )

    status = serializers.CharField(read_only=True)
    currency_code = serializers.CharField(read_only=True)

    estimated_duration_minutes = serializers.IntegerField(
        min_value=1,
        max_value=300,
    )
    wage_budget_amount = serializers.IntegerField(
        min_value=0,
        max_value=BIGINT_MAX,
    )
    item_cost_cap_amount = serializers.IntegerField(
        min_value=0,
        max_value=BIGINT_MAX,
        required=False,
        allow_null=True,
    )

    receipt_required = serializers.BooleanField(required=False, default=False)
    deadline_at = serializers.DateTimeField(required=False, allow_null=True)

    required_skills = RequiredSkillInputSerializer(
        many=True,
        required=False,
        write_only=True,
    )

    class Meta:
        model = Task
        fields = [
            "task_id",
            "employer_user_id",
            "category_id",
            "category_name",
            "title",
            "description",
            "status",
            "estimated_duration_minutes",
            "wage_budget_amount",
            "currency_code",
            "item_cost_cap_amount",
            "receipt_required",
            "execution_window_start_at",
            "execution_window_end_at",
            "deadline_at",
            "proposal_deadline_at",
            "delivery_criteria",
            "required_skills",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "task_id",
            "employer_user_id",
            "category_name",
            "status",
            "currency_code",
            "created_at",
            "updated_at",
        ]

    def validate_required_skills(self, values):
        skill_ids = [row["skill"].pk for row in values]

        if len(skill_ids) != len(set(skill_ids)):
            raise serializers.ValidationError(
                "A skill cannot appear more than once for the same task."
            )

        return values

    def validate(self, attrs):
        start_at = attrs["execution_window_start_at"]
        end_at = attrs["execution_window_end_at"]

        if end_at <= start_at:
            raise serializers.ValidationError(
                {
                    "execution_window_end_at": [
                        "Execution end must be later than execution start."
                    ]
                }
            )

        category = attrs["category"]
        required_skills = attrs.get("required_skills", [])

        for row in required_skills:
            skill = row["skill"]
            if skill.category_id is not None and skill.category_id != category.pk:
                raise serializers.ValidationError(
                    {
                        "required_skills": [
                            f"Skill '{skill.name}' does not belong to the selected category."
                        ]
                    }
                )

        return attrs

    def create(self, validated_data):
        employer = validated_data.pop("employer_user", None)

        if employer is None:
            request = self.context.get("request")
            employer = getattr(request, "user", None)

        if employer is None or not employer.is_authenticated:
            raise serializers.ValidationError(
                {"employer_user": "An authenticated employer is required."}
            )

        return create_task_draft(
            employer=employer,
            data=validated_data,
        )


class TaskRequiredSkillReadSerializer(serializers.ModelSerializer):
    """Read-only skill information attached to a task."""

    skill_id = serializers.UUIDField(read_only=True)
    skill_name = serializers.CharField(source="skill.name", read_only=True)

    class Meta:
        model = TaskRequiredSkill
        fields = [
            "skill_id",
            "skill_name",
            "importance",
            "source",
        ]


class TaskReadSerializer(serializers.ModelSerializer):
    """Representation returned when an employer lists their own tasks."""

    employer_user_id = serializers.UUIDField(read_only=True)
    category_id = serializers.UUIDField(read_only=True)
    category_name = serializers.CharField(source="category.name", read_only=True)
    required_skills = TaskRequiredSkillReadSerializer(many=True, read_only=True)

    class Meta:
        model = Task
        fields = [
            "task_id",
            "employer_user_id",
            "category_id",
            "category_name",
            "title",
            "description",
            "status",
            "estimated_duration_minutes",
            "wage_budget_amount",
            "currency_code",
            "item_cost_cap_amount",
            "receipt_required",
            "execution_window_start_at",
            "execution_window_end_at",
            "deadline_at",
            "proposal_deadline_at",
            "delivery_criteria",
            "required_skills",
            "published_at",
            "created_at",
            "updated_at",
        ]
