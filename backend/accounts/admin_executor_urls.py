from django.urls import path

from .admin_executor_views import AdminExecutorListView

urlpatterns = [
    path("", AdminExecutorListView.as_view(), name="admin-executor-list"),
]
