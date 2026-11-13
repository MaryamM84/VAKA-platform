from django.urls import path

from .public_profile_views import PublicWorkerProfileView


urlpatterns = [
    path(
        "<uuid:profile_id>/",
        PublicWorkerProfileView.as_view(),
        name="public-worker-profile",
    ),
]
