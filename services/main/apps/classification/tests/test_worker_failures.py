from __future__ import annotations

import pytest

from apps.classification.client import ClassifierClientError
from apps.classification.constants import (
    SUBMISSION_STATUS_CLASSIFICATION_FAILED,
    SUBMISSION_STATUS_CLASSIFIED,
    SUBMISSION_STATUS_CLASSIFYING,
)
from apps.classification.models import ClassificationResult
from apps.classification.tasks import (
    RetryableClassificationError,
    fail_classification_after_retry_exhaustion,
    process_classification_job_payload,
)

from .factories import FakeClassifierClient, FakeStorageClient, make_job, make_submission

pytestmark = pytest.mark.django_db


def test_classifier_timeout_is_retryable_and_retry_exhaustion_marks_failed() -> None:
    job = make_job()

    with pytest.raises(RetryableClassificationError, match="timeout"):
        process_classification_job_payload(
            job.payload,
            client=FakeClassifierClient(error=ClassifierClientError("timeout")),
            storage_client=FakeStorageClient(),
        )

    job.submission.refresh_from_db()
    assert job.submission.status == SUBMISSION_STATUS_CLASSIFYING

    fail_classification_after_retry_exhaustion(payload=job.payload, error="timeout")

    job.submission.refresh_from_db()
    job.refresh_from_db()
    assert job.submission.status == SUBMISSION_STATUS_CLASSIFICATION_FAILED
    assert job.last_error == "timeout"


def test_malformed_classifier_response_fails_without_persisting_result() -> None:
    job = make_job()

    result = process_classification_job_payload(
        job.payload,
        client=FakeClassifierClient(response={"category": "not enough"}),
        storage_client=FakeStorageClient(),
    )

    job.submission.refresh_from_db()
    assert result.status == "failed"
    assert job.submission.status == SUBMISSION_STATUS_CLASSIFICATION_FAILED
    assert ClassificationResult.objects.count() == 0


def test_missing_object_is_retryable() -> None:
    job = make_job()

    with pytest.raises(RetryableClassificationError, match="object missing"):
        process_classification_job_payload(
            job.payload,
            client=FakeClassifierClient(),
            storage_client=FakeStorageClient(error=RuntimeError("object missing")),
        )


def test_deleted_submission_race_skips_missing_job() -> None:
    job = make_job()
    payload = dict(job.payload)
    job.submission.delete()

    result = process_classification_job_payload(
        payload,
        client=FakeClassifierClient(),
        storage_client=FakeStorageClient(),
    )

    assert result.status == "skipped"
    assert ClassificationResult.objects.count() == 0


def test_terminal_submission_is_skipped() -> None:
    submission = make_submission(status=SUBMISSION_STATUS_CLASSIFIED)
    job = make_job(submission)
    client = FakeClassifierClient()

    result = process_classification_job_payload(
        job.payload,
        client=client,
        storage_client=FakeStorageClient(),
    )

    assert result.status == "skipped"
    assert client.calls == 0
    assert ClassificationResult.objects.count() == 0
