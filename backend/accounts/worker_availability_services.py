from django.db import transaction
from django.shortcuts import get_object_or_404

from rest_framework.exceptions import ValidationError

from .models import (
    ExecutorProfile,
    WorkerAvailability,
)


def check_availability_overlap(
    *,
    profile,
    weekday,
    start_time,
    end_time,
    exclude_id=None,
):

    queryset = WorkerAvailability.objects.filter(
        executor_profile=profile,
        weekday=weekday,
        start_time__lt=end_time,
        end_time__gt=start_time,
    )

    if exclude_id is not None:
        queryset = queryset.exclude(
            availability_id=exclude_id,
        )

    if queryset.exists():
        raise ValidationError({
            "non_field_errors": [
                "This time slot overlaps with an existing availability slot."
            ]
        })


@transaction.atomic
def update_availability_timezone(*, user, timezone_name):

    profile, _ = ExecutorProfile.objects.get_or_create(
        user=user,
    )

    profile = ExecutorProfile.objects.select_for_update().get(
        pk=profile.pk,
    )

    profile.availability_timezone = timezone_name

    profile.save(
        update_fields=[
            "availability_timezone",
            "updated_at",
        ]
    )

    return profile


@transaction.atomic
def create_worker_availability(*, user, changes):

    profile, _ = ExecutorProfile.objects.get_or_create(
        user=user,
    )

    profile = ExecutorProfile.objects.select_for_update().get(
        pk=profile.pk,
    )

    check_availability_overlap(
        profile=profile,
        weekday=changes["weekday"],
        start_time=changes["start_time"],
        end_time=changes["end_time"],
    )

    return WorkerAvailability.objects.create(
        executor_profile=profile,
        **changes,
    )


@transaction.atomic
def update_worker_availability(
    *,
    user,
    availability_id,
    changes,
):

    profile = get_object_or_404(
        ExecutorProfile.objects.select_for_update(),
        user=user,
    )

    slot = get_object_or_404(
        WorkerAvailability.objects.select_for_update().filter(
            executor_profile=profile,
        ),
        availability_id=availability_id,
    )

    weekday = changes.get(
        "weekday",
        slot.weekday,
    )

    start_time = changes.get(
        "start_time",
        slot.start_time,
    )

    end_time = changes.get(
        "end_time",
        slot.end_time,
    )

    check_availability_overlap(
        profile=profile,
        weekday=weekday,
        start_time=start_time,
        end_time=end_time,
        exclude_id=slot.availability_id,
    )

    for field, value in changes.items():
        setattr(slot, field, value)

    slot.save(
        update_fields=[
            *changes.keys(),
            "updated_at",
        ]
    )

    return slot


@transaction.atomic
def delete_worker_availability(
    *,
    user,
    availability_id,
):

    profile = get_object_or_404(
        ExecutorProfile.objects.select_for_update(),
        user=user,
    )

    slot = get_object_or_404(
        WorkerAvailability.objects.select_for_update().filter(
            executor_profile=profile,
        ),
        availability_id=availability_id,
    )

    slot.delete()