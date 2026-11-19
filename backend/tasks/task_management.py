from django.db import transaction
from rest_framework.exceptions import APIException, NotFound
from django.utils import timezone

from .choices import TaskSkillSource, TaskStatus
from .models import (
    Task,
    TaskLocation,
    TaskRequiredSkill,
    TaskStatusHistory,
)
from .services import _store_location, _validate_task_for_publication
from .lifecycle import transition_task_locked

from offers.models import (
    Bid,
    BidStatus,
    BidStatusHistory,
)


class TaskManagementConflict(APIException):

    status_code = 409
    default_detail = "The task cannot be changed."
    default_code = "task_management_conflict"


@transaction.atomic
def update_employer_task(*, task_id, employer, data):

    try:
        task = (
            Task.objects.select_for_update()
            .select_related("category")
            .get(
                task_id=task_id,
                employer_user=employer,
                deleted_at__isnull=True,
            )
        )

    except Task.DoesNotExist:
        raise NotFound("Task not found.")

    if task.status not in (
        TaskStatus.DRAFT,
        TaskStatus.OPEN,
    ):
        raise TaskManagementConflict(
            "Only DRAFT or OPEN tasks can be edited."
        )

    if (
        task.status == TaskStatus.OPEN
        and Bid.objects.filter(task=task).exists()
    ):
        raise TaskManagementConflict(
            "This task already has submitted bids."
        )

    values = data.copy()

    required_skills = values.pop(
        "required_skills",
        None,
    )

    locations = values.pop(
        "locations",
        None,
    )

    for field, value in values.items():
        setattr(task, field, value)

    if task.status == TaskStatus.OPEN:
        _validate_task_for_publication(task)

    task.version += 1
    task.save()

    if required_skills is not None:

        TaskRequiredSkill.objects.filter(
            task=task
        ).delete()

        TaskRequiredSkill.objects.bulk_create([
            TaskRequiredSkill(
                task=task,
                skill=row["skill"],
                importance=row["importance"],
                source=TaskSkillSource.MANUAL,
            )
            for row in required_skills
        ])

    if locations is not None:

        TaskLocation.objects.filter(
            task=task
        ).delete()

        for location in locations:
            _store_location(
                task=task,
                item=location,
            )

    return task


@transaction.atomic
def cancel_employer_task(*, task_id, employer):

    try:
        task = (
            Task.objects.select_for_update()
            .get(
                task_id=task_id,
                employer_user=employer,
                deleted_at__isnull=True,
            )
        )

    except Task.DoesNotExist:
        raise NotFound("Task not found.")

    # FS §7.2: review only after assignment; never invent unsupported edges.
    if task.status in (TaskStatus.DRAFT, TaskStatus.OPEN):
        target_status = TaskStatus.CANCELLED
        event = "cancel_before_assignment"
    elif task.status in (TaskStatus.ASSIGNED, TaskStatus.IN_PROGRESS):
        target_status = TaskStatus.CANCELLATION_REVIEW
        event = "cancellation_requested"
    else:
        raise TaskManagementConflict(
            f"Cannot cancel task in {task.status} status under FS §7.2."
        )

    active_bids = list(
        Bid.objects.select_for_update()
        .filter(
            task=task,
            status=BidStatus.ACTIVE,
        )
        .order_by("bid_id")
    )

    for bid in active_bids:

        previous_bid_status = bid.status

        bid.status = BidStatus.REJECTED

        bid.save(
            update_fields=[
                "status",
                "updated_at",
            ]
        )

        BidStatusHistory.objects.create(
            bid=bid,
            from_status=previous_bid_status,
            to_status=BidStatus.REJECTED,
            changed_by_user=employer,
            reason="Task cancellation requested by employer",
        )

    transition_task_locked(
        task=task,
        target=target_status,
        event=event,
        actor=employer,
        reason=(
            "Task cancelled by employer"
            if target_status == TaskStatus.CANCELLED
            else "Task cancellation review requested by employer"
        ),
    )

    return task

@transaction.atomic
def soft_delete_employer_task(*, task_id, employer):
    try:
        task = (
            Task.objects.select_for_update()
            .get(
                task_id=task_id,
                employer_user=employer,
                deleted_at__isnull=True,
            )
        )
    except Task.DoesNotExist:
        raise NotFound("Task not found.")

    if task.status not in (
        TaskStatus.DRAFT,
        TaskStatus.OPEN,
    ):
        raise TaskManagementConflict(
            "Only DRAFT or OPEN tasks can be deleted."
        )

    if Bid.objects.filter(task=task).exists():
        raise TaskManagementConflict(
            "Tasks with submitted bids cannot be deleted. "
            "Use the cancellation workflow instead."
        )

    transition_task_locked(
        task=task, target=TaskStatus.CANCELLED,
        event="cancel_before_assignment", actor=employer,
        reason="Task deleted by employer",
    )
    task.deleted_at = timezone.now()
    task.save(update_fields=["deleted_at", "updated_at"])

    return task