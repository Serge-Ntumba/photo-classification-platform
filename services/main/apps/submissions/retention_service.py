from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from django.db import transaction

from .models import Submission
from .storage_service import SubmissionStorageService


class SubmissionRetentionError(RuntimeError):
    """Raised when permanent deletion cannot safely remove linked private data."""


@dataclass(frozen=True, slots=True)
class PermanentDeletionOutcome:
    submission_id: UUID
    photo_object_key: str
    deleted_counts: dict[str, int]


def permanently_delete_submission(
    *,
    submission_id: UUID | str,
    storage_service: SubmissionStorageService | None = None,
) -> PermanentDeletionOutcome:
    """Delete a submission and its private photo as one fail-closed retention action."""

    service = storage_service or SubmissionStorageService()
    with transaction.atomic():
        submission = Submission.objects.select_for_update().get(pk=submission_id)
        deleted_submission_id = submission.id
        photo_object_key = submission.photo_object_key
        try:
            service.delete_photo(photo_object_key)
        except Exception as exc:
            raise SubmissionRetentionError(
                "Could not delete private photo object; submission was retained.",
            ) from exc

        deleted_counts = submission.delete()[1]

    return PermanentDeletionOutcome(
        submission_id=deleted_submission_id,
        photo_object_key=photo_object_key,
        deleted_counts=deleted_counts,
    )
