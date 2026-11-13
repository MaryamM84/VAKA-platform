
from rest_framework import serializers
from drf_spectacular.utils import extend_schema_field

from .models import (
    User,
    ExecutorProfile,
)

from .worker_verification_services import identity_to_payload
from .worker_verification_serializers import (
    WorkerVerificationDocumentReadSerializer,
    WorkerVerificationIdentityReadSerializer,
)


class VerificationApplicantSerializer(serializers.ModelSerializer):

    class Meta:
        model = User
        fields = [
            "user_id",
            "phone",
            "full_name",
            "email",
        ]

        read_only_fields = fields


class AdminWorkerVerificationListSerializer(
    serializers.ModelSerializer
):

    applicant = VerificationApplicantSerializer(
        source="user",
        read_only=True,
    )

    class Meta:
        model = ExecutorProfile
        fields = [
            "executor_profile_id",
            "applicant",
            "verification_status",
            "application_submitted_at",
        ]

        read_only_fields = fields


class AdminWorkerVerificationDetailSerializer(
    serializers.ModelSerializer
):

    applicant = VerificationApplicantSerializer(
        source="user",
        read_only=True,
    )

    documents = WorkerVerificationDocumentReadSerializer(
        source="verification_documents",
        many=True,
        read_only=True,
    )

    identity = serializers.SerializerMethodField()

    @extend_schema_field(WorkerVerificationIdentityReadSerializer)
    def get_identity(self, obj):
        details = getattr(obj, "verification_identity", None)
        if details is None:
            return None
        return WorkerVerificationIdentityReadSerializer(identity_to_payload(details)).data

    class Meta:
        model = ExecutorProfile
        fields = [
            "executor_profile_id",
            "applicant",
            "bio",
            "work_interests",
            "service_area_city",
            "service_area_region",
            "service_area_latitude",
            "service_area_longitude",
            "service_area_radius_km",
            "verification_status",
            "application_submitted_at",
            "reviewed_at",
            "reviewed_by_user",
            "approved_at",
            "rejection_reason",
            "documents",
            "identity",
        ]

        read_only_fields = fields


class WorkerVerificationRejectSerializer(serializers.Serializer):

    reason = serializers.CharField(
        max_length=2000,
        trim_whitespace=True,
        allow_blank=False,
    )
