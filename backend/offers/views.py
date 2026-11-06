
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from drf_spectacular.utils import extend_schema

from .serializers import (
    BidSubmissionSerializer,
    BidReadSerializer,
    BidUpdateSerializer,
)

from .services import (
    get_executor_bids,
    get_executor_bid_detail,
    update_executor_bid,
    submit_bid,
)

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

class MyBidsListView(APIView):

    permission_classes = [IsAuthenticated]

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
