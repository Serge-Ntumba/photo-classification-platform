"""Celery task for asynchronous submission classification."""

from __future__ import annotations

import random
from dataclasses import dataclass
from typing import Any

from celery import shared_task
from django.conf import settings
from django.db import transaction
from django.utils import timezone

from apps.core.storage import ObjectStorageClient
from apps.submissions.status import is_terminal_status

from .client import ClassifierClient, ClassifierClientError
from .constants import (
    SUBMISSION_STATUS_CLASSIFYING,
    SUBMISSION_STATUS_PENDING_CLASSIFICATION,
    TERMINAL_SUBMISSION_STATUSES,
    WORKER_CLASSIFIER_MAX_RETRIES,
)
from .models import ClassificationJob, ClassificationResult
from .services import mark_submission_classification_failed, persist_classification_result
from .validators import ClassifierResponseValidationError


class RetryableClassificationError(RuntimeError):
    """Raised for worker errors Celery may retry."""


@dataclass(frozen=True, slots=True)
class ProcessingResult:
    status: str
    detail: str = ""


def retry_countdown(retries: int) -> int:
    base = settings.RETRY_BACKOFF_BASE_SECONDS
    cap = settings.RETRY_BACKOFF_CAP_SECONDS
    countdown = min(cap, base * (2**retries))
    if not settings.RETRY_BACKOFF_JITTER:
        return countdown
    return max(1, min(cap, int(random.uniform(countdown / 2, countdown))))  # noqa: S311


@shared_task(
    bind=True,
    name="apps.classification.tasks.process_classification_job",
    max_retries=WORKER_CLASSIFIER_MAX_RETRIES,
)
def process_classification_job(self, **payload: Any) -> dict[str, str]:
    try:
        result = process_classification_job_payload(payload)
    except RetryableClassificationError as exc:
        job = _job_for_payload(payload)
        if self.request.retries >= settings.CLASSIFIER_MAX_RETRIES - 1:
            if job is not None:
                mark_submission_classification_failed(job=job, error=str(exc))
            return {"status": "failed", "detail": str(exc)}
        raise self.retry(exc=exc, countdown=retry_countdown(self.request.retries)) from exc
    return {"status": result.status, "detail": result.detail}


def process_classification_job_payload(
    payload: dict[str, Any],
    *,
    client: ClassifierClient | None = None,
    storage_client: ObjectStorageClient | None = None,
) -> ProcessingResult:
    job = _claim_job(payload)
    if job is None:
        return ProcessingResult(status="skipped", detail="job not found")

    submission = job.submission
    if ClassificationResult.objects.filter(job_id=job.job_id).exists():
        return ProcessingResult(status="duplicate", detail="result already persisted")
    if submission.status in TERMINAL_SUBMISSION_STATUSES:
        return ProcessingResult(status="skipped", detail="submission is terminal")

    if submission.status == SUBMISSION_STATUS_PENDING_CLASSIFICATION:
        submission.transition_status(SUBMISSION_STATUS_CLASSIFYING)

    try:
        image_bytes = (storage_client or ObjectStorageClient()).get_bytes(
            key=submission.photo_object_key,
        )
    except Exception as exc:
        raise RetryableClassificationError(str(exc)) from exc

    try:
        response_payload = (client or ClassifierClient()).classify(
            submission=submission,
            image_bytes=image_bytes,
        )
    except ClassifierClientError as exc:
        raise RetryableClassificationError(str(exc)) from exc

    try:
        result = persist_classification_result(job=job, response_payload=response_payload)
    except ClassifierResponseValidationError as exc:
        mark_submission_classification_failed(job=job, error=str(exc))
        return ProcessingResult(status="failed", detail=str(exc))
    except RuntimeError as exc:
        raise RetryableClassificationError(str(exc)) from exc

    return ProcessingResult(status="classified", detail=str(result.id))


def fail_classification_after_retry_exhaustion(*, payload: dict[str, Any], error: str) -> None:
    job = _job_for_payload(payload)
    if job is not None:
        mark_submission_classification_failed(job=job, error=error)


def _claim_job(payload: dict[str, Any]) -> ClassificationJob | None:
    job_id = payload.get("job_id")
    submission_id = payload.get("submission_id")
    with transaction.atomic():
        job = (
            ClassificationJob.objects.select_for_update()
            .select_related("submission")
            .filter(job_id=job_id, submission_id=submission_id)
            .first()
        )
        if job is None:
            return None
        if is_terminal_status(job.submission.status):
            return job
        job.locked_at = timezone.now()
        job.save(update_fields=["locked_at", "updated_at"])
        return job


def _job_for_payload(payload: dict[str, Any]) -> ClassificationJob | None:
    return (
        ClassificationJob.objects.select_related("submission")
        .filter(job_id=payload.get("job_id"), submission_id=payload.get("submission_id"))
        .first()
    )
