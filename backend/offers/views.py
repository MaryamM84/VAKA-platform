
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from drf_spectacular.utils import (
    extend_schema,
    OpenApiResponse,
    OpenApiParameter,
)

from .employer_bid_decisions import (
    accept_employer_bid,
    get_employer_bid_assignment_preview,
    reject_employer_bid,
)

from .serializers import (
    BidSubmissionSerializer,
    BidReadSerializer,
    BidUpdateSerializer,
    EmployerBidListSerializer,
    EmployerBidDetailSerializer,
    BidDecisionResponseSerializer,
    BidAssignmentPreviewSerializer,
    BidAssignmentResponseSerializer,
)

from .services import (
    get_executor_bids,
    get_executor_bid_detail,
    update_executor_bid,
    withdraw_executor_bid,
    submit_bid,
    get_employer_bids,
    get_employer_task_bids,
    get_employer_bid_detail,    
)
from tasks.permissions import IsEmployer

class BidSubmissionView(APIView):

    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Bidding"],
        operation_id="submit_bid",
        summary="Submit a bid",
        description=(
            "Allows an authenticated, approved and active executor "
            "to submit one bid for an open task."
        ),
        request=BidSubmissionSerializer,
        responses={
            201: BidReadSerializer,
        },
    )
    def post(self, request):

        serializer = BidSubmissionSerializer(
            data=request.data,
        )

        serializer.is_valid(raise_exception=True)

        bid = submit_bid(
            user=request.user,
            **serializer.validated_data,
        )

        response_serializer = BidReadSerializer(bid)

        return Response(
            response_serializer.data,
            status=status.HTTP_201_CREATED,
        )
    
    @extend_schema(
        tags=["Bidding"],
        operation_id="my_bids_list",
        summary="Get my bids",
        description=(
            "Returns all bids submitted by the authenticated executor."
        ),
        responses={
            200: BidReadSerializer(many=True),
        },
    )
    def get(self, request):

        bids = get_executor_bids(
            user=request.user,
        )

        serializer = BidReadSerializer(
            bids,
            many=True,
        )

        return Response(
            serializer.data,
            status=status.HTTP_200_OK,
        )



class MyBidDetailView(APIView):

    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Bidding"],
        operation_id="my_bid_detail",
        summary="Get my bid details",
        description=(
            "Returns details of a bid belonging to the authenticated executor."
        ),
        responses={
            200: BidReadSerializer,
        },
    )
    def get(self, request, bid_id):

        bid = get_executor_bid_detail(
            user=request.user,
            bid_id=bid_id,
        )

        serializer = BidReadSerializer(bid)

        return Response(
            serializer.data,
            status=status.HTTP_200_OK,
        )

    @extend_schema(
        tags=["Bidding"],
        operation_id="update_my_bid",
        summary="Update my bid",
        description=(
            "Updates an active bid before the task is assigned."
        ),
        request=BidUpdateSerializer,
        responses={
            200: BidReadSerializer,
        },
    )
    def patch(self, request, bid_id):

        serializer = BidUpdateSerializer(
            data=request.data,
            partial=True,
        )

        serializer.is_valid(raise_exception=True)

        bid = update_executor_bid(
            user=request.user,
            bid_id=bid_id,
            validated_data=serializer.validated_data,
        )

        response_serializer = BidReadSerializer(bid)

        return Response(
            response_serializer.data,
            status=status.HTTP_200_OK,
        )

    @extend_schema(
        tags=["Bidding"],
        operation_id="delete_my_bid",
        summary="Delete my bid",
        description=(
            "Withdraws an active bid before the task is assigned."
        ),
        request=None,
        responses={
            200: BidReadSerializer,
            401: OpenApiResponse(
                description="Authentication required."
            ),
            403: OpenApiResponse(
                description="Executor permission required."
            ),
            404: OpenApiResponse(
                description="Bid not found."
            ),
            400: OpenApiResponse(
                description="Bid cannot be deleted."
            ),
        },
    )
    def delete(self, request, bid_id):

        bid = withdraw_executor_bid(
            user=request.user,
            bid_id=bid_id,
        )

        response_serializer = BidReadSerializer(bid)

        return Response(
            response_serializer.data,
            status=status.HTTP_200_OK,
        )



class EmployerBidsListView(APIView):

    permission_classes = [IsAuthenticated, IsEmployer]

    @extend_schema(
        tags=["Employer Bidding"],
        operation_id="employer_bids_list",
        summary="List employer received bids",
        description=(
            "Returns all bids submitted to tasks owned "
            "by the authenticated employer."
        ),
        responses={
            200: EmployerBidListSerializer(many=True),
        },
    )
    def get(self, request):

        bids = get_employer_bids(
            user=request.user,
        )

        serializer = EmployerBidListSerializer(
            bids,
            many=True,
        )

        return Response(
            serializer.data,
            status=status.HTTP_200_OK,
        )


class EmployerTaskBidsListView(APIView):

    permission_classes = [IsAuthenticated, IsEmployer]

    @extend_schema(
        tags=["Employer Bidding"],
        operation_id="employer_task_bids_list",
        summary="List bids for employer task",
        description=(
            "Returns all bids for a task owned "
            "by the authenticated employer."
        ),
        responses={
            200: EmployerBidListSerializer(many=True),
        },
    )
    def get(self, request, task_id):

        bids = get_employer_task_bids(
            user=request.user,
            task_id=task_id,
        )

        serializer = EmployerBidListSerializer(
            bids,
            many=True,
        )

        return Response(
            serializer.data,
            status=status.HTTP_200_OK,
        )


class EmployerBidDetailView(APIView):

    permission_classes = [IsAuthenticated, IsEmployer]

    @extend_schema(
        tags=["Employer Bidding"],
        operation_id="employer_bid_detail",
        summary="Get employer bid details",
        description=(
            "Returns bid details only if the related task "
            "belongs to the authenticated employer."
        ),
        responses={
            200: EmployerBidDetailSerializer,
        },
    )
    def get(self, request, bid_id):

        bid = get_employer_bid_detail(
            user=request.user,
            bid_id=bid_id,
        )

        serializer = EmployerBidDetailSerializer(bid)

        return Response(
            serializer.data,
            status=status.HTTP_200_OK,
        )

class EmployerBidAssignmentPreviewView(APIView):
    permission_classes = [IsAuthenticated, IsEmployer]

    @extend_schema(
        tags=["Employer Bidding"],
        operation_id="employer_bid_assignment_preview",
        summary="Preview bid assignment and escrow reservation",
        description=(
            "Returns the selected task, executor, reservation breakdown and "
            "current employer wallet balances. This is a read-only preview; "
            "it does not reserve funds or change task/bid state. The accept "
            "endpoint revalidates all values atomically."
        ),
        responses={
            200: BidAssignmentPreviewSerializer,
            401: OpenApiResponse(description="Authentication required."),
            403: OpenApiResponse(description="Employer permission required."),
            404: OpenApiResponse(description="Bid not found."),
            409: OpenApiResponse(description="The bid, task or executor is no longer eligible."),
        },
    )
    def get(self, request, bid_id):
        payload = get_employer_bid_assignment_preview(
            user=request.user,
            bid_id=bid_id,
            request=request,
        )
        serializer = BidAssignmentPreviewSerializer(payload)
        return Response(serializer.data, status=status.HTTP_200_OK)


class EmployerBidAcceptView(APIView):

    permission_classes = [IsAuthenticated, IsEmployer]

    @extend_schema(
        tags=["Employer Bidding"],
        operation_id="employer_bid_accept",
        summary="Atomically accept a bid and reserve escrow funds",
        description=(
            "Atomically reserves the employer's available wallet balance, "
            "records the escrow hold and financial ledger entry, accepts the "
            "selected bid, rejects competing active bids and assigns the task. "
            "An Idempotency-Key header is required for safe retries."
        ),
        request=None,
        parameters=[
            OpenApiParameter(
                name="Idempotency-Key",
                type=str,
                location=OpenApiParameter.HEADER,
                required=True,
                description="Unique key for this bid assignment attempt.",
            ),
        ],
        responses={
            200: BidAssignmentResponseSerializer,
            401: OpenApiResponse(
                description="Authentication required."
            ),
            403: OpenApiResponse(
                description="Employer permission required."
            ),
            404: OpenApiResponse(
                description="Bid not found."
            ),
            400: OpenApiResponse(
                description="A valid Idempotency-Key header is required."
            ),
            409: OpenApiResponse(
                description="Insufficient balance or invalid bid/task state."
            ),
        },
    )
    def post(self, request, bid_id):

        bid, task, reservation = accept_employer_bid(
            user=request.user,
            bid_id=bid_id,
            idempotency_key=request.headers.get("Idempotency-Key"),
        )

        wallet = reservation.wallet
        wallet.refresh_from_db()

        payload = {
            "bid_id": bid.pk,
            "task_id": task.pk,
            "status": bid.status,
            "task_status": task.status,
            "updated_at": bid.updated_at,
            "escrow_reservation_id": reservation.reservation_id,
            "escrow_public_reference": reservation.public_reference,
            "escrow_status": reservation.status,
            "task_title": task.title,
            "executor_name": bid.executor_profile.user.full_name,
            "reserved_amount": reservation.amount,
            "labor_amount": reservation.labor_amount,
            "expense_amount": reservation.expense_amount,
            "currency_code": reservation.currency_code,
            "platform_fee_rate_bps": reservation.platform_fee_rate_bps,
            "platform_fee_amount": reservation.platform_fee_amount,
            "fee_payer": reservation.fee_payer,
            "fee_included_in_reserved_amount": False,
            "wallet_total_balance": wallet.total_balance,
            "available_balance_after_reservation": wallet.available_balance,
            "reserved_balance_after_reservation": wallet.reserved_balance,
        }

        serializer = BidAssignmentResponseSerializer(payload)

        return Response(
            serializer.data,
            status=status.HTTP_200_OK,
        )


class EmployerBidRejectView(APIView):

    permission_classes = [IsAuthenticated, IsEmployer]

    @extend_schema(
        tags=["Employer Bidding"],
        operation_id="employer_bid_reject",
        summary="Reject an executor bid",
        request=None,
        responses={
            200: BidDecisionResponseSerializer,
            401: OpenApiResponse(
                description="Authentication required."
            ),
            403: OpenApiResponse(
                description="Employer permission required."
            ),
            404: OpenApiResponse(
                description="Bid not found."
            ),
            409: OpenApiResponse(
                description="Invalid bid or task state."
            ),
        },
    )
    def post(self, request, bid_id):

        bid, task = reject_employer_bid(
            user=request.user,
            bid_id=bid_id,
        )

        payload = {
            "bid_id": bid.pk,
            "task_id": task.pk,
            "status": bid.status,
            "task_status": task.status,
            "updated_at": bid.updated_at,
        }

        serializer = BidDecisionResponseSerializer(payload)

        return Response(
            serializer.data,
            status=status.HTTP_200_OK,
        )
