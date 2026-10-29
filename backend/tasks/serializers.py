
import math

from rest_framework import serializers

from .models import Skill, Task, TaskCategory
from .services import create_task_draft


BIGINT_MAX = 2**63 - 1


class RejectUnexpectedFieldsMixin:
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
    importance = serializers.IntegerField(min_value=-32768, max_value=32767)


class LocationInputSerializer(RejectUnexpectedFieldsMixin, serializers.Serializer):
    location_type = serializers.CharField(max_length=20)
    stop_order = serializers.IntegerField(min_value=1, max_value=32767)
    city = serializers.CharField(max_length=100)
    region = serializers.CharField(max_length=120)
    latitude = serializers.FloatField(min_value=-90, max_value=90)
    longitude = serializers.FloatField(min_value=-180, max_value=180)

    def validate(self, attrs):
        for name in ("latitude", "longitude"):
            if not math.isfinite(attrs[name]):
                raise serializers.ValidationError({
                    name: "Must be a finite number."
                })
        return attrs


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
    locations = LocationInputSerializer(
        many=True, required=False, write_only=True
    )
    saved_locations = serializers.SerializerMethodField()

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
            "locations",
            "saved_locations",
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

    def validate_locations(self, values):
        orders = [item["stop_order"] for item in values]

        if len(orders) != len(set(orders)):
            raise serializers.ValidationError(
                "Each stop_order must be unique."
            )

        if sorted(orders) != list(range(1, len(orders) + 1)):
            raise serializers.ValidationError(
                "stop_order must start at 1 and be consecutive."
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

    def get_saved_locations(self, task):
        return [
            {
                "task_location_id": str(item.pk),
                "location_type": item.location_type,
                "stop_order": item.stop_order,
                "city": item.city,
                "region": item.region,
            }
            for item in task.locations.only(
                "task_location_id",
                "location_type",
                "stop_order",
                "city",
                "region",
            )
        ]
