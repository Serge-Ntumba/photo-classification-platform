from __future__ import annotations

from uuid import UUID, uuid4

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from apps.submissions.status import failure_status_after_retry_exhaustion
from config.celery import app as celery_app

from .constants import (
    PUBLISH_STATUS_PUBLISHED,
    PUBLISH_STATUS_PUBLISHING,
    RABBITMQ_PUBLISH_MAX_ATTEMPTS,
)
from .models import ClassificationJob

CLASSIFICATION_TASK_NAME = "apps.classification.tasks.process_classification_job"


def build_classification_job_payload(
    *,
    submission_id: UUID,
    job_id: UUID,
    attempt: int = 1,
) -> dict[str, object]:
    return {
        "submission_id": str(submission_id),
        "job_id": str(job_id),
        "attempt": attempt,
        "requested_at": timezone.now().isoformat(),
    }


def create_classification_job(submission) -> ClassificationJob:
    job_id = uuid4()
    return ClassificationJob.objects.create(
        submission=submission,
        job_id=job_id,
        payload=build_classification_job_payload(submission_id=submission.id, job_id=job_id),
    )


class ClassificationJobPublisher:
    """Publishes durable outbox rows to Celery while retaining retry state."""

    def __init__(self, *, task_name: str = CLASSIFICATION_TASK_NAME) -> None:
        self.task_name = task_name

    def publish(self, job: ClassificationJob) -> ClassificationJob:
        max_attempts = getattr(
            settings,
            "RABBITMQ_PUBLISH_MAX_ATTEMPTS",
            RABBITMQ_PUBLISH_MAX_ATTEMPTS,
        )
        while job.attempt_count < max_attempts and job.publish_status != PUBLISH_STATUS_PUBLISHED:
            job.transition_publish_status(PUBLISH_STATUS_PUBLISHING)
            try:
                self._send(job)
            except Exception as exc:
                exhausted = job.record_publish_error(str(exc), max_attempts=max_attempts)
                if exhausted:
                    self._mark_submission_failed(job)
                continue

            job.transition_publish_status(PUBLISH_STATUS_PUBLISHED)
            return job

        return job

    def _send(self, job: ClassificationJob) -> None:
        if getattr(settings, "CELERY_TASK_ALWAYS_EAGER", False):
            return

        celery_app.send_task(
            self.task_name,
            kwargs=job.payload,
            queue="classification",
        )

    def _mark_submission_failed(self, job: ClassificationJob) -> None:
        with transaction.atomic():
            submission = job.submission
            submission.status = failure_status_after_retry_exhaustion(submission.status)
            submission.save(update_fields=["status", "updated_at"])


def publish_classification_job(job: ClassificationJob) -> ClassificationJob:
    return ClassificationJobPublisher().publish(job)
