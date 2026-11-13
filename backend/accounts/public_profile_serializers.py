from rest_framework import serializers

from .profile_metrics import get_executor_profile_metrics

from .profile_avatar_serializers import (
    get_avatar_id,
    get_avatar_type,
    get_avatar_url,
)


class PublicWorkerSkillSerializer(serializers.Serializer):
    skill_id = serializers.UUIDField(read_only=True)
    name = serializers.CharField(source="skill.name", read_only=True)
    proficiency_level = serializers.CharField(read_only=True)
    experience_years = serializers.IntegerField(read_only=True)


class PublicWorkerProfileSerializer(serializers.Serializer):
    profile_id = serializers.UUIDField(source="executor_profile_id", read_only=True)
    full_name = serializers.CharField(source="user.full_name", read_only=True)
    avatar_key = serializers.CharField(
        source="user.avatar_key", read_only=True, allow_null=True
    )
    avatar_type = serializers.SerializerMethodField()
    avatar_id = serializers.SerializerMethodField()
    avatar_url = serializers.SerializerMethodField()
    bio = serializers.CharField(allow_null=True, read_only=True)
    skills = PublicWorkerSkillSerializer(
        source="worker_skills", many=True, read_only=True
    )
    province = serializers.CharField(
        source="service_area_region", read_only=True, allow_blank=True
    )
    city = serializers.CharField(
        source="service_area_city", read_only=True, allow_blank=True
    )
    verification_status = serializers.CharField(read_only=True)
    completed_tasks_count = serializers.SerializerMethodField()
    active_tasks_count = serializers.SerializerMethodField()
    average_rating = serializers.SerializerMethodField()
    rating_count = serializers.SerializerMethodField()

    def get_avatar_type(self, profile):
        return get_avatar_type(profile.user)

    def get_avatar_id(self, profile):
        return get_avatar_id(profile.user)

    def get_avatar_url(self, profile):
        return get_avatar_url(profile.user, self.context.get("request"))

    def _metrics(self, profile):
        if not hasattr(self, "_profile_metrics_cache"):
            self._profile_metrics_cache = get_executor_profile_metrics(
                profile=profile
            )
        return self._profile_metrics_cache

    def get_completed_tasks_count(self, profile):
        return self._metrics(profile)["completed_tasks_count"]

    def get_active_tasks_count(self, profile):
        return self._metrics(profile)["active_tasks_count"]

    def get_average_rating(self, profile):
        return self._metrics(profile)["average_rating"]

    def get_rating_count(self, profile):
        return self._metrics(profile)["rating_count"]
