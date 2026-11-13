
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from drf_spectacular.utils import (
    extend_schema,
    OpenApiResponse,
)

from .employer_bid_decisions import (
    accept_employer_bid,
    reject_employer_bid,
)

from .serializers import (
    BidSubmissionSerializer,
    BidReadSerializer,
    BidUpdateSerializer,
    EmployerBidListSerializer,
    EmployerBidDetailSerializer,
    BidDecisionResponseSerializer,
)

from .services import (
    get_executor_bids,
    get_executor_bid_detail,
    update_executor_bid,
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

class EmployerBidAcceptView(APIView):

    permission_classes = [IsAuthenticated, IsEmployer]

    @extend_schema(
        tags=["Employer Bidding"],
        operation_id="employer_bid_accept",
        summary="Accept an executor bid",
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

        bid, task = accept_employer_bid(
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