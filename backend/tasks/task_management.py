from django.db import transaction
from rest_framework.exceptions import APIException, NotFound

from .choices import TaskSkillSource, TaskStatus
from .models import (
    Task,
    TaskLocation,
    TaskRequiredSkill,
    TaskStatusHistory,
)
from .services import _store_location, _validate_task_for_publication

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
            )
        )

    except Task.DoesNotExist:
        raise NotFound("Task not found.")

    if task.status in (
        TaskStatus.DRAFT,
        TaskStatus.OPEN,
    ):
        target_status = TaskStatus.CANCELLED

    elif task.status in (
        TaskStatus.FUNDING_PENDING,
        TaskStatus.ASSIGNED,
        TaskStatus.IN_PROGRESS,
        TaskStatus.SUBMITTED,
        TaskStatus.APPROVED,
        TaskStatus.DISPUTED,
    ):
        target_status = TaskStatus.CANCELLATION_REVIEW

    else:
        raise TaskManagementConflict(
            f"Cannot cancel task in {task.status} status."
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

    previous_task_status = task.status

    task.status = target_status
    task.version += 1

    task.save(
        update_fields=[
            "status",
            "version",
            "updated_at",
        ]
    )

    TaskStatusHistory.objects.create(
        task=task,
        from_status=previous_task_status,
        to_status=target_status,
        changed_by_user=employer,
        reason=(
            "Task cancelled by employer"
            if target_status == TaskStatus.CANCELLED
            else "Task cancellation review requested by employer"
        ),
    )

    return task