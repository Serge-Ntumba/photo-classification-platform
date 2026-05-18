from __future__ import annotations

from typing import Any

from django.conf import settings
from django.db.models import Count, Max

from apps.core.logging import sanitize_log_value
from config.celery import app as celery_app

from .constants import (
    JOB_PUBLISH_STATUSES,
    PUBLISH_STATUS_FAILED,
    PUBLISH_STATUS_PENDING,
    PUBLISH_STATUS_PUBLISHED,
    PUBLISH_STATUS_PUBLISHING,
    PUBLISH_STATUS_RETRY_SCHEDULED,
    SUBMISSION_STATUS_CLASSIFICATION_FAILED,
)
from .models import ClassificationJob

CLASSIFICATION_TASK_NAME = "apps.classification.tasks.process_classification_job"
CLASSIFICATION_QUEUE_NAME = "classification"


def worker_health_snapshot(*, include_broker_depth: bool | None = None) -> dict[str, Any]:
    include_depth = (
        bool(getattr(settings, "WORKER_HEALTH_INCLUDE_QUEUE_DEPTH", False))
        if include_broker_depth is None
        else include_broker_depth
    )
    queue_depth: int | None = None
    queue_depth_available = False
    if include_depth:
        try:
            queue_depth = _broker_queue_depth()
            queue_depth_available = True
        except Exception:
            queue_depth = None

    counts_by_publish_status = _job_counts_by_publish_status()
    retry_summary = ClassificationJob.objects.aggregate(
        max_attempt_count=Max("attempt_count"),
    )
    jobs_with_retries = ClassificationJob.objects.filter(attempt_count__gt=0).count()
    failed_jobs = counts_by_publish_status[PUBLISH_STATUS_FAILED]
    failed_submissions = ClassificationJob.objects.filter(
        submission__status=SUBMISSION_STATUS_CLASSIFICATION_FAILED,
    ).count()
    pending_or_published = sum(
        counts_by_publish_status[status]
        for status in (
            PUBLISH_STATUS_PENDING,
            PUBLISH_STATUS_PUBLISHING,
            PUBLISH_STATUS_RETRY_SCHEDULED,
            PUBLISH_STATUS_PUBLISHED,
        )
    )

    return {
        "service": "classification-worker",
        "status": "ok",
        "queue": CLASSIFICATION_QUEUE_NAME,
        "queue_depth": queue_depth,
        "queue_depth_available": queue_depth_available,
        "task_name": CLASSIFICATION_TASK_NAME,
        "task_state": {
            "pending_or_published_jobs": pending_or_published,
            "failed_jobs": failed_jobs,
        },
        "job_counts_by_publish_status": counts_by_publish_status,
        "retry_policy": {
            "max_retries": settings.CLASSIFIER_MAX_RETRIES,
            "timeout_seconds": settings.CLASSIFIER_TIMEOUT_SECONDS,
            "backoff_base_seconds": settings.RETRY_BACKOFF_BASE_SECONDS,
            "backoff_cap_seconds": settings.RETRY_BACKOFF_CAP_SECONDS,
            "jitter": settings.RETRY_BACKOFF_JITTER,
        },
        "retry_counters": {
            "jobs_with_retries": jobs_with_retries,
            "max_attempt_count": retry_summary["max_attempt_count"] or 0,
        },
        "safe_failure_observability": {
            "failed_jobs": failed_jobs,
            "failed_submissions": failed_submissions,
            "failure_samples": _safe_failure_samples(),
        },
    }


def _job_counts_by_publish_status() -> dict[str, int]:
    counts = {status: 0 for status in JOB_PUBLISH_STATUSES}
    rows = ClassificationJob.objects.values("publish_status").annotate(count=Count("id"))
    for row in rows:
        counts[row["publish_status"]] = row["count"]
    return counts


def _safe_failure_samples() -> list[str]:
    errors = (
        ClassificationJob.objects.exclude(last_error="")
        .order_by("-updated_at")
        .values_list("last_error", flat=True)[:5]
    )
    return [sanitize_log_value(error) for error in errors]


def _broker_queue_depth() -> int:
    with celery_app.connection_for_read() as connection:
        channel = connection.channel()
        declaration = channel.queue_declare(queue=CLASSIFICATION_QUEUE_NAME, passive=True)
        if hasattr(declaration, "message_count"):
            return int(declaration.message_count)
        return int(declaration[1])
