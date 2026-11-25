"""Authenticated employer/worker expense claim endpoints."""

from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema, OpenApiResponse
from rest_framework import status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from tasks.pagination import TaskDiscoveryPagination

from .expense_models import ExpenseReceipt
from .expense_receipts import private_receipt_storage
from .expense_serializers import (
    ExpenseClaimCreateSerializer, ExpenseClaimReadSerializer, ExpenseRejectSerializer,
)
from .expense_services import (
    approve_expense_claim, reject_expense_claim, submit_expense_claim, visible_claims,
)


class ExpenseClaimListCreateView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser, FormParser, MultiPartParser]

    @extend_schema(tags=["Expense Claims"], responses={200: ExpenseClaimReadSerializer(many=True)})
    def get(self, request, task_id):
        _task, queryset = visible_claims(task_id=task_id, actor=request.user)
        pagination = TaskDiscoveryPagination()
        page = pagination.paginate_queryset(queryset, request, view=self)
        return pagination.get_paginated_response(
            ExpenseClaimReadSerializer(page, many=True, context={"request": request}).data,
        )

    @extend_schema(
        tags=["Expense Claims"], request=ExpenseClaimCreateSerializer,
        responses={201: ExpenseClaimReadSerializer},
    )
    def post(self, request, task_id):
        serializer = ExpenseClaimCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        claim = submit_expense_claim(
            task_id=task_id, actor=request.user,
            **serializer.validated_data,
        )
        claim = type(claim).objects.prefetch_related("receipts").get(pk=claim.pk)
        return Response(
            ExpenseClaimReadSerializer(claim, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class ExpenseClaimApproveView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Expense Claims"], request=None,
        responses={200: ExpenseClaimReadSerializer,
                   409: OpenApiResponse(description="Claim not pending or unfunded")},
    )
    def post(self, request, task_id, claim_id):
        claim = approve_expense_claim(task_id=task_id, claim_id=claim_id, actor=request.user)
        return Response(ExpenseClaimReadSerializer(
            claim, context={"request": request},
        ).data)


class ExpenseClaimRejectView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Expense Claims"], request=ExpenseRejectSerializer,
        responses={200: ExpenseClaimReadSerializer},
    )
    def post(self, request, task_id, claim_id):
        serializer = ExpenseRejectSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        claim = reject_expense_claim(
            task_id=task_id, claim_id=claim_id, actor=request.user,
            reason=serializer.validated_data["reason"],
        )
        return Response(ExpenseClaimReadSerializer(
            claim, context={"request": request},
        ).data)


class ExpenseReceiptDownloadView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Expense Claims"], responses={200: OpenApiResponse(description="Private receipt image")},
    )
    def get(self, request, task_id, claim_id, receipt_id):
        task, _claims = visible_claims(task_id=task_id, actor=request.user)
        receipt = get_object_or_404(
            ExpenseReceipt.objects.select_related("claim"),
            pk=receipt_id, claim_id=claim_id, claim__task=task,
        )
        storage = private_receipt_storage()
        if not receipt.storage_key.startswith(
            f"expense-receipts/{task.pk}/{claim_id}/"
        ):
            raise Http404
        try:
            file = storage.open(receipt.storage_key, "rb")
        except (OSError, ValueError) as exc:
            raise Http404 from exc
        response = FileResponse(file, content_type=receipt.mime_type)
        response["Cache-Control"] = "private, no-store"
        response["X-Content-Type-Options"] = "nosniff"
        response["Content-Disposition"] = "inline"
        return response
