from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .profile_avatar_serializers import (
    AvatarPresetSelectionSerializer,
    AvatarUploadSerializer,
    ProfileAvatarReadSerializer,
)
from .profile_avatar_services import (
    delete_profile_avatar,
    select_profile_avatar,
    upload_profile_avatar,
)


class MyProfileAvatarView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    @extend_schema(
        tags=["Profile"],
        summary="Get current profile avatar",
        responses={200: ProfileAvatarReadSerializer},
    )
    def get(self, request):
        serializer = ProfileAvatarReadSerializer(
            request.user,
            context={"request": request},
        )
        return Response(serializer.data, status=status.HTTP_200_OK)

    @extend_schema(
        tags=["Profile"],
        summary="Select one of the predefined profile avatars",
        request=AvatarPresetSelectionSerializer,
        responses={
            200: ProfileAvatarReadSerializer,
            400: OpenApiResponse(description="Invalid avatar selection."),
            401: OpenApiResponse(description="Authentication required."),
        },
    )
    def patch(self, request):
        serializer = AvatarPresetSelectionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = select_profile_avatar(
            user=request.user,
            avatar_id=serializer.validated_data["avatar_id"],
        )
        response_serializer = ProfileAvatarReadSerializer(
            user,
            context={"request": request},
        )
        return Response(response_serializer.data, status=status.HTTP_200_OK)

    @extend_schema(
        tags=["Profile"],
        summary="Upload or replace the current profile avatar",
        request=AvatarUploadSerializer,
        responses={
            200: ProfileAvatarReadSerializer,
            400: OpenApiResponse(description="Invalid image."),
            401: OpenApiResponse(description="Authentication required."),
        },
    )
    def post(self, request):
        serializer = AvatarUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = upload_profile_avatar(
            user=request.user,
            image=serializer.validated_data["image"],
            image_format=serializer.validated_data["image_format"],
        )
        response_serializer = ProfileAvatarReadSerializer(
            user,
            context={"request": request},
        )
        return Response(response_serializer.data, status=status.HTTP_200_OK)

    @extend_schema(
        tags=["Profile"],
        summary="Delete the current profile avatar",
        responses={
            204: OpenApiResponse(description="Avatar deleted."),
            401: OpenApiResponse(description="Authentication required."),
        },
    )
    def delete(self, request):
        delete_profile_avatar(user=request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)
