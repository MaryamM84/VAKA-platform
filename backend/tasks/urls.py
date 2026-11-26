"""URL routes for task APIs."""

from django.urls import path

from .category_management import CategoryManageListCreateView, CategoryManageDetailView
from execution.views import TaskExecutionStartView

from .views import (
    CategoryTaskListView,
    SkillListView,
    TaskCategoryListView,
    TaskDiscoveryDetailView,
    TaskDiscoveryListView,
    TaskListCreateView,
    TaskPublishView,
    TaskSubcategoryListView,
    EmployerTaskDetailView,
    EmployerTaskCancelView,
)

from payments.expense_views import (
    ExpenseClaimListCreateView, ExpenseClaimApproveView,
    ExpenseClaimRejectView, ExpenseReceiptDownloadView,
)


urlpatterns = [
    # Expense claims: employer and accepted executor share a task-scoped resource.
    path("tasks/<uuid:task_id>/expense-claims/",
         ExpenseClaimListCreateView.as_view(), name="expense-claim-list-create"),
    path("tasks/<uuid:task_id>/expense-claims/<uuid:claim_id>/approve/",
         ExpenseClaimApproveView.as_view(), name="expense-claim-approve"),
    path("tasks/<uuid:task_id>/expense-claims/<uuid:claim_id>/reject/",
         ExpenseClaimRejectView.as_view(), name="expense-claim-reject"),
    path("tasks/<uuid:task_id>/expense-claims/<uuid:claim_id>/receipts/<uuid:receipt_id>/",
         ExpenseReceiptDownloadView.as_view(), name="expense-claim-receipt"),
    # Existing employer endpoints: preserve their behavior and names.
    path("tasks/", TaskListCreateView.as_view(), name="task-list-create"),
    path(
        "tasks/<uuid:task_id>/publish/",
        TaskPublishView.as_view(),
        name="task-publish",
    ),

    path(
        "tasks/<uuid:task_id>/start/",
        TaskExecutionStartView.as_view(),
        name="task-execution-start",
    ),

    path(
        "tasks/<uuid:task_id>/cancel/",
        EmployerTaskCancelView.as_view(),
        name="task-cancel",
    ),

    path(
        "tasks/<uuid:task_id>/",
        EmployerTaskDetailView.as_view(),
        name="task-detail-update",
    ),

    # Existing public catalog endpoints.
    path(
        "task-categories/",
        TaskCategoryListView.as_view(),
        name="task-category-list",
    ),
    path("skills/", SkillListView.as_view(), name="skill-list"),

    # New category and subcategory discovery endpoints.
    path(
        "task-categories/<uuid:category_id>/subcategories/",
        TaskSubcategoryListView.as_view(),
        name="task-category-subcategories",
    ),
    path(
        "task-categories/<uuid:category_id>/tasks/",
        CategoryTaskListView.as_view(),
        name="task-category-tasks",
    ),

    # New task discovery endpoints. Keep them separate from /api/tasks/.
    path(
        "discovery/tasks/",
        TaskDiscoveryListView.as_view(),
        name="task-discovery-list",
    ),
    path(
        "discovery/tasks/<uuid:task_id>/",
        TaskDiscoveryDetailView.as_view(),
        name="task-discovery-detail",
    ),
    # Restricted management; do not change public catalog behavior.
    path(
        "manage/task-categories/",
        CategoryManageListCreateView.as_view(),
        name="task-category-manage-list-create",
    ),
    path(
        "manage/task-categories/<uuid:category_id>/",
        CategoryManageDetailView.as_view(),
        name="task-category-manage-detail",
    ),
]
