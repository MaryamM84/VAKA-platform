from uuid import uuid4

from django.core.files.storage import default_storage
from django.db import transaction
from rest_framework.exceptions import ValidationError

from .models import User
from .profile_avatar_serializers import ALLOWED_AVATAR_FORMATS, AVATAR_PRESET_IDS


def _schedule_old_avatar_deletion(old_key, new_key):
    if (
        old_key
        and old_key != new_key
        and old_key.startswith("avatars/")
    ):
        transaction.on_commit(
            lambda key=old_key: default_storage.delete(key)
        )


@transaction.atomic
def select_profile_avatar(*, user, avatar_id):
    if avatar_id not in AVATAR_PRESET_IDS:
        raise ValidationError({"avatar_id": "Unknown avatar selection."})

    locked_user = User.objects.select_for_update().get(pk=user.pk)
    old_key = locked_user.avatar_key
    new_key = f"preset:{avatar_id}"

    if old_key != new_key:
        locked_user.avatar_key = new_key
        locked_user.save(update_fields=["avatar_key", "updated_at"])
        _schedule_old_avatar_deletion(old_key, new_key)

    return locked_user


@transaction.atomic
def upload_profile_avatar(*, user, image, image_format):
    extension = ALLOWED_AVATAR_FORMATS.get(image_format)
    if extension is None:
        raise ValidationError({
            "image": "Only JPEG, PNG and WEBP images are supported."
        })

    locked_user = User.objects.select_for_update().get(pk=user.pk)
    old_key = locked_user.avatar_key

    image.seek(0)
    requested_name = f"avatars/{locked_user.pk}/{uuid4().hex}{extension}"
    new_key = default_storage.save(requested_name, image)

    try:
        locked_user.avatar_key = new_key
        locked_user.save(update_fields=["avatar_key", "updated_at"])
    except Exception:
        default_storage.delete(new_key)
        raise

    _schedule_old_avatar_deletion(old_key, new_key)
    return locked_user


@transaction.atomic
def delete_profile_avatar(*, user):
    locked_user = User.objects.select_for_update().get(pk=user.pk)
    old_key = locked_user.avatar_key

    if old_key is not None:
        locked_user.avatar_key = None
        locked_user.save(update_fields=["avatar_key", "updated_at"])
        _schedule_old_avatar_deletion(old_key, None)

    return locked_user
