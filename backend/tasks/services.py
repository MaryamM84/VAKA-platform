"""Business services for task creation and publication."""

from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import APIException, ValidationError

from .choices import TaskSkillSource, TaskStatus
from .models import Task, TaskRequiredSkill, TaskStatusHistory

class TaskPublishConflict(APIException):
    """Raised when a task is not in a publishable state."""

    status_code = status.HTTP_409_CONFLICT
    default_detail = "Only tasks in DRAFT status can be published."
    default_code = "task_publish_conflict"


def _validate_task_for_publication(task):
    """Validate the required task data before publication."""

    errors = {}

    # Required text fields
    required_text_fields = (
        ("title", "A title is required before publishing."),
        ("description", "A description is required before publishing."),
        (
            "delivery_criteria",
            "Delivery criteria are required before publishing.",
        ),
    )

    for field_name, message in required_text_fields:
        value = getattr(task, field_name)

        if not isinstance(value, str) or not value.strip():
            errors[field_name] = [message]

    # Category must still be active
    if task.category_id is None or not task.category.is_active:
        errors["category_id"] = [
            "An active task category is required before publishing."
        ]

    # Duration validation
    duration = task.estimated_duration_minutes

    if duration is None or duration < 1 or duration > 300:
        errors["estimated_duration_minutes"] = [
            "Estimated duration must be between 1 and 300 minutes."
        ]

    # Wage validation
    wage = task.wage_budget_amount

    if wage is None or wage < 0:
        errors["wage_budget_amount"] = [
            "Wage budget must be zero or greater."
        ]

    # Optional item cost cap
    item_cost_cap = task.item_cost_cap_amount

    if item_cost_cap is not None and item_cost_cap < 0:
        errors["item_cost_cap_amount"] = [
            "Item cost cap must be zero or greater."
        ]

    # Execution time validation
    start_at = task.execution_window_start_at
    end_at = task.execution_window_end_at

    if start_at is None or end_at is None or end_at <= start_at:
        errors["execution_window_end_at"] = [
            "Execution end must be later than execution start."
        ]

    # Proposal deadline
    if task.proposal_deadline_at is None:
        errors["proposal_deadline_at"] = [
            "A proposal deadline is required before publishing."
        ]

    if errors:
        raise ValidationError(errors)


@transaction.atomic
def create_task_draft(*, employer, data):
    """Transactionally create a task draft and related records."""

    values = data.copy()
    required_skills = values.pop("required_skills", [])

    # Ownership and initial status are controlled by the backend.
    task = Task.objects.create(
        employer_user=employer,
        status=TaskStatus.DRAFT,
        **values,
    )

    TaskStatusHistory.objects.create(
        task=task,
        from_status=None,
        to_status=TaskStatus.DRAFT,
        changed_by_user=employer,
        reason="Task draft created",
    )

    TaskRequiredSkill.objects.bulk_create(
        [
            TaskRequiredSkill(
                task=task,
                skill=row["skill"],
                importance=row["importance"],
                source=TaskSkillSource.MANUAL,
            )
            for row in required_skills
        ]
    )

    return task


@transaction.atomic
def publish_task(*, task_id, employer):
    """Publish an employer-owned draft and record its status transition."""

    # Lock the task to prevent concurrent publication.
    task = (
        Task.objects.select_for_update()
        .select_related("category")
        .get(
            task_id=task_id,
            employer_user=employer,
        )
    )

    # Only DRAFT can transition to OPEN.
    # CANCELLED and EXPIRED can never be reopened here.
    if task.status != TaskStatus.DRAFT:
        raise TaskPublishConflict()

    # Protect against inconsistent database state.
    if task.published_at is not None:
        raise TaskPublishConflict(
            "This draft has an inconsistent publication timestamp "
            "and cannot be published."
        )

    # Validate all required publication data.
    _validate_task_for_publication(task)

    previous_status = task.status

    # Perform the state transition.
    task.status = TaskStatus.OPEN
    task.published_at = timezone.now()
    task.version += 1

    task.save(
        update_fields=[
            "status",
            "published_at",
            "updated_at",
            "version",
        ]
    )

    # Record the transition in the status history.
    TaskStatusHistory.objects.create(
        task=task,
        from_status=previous_status,
        to_status=TaskStatus.OPEN,
        changed_by_user=employer,
        reason="Task published by employer",
    )

    return task