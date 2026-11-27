from django.urls import path

from .employer_views import EmployerAssignedExecutorView

urlpatterns = [
    path("tasks/<uuid:task_id>/executor/", EmployerAssignedExecutorView.as_view(),
         name="employer-assigned-executor"),
]
