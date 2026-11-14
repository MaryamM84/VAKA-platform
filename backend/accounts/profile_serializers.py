from django.db import transaction
from rest_framework import serializers
from drf_spectacular.utils import extend_schema_field
from django.utils import timezone
from .models import User, ExecutorProfile
from .profile_metrics import get_executor_profile_metrics
from .profile_avatar_serializers import (
    get_avatar_id,
    get_avatar_type,
    get_avatar_url,
)


@extend_schema_field(
    serializers.CharField(
        allow_null=True,
        allow_blank=True,
        max_length=5000,
    )
)
class ExecutorBioField(serializers.Field):

    default_error_messages = {
        "invalid": "Bio must be a text value.",
        "max_length": "Bio cannot exceed 5000 characters.",
    }

    def get_attribute(self, instance):
        return instance

    def to_representation(self, user):
        profile = getattr(user, "executor_profile", None)

        if profile is None:
            return None

        return profile.bio

    def to_internal_value(self, data):
        if data is None:
            return {"bio": None}

        if not isinstance(data, str):
            self.fail("invalid")

        value = data.strip()

        if len(value) > 5000:
            self.fail("max_length")

        return {"bio": value}


class MyProfileSerializer(serializers.Serializer):

    user_id = serializers.UUIDField(read_only=True)
    phone = serializers.CharField(read_only=True)

    full_name = serializers.CharField(
        max_length=160,
        required=False,
        allow_blank=True,
    )

    email = serializers.EmailField(
        required=False,
        allow_null=True,
        allow_blank=True,
    )

    birth_date = serializers.DateField(
        required=False,
        allow_null=True,
    )

    province_id = serializers.CharField(
        required=False,
        allow_null=True,
        allow_blank=True,
        max_length=64,
    )

    city_id = serializers.CharField(
        required=False,
        allow_null=True,
        allow_blank=True,
        max_length=64,
    )

    avatar_key = serializers.CharField(
        read_only=True,
        allow_null=True,
    )
    avatar_type = serializers.SerializerMethodField()
    avatar_id = serializers.SerializerMethodField()
    avatar_url = serializers.SerializerMethodField()

    completed_tasks_count = serializers.SerializerMethodField()
    active_tasks_count = serializers.SerializerMethodField()
    average_rating = serializers.SerializerMethodField()
    rating_count = serializers.SerializerMethodField()

    bio = ExecutorBioField(
        source="*",
        required=False,
    )

    verification_status = serializers.SerializerMethodField()

    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)

    def to_internal_value(self, data):

        allowed_fields = {
            "full_name",
            "email",
            "bio",
            "birth_date",
            "province_id",
            "city_id",
        }

        if hasattr(data, "keys"):
            unsupported_fields = set(data.keys()) - allowed_fields

            if unsupported_fields:
                raise serializers.ValidationError({
                    field: "This field cannot be updated."
                    for field in unsupported_fields
                })

        return super().to_internal_value(data)

    def validate_full_name(self, value):
        return value.strip()

    def validate_email(self, value):

        if value is None or not value.strip():
            return None

        value = value.strip()

        queryset = User.objects.filter(email__iexact=value)

        if self.instance is not None:
            queryset = queryset.exclude(pk=self.instance.pk)

        if queryset.exists():
            raise serializers.ValidationError(
                "This email address is already in use."
            )

        return value

    def validate_birth_date(self, value):
        if value is not None and value > timezone.localdate():
            raise serializers.ValidationError(
                "Birth date cannot be in the future."
            )

        return value

    def validate_province_id(self, value):
        if value is None:
            return None

        return value.strip() or None

    def validate_city_id(self, value):
        if value is None:
            return None

        return value.strip() or None

    def validate(self, attrs):
        province_id = attrs.get(
            "province_id",
            getattr(self.instance, "province_id", None),
        )

        city_id = attrs.get(
            "city_id",
            getattr(self.instance, "city_id", None),
        )

        if (
            "city_id" in attrs
            and city_id is not None
            and province_id is None
        ):
            raise serializers.ValidationError({
                "city_id": (
                    "A province must be selected before a city."
                )
            })

        return attrs

    def get_avatar_type(self, user):
        return get_avatar_type(user)

    def get_avatar_id(self, user):
        return get_avatar_id(user)

    def get_avatar_url(self, user):
        return get_avatar_url(user, self.context.get("request"))

    def _profile_metrics(self, user):
        if not hasattr(self, "_profile_metrics_cache"):
            profile = getattr(user, "executor_profile", None)
            self._profile_metrics_cache = get_executor_profile_metrics(
                profile=profile
            )
        return self._profile_metrics_cache

    def get_completed_tasks_count(self, user):
        return self._profile_metrics(user)["completed_tasks_count"]

    def get_active_tasks_count(self, user):
        return self._profile_metrics(user)["active_tasks_count"]

    def get_average_rating(self, user):
        return self._profile_metrics(user)["average_rating"]

    def get_rating_count(self, user):
        return self._profile_metrics(user)["rating_count"]

    def get_verification_status(self, user):

        profile = getattr(user, "executor_profile", None)

        if profile is None:
            return ExecutorProfile.VerificationStatus.NOT_SUBMITTED

        return profile.verification_status

    @transaction.atomic
    def update(self, instance, validated_data):

        bio = validated_data.pop("bio", serializers.empty)

        if (
            "province_id" in validated_data
            and validated_data["province_id"] != instance.province_id
            and "city_id" not in validated_data
        ):
            validated_data["city_id"] = None

        changed_fields = []

        for field, value in validated_data.items():
            setattr(instance, field, value)
            changed_fields.append(field)

        if changed_fields:
            changed_fields.append("updated_at")
            instance.save(update_fields=changed_fields)

        if bio is not serializers.empty:

            profile, created = ExecutorProfile.objects.get_or_create(
                user=instance,
            )

            if profile.bio != bio:
                profile.bio = bio
                profile.save(
                    update_fields=["bio", "updated_at"]
                )

        return instance