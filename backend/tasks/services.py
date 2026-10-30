
import uuid

from django.db import connection, transaction

from .choices import TaskSkillSource, TaskStatus
from .models import Task, TaskRequiredSkill, TaskStatusHistory


def _store_location(*, task, item):
    longitude = item["longitude"]
    latitude = item["latitude"]

    with connection.cursor() as cursor:
        cursor.execute(
            """
            INSERT INTO task_locations (
                task_location_id,
                task_id,
                location_type,
                stop_order,
                city,
                region,
                approximate_point,
                exact_point
            )
            VALUES (
                %s::uuid,
                %s::uuid,
                %s,
                %s,
                %s,
                %s,
                ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography,
                ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography
            )
            """,
            [
                str(uuid.uuid4()),
                str(task.pk),
                item["location_type"],
                item["stop_order"],
                item["city"],
                item["region"],
                round(longitude, 2),
                round(latitude, 2),
                longitude,
                latitude,
            ],
        )


@transaction.atomic
def create_task_draft(*, employer, data):
    values = data.copy()

    required_skills = values.pop("required_skills", [])
    locations = values.pop("locations", [])

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

    for item in locations:
        _store_location(task=task, item=item)

    return task
