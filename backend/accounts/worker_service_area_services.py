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

    # Neighborhoods belong to a single selected city. Switching city clears
    # old selections to avoid silently covering neighborhoods elsewhere.
    new_city = changes.get("service_area_city", profile.service_area_city)
    if new_city.casefold() != profile.service_area_city.casefold():
        profile.service_neighborhoods.all().delete()

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