from decimal import Decimal

from rest_framework import serializers


class WorkerServiceAreaSerializer(serializers.Serializer):

    service_area_city = serializers.CharField(
        max_length=100,
        required=False,
        allow_blank=True,
        trim_whitespace=True,
    )

    service_area_region = serializers.CharField(
        max_length=120,
        required=False,
        allow_blank=True,
        trim_whitespace=True,
    )

    service_area_latitude = serializers.DecimalField(
        max_digits=9,
        decimal_places=6,
        min_value=Decimal("-90"),
        max_value=Decimal("90"),
        required=False,
        allow_null=True,
    )

    service_area_longitude = serializers.DecimalField(
        max_digits=9,
        decimal_places=6,
        min_value=Decimal("-180"),
        max_value=Decimal("180"),
        required=False,
        allow_null=True,
    )

    service_area_radius_km = serializers.IntegerField(
        min_value=1,
        max_value=32767,
        required=False,
        allow_null=True,
    )

    covers_entire_city = serializers.BooleanField(required=False)

    def to_internal_value(self, data):

        allowed_fields = set(self.fields.keys())

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
                        "At least one service area field must be provided."
                    ]
                })

        return super().to_internal_value(data)

    def validate(self, attrs):

        instance = self.instance

        latitude = attrs.get(
            "service_area_latitude",
            getattr(instance, "service_area_latitude", None),
        )

        longitude = attrs.get(
            "service_area_longitude",
            getattr(instance, "service_area_longitude", None),
        )

        radius = attrs.get(
            "service_area_radius_km",
            getattr(instance, "service_area_radius_km", None),
        )

        values = [latitude, longitude, radius]

        if any(value is not None for value in values):
            if not all(value is not None for value in values):
                raise serializers.ValidationError({
                    "service_area_latitude": [
                        "Latitude, longitude and radius must be provided together."
                    ]
                })

        city = attrs.get(
            "service_area_city",
            getattr(instance, "service_area_city", ""),
        )
        covers_entire_city = attrs.get(
            "covers_entire_city",
            getattr(instance, "covers_entire_city", False),
        )

        if covers_entire_city and not city.strip():
            raise serializers.ValidationError({
                "service_area_city": [
                    "Select a city before enabling entire-city coverage."
                ]
            })

        return attrs
