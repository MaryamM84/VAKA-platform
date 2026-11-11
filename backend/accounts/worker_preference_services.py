from django.db import transaction

from .models import ExecutorProfile


@transaction.atomic
def update_worker_preferences(*, user, changes):

    profile, _ = ExecutorProfile.objects.get_or_create(
        user=user,
    )

    changes = dict(changes)

    categories = changes.pop(
        "preferred_category_ids",
        None,
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

    if categories is not None:

        profile.preferred_categories.set(categories)

        if not updated_fields:
            profile.save(
                update_fields=["updated_at"],
            )

    return profile