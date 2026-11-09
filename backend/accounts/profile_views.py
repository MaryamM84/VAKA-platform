from drf_spectacular.utils import extend_schema, OpenApiResponse

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .profile_serializers import MyProfileSerializer


class MyProfileView(APIView):

    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Profile"],
        summary="Get current user's profile",
        description=(
            "Returns the personal information and optional "
            "worker profile information of the authenticated user."
        ),
        responses={
            200: MyProfileSerializer,
            401: OpenApiResponse(
                description="Authentication credentials were not provided."
            ),
        },
    )
    def get(self, request):

        serializer = MyProfileSerializer(
            instance=request.user,
        )

        return Response(
            serializer.data,
            status=status.HTTP_200_OK,
        )

    @extend_schema(
        tags=["Profile"],
        summary="Update current user's profile",
        request=MyProfileSerializer,
        responses={
            200: MyProfileSerializer,
            400: OpenApiResponse(
                description="Invalid profile information."
            ),
            401: OpenApiResponse(
                description="Authentication credentials were not provided."
            ),
        },
    )
    def patch(self, request):

        serializer = MyProfileSerializer(
            instance=request.user,
            data=request.data,
            partial=True,
        )

        serializer.is_valid(raise_exception=True)
        serializer.save()

        request.user.refresh_from_db()

        response_serializer = MyProfileSerializer(
            instance=request.user,
        )

        return Response(
            response_serializer.data,
            status=status.HTTP_200_OK,
        )