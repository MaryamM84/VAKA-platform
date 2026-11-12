from rest_framework import serializers


class WorkerStatisticsSerializer(serializers.Serializer):
    average_rating = serializers.FloatField(allow_null=True)
    completed_tasks_count = serializers.IntegerField(min_value=0)
    received_offers_count = serializers.IntegerField(allow_null=True, min_value=0)
    submitted_bids_count = serializers.IntegerField(min_value=0)
    profile_completion_percent = serializers.IntegerField(min_value=0, max_value=100)
