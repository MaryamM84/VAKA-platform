"""URL routes for task APIs."""

from django.urls import path

from .views import SkillListView, TaskCategoryListView, TaskListCreateView

urlpatterns = [
    path(
        "tasks/",
        TaskListCreateView.as_view(),
        name="task-list-create",
    ),
    path(
        "task-categories/",
        TaskCategoryListView.as_view(),
        name="task-category-list",
    ),
    path(
        "skills/",
        SkillListView.as_view(),
        name="skill-list",
    ),
]
