"""API contracts for execution endpoints."""
from rest_framework import serializers


class TaskStartResponseSerializer(serializers.Serializer):
    task_id = serializers.UUIDField(read_only=True)
    status = serializers.CharField(read_only=True)
    version = serializers.IntegerField(read_only=True)
