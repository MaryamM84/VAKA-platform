from django.urls import path

from .profile_views import MyProfileView
from .worker_skill_views import (
    MyWorkerSkillsView,
    MyWorkerSkillDetailView,
)
from .worker_preference_views import WorkerPreferencesView
from .worker_service_area_views import WorkerServiceAreaView
from .worker_availability_views import (
    WorkerAvailabilityCollectionView,
    WorkerAvailabilityDetailView,
)

app_name = "profile"

urlpatterns = [
    path("me/",MyProfileView.as_view(),name="my-profile",),
    path("me/skills/",MyWorkerSkillsView.as_view(),name="my-worker-skills",),
    path("me/skills/<uuid:worker_skill_id>/",MyWorkerSkillDetailView.as_view(),name="my-worker-skill-detail",),
    path("me/preferences/",WorkerPreferencesView.as_view(),name="my-worker-preferences",),
    path("me/service-area/",WorkerServiceAreaView.as_view(),name="my-service-area",),
    path("me/availability/",WorkerAvailabilityCollectionView.as_view(),name="my-worker-availability",),
    path("me/availability/<uuid:availability_id>/",WorkerAvailabilityDetailView.as_view(),name="my-worker-availability-detail",),
]