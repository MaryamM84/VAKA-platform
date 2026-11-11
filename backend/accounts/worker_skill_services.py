from django.db import transaction

from .models import ExecutorProfile, WorkerSkill


@transaction.atomic
def add_worker_skill(
    *,
    user,
    skill,
    proficiency_level,
    experience_years,
):

    profile, _ = ExecutorProfile.objects.get_or_create(
        user=user,
    )

    return WorkerSkill.objects.create(
        executor_profile=profile,
        skill=skill,
        proficiency_level=proficiency_level,
        experience_years=experience_years,
    )


@transaction.atomic
def update_worker_skill(
    *,
    worker_skill,
    changes,
):

    worker_skill = WorkerSkill.objects.select_for_update().get(
        pk=worker_skill.pk,
    )

    for field, value in changes.items():
        setattr(worker_skill, field, value)

    worker_skill.save(
        update_fields=[
            *changes.keys(),
            "updated_at",
        ]
    )

    return worker_skill


@transaction.atomic
def delete_worker_skill(*, worker_skill):

    worker_skill.delete()