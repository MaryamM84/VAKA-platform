from io import BytesIO
import tempfile

from django.core.files.storage import default_storage
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from PIL import Image
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import User


class ProfileAvatarAPITests(APITestCase):
    def setUp(self):
        self.media_directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.media_directory.cleanup)
        settings_override = override_settings(
            MEDIA_ROOT=self.media_directory.name,
            MEDIA_URL="/media/",
        )
        settings_override.enable()
        self.addCleanup(settings_override.disable)

        self.user = User.objects.create_user(
            phone="09129990001",
            full_name="Avatar User",
            password="Strong-test-password-123!",
            phone_verified_at=timezone.now(),
        )
        self.client.force_authenticate(user=self.user)
        self.avatar_url = reverse("profile:my-profile-avatar")
        self.profile_url = reverse("profile:my-profile")

    @staticmethod
    def make_image(*, image_format="JPEG", name=None):
        buffer = BytesIO()
        Image.new("RGB", (48, 48), color=(120, 80, 160)).save(
            buffer,
            format=image_format,
        )
        extension = {
            "JPEG": "jpg",
            "PNG": "png",
            "WEBP": "webp",
            "GIF": "gif",
        }[image_format]
        return SimpleUploadedFile(
            name or f"avatar.{extension}",
            buffer.getvalue(),
            content_type=f"image/{extension}",
        )

    def test_selecting_preset_avatar_is_persisted_and_returned_by_profile(self):
        response = self.client.patch(
            self.avatar_url,
            {"avatar_id": "avatar_3"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data["avatar_key"], "preset:avatar_3")
        self.assertEqual(response.data["avatar_type"], "preset")
        self.assertEqual(response.data["avatar_id"], "avatar_3")
        self.assertIsNone(response.data["avatar_url"])

        self.user.refresh_from_db()
        self.assertEqual(self.user.avatar_key, "preset:avatar_3")

        refresh_response = self.client.get(self.profile_url)
        self.assertEqual(refresh_response.status_code, status.HTTP_200_OK)
        self.assertEqual(refresh_response.data["avatar_id"], "avatar_3")
        self.assertEqual(refresh_response.data["avatar_type"], "preset")

    def test_unknown_preset_avatar_is_rejected(self):
        response = self.client.patch(
            self.avatar_url,
            {"avatar_id": "avatar_7"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.user.refresh_from_db()
        self.assertIsNone(self.user.avatar_key)

    def test_upload_profile_image_returns_public_url_and_persists_key(self):
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(
                self.avatar_url,
                {"image": self.make_image()},
                format="multipart",
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data["avatar_type"], "upload")
        self.assertIsNone(response.data["avatar_id"])
        self.assertTrue(response.data["avatar_url"].endswith(".jpg"))

        key = response.data["avatar_key"]
        self.assertTrue(key.startswith(f"avatars/{self.user.pk}/"))
        self.assertTrue(default_storage.exists(key))

        self.user.refresh_from_db()
        self.assertEqual(self.user.avatar_key, key)

        profile_response = self.client.get(self.profile_url)
        self.assertEqual(profile_response.status_code, status.HTTP_200_OK)
        self.assertEqual(profile_response.data["avatar_key"], key)
        self.assertEqual(profile_response.data["avatar_url"], response.data["avatar_url"])

    def test_upload_replaces_previous_uploaded_image_and_deletes_old_file(self):
        with self.captureOnCommitCallbacks(execute=True):
            first_response = self.client.post(
                self.avatar_url,
                {"image": self.make_image()},
                format="multipart",
            )
        old_key = first_response.data["avatar_key"]
        self.assertTrue(default_storage.exists(old_key))

        with self.captureOnCommitCallbacks(execute=True):
            second_response = self.client.post(
                self.avatar_url,
                {"image": self.make_image(image_format="PNG")},
                format="multipart",
            )

        self.assertEqual(second_response.status_code, status.HTTP_200_OK)
        new_key = second_response.data["avatar_key"]
        self.assertNotEqual(old_key, new_key)
        self.assertFalse(default_storage.exists(old_key))
        self.assertTrue(default_storage.exists(new_key))

    def test_selecting_preset_replaces_uploaded_image_and_deletes_file(self):
        with self.captureOnCommitCallbacks(execute=True):
            upload_response = self.client.post(
                self.avatar_url,
                {"image": self.make_image()},
                format="multipart",
            )
        old_key = upload_response.data["avatar_key"]
        self.assertTrue(default_storage.exists(old_key))

        with self.captureOnCommitCallbacks(execute=True):
            preset_response = self.client.patch(
                self.avatar_url,
                {"avatar_id": "avatar_2"},
                format="json",
            )

        self.assertEqual(preset_response.status_code, status.HTTP_200_OK)
        self.assertEqual(preset_response.data["avatar_id"], "avatar_2")
        self.assertFalse(default_storage.exists(old_key))

    def test_upload_larger_than_five_megabytes_is_rejected(self):
        image = self.make_image()
        image.seek(0)
        oversized_content = image.read() + (b"0" * (5 * 1024 * 1024))
        oversized = SimpleUploadedFile(
            "large-avatar.jpg",
            oversized_content,
            content_type="image/jpeg",
        )

        response = self.client.post(
            self.avatar_url,
            {"image": oversized},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("image", response.data)
        self.user.refresh_from_db()
        self.assertIsNone(self.user.avatar_key)

    def test_gif_upload_is_rejected(self):
        response = self.client.post(
            self.avatar_url,
            {"image": self.make_image(image_format="GIF")},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.user.refresh_from_db()
        self.assertIsNone(self.user.avatar_key)

    def test_delete_removes_uploaded_image_and_clears_avatar(self):
        with self.captureOnCommitCallbacks(execute=True):
            upload_response = self.client.post(
                self.avatar_url,
                {"image": self.make_image()},
                format="multipart",
            )
        key = upload_response.data["avatar_key"]
        self.assertTrue(default_storage.exists(key))

        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.delete(self.avatar_url)

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.user.refresh_from_db()
        self.assertIsNone(self.user.avatar_key)
        self.assertFalse(default_storage.exists(key))

        get_response = self.client.get(self.avatar_url)
        self.assertEqual(get_response.status_code, status.HTTP_200_OK)
        self.assertIsNone(get_response.data["avatar_key"])
        self.assertIsNone(get_response.data["avatar_url"])

    def test_delete_is_idempotent_when_no_avatar_is_selected(self):
        response = self.client.delete(self.avatar_url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

    def test_avatar_endpoints_require_authentication(self):
        self.client.force_authenticate(user=None)

        get_response = self.client.get(self.avatar_url)
        patch_response = self.client.patch(
            self.avatar_url,
            {"avatar_id": "avatar_1"},
            format="json",
        )
        post_response = self.client.post(
            self.avatar_url,
            {"image": self.make_image()},
            format="multipart",
        )
        delete_response = self.client.delete(self.avatar_url)

        for response in (get_response, patch_response, post_response, delete_response):
            self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
