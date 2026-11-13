from django.core.files.storage import default_storage
from PIL import Image, UnidentifiedImageError
from rest_framework import serializers


AVATAR_PRESET_IDS = tuple(f"avatar_{number}" for number in range(1, 7))
AVATAR_PRESET_CHOICES = tuple((value, value) for value in AVATAR_PRESET_IDS)

MAX_PROFILE_AVATAR_SIZE = 5 * 1024 * 1024
MAX_PROFILE_AVATAR_PIXELS = 16_000_000
ALLOWED_AVATAR_FORMATS = {
    "JPEG": ".jpg",
    "PNG": ".png",
    "WEBP": ".webp",
}


def get_avatar_type(user):
    key = user.avatar_key
    if not key:
        return None
    if key.startswith("preset:"):
        return "preset"
    if key.startswith("avatars/"):
        return "upload"
    return "legacy"


def get_avatar_id(user):
    key = user.avatar_key
    if key and key.startswith("preset:"):
        return key.partition(":")[2]
    return None


def get_avatar_url(user, request=None):
    key = user.avatar_key
    if not key or not key.startswith("avatars/"):
        return None

    try:
        url = default_storage.url(key)
    except (ValueError, NotImplementedError):
        return None

    if request is not None:
        return request.build_absolute_uri(url)
    return url


class RejectUnexpectedAvatarFieldsMixin:
    def to_internal_value(self, data):
        if not hasattr(data, "keys"):
            raise serializers.ValidationError("Expected an object.")

        allowed_fields = {
            name
            for name, field in self.fields.items()
            if not field.read_only
        }
        unexpected = set(data.keys()) - allowed_fields
        if unexpected:
            raise serializers.ValidationError({
                name: ["This field is not accepted by this endpoint."]
                for name in sorted(unexpected)
            })

        return super().to_internal_value(data)


class AvatarPresetSelectionSerializer(
    RejectUnexpectedAvatarFieldsMixin,
    serializers.Serializer,
):
    avatar_id = serializers.ChoiceField(choices=AVATAR_PRESET_CHOICES)


class AvatarUploadSerializer(
    RejectUnexpectedAvatarFieldsMixin,
    serializers.Serializer,
):
    image = serializers.FileField(allow_empty_file=False)

    def validate_image(self, value):
        if value.size > MAX_PROFILE_AVATAR_SIZE:
            raise serializers.ValidationError(
                "The maximum profile image size is 5 MB."
            )

        value.seek(0)
        try:
            with Image.open(value) as image:
                image_format = image.format
                width, height = image.size
                if width < 1 or height < 1:
                    raise serializers.ValidationError("Invalid image dimensions.")
                if width * height > MAX_PROFILE_AVATAR_PIXELS:
                    raise serializers.ValidationError(
                        "The image dimensions are too large."
                    )
                image.verify()
        except serializers.ValidationError:
            raise
        except (UnidentifiedImageError, OSError, Image.DecompressionBombError,
                Image.DecompressionBombWarning):
            raise serializers.ValidationError(
                "The uploaded file is not a valid supported image."
            )
        finally:
            value.seek(0)

        if image_format not in ALLOWED_AVATAR_FORMATS:
            raise serializers.ValidationError(
                "Only JPEG, PNG and WEBP images are supported."
            )

        self._image_format = image_format
        return value

    def validate(self, attrs):
        attrs["image_format"] = self._image_format
        return attrs


class ProfileAvatarReadSerializer(serializers.Serializer):
    avatar_key = serializers.CharField(allow_null=True, read_only=True)
    avatar_type = serializers.SerializerMethodField()
    avatar_id = serializers.SerializerMethodField()
    avatar_url = serializers.SerializerMethodField()

    def get_avatar_type(self, user):
        return get_avatar_type(user)

    def get_avatar_id(self, user):
        return get_avatar_id(user)

    def get_avatar_url(self, user):
        return get_avatar_url(user, self.context.get("request"))
