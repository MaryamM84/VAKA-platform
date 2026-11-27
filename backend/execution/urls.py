from django.urls import path

from .workspace_views import (
    ExecutorTaskListView,
    ExecutorTaskDetailView,
    ExecutorTaskPrivateDetailsView,
    ExecutorProgressReportView,
    ExecutorTaskDeliveryView,
)

from .employer_views import EmployerAssignedExecutorView, EmployerTaskProgressReportsView


urlpatterns = [
    path("tasks/", ExecutorTaskListView.as_view(), name="executor-task-list"),
    path("tasks/<uuid:task_id>/", ExecutorTaskDetailView.as_view(), name="executor-task-detail"),
    path("tasks/<uuid:task_id>/private-details/", ExecutorTaskPrivateDetailsView.as_view(), name="executor-task-private"),
    path("tasks/<uuid:task_id>/progress-reports/", ExecutorProgressReportView.as_view(), name="executor-task-progress"),
    path("tasks/<uuid:task_id>/delivery/", ExecutorTaskDeliveryView.as_view(), name="executor-task-delivery"),
    path("tasks/<uuid:task_id>/executor/", EmployerAssignedExecutorView.as_view(),name="employer-assigned-executor"),
    path("tasks/<uuid:task_id>/progress-reports/", EmployerTaskProgressReportsView.as_view(),name="employer-task-progress-reports"),
]

