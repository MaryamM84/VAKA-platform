from django.urls import path

from .views import (
    RegisterView,
    PasswordLoginView,
    AuthTokenRefreshView,
    AuthTokenVerifyView,
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

]