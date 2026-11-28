"""Safe, paginated executor directory for platform administrators."""
from rest_framework import serializers

from .models import ExecutorProfile


class AdminExecutorListSerializer(serializers.ModelSerializer):
    user_id = serializers.UUIDField(source="user.user_id", read_only=True)
    full_name = serializers.CharField(source="user.full_name", read_only=True)
    phone = serializers.CharField(source="user.phone", read_only=True)
    email = serializers.EmailField(source="user.email", read_only=True, allow_null=True)
    account_status = serializers.CharField(source="user.account_status", read_only=True)
    completed_tasks_count = serializers.IntegerField(read_only=True)
    active_tasks_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = ExecutorProfile
        fields = [
            "executor_profile_id", "user_id", "full_name", "phone", "email",
            "account_status", "profile_status", "verification_status",
            "service_area_city", "service_area_region", "approved_at",
            "completed_tasks_count", "active_tasks_count",
        ]
        read_only_fields = fields


class AdminExecutorListResponseSerializer(serializers.Serializer):
    count = serializers.IntegerField()
    next = serializers.URLField(allow_null=True)
    previous = serializers.URLField(allow_null=True)
    results = AdminExecutorListSerializer(many=True)
