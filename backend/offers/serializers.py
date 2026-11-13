
from django.utils import timezone
from rest_framework import serializers

from tasks.models import Task
from .models import Bid


BIGINT_MAX = (2 ** 63) - 1


class RejectUnexpectedFieldsMixin:
    """
    Reject fields that are not explicitly declared
    by the serializer.
    """

    def to_internal_value(self, data):
        if not hasattr(data, "keys"):
            raise serializers.ValidationError(
                "Expected a JSON object."
            )

        allowed_fields = {
            name
            for name, field in self.fields.items()
            if not field.read_only
        }

        unexpected_fields = set(data.keys()) - allowed_fields

        if unexpected_fields:
            raise serializers.ValidationError({
                field_name: [
                    "This field is not accepted by this endpoint."
                ]
                for field_name in sorted(unexpected_fields)
            })

        return super().to_internal_value(data)


class BidSubmissionSerializer(
    RejectUnexpectedFieldsMixin,
    serializers.Serializer,
):
    task_id = serializers.PrimaryKeyRelatedField(
        source="task",
        queryset=Task.objects.all(),
    )

    proposed_wage_amount = serializers.IntegerField(
        min_value=0,
        max_value=BIGINT_MAX,
    )

    proposed_duration_minutes = serializers.IntegerField(
        min_value=1,
        max_value=300,
    )

    message = serializers.CharField(
        required=True,
        allow_blank=False,
        trim_whitespace=True,
    )

    expires_at = serializers.DateTimeField(
        required=False,
        allow_null=True,
    )

    def validate_expires_at(self, value):
        if value is not None and value <= timezone.now():
            raise serializers.ValidationError(
                "Expiration time must be in the future."
            )

        return value



class BidReadSerializer(serializers.ModelSerializer):

    task_id = serializers.UUIDField(read_only=True)
    task_title = serializers.CharField(source="task.title", read_only=True)
    employer_name = serializers.CharField(
        source="task.employer_user.full_name", read_only=True
    )
    task_currency_code = serializers.CharField(
        source="task.currency_code", read_only=True
    )

    executor_profile_id = serializers.UUIDField(read_only=True)

    class Meta:
        model = Bid

        fields = [
            "bid_id",
            "task_id",
            "task_title",
            "employer_name",
            "task_currency_code",
            "executor_profile_id",
            "proposed_wage_amount",
            "proposed_duration_minutes",
            "message",
            "expires_at",
            "status",
            "created_at",
            "updated_at",
        ]

        read_only_fields = fields


class BidUpdateSerializer(serializers.ModelSerializer):

    proposed_wage_amount = serializers.IntegerField(
        required=False,
        min_value=0,
        max_value=BIGINT_MAX,
    )

    proposed_duration_minutes = serializers.IntegerField(
        required=False,
        min_value=1,
        max_value=300,
    )

    message = serializers.CharField(
        required=False,
        allow_blank=False,
        trim_whitespace=True,
    )

    expires_at = serializers.DateTimeField(
        required=False,
        allow_null=True,
    )

    class Meta:
        model = Bid

        fields = [
            "proposed_wage_amount",
            "proposed_duration_minutes",
            "message",
            "expires_at",
        ]

    def validate(self, attrs):
        if not attrs:
            raise serializers.ValidationError(
                "At least one field must be provided for update."
            )

        return attrs

    def validate_expires_at(self, value):
        from django.utils import timezone

        if value is not None and value <= timezone.now():
            raise serializers.ValidationError(
                "Expiration time must be in the future."
            )

        return value
    
    def to_internal_value(self, data):
        allowed_fields = set(self.fields.keys())

        if hasattr(data, "keys"):
            submitted_fields = set(data.keys())
            unexpected_fields = submitted_fields - allowed_fields

            if unexpected_fields:
                raise serializers.ValidationError({
                    field: ["This field is not allowed."]
                    for field in sorted(unexpected_fields)
                })

        return super().to_internal_value(data)


class EmployerBidListSerializer(serializers.ModelSerializer):

    task_id = serializers.UUIDField(read_only=True)
    executor_profile_id = serializers.UUIDField(read_only=True)

    task_title = serializers.CharField(
        source="task.title",
        read_only=True,
    )

    task_currency_code = serializers.CharField(
        source="task.currency_code",
        read_only=True,
    )

    executor_name = serializers.CharField(
        source="executor_profile.user.full_name",
        read_only=True,
    )

    executor_bio = serializers.CharField(
        source="executor_profile.bio",
        read_only=True,
        allow_null=True,
    )

    executor_verification_status = serializers.CharField(
        source="executor_profile.verification_status",
        read_only=True,
    )

    class Meta:
        model = Bid

        fields = [
            "bid_id",
            "task_id",
            "task_title",
            "task_currency_code",
            "executor_profile_id",
            "executor_name",
            "executor_bio",
            "executor_verification_status",
            "proposed_wage_amount",
            "proposed_duration_minutes",
            "message",
            "expires_at",
            "status",
            "created_at",
        ]

        read_only_fields = fields


class EmployerBidDetailSerializer(EmployerBidListSerializer):

    task_description = serializers.CharField(
        source="task.description",
        read_only=True,
    )

    task_status = serializers.CharField(
        source="task.status",
        read_only=True,
    )

    task_wage_budget_amount = serializers.IntegerField(
        source="task.wage_budget_amount",
        read_only=True,
    )

    task_estimated_duration_minutes = serializers.IntegerField(
        source="task.estimated_duration_minutes",
        read_only=True,
    )

    task_execution_window_start_at = serializers.DateTimeField(
        source="task.execution_window_start_at",
        read_only=True,
    )

    task_execution_window_end_at = serializers.DateTimeField(
        source="task.execution_window_end_at",
        read_only=True,
    )

    task_proposal_deadline_at = serializers.DateTimeField(
        source="task.proposal_deadline_at",
        read_only=True,
    )

    task_delivery_criteria = serializers.CharField(
        source="task.delivery_criteria",
        read_only=True,
    )

    updated_at = serializers.DateTimeField(read_only=True)

    class Meta(EmployerBidListSerializer.Meta):
        fields = EmployerBidListSerializer.Meta.fields + [
            "task_description",
            "task_status",
            "task_wage_budget_amount",
            "task_estimated_duration_minutes",
            "task_execution_window_start_at",
            "task_execution_window_end_at",
            "task_proposal_deadline_at",
            "task_delivery_criteria",
            "updated_at",
        ]

        read_only_fields = fields


