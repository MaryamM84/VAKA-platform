from django.urls import path

from .workspace_views import (
    ExecutorTaskListView,
    ExecutorTaskDetailView,
    ExecutorTaskPrivateDetailsView,
    ExecutorProgressReportView,
)

urlpatterns = [
    path("tasks/", ExecutorTaskListView.as_view(), name="executor-task-list"),
    path("tasks/<uuid:task_id>/", ExecutorTaskDetailView.as_view(), name="executor-task-detail"),
    path("tasks/<uuid:task_id>/private-details/", ExecutorTaskPrivateDetailsView.as_view(), name="executor-task-private"),
    path("tasks/<uuid:task_id>/progress-reports/", ExecutorProgressReportView.as_view(), name="executor-task-progress"),
]
