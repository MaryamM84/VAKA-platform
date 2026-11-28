"""Employer-facing output contracts; avoid exposing worker identity documents."""
from rest_framework import serializers


class EmployerAssignedExecutorSerializer(serializers.Serializer):
    task_id = serializers.UUIDField()
    task_status = serializers.CharField()
    accepted_bid_id = serializers.UUIDField()
    executor_profile_id = serializers.UUIDField()
    user_id = serializers.UUIDField()
    full_name = serializers.CharField(allow_blank=True)
    bio = serializers.CharField(allow_blank=True, allow_null=True)
    avatar_type = serializers.CharField(allow_null=True)
    avatar_id = serializers.CharField(allow_null=True)
    avatar_url = serializers.CharField(allow_null=True)
    verification_status = serializers.CharField()
    service_area_city = serializers.CharField(allow_blank=True)
    service_area_region = serializers.CharField(allow_blank=True)
    completed_tasks_count = serializers.IntegerField()
    active_tasks_count = serializers.IntegerField()
    average_rating = serializers.FloatField(allow_null=True)
    rating_count = serializers.IntegerField(allow_null=True)
    can_view_phone = serializers.BooleanField()
    phone = serializers.CharField(allow_null=True)

