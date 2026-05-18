from __future__ import annotations

from uuid import uuid4

import pytest
from django.contrib import admin

from apps.classification.models import ClassificationJob, ClassificationResult
from apps.classification.publisher import create_classification_job
from apps.submissions.models import Submission
from apps.submissions.retention_service import (
    SubmissionRetentionError,
    permanently_delete_submission,
)
from factories import make_admin_user, make_classification_result, make_submission

pytestmark = pytest.mark.django_db


class RecordingDeletionService:
    def __init__(self, *, error: Exception | None = None) -> None:
        self.deleted: list[str] = []
        self.error = error

    def delete_photo(self, object_key: str) -> None:
        if self.error is not None:
            raise self.error
        self.deleted.append(object_key)


def test_permanent_submission_deletion_removes_photo_and_submission_linked_history() -> None:
    object_key = f"uploads/submissions/{uuid4()}/profile.jpg"
    submission = make_submission(photo_object_key=object_key)
    create_classification_job(submission)
    result = make_classification_result(submission=submission)
    deletion_service = RecordingDeletionService()

    outcome = permanently_delete_submission(
        submission_id=submission.id,
        storage_service=deletion_service,
    )

    assert outcome.submission_id == submission.id
    assert deletion_service.deleted == [object_key]
    assert not Submission.objects.filter(id=submission.id).exists()
    assert not ClassificationJob.objects.filter(submission_id=submission.id).exists()
    assert not ClassificationResult.objects.filter(id=result.id).exists()


def test_permanent_deletion_keeps_database_records_when_photo_delete_fails() -> None:
    submission = make_submission()
    result = make_classification_result(submission=submission)
    deletion_service = RecordingDeletionService(error=RuntimeError("object store unavailable"))

    with pytest.raises(SubmissionRetentionError, match="Could not delete private photo object"):
        permanently_delete_submission(
            submission_id=submission.id,
            storage_service=deletion_service,
        )

    assert Submission.objects.filter(id=submission.id).exists()
    assert ClassificationResult.objects.filter(id=result.id).exists()
    assert deletion_service.deleted == []


def test_admin_delete_delegates_to_retention_service(rf, monkeypatch: pytest.MonkeyPatch) -> None:
    admin_user = make_admin_user("retention-admin")
    submission = make_submission()
    submission_admin = admin.site._registry[Submission]
    request = rf.post("/admin/submissions/submission/delete/")
    request.user = admin_user
    deleted: list[str] = []

    def fake_delete(*, submission_id):
        deleted.append(str(submission_id))

    monkeypatch.setattr("apps.submissions.admin.permanently_delete_submission", fake_delete)

    assert submission_admin.has_delete_permission(request, submission) is True
    submission_admin.delete_model(request, submission)

    assert deleted == [str(submission.id)]
