"""Public executor workspace API contracts."""
from rest_framework import serializers


class TaskStartResponseSerializer(serializers.Serializer):
    task_id = serializers.UUIDField(read_only=True)
    status = serializers.CharField(read_only=True)
    version = serializers.IntegerField(read_only=True)


class TaskEmployerSummarySerializer(serializers.Serializer):
    user_id = serializers.UUIDField()
    full_name = serializers.CharField(allow_blank=True)
    avatar_type = serializers.CharField(allow_null=True)
    avatar_id = serializers.CharField(allow_null=True)
    avatar_url = serializers.CharField(allow_null=True)
    completed_tasks_count = serializers.IntegerField()
    average_rating = serializers.FloatField(allow_null=True)


class TaskRequirementSerializer(serializers.Serializer):
    skill_id = serializers.UUIDField()
    skill_name = serializers.CharField()
    importance = serializers.IntegerField()
    source = serializers.CharField()


class TaskAreaSerializer(serializers.Serializer):
    task_location_id = serializers.UUIDField()
    location_type = serializers.CharField()
    stop_order = serializers.IntegerField()
    city = serializers.CharField()
    region = serializers.CharField()


class ExecutorTaskCardSerializer(serializers.Serializer):
    task_id = serializers.UUIDField()
    title = serializers.CharField()
    description = serializers.CharField()
    category_id = serializers.UUIDField()
    category_name = serializers.CharField()
    status = serializers.CharField()
    accepted_bid_id = serializers.UUIDField()
    agreed_wage_amount = serializers.IntegerField()
    currency_code = serializers.CharField()
    proposed_duration_minutes = serializers.IntegerField()
    assigned_at = serializers.DateTimeField(allow_null=True)
    started_at = serializers.DateTimeField(allow_null=True)
    execution_window_start_at = serializers.DateTimeField()
    execution_window_end_at = serializers.DateTimeField()
    due_at = serializers.DateTimeField(allow_null=True)
    remaining_seconds = serializers.IntegerField(allow_null=True)
    server_time = serializers.DateTimeField()
    progress_percent = serializers.IntegerField()
    reports_count = serializers.IntegerField()
    escrow_verified = serializers.BooleanField()
    secured_amount = serializers.IntegerField(allow_null=True)
    net_worker_amount = serializers.IntegerField(allow_null=True)
    platform_fee_amount = serializers.IntegerField(allow_null=True)
    can_start = serializers.BooleanField()
    can_report_progress = serializers.BooleanField()
    can_submit_delivery = serializers.BooleanField()
    can_view_private_details = serializers.BooleanField()


class ExecutorTaskDetailSerializer(ExecutorTaskCardSerializer):
    employer = TaskEmployerSummarySerializer()
    delivery_criteria = serializers.CharField()
    item_cost_cap_amount = serializers.IntegerField(allow_null=True)
    receipt_required = serializers.BooleanField()
    required_skills = TaskRequirementSerializer(many=True)
    locations = TaskAreaSerializer(many=True)
    version = serializers.IntegerField()


class ExecutorTaskListResponseSerializer(serializers.Serializer):
    count = serializers.IntegerField()
    next = serializers.URLField(allow_null=True)
    previous = serializers.URLField(allow_null=True)
    results = ExecutorTaskCardSerializer(many=True)
