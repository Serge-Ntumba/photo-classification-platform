from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from apps.core.images import NormalizedImage
from apps.core.storage import ObjectStorageClient, build_submission_object_key


@dataclass(frozen=True, slots=True)
class StoredSubmissionPhoto:
    object_key: str
    original_filename: str
    content_type: str
    size_bytes: int
    width: int
    height: int


class SubmissionStorageService:
    """Stores normalized uploads as private objects and exposes references only."""

    def __init__(self, storage_client: ObjectStorageClient | None = None) -> None:
        self.storage_client = storage_client or ObjectStorageClient()

    def store_photo(
        self,
        *,
        submission_id: UUID,
        original_filename: str,
        normalized_image: NormalizedImage,
    ) -> StoredSubmissionPhoto:
        object_key = build_submission_object_key(submission_id, original_filename)
        self.storage_client.upload_bytes(
            key=object_key,
            content=normalized_image.content,
            content_type=normalized_image.content_type,
        )
        return StoredSubmissionPhoto(
            object_key=object_key,
            original_filename=original_filename,
            content_type=normalized_image.content_type,
            size_bytes=normalized_image.size_bytes,
            width=normalized_image.width,
            height=normalized_image.height,
        )

    def delete_photo(self, object_key: str) -> None:
        self.storage_client.delete_object(key=object_key)
