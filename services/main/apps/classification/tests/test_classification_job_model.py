from __future__ import annotations

from uuid import uuid4

import pytest

from apps.classification.constants import (
    JOB_PUBLISH_STATUSES,
    PUBLISH_STATUS_FAILED,
    PUBLISH_STATUS_PENDING,
    PUBLISH_STATUS_PUBLISHED,
    PUBLISH_STATUS_PUBLISHING,
    PUBLISH_STATUS_RETRY_SCHEDULED,
    RABBITMQ_PUBLISH_MAX_ATTEMPTS,
)
from apps.classification.outbox import (
    ClassificationJobDraft,
    ClassificationJobPayloadError,
    PublishStatusTransitionError,
)


def make_job() -> ClassificationJobDraft:
    submission_id = uuid4()
    job_id = uuid4()
    return ClassificationJobDraft(
        submission_id=submission_id,
        job_id=job_id,
        payload={
            "submission_id": str(submission_id),
            "job_id": str(job_id),
            "attempt": 1,
            "requested_at": "2026-05-14T10:20:01Z",
        },
    )


def test_outbox_contract_has_required_submission_ownership_and_unique_job_id() -> None:
    first = make_job()
    second = make_job()

    assert first.submission_id
    assert first.payload["submission_id"] == str(first.submission_id)
    assert first.job_id != second.job_id


def test_outbox_contract_rejects_missing_required_payload_fields() -> None:
    submission_id = uuid4()

    with pytest.raises(ClassificationJobPayloadError, match="Missing"):
        ClassificationJobDraft(
            submission_id=submission_id,
            payload={
                "submission_id": str(submission_id),
                "attempt": 1,
                "requested_at": "2026-05-14T10:20:01Z",
            },
        )


def test_outbox_contract_rejects_payload_that_does_not_match_owner() -> None:
    submission_id = uuid4()
    job_id = uuid4()

    with pytest.raises(ClassificationJobPayloadError, match="submission_id"):
        ClassificationJobDraft(
            submission_id=submission_id,
            job_id=job_id,
            payload={
                "submission_id": str(uuid4()),
                "job_id": str(job_id),
                "attempt": 1,
                "requested_at": "2026-05-14T10:20:01Z",
            },
        )


def test_publish_status_lifecycle_values_are_explicit() -> None:
    assert JOB_PUBLISH_STATUSES == (
        PUBLISH_STATUS_PENDING,
        PUBLISH_STATUS_PUBLISHING,
        PUBLISH_STATUS_PUBLISHED,
        PUBLISH_STATUS_RETRY_SCHEDULED,
        PUBLISH_STATUS_FAILED,
    )


def test_publish_status_allows_pending_to_publishing_to_published() -> None:
    job = make_job()

    job.transition_to(PUBLISH_STATUS_PUBLISHING)
    job.transition_to(PUBLISH_STATUS_PUBLISHED)

    assert job.publish_status == PUBLISH_STATUS_PUBLISHED
    assert job.locked_at is not None
    assert job.published_at is not None


def test_publish_status_rejects_terminal_transition() -> None:
    job = make_job()
    job.transition_to(PUBLISH_STATUS_PUBLISHING)
    job.transition_to(PUBLISH_STATUS_PUBLISHED)

    with pytest.raises(PublishStatusTransitionError):
        job.transition_to(PUBLISH_STATUS_PUBLISHING)


def test_attempt_error_tracking_schedules_retry_then_fails() -> None:
    job = make_job()

    for attempt in range(1, RABBITMQ_PUBLISH_MAX_ATTEMPTS + 1):
        job.transition_to(PUBLISH_STATUS_PUBLISHING)
        job.record_publish_error(f"broker failure {attempt}")

    assert job.attempt_count == RABBITMQ_PUBLISH_MAX_ATTEMPTS
    assert job.last_error == f"broker failure {RABBITMQ_PUBLISH_MAX_ATTEMPTS}"
    assert job.publish_status == PUBLISH_STATUS_FAILED
    assert job.locked_at is None


def test_publish_error_cannot_mutate_terminal_published_job() -> None:
    job = make_job()
    job.transition_to(PUBLISH_STATUS_PUBLISHING)
    job.transition_to(PUBLISH_STATUS_PUBLISHED)

    with pytest.raises(PublishStatusTransitionError, match="terminal"):
        job.record_publish_error("late broker error")

    assert job.publish_status == PUBLISH_STATUS_PUBLISHED
