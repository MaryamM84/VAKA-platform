"""Executor-facing execution actions (no direct task-status mutation)."""
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import TaskStartResponseSerializer
from .services import start_task_execution


class TaskExecutionStartView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        operation_id="tasks_start_execution",
        tags=["Execution"],
        summary="Start execution of an assigned and funded task",
        description=(
            "Only the currently approved, active, assigned executor can start "
            "an ASSIGNED task, after the internal finance adapter verifies "
            "a current HELD escrow reservation. No escrow status is accepted "
            "from the client. Until the finance adapter is implemented, this "
            "endpoint rejects attempts to start execution with HTTP 409."
        ),
        request=None,
        responses={
            200: TaskStartResponseSerializer,
            400: OpenApiResponse(description="Unexpected request payload"),
            401: OpenApiResponse(description="Unauthenticated"),
            403: OpenApiResponse(description="Not the eligible assigned executor"),
            404: OpenApiResponse(description="Task not found"),
            409: OpenApiResponse(description="State invalid or escrow hold not verified"),
        },
    )
    def post(self, request, task_id):
        if request.data:
            raise ValidationError({"detail": "This endpoint does not accept a request body."})
        task = start_task_execution(task_id=task_id, actor=request.user)
        return Response(
            {"task_id": str(task.pk), "status": task.status, "version": task.version},
            status=status.HTTP_200_OK,
        )
