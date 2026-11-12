from rest_framework import serializers

from .models import WorkerServiceNeighborhood


class WorkerServiceNeighborhoodReadSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkerServiceNeighborhood
        fields = ["neighborhood_id", "name"]
        read_only_fields = fields


class WorkerServiceNeighborhoodCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=120, trim_whitespace=True)

    def to_internal_value(self, data):
        if hasattr(data, "keys"):
            extra = set(data.keys()) - {"name"}
            if extra:
                raise serializers.ValidationError({
                    field: ["This field is not accepted."]
                    for field in extra
                })
        return super().to_internal_value(data)
