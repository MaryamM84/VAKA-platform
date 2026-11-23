from django.urls import path

from .workspace_views import (
    ExecutorTaskListView,
    ExecutorTaskDetailView,
)

urlpatterns = [
    path("tasks/", ExecutorTaskListView.as_view(), name="executor-task-list"),
    path("tasks/<uuid:task_id>/", ExecutorTaskDetailView.as_view(), name="executor-task-detail"),
]
