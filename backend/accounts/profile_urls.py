from django.urls import path

from .profile_views import MyProfileView
from .profile_avatar_views import MyProfileAvatarView
from .worker_skill_views import (
    MyWorkerSkillsView,
    MyWorkerSkillDetailView,
)
from .worker_preference_views import WorkerPreferencesView
from .worker_service_area_views import WorkerServiceAreaView
from .worker_statistics_views import WorkerStatisticsView
from .worker_service_neighborhood_views import (
    WorkerServiceNeighborhoodListCreateView,
    WorkerServiceNeighborhoodDetailView,
)
from .worker_availability_views import (
    WorkerAvailabilityCollectionView,
    WorkerAvailabilityDetailView,
)
from .worker_verification_views import (WorkerVerificationDocumentUploadView,
    WorkerVerificationStatusView,WorkerVerificationSubmitView,
    WorkerVerificationIdentityView, WorkerVerificationDocumentDeleteView,)

app_name = "profile"

urlpatterns = [
    path("me/",MyProfileView.as_view(),name="my-profile",),
    path("me/avatar/", MyProfileAvatarView.as_view(), name="my-profile-avatar"),
    path("me/skills/",MyWorkerSkillsView.as_view(),name="my-worker-skills",),
    path("me/skills/<uuid:worker_skill_id>/",MyWorkerSkillDetailView.as_view(),name="my-worker-skill-detail",),
    path("me/preferences/",WorkerPreferencesView.as_view(),name="my-worker-preferences",),
    path("me/service-area/",WorkerServiceAreaView.as_view(),name="my-service-area",),
    path("me/statistics/", WorkerStatisticsView.as_view(), name="my-worker-statistics"),
    path("me/service-area/neighborhoods/", WorkerServiceNeighborhoodListCreateView.as_view(), name="my-service-neighborhoods"),
    path("me/service-area/neighborhoods/<uuid:neighborhood_id>/", WorkerServiceNeighborhoodDetailView.as_view(), name="my-service-neighborhood-detail"),
    path("me/availability/",WorkerAvailabilityCollectionView.as_view(),name="my-worker-availability",),
    path("me/availability/<uuid:availability_id>/",WorkerAvailabilityDetailView.as_view(),name="my-worker-availability-detail",),
    path("me/verification/",WorkerVerificationStatusView.as_view(),name="worker-verification-status",),
    path("me/verification/identity/", WorkerVerificationIdentityView.as_view(), name="worker-verification-identity"),
    path("me/verification/documents/",WorkerVerificationDocumentUploadView.as_view(),name="worker-verification-document-upload",),
    path("me/verification/documents/<uuid:document_id>/", WorkerVerificationDocumentDeleteView.as_view(), name="worker-verification-document-delete"),
    path("me/verification/submit/",WorkerVerificationSubmitView.as_view(),name="worker-verification-submit",),
]   