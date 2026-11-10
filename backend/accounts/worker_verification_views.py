
from drf_spectacular.utils import (
    extend_schema,
    OpenApiResponse,
)

from rest_framework import status
from rest_framework.parsers import (
    MultiPartParser,
    FormParser,
)
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .worker_verification_serializers import (
    WorkerVerificationDocumentUploadSerializer,
    WorkerVerificationDocumentReadSerializer,
)

from .worker_verification_services import (
    upload_worker_verification_document,
)


class WorkerVerificationDocumentUploadView(APIView):

    permission_classes = [IsAuthenticated]

    parser_classes = [
        MultiPartParser,
        FormParser,
    ]

    @extend_schema(
        tags=["Worker Verification"],
        summary="Upload worker verification document",
        description=(
            "Upload a private identity verification document "
            "for the authenticated user's executor profile."
        ),
        request=WorkerVerificationDocumentUploadSerializer,
        responses={
            201: WorkerVerificationDocumentReadSerializer,
            400: OpenApiResponse(
                description="Invalid document or verification status."
            ),
            401: OpenApiResponse(
                description="Authentication required."
            ),
        },
    )
    def post(self, request):

        serializer = WorkerVerificationDocumentUploadSerializer(
            data=request.data,
        )

        serializer.is_valid(
            raise_exception=True,
        )

        document = upload_worker_verification_document(
            user=request.user,
            document_type=serializer.validated_data[
                "document_type"
            ],
            uploaded_file=serializer.validated_data["file"],
            mime_type=serializer.validated_data["mime_type"],
        )

        response_serializer = (
            WorkerVerificationDocumentReadSerializer(
                document,
            )
        )

        return Response(
            response_serializer.data,
            status=status.HTTP_201_CREATED,
        )
