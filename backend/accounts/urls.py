from django.urls import path

from .views import (
    RegisterView,
    PasswordLoginView,
    AuthTokenRefreshView,
    AuthTokenVerifyView,
    RegisterOTPVerifyView,
    OTPLoginSendView,
    OTPLoginVerifyView,
    OTPResendView,
)


app_name = "accounts"


urlpatterns = [

    path(
        "register/",
        RegisterView.as_view(),
        name="register",
    ),

    path(
        "login/password/",
        PasswordLoginView.as_view(),
        name="login-password",
    ),

    path(
        "token/refresh/",
        AuthTokenRefreshView.as_view(),
        name="token-refresh",
    ),

    path(
        "token/verify/",
        AuthTokenVerifyView.as_view(),
        name="token-verify",
    ),


    path(
    "register/verify-otp/",
    RegisterOTPVerifyView.as_view(),
    name="register-verify-otp",
    ),
    
    path(
        "login/otp/send/",
        OTPLoginSendView.as_view(),
        name="login-otp-send",
    ),
    
    path(
        "login/otp/verify/",
        OTPLoginVerifyView.as_view(),
        name="login-otp-verify",
    ),
    
    path(
        "otp/resend/",
        OTPResendView.as_view(),
        name="otp-resend",
    ),

]