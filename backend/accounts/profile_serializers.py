from django.db import transaction
from rest_framework import serializers
from drf_spectacular.utils import extend_schema_field

from .models import User, ExecutorProfile


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

    avatar_key = serializers.CharField(
        read_only=True,
        allow_null=True,
    )

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

    def get_verification_status(self, user):

        profile = getattr(user, "executor_profile", None)

        if profile is None:
            return ExecutorProfile.VerificationStatus.NOT_SUBMITTED

        return profile.verification_status

    @transaction.atomic
    def update(self, instance, validated_data):

        bio = validated_data.pop("bio", serializers.empty)

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