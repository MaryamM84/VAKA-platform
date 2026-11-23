
from django.utils import timezone
from rest_framework import serializers

from tasks.models import Task
from .models import Bid, BidStatus
from tasks.choices import TaskStatus


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


class BidDecisionResponseSerializer(serializers.Serializer):

    bid_id = serializers.UUIDField(read_only=True)

    task_id = serializers.UUIDField(read_only=True)

    status = serializers.ChoiceField(
        choices=BidStatus.choices,
        read_only=True,
    )

    task_status = serializers.ChoiceField(
        choices=TaskStatus.choices,
        read_only=True,
    )

    updated_at = serializers.DateTimeField(read_only=True)

class AssignmentPreviewLocationSerializer(serializers.Serializer):
    location_type = serializers.CharField()
    stop_order = serializers.IntegerField()
    city = serializers.CharField()
    region = serializers.CharField()


class AssignmentPreviewTaskSerializer(serializers.Serializer):
    task_id = serializers.UUIDField()
    title = serializers.CharField()
    description = serializers.CharField()
    category_name = serializers.CharField()
    status = serializers.CharField()
    currency_code = serializers.CharField()
    receipt_required = serializers.BooleanField()
    execution_window_start_at = serializers.DateTimeField()
    execution_window_end_at = serializers.DateTimeField()
    deadline_at = serializers.DateTimeField(allow_null=True)
    delivery_criteria = serializers.CharField()
    locations = AssignmentPreviewLocationSerializer(many=True)


class AssignmentPreviewBidSerializer(serializers.Serializer):
    bid_id = serializers.UUIDField()
    status = serializers.ChoiceField(choices=BidStatus.choices)
    proposed_wage_amount = serializers.IntegerField()
    proposed_duration_minutes = serializers.IntegerField()
    message = serializers.CharField()
    expires_at = serializers.DateTimeField(allow_null=True)


class AssignmentPreviewExecutorSerializer(serializers.Serializer):
    profile_id = serializers.UUIDField()
    full_name = serializers.CharField(allow_blank=True)
    avatar_type = serializers.CharField(allow_null=True)
    avatar_id = serializers.CharField(allow_null=True)
    avatar_url = serializers.URLField(allow_null=True)
    bio = serializers.CharField(allow_null=True)
    verification_status = serializers.CharField()
    completed_tasks_count = serializers.IntegerField()
    active_tasks_count = serializers.IntegerField()
    average_rating = serializers.FloatField(allow_null=True)
    rating_count = serializers.IntegerField(allow_null=True)


class AssignmentPreviewReservationSerializer(serializers.Serializer):
    labor_amount = serializers.IntegerField()
    expense_amount = serializers.IntegerField()
    reserved_amount = serializers.IntegerField()
    currency_code = serializers.CharField()
    platform_fee_rate_bps = serializers.IntegerField()
    platform_fee_amount = serializers.IntegerField()
    fee_payer = serializers.CharField()
    fee_included_in_reserved_amount = serializers.BooleanField()


class AssignmentPreviewWalletSerializer(serializers.Serializer):
    wallet_id = serializers.UUIDField(allow_null=True)
    currency_code = serializers.CharField()
    total_balance = serializers.IntegerField()
    available_balance = serializers.IntegerField()
    reserved_balance = serializers.IntegerField()
    required_reservation_amount = serializers.IntegerField()
    shortfall_amount = serializers.IntegerField()
    has_sufficient_balance = serializers.BooleanField()
    currency_matches = serializers.BooleanField()
    available_balance_after_reservation = serializers.IntegerField(allow_null=True)
    reserved_balance_after_reservation = serializers.IntegerField(allow_null=True)


class BidAssignmentPreviewSerializer(serializers.Serializer):
    task = AssignmentPreviewTaskSerializer()
    bid = AssignmentPreviewBidSerializer()
    executor = AssignmentPreviewExecutorSerializer()
    reservation_preview = AssignmentPreviewReservationSerializer()
    wallet = AssignmentPreviewWalletSerializer()
    can_confirm = serializers.BooleanField()
    blocking_reason = serializers.CharField(allow_null=True)


class BidAssignmentResponseSerializer(BidDecisionResponseSerializer):
    escrow_reservation_id = serializers.UUIDField(read_only=True)
    escrow_public_reference = serializers.CharField(read_only=True)
    escrow_status = serializers.CharField(read_only=True)
    task_title = serializers.CharField(read_only=True)
    executor_name = serializers.CharField(read_only=True, allow_blank=True)
    reserved_amount = serializers.IntegerField(read_only=True)
    labor_amount = serializers.IntegerField(read_only=True)
    expense_amount = serializers.IntegerField(read_only=True)
    currency_code = serializers.CharField(read_only=True)
    platform_fee_rate_bps = serializers.IntegerField(read_only=True)
    platform_fee_amount = serializers.IntegerField(read_only=True)
    fee_payer = serializers.CharField(read_only=True)
    fee_included_in_reserved_amount = serializers.BooleanField(read_only=True)
    wallet_total_balance = serializers.IntegerField(read_only=True)
    available_balance_after_reservation = serializers.IntegerField(read_only=True)
    reserved_balance_after_reservation = serializers.IntegerField(read_only=True)
