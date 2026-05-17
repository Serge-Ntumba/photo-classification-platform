"""Classification result persistence and status mapping."""

from __future__ import annotations

from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.submissions.status import is_terminal_status

from .constants import (
    REVIEW_DECISION_STATUS_MAP,
    SUBMISSION_STATUS_CLASSIFICATION_FAILED,
    SUBMISSION_STATUS_CLASSIFYING,
    SUBMISSION_STATUS_PENDING_CLASSIFICATION,
)
from .models import ClassificationJob, ClassificationResult
from .validators import ValidatedClassifierResponse, validate_classifier_response


def status_for_review_decision(review_decision: str) -> str:
    return REVIEW_DECISION_STATUS_MAP[review_decision]


def persist_classification_result(
    *,
    job: ClassificationJob,
    response_payload: dict[str, object],
) -> ClassificationResult:
    validated = validate_classifier_response(response_payload)
    with transaction.atomic():
        submission = type(job.submission).objects.select_for_update().get(pk=job.submission_id)
        existing = ClassificationResult.objects.filter(job_id=job.job_id).first()
        if existing is not None:
            return existing
        if is_terminal_status(submission.status):
            raise ValueError("Terminal submissions cannot receive new classification results.")
        if submission.status == SUBMISSION_STATUS_PENDING_CLASSIFICATION:
            submission.transition_status(SUBMISSION_STATUS_CLASSIFYING)

        result = _create_result(job=job, validated=validated)
        submission.status = status_for_review_decision(validated.review_decision)
        submission.latest_classification_result = result
        submission.classified_at = validated.classified_at
        submission.save(
            update_fields=[
                "status",
                "latest_classification_result",
                "classified_at",
                "updated_at",
            ],
        )
        return result


def _create_result(
    *,
    job: ClassificationJob,
    validated: ValidatedClassifierResponse,
) -> ClassificationResult:
    try:
        return ClassificationResult.objects.create(
            submission_id=job.submission_id,
            job_id=job.job_id,
            classification_type=validated.classification_type,
            category=validated.category,
            review_decision=validated.review_decision,
            score=validated.score,
            confidence_score=validated.confidence_score,
            reason=validated.reason,
            reasons=validated.reasons,
            provider=validated.provider,
            classifier_version=validated.classifier_version,
            schema_version=validated.schema_version,
            photo_type=validated.photo_type,
            image_quality=validated.image_quality,
            technical_status=validated.technical_status,
            content_safety_status=validated.content_safety_status,
            profile_suitability=validated.profile_suitability,
            provider_metadata=validated.provider_metadata,
            raw_response=validated.raw_response,
            is_fallback=validated.is_fallback,
            fallback_reason=validated.fallback_reason,
            error_code=validated.error_code,
            classified_at=validated.classified_at,
            classification_duration_ms=validated.classification_duration_ms,
        )
    except IntegrityError:
        return ClassificationResult.objects.get(job_id=job.job_id)


def mark_submission_classification_failed(*, job: ClassificationJob, error: str) -> None:
    with transaction.atomic():
        submission = type(job.submission).objects.select_for_update().get(pk=job.submission_id)
        if is_terminal_status(submission.status):
            return
        if submission.status not in {
            SUBMISSION_STATUS_PENDING_CLASSIFICATION,
            SUBMISSION_STATUS_CLASSIFYING,
        }:
            return
        submission.status = SUBMISSION_STATUS_CLASSIFICATION_FAILED
        submission.classified_at = timezone.now()
        submission.save(update_fields=["status", "classified_at", "updated_at"])
        job.last_error = error
        job.locked_at = None
        job.save(update_fields=["last_error", "locked_at", "updated_at"])
