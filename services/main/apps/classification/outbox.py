"""Small lifecycle helpers for the future durable classification outbox model."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from uuid import UUID, uuid4

from .constants import (
    JOB_PUBLISH_STATUSES,
    JOB_PUBLISH_STATUS_TRANSITIONS,
    PUBLISH_STATUS_FAILED,
    PUBLISH_STATUS_PENDING,
    PUBLISH_STATUS_PUBLISHED,
    PUBLISH_STATUS_PUBLISHING,
    PUBLISH_STATUS_RETRY_SCHEDULED,
    RABBITMQ_PUBLISH_MAX_ATTEMPTS,
)

CLASSIFICATION_JOB_PAYLOAD_REQUIRED_FIELDS = frozenset(
    {"submission_id", "job_id", "attempt", "requested_at"},
)


class PublishStatusTransitionError(ValueError):
    """Raised when an outbox job is moved through an invalid lifecycle edge."""


class ClassificationJobPayloadError(ValueError):
    """Raised when a classification job payload violates the minimal contract."""


@dataclass(slots=True)
class ClassificationJobDraft:
    """Phase-2 contract object mirroring fields required by the durable outbox row."""

    submission_id: UUID
    payload: dict[str, object]
    job_id: UUID = field(default_factory=uuid4)
    publish_status: str = PUBLISH_STATUS_PENDING
    attempt_count: int = 0
    last_error: str = ""
    locked_at: datetime | None = None
    published_at: datetime | None = None

    def __post_init__(self) -> None:
        self._validate_publish_state()
        self._validate_payload()

    def _validate_publish_state(self) -> None:
        if self.publish_status not in JOB_PUBLISH_STATUSES:
            msg = f"Unknown publish status {self.publish_status!r}."
            raise PublishStatusTransitionError(msg)
        if self.attempt_count < 0:
            raise PublishStatusTransitionError("Publish attempt count cannot be negative.")

    def _validate_payload(self) -> None:
        payload_fields = set(self.payload)
        if payload_fields != CLASSIFICATION_JOB_PAYLOAD_REQUIRED_FIELDS:
            missing = sorted(CLASSIFICATION_JOB_PAYLOAD_REQUIRED_FIELDS - payload_fields)
            extra = sorted(payload_fields - CLASSIFICATION_JOB_PAYLOAD_REQUIRED_FIELDS)
            msg = f"Classification job payload fields are invalid. Missing={missing}; extra={extra}."
            raise ClassificationJobPayloadError(msg)

        try:
            payload_submission_id = UUID(str(self.payload["submission_id"]))
            payload_job_id = UUID(str(self.payload["job_id"]))
        except (TypeError, ValueError) as exc:
            raise ClassificationJobPayloadError("Payload submission_id and job_id must be UUIDs.") from exc

        if payload_submission_id != self.submission_id:
            raise ClassificationJobPayloadError("Payload submission_id must match the owning submission.")
        if payload_job_id != self.job_id:
            raise ClassificationJobPayloadError("Payload job_id must match the draft job_id.")

        attempt = self.payload["attempt"]
        if type(attempt) is not int or attempt < 1:
            raise ClassificationJobPayloadError("Payload attempt must be a positive integer.")
        if not str(self.payload["requested_at"]).strip():
            raise ClassificationJobPayloadError("Payload requested_at must be a non-empty timestamp.")

    def transition_to(self, target_status: str) -> None:
        allowed = JOB_PUBLISH_STATUS_TRANSITIONS.get(self.publish_status, ())
        if target_status not in allowed:
            msg = f"Cannot transition publish status {self.publish_status!r} to {target_status!r}."
            raise PublishStatusTransitionError(msg)

        self.publish_status = target_status
        now = datetime.now(UTC)
        if target_status == PUBLISH_STATUS_PUBLISHING:
            self.locked_at = now
        if target_status == PUBLISH_STATUS_PUBLISHED:
            self.published_at = now
        if target_status == PUBLISH_STATUS_FAILED:
            self.locked_at = None

    def record_publish_error(self, error: str) -> None:
        if self.publish_status in {PUBLISH_STATUS_PUBLISHED, PUBLISH_STATUS_FAILED}:
            msg = f"Cannot record a publish error from terminal status {self.publish_status!r}."
            raise PublishStatusTransitionError(msg)

        self.attempt_count += 1
        self.last_error = error
        target_status = (
            PUBLISH_STATUS_FAILED
            if self.attempt_count >= RABBITMQ_PUBLISH_MAX_ATTEMPTS
            else PUBLISH_STATUS_RETRY_SCHEDULED
        )
        allowed = JOB_PUBLISH_STATUS_TRANSITIONS.get(self.publish_status, ())
        if target_status not in allowed:
            msg = f"Cannot transition publish status {self.publish_status!r} to {target_status!r}."
            raise PublishStatusTransitionError(msg)

        self.publish_status = target_status
        self.locked_at = None
