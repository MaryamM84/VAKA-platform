"""Transactionally create a task draft and its related records."""
from django.db import transaction

from .choices import TaskSkillSource, TaskStatus
from .models import Task, TaskRequiredSkill, TaskStatusHistory


@transaction.atomic
def create_task_draft(*, employer, data):
    # Operate on a copy because serializers may reuse their validated input.
    values = data.copy()
    required_skills = values.pop("required_skills", [])

    # These attributes belong to the server, never the request body.
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

    TaskRequiredSkill.objects.bulk_create([
        TaskRequiredSkill(
            task=task,
            skill=row["skill"],
            importance=row["importance"],
            source=TaskSkillSource.MANUAL,
        )
        for row in required_skills
    ])
    return task
