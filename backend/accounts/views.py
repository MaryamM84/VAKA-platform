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
    OTPMessageResponseSerializer,
)

import logging

from django.utils import timezone
from rest_framework.exceptions import APIException, AuthenticationFailed

from .models import User, OTPChallenge

from accounts.otp import (
    send_otp,
    verify_otp,
    OTPCooldown,
    OTPDeliveryError,
)

from .serializers import (
    OTPPhoneSerializer,
    OTPVerifySerializer,
    OTPResendSerializer,
    OTPPendingResponseSerializer,
)



logger = logging.getLogger(__name__)


class SMSUnavailable(APIException):
    status_code = 503
    default_detail = "SMS service is temporarily unavailable."
    default_code = "sms_unavailable"


def build_auth_response(user):
    if not user.is_active:
        raise AuthenticationFailed(
            "Account is not verified or is inactive."
        )

    user.last_login = timezone.now()
    user.save(update_fields=["last_login"])

    refresh = RefreshToken.for_user(user)

    return {
        "user": UserReadSerializer(user).data,
        "access": str(refresh.access_token),
        "refresh": str(refresh),
    }


class RegisterView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_scope = "register"

    @extend_schema(
        tags=["Authentication"],
        summary="Register and request phone verification OTP",
        request=RegisterSerializer,
        responses={201: OTPPendingResponseSerializer},
    )
    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = serializer.save()

        try:
            send_otp(user, OTPChallenge.Purpose.REGISTER)
        except OTPDeliveryError:
            return Response(
                {
                    "detail": (
                        "Account created, but SMS sending failed. "
                        "Use OTP resend to retry."
                    ),
                    "requires_verification": True,
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        return Response(
            {
                "detail": "Verification code requested.",
                "requires_verification": True,
            },
            status=status.HTTP_201_CREATED,
        )

class RegisterOTPVerifyView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_scope = "otp_verify"

    @extend_schema(
        tags=["Authentication"],
        summary="Verify registration OTP",
        request=OTPVerifySerializer,
        responses={200: AuthResponseSerializer},
    )
    def post(self, request):
        serializer = OTPVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        phone = serializer.validated_data["phone"]
        code = serializer.validated_data["code"]

        user = User.objects.filter(phone=phone).first()

        if (
            user is None
            or user.phone_verified_at is not None
            or user.account_status != User.AccountStatus.ACTIVE
        ):
            raise AuthenticationFailed(
                "Invalid or expired verification code."
            )

        success = verify_otp(
            user,
            OTPChallenge.Purpose.REGISTER,
            code,
        )

        if not success:
            raise AuthenticationFailed(
                "Invalid or expired verification code."
            )

        user.refresh_from_db()

        return Response(
            build_auth_response(user),
            status=status.HTTP_200_OK,
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


class OTPLoginSendView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_scope = "otp_send"
    serializer_class = OTPPhoneSerializer

    @extend_schema(
        tags=["Authentication"],
        summary="Request login OTP",
        request=OTPPhoneSerializer,
    )
    def post(self, request):
        serializer = OTPPhoneSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        phone = serializer.validated_data["phone"]
        user = User.objects.filter(phone=phone).first()

        if user is not None and user.is_active:
            try:
                send_otp(user, OTPChallenge.Purpose.LOGIN)
            except OTPCooldown:
                pass
            except OTPDeliveryError:
                logger.warning("Login OTP delivery failed.")

        return Response(
            {
                "detail": (
                    "If this number has an eligible account, "
                    "a verification code has been requested."
                )
            },
            status=status.HTTP_202_ACCEPTED,
        )


class OTPLoginVerifyView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_scope = "otp_verify"

    @extend_schema(
        tags=["Authentication"],
        summary="Login using OTP",
        request=OTPVerifySerializer,
        responses={200: AuthResponseSerializer},
    )
    def post(self, request):
        serializer = OTPVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        phone = serializer.validated_data["phone"]
        code = serializer.validated_data["code"]

        user = User.objects.filter(phone=phone).first()

        if user is None or not user.is_active:
            raise AuthenticationFailed(
                "Invalid or expired verification code."
            )

        success = verify_otp(
            user,
            OTPChallenge.Purpose.LOGIN,
            code,
        )

        if not success:
            raise AuthenticationFailed(
                "Invalid or expired verification code."
            )

        return Response(
            build_auth_response(user),
            status=status.HTTP_200_OK,
        )



class OTPResendView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_scope = "otp_send"
    serializer_class = OTPResendSerializer

    @extend_schema(
        tags=["Authentication"],
        summary="Resend OTP",
        request=OTPResendSerializer,
    )
    def post(self, request):
        serializer = OTPResendSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        phone = serializer.validated_data["phone"]
        purpose = serializer.validated_data["purpose"]

        user = User.objects.filter(phone=phone).first()

        if user is not None:
            if purpose == OTPChallenge.Purpose.REGISTER:
                eligible = (
                    user.account_status == User.AccountStatus.ACTIVE
                    and user.phone_verified_at is None
                )
            else:
                eligible = user.is_active

            if eligible:
                try:
                    send_otp(user, purpose)
                except OTPCooldown:
                    pass
                except OTPDeliveryError:
                    logger.warning("OTP resend delivery failed.")

        return Response(
            {
                "detail": (
                    "If eligible, a verification code "
                    "has been requested."
                )
            },
            status=status.HTTP_202_ACCEPTED,
        )