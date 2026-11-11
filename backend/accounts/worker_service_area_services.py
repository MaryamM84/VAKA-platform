from django.db import transaction

from .models import ExecutorProfile


@transaction.atomic
def update_worker_service_area(*, user, changes):

    profile, _ = ExecutorProfile.objects.get_or_create(
        user=user,
    )

    profile = ExecutorProfile.objects.select_for_update().get(
        pk=profile.pk,
    )

    updated_fields = []

    for field, value in changes.items():

        setattr(profile, field, value)
        updated_fields.append(field)

    if updated_fields:

        updated_fields.append("updated_at")

        profile.save(
            update_fields=updated_fields,
        )

    return profile