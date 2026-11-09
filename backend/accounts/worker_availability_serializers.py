from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from rest_framework import serializers

from .models import WorkerAvailability


class WorkerAvailabilityReadSerializer(serializers.ModelSerializer):

    class Meta:
        model = WorkerAvailability
        fields = [
            "availability_id",
            "weekday",
            "start_time",
            "end_time",
            "created_at",
            "updated_at",
        ]

        read_only_fields = fields


class WorkerAvailabilityWriteSerializer(serializers.Serializer):

    weekday = serializers.ChoiceField(
        choices=WorkerAvailability.Weekday.choices,
    )

    start_time = serializers.TimeField()

    end_time = serializers.TimeField()

    def to_internal_value(self, data):

        allowed_fields = {
            "weekday",
            "start_time",
            "end_time",
        }

        if hasattr(data, "keys"):

            unsupported = set(data.keys()) - allowed_fields

            if unsupported:
                raise serializers.ValidationError({
                    field: ["This field cannot be updated."]
                    for field in unsupported
                })

            if not data:
                raise serializers.ValidationError({
                    "non_field_errors": [
                        "At least one availability field must be provided."
                    ]
                })

        return super().to_internal_value(data)

    def validate(self, attrs):

        instance = self.instance

        start_time = attrs.get(
            "start_time",
            getattr(instance, "start_time", None),
        )

        end_time = attrs.get(
            "end_time",
            getattr(instance, "end_time", None),
        )

        if start_time is not None and end_time is not None:

            if start_time >= end_time:
                raise serializers.ValidationError({
                    "end_time": [
                        "End time must be later than start time."
                    ]
                })

        return attrs


class WorkerAvailabilityTimezoneSerializer(serializers.Serializer):

    availability_timezone = serializers.CharField(
        max_length=64,
        required=False,
        trim_whitespace=True,
    )

    def to_internal_value(self, data):

        if hasattr(data, "keys"):

            unsupported = (
                set(data.keys()) - {"availability_timezone"}
            )

            if unsupported:
                raise serializers.ValidationError({
                    field: ["This field cannot be updated here."]
                    for field in unsupported
                })

            if not data:
                raise serializers.ValidationError({
                    "non_field_errors": [
                        "Timezone must be provided."
                    ]
                })

        return super().to_internal_value(data)

    def validate_availability_timezone(self, value):

        if not value:
            raise serializers.ValidationError(
                "Timezone cannot be empty."
            )

        if value == "UTC":
            return value

        try:
            ZoneInfo(value)

        except ZoneInfoNotFoundError:
            raise serializers.ValidationError(
                "Enter a valid IANA timezone, such as Europe/Berlin or Asia/Tehran."
            )

        return value


class WorkerAvailabilityCollectionSerializer(serializers.Serializer):

    availability_timezone = serializers.CharField()

    slots = WorkerAvailabilityReadSerializer(
        many=True,
    )