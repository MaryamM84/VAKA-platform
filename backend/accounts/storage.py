
from django.conf import settings
from django.core.files.storage import FileSystemStorage
from django.utils.deconstruct import deconstructible


@deconstructible
class PrivateFileSystemStorage(FileSystemStorage):

    def __init__(self, location=None):
        super().__init__(
            location=location or settings.PRIVATE_MEDIA_ROOT,
        )

    def url(self, name):
        raise ValueError(
            "Private verification documents "
            "cannot be accessed through public URLs."
        )


private_verification_storage = PrivateFileSystemStorage()
