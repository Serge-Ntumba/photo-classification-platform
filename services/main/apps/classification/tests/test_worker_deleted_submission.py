from __future__ import annotations

import pytest

from apps.classification.models import ClassificationResult
from apps.classification.tasks import process_classification_job_payload
from apps.submissions.retention_service import permanently_delete_submission

from .factories import FakeClassifierClient, FakeStorageClient, make_job

pytestmark = pytest.mark.django_db


class RecordingDeletionService:
    def __init__(self) -> None:
        self.deleted: list[str] = []

    def delete_photo(self, object_key: str) -> None:
        self.deleted.append(object_key)


def test_worker_skips_job_after_submission_was_permanently_deleted() -> None:
    job = make_job()
    payload = dict(job.payload)
    object_key = job.submission.photo_object_key
    deletion_service = RecordingDeletionService()

    permanently_delete_submission(
        submission_id=job.submission_id,
        storage_service=deletion_service,
    )

    client = FakeClassifierClient()
    result = process_classification_job_payload(
        payload,
        client=client,
        storage_client=FakeStorageClient(),
    )

    assert deletion_service.deleted == [object_key]
    assert result.status == "skipped"
    assert client.calls == 0
    assert ClassificationResult.objects.count() == 0
