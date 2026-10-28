"""Validation and representation of the first-phase task draft API."""
from rest_framework import serializers

from .models import Skill, Task, TaskCategory
from .services import create_task_draft


BIGINT_MAX = 2**63 - 1


class RejectUnexpectedFieldsMixin:
    """Avoid silently accepting client-controlled or not-yet-supported fields."""

    def to_internal_value(self, data):
        if not hasattr(data, "keys"):
            raise serializers.ValidationError("Expected a JSON object.")
        allowed = {
            name for name, field in self.fields.items() if not field.read_only
        }
        unexpected = set(data.keys()) - allowed
        if unexpected:
            raise serializers.ValidationError({
                name: ["This field is not accepted by this endpoint."]
                for name in sorted(unexpected)
            })
        return super().to_internal_value(data)


class RequiredSkillInputSerializer(RejectUnexpectedFieldsMixin, serializers.Serializer):
    skill_id = serializers.PrimaryKeyRelatedField(
        source="skill", queryset=Skill.objects.all()
    )
    # The ERD specifies SMALLINT and does not specify an importance scale.
    importance = serializers.IntegerField(min_value=-32768, max_value=32767)


class TaskCreateSerializer(RejectUnexpectedFieldsMixin, serializers.ModelSerializer):
    task_id = serializers.UUIDField(read_only=True)
    employer_user_id = serializers.UUIDField(read_only=True)
    category_id = serializers.PrimaryKeyRelatedField(
        source="category", queryset=TaskCategory.objects.filter(is_active=True)
    )
    status = serializers.CharField(read_only=True)
    currency_code = serializers.CharField(read_only=True)
    estimated_duration_minutes = serializers.IntegerField(min_value=1, max_value=300)
    wage_budget_amount = serializers.IntegerField(min_value=0, max_value=BIGINT_MAX)
    item_cost_cap_amount = serializers.IntegerField(
        min_value=0, max_value=BIGINT_MAX, required=False, allow_null=True
    )
    receipt_required = serializers.BooleanField(required=False, default=False)
    deadline_at = serializers.DateTimeField(required=False, allow_null=True)
    required_skills = RequiredSkillInputSerializer(
        many=True, required=False, write_only=True
    )

    class Meta:
        model = Task
        fields = [
            "task_id",
            "employer_user_id",
            "category_id",
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
        read_only_fields = ["created_at", "updated_at"]

    def validate_required_skills(self, values):
        ids = [row["skill"].pk for row in values]
        if len(ids) != len(set(ids)):
            raise serializers.ValidationError(
                "A skill cannot appear more than once for the same task."
            )
        return values

    def validate(self, attrs):
        start = attrs["execution_window_start_at"]
        end = attrs["execution_window_end_at"]
        if end <= start:
            raise serializers.ValidationError({
                "execution_window_end_at": [
                    "Execution end must be later than execution start."
                ]
            })
        return attrs

    def create(self, validated_data):
        employer = validated_data.pop("employer_user")
        return create_task_draft(employer=employer, data=validated_data)
