from django.urls import path

from .employer_views import (
    EmployerAssignedExecutorView,
    EmployerTaskProgressReportsView,
)

urlpatterns = [
    path(
        "tasks/<uuid:task_id>/executor/",
        EmployerAssignedExecutorView.as_view(),
        name="employer-assigned-executor",
    ),
    path(
        "tasks/<uuid:task_id>/progress-reports/",
        EmployerTaskProgressReportsView.as_view(),
        name="employer-task-progress-reports",
    ),
]
