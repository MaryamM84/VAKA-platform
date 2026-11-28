from drf_spectacular.utils import (
    OpenApiParameter,
    OpenApiResponse,
    extend_schema,
)
from rest_framework import generics, status
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import WalletTransaction, WalletTransactionType
from .pagination import WalletTransactionPagination
from .serializers import (
    WalletDepositRequestSerializer,
    WalletDepositResponseSerializer,
    WalletSummarySerializer,
    WalletTransactionSerializer,
)
from .services import get_or_create_wallet, initiate_wallet_deposit


class WalletSummaryView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Wallet"],
        operation_id="wallet_summary",
        summary="Get current user's wallet summary",
        responses={200: WalletSummarySerializer, 401: OpenApiResponse(description="Authentication required.")},
    )
    def get(self, request):
        wallet = get_or_create_wallet(user=request.user)
        return Response(
            WalletSummarySerializer(wallet).data,
            status=status.HTTP_200_OK,
        )


class WalletTransactionListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = WalletTransactionSerializer
    pagination_class = WalletTransactionPagination

    @extend_schema(
        tags=["Wallet"],
        operation_id="wallet_transactions_list",
        summary="List current user's posted wallet transactions",
        parameters=[
            OpenApiParameter(name="page", type=int, location=OpenApiParameter.QUERY),
            OpenApiParameter(name="page_size", type=int, location=OpenApiParameter.QUERY),
            OpenApiParameter(
                name="type",
                type=str,
                location=OpenApiParameter.QUERY,
                description="Optional WalletTransactionType filter.",
            ),
            OpenApiParameter(
                name="status",
                type=str,
                location=OpenApiParameter.QUERY,
                description="Posted ledger entries have status SUCCEEDED.",
            ),
        ],
        responses={200: WalletTransactionSerializer(many=True)},
    )
    def get_queryset(self):
        wallet = get_or_create_wallet(user=self.request.user)
        queryset = WalletTransaction.objects.filter(wallet=wallet).select_related(
            "task", "escrow_reservation"
        )

        transaction_type = self.request.query_params.get("type")
        if transaction_type:
            if transaction_type not in WalletTransactionType.values:
                raise ValidationError({"type": "Unsupported transaction type."})
            queryset = queryset.filter(transaction_type=transaction_type)

        transaction_status = self.request.query_params.get("status")
        if transaction_status and transaction_status != "SUCCEEDED":
            raise ValidationError({"status": "Only posted SUCCEEDED ledger entries are listed."})

        return queryset


class WalletTransactionDetailView(generics.RetrieveAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = WalletTransactionSerializer
    lookup_field = "transaction_id"
    lookup_url_kwarg = "transaction_id"

    @extend_schema(
        tags=["Wallet"],
        operation_id="wallet_transaction_detail",
        summary="Get a wallet transaction owned by the current user",
        responses={
            200: WalletTransactionSerializer,
            404: OpenApiResponse(description="Transaction not found."),
        },
    )
    def get_queryset(self):
        return WalletTransaction.objects.filter(
            wallet__user=self.request.user
        ).select_related("task", "escrow_reservation")


class WalletDepositView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Wallet"],
        operation_id="wallet_deposit_create",
        summary="Create a wallet deposit (simulated or via payment gateway)",
        description=(
            "Mode is configured on the server. In SIMULATED mode (development "
            "only), credits demo IRR immediately and returns SUCCEEDED with "
            "an empty payment_url. In GATEWAY mode, returns a payment link "
            "and does NOT credit the wallet until provider confirmation. "
            "Requires Idempotency-Key; repeated identical requests do not "
            "credit the wallet again. Simulated funds are not real money."
        ),
        request=WalletDepositRequestSerializer,
        parameters=[
            OpenApiParameter(
                name="Idempotency-Key",
                type=str,
                location=OpenApiParameter.HEADER,
                required=True,
            ),
        ],
        responses={
            201: WalletDepositResponseSerializer,
            200: WalletDepositResponseSerializer,
            400: OpenApiResponse(description="Invalid amount or Idempotency-Key."),
            401: OpenApiResponse(description="Authentication required."),
            409: OpenApiResponse(description="Idempotency conflict."),
            503: OpenApiResponse(description="Gateway unavailable or simulated mode disabled."),
        },
    )
    def post(self, request):
        serializer = WalletDepositRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        idempotency_key = request.headers.get("Idempotency-Key", "").strip()
        if not idempotency_key or len(idempotency_key) > 128:
            raise ValidationError({
                "Idempotency-Key": "A non-empty key of at most 128 characters is required."
            })

        deposit, created = initiate_wallet_deposit(
            user=request.user,
            amount=serializer.validated_data["amount"],
            idempotency_key=idempotency_key,
        )
        return Response(
            WalletDepositResponseSerializer(deposit).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )
