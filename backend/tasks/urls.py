"""URL routes for task APIs."""

from django.urls import path

from .views import (
    SkillListView,
    TaskCategoryListView,
    TaskListCreateView,
    TaskPublishView,
)


urlpatterns = [

    # Create a task and list employer's tasks
    path(
        "tasks/",
        TaskListCreateView.as_view(),
        name="task-list-create",
    ),

    # Publish an existing task draft
    path(
        "tasks/<uuid:task_id>/publish/",
        TaskPublishView.as_view(),
        name="task-publish",
    ),

    # List active task categories
    path(
        "task-categories/",
        TaskCategoryListView.as_view(),
        name="task-category-list",
    ),

    # List skills
    path(
        "skills/",
        SkillListView.as_view(),
        name="skill-list",
    ),

]