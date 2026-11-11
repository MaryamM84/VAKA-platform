
from django.urls import path

from .worker_verification_admin_views import (
    AdminWorkerVerificationListView,
    AdminWorkerVerificationDetailView,
    AdminWorkerVerificationApproveView,
    AdminWorkerVerificationRejectView,
    AdminWorkerVerificationDocumentDownloadView,
)


app_name = "worker_verification_admin"


urlpatterns = [

    path(
        "",
        AdminWorkerVerificationListView.as_view(),
        name="list",
    ),

    path(
        "<uuid:executor_profile_id>/",
        AdminWorkerVerificationDetailView.as_view(),
        name="detail",
    ),

    path(
        "<uuid:executor_profile_id>/approve/",
        AdminWorkerVerificationApproveView.as_view(),
        name="approve",
    ),

    path(
        "<uuid:executor_profile_id>/reject/",
        AdminWorkerVerificationRejectView.as_view(),
        name="reject",
    ),

    path(
        "<uuid:executor_profile_id>/documents/<uuid:document_id>/download/",
        AdminWorkerVerificationDocumentDownloadView.as_view(),
        name="document-download",
    ),
]
