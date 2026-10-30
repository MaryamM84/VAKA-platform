from drf_spectacular.utils import extend_schema, OpenApiResponse

from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import (
    TokenRefreshView,
    TokenVerifyView,
)

from .serializers import (
    RegisterSerializer,
    PasswordLoginSerializer,
    UserReadSerializer,
    AuthResponseSerializer,
    TokenRefreshRequestSerializer,
    TokenRefreshResponseSerializer,
    TokenVerifyRequestSerializer,
)


def build_auth_response(user):

    refresh = RefreshToken.for_user(user)

    return {
        "user": UserReadSerializer(user).data,
        "access": str(refresh.access_token),
        "refresh": str(refresh),
    }


class RegisterView(APIView):

    authentication_classes = []
    permission_classes = [AllowAny]

    @extend_schema(
        tags=["Authentication"],
        summary="Register a new user",
        description=(
            "Register using phone number and password. "
            "OTP verification is temporarily disabled during development."
        ),
        request=RegisterSerializer,
        responses={
            201: AuthResponseSerializer,
        },
    )
    def post(self, request):

        serializer = RegisterSerializer(data=request.data)

        serializer.is_valid(raise_exception=True)

        user = serializer.save()

        return Response(
            build_auth_response(user),
            status=status.HTTP_201_CREATED,
        )


class PasswordLoginView(APIView):

    authentication_classes = []
    permission_classes = [AllowAny]

    @extend_schema(
        tags=["Authentication"],
        summary="Login with phone and password",
        request=PasswordLoginSerializer,
        responses={
            200: AuthResponseSerializer,
            401: OpenApiResponse(
                description="Invalid phone number or password."
            ),
        },
    )
    def post(self, request):

        serializer = PasswordLoginSerializer(
            data=request.data,
            context={"request": request},
        )

        serializer.is_valid(raise_exception=True)

        user = serializer.validated_data["user"]

        return Response(
            build_auth_response(user),
            status=status.HTTP_200_OK,
        )


class AuthTokenRefreshView(TokenRefreshView):

    authentication_classes = []
    permission_classes = [AllowAny]

    @extend_schema(
        tags=["Authentication"],
        summary="Refresh JWT access token",
        request=TokenRefreshRequestSerializer,
        responses={
            200: TokenRefreshResponseSerializer,
        },
    )
    def post(self, request, *args, **kwargs):

        return super().post(request, *args, **kwargs)


class AuthTokenVerifyView(TokenVerifyView):

    authentication_classes = []
    permission_classes = [AllowAny]

    @extend_schema(
        tags=["Authentication"],
        summary="Verify JWT token",
        request=TokenVerifyRequestSerializer,
        responses={
            200: OpenApiResponse(
                description="Token is valid."
            ),
            401: OpenApiResponse(
                description="Token is invalid or expired."
            ),
        },
    )
    def post(self, request, *args, **kwargs):

        return super().post(request, *args, **kwargs)