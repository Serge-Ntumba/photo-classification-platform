from __future__ import annotations

import uuid

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone

from .constants import (
    CLASSIFICATION_CATEGORIES,
    CLASSIFICATION_SCHEMA_VERSION,
    CLASSIFICATION_TYPE_SUBMISSION_REVIEW,
    CLASSIFIER_PROVIDERS,
    CLASSIFIER_VERSION,
    JOB_PUBLISH_STATUS_TRANSITIONS,
    JOB_PUBLISH_STATUSES,
    PROVIDER_RULE_BASED,
    PUBLISH_STATUS_FAILED,
    PUBLISH_STATUS_PENDING,
    PUBLISH_STATUS_PUBLISHED,
    PUBLISH_STATUS_PUBLISHING,
    PUBLISH_STATUS_RETRY_SCHEDULED,
    RABBITMQ_PUBLISH_MAX_ATTEMPTS,
    REVIEW_DECISIONS,
)


class ClassificationJobPayloadError(ValueError):
    """Raised when the durable job payload violates the minimal worker contract."""


class PublishStatusTransitionError(ValueError):
    """Raised when a durable outbox row moves through an invalid publish status."""


CLASSIFICATION_JOB_PAYLOAD_REQUIRED_FIELDS = frozenset(
    {"submission_id", "job_id", "attempt", "requested_at"},
)


class ClassificationJob(models.Model):
    """Durable RabbitMQ/Celery outbox row for an accepted submission."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    submission = models.ForeignKey(
        "submissions.Submission",
        on_delete=models.CASCADE,
        related_name="classification_jobs",
    )
    job_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    payload = models.JSONField()
    publish_status = models.CharField(
        max_length=40,
        choices=[(status, status) for status in JOB_PUBLISH_STATUSES],
        default=PUBLISH_STATUS_PENDING,
    )
    attempt_count = models.PositiveSmallIntegerField(default=0)
    last_error = models.TextField(blank=True)
    published_at = models.DateTimeField(null=True, blank=True)
    locked_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["submission"], name="class_job_submission_idx"),
            models.Index(fields=["job_id"], name="class_job_job_id_idx"),
            models.Index(fields=["publish_status"], name="class_job_publish_idx"),
            models.Index(fields=["created_at"], name="class_job_created_idx"),
            models.Index(fields=["locked_at"], name="class_job_locked_idx"),
        ]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(publish_status__in=JOB_PUBLISH_STATUSES),
                name="class_job_publish_status_allowed",
            ),
            models.CheckConstraint(
                condition=models.Q(attempt_count__gte=0),
                name="class_job_attempt_count_nonnegative",
            ),
            models.UniqueConstraint(
                fields=["submission", "job_id"],
                name="class_job_submission_job_unique",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.job_id} ({self.publish_status})"

    def save(self, *args, **kwargs) -> None:
        self.validate_payload()
        super().save(*args, **kwargs)

    def clean(self) -> None:
        self.validate_payload()
        super().clean()

    def validate_payload(self) -> None:
        payload_fields = set(self.payload or {})
        if payload_fields != CLASSIFICATION_JOB_PAYLOAD_REQUIRED_FIELDS:
            missing = sorted(CLASSIFICATION_JOB_PAYLOAD_REQUIRED_FIELDS - payload_fields)
            extra = sorted(payload_fields - CLASSIFICATION_JOB_PAYLOAD_REQUIRED_FIELDS)
            msg = (
                f"Classification job payload fields are invalid. Missing={missing}; extra={extra}."
            )
            raise ClassificationJobPayloadError(msg)

        if str(self.payload["submission_id"]) != str(self.submission_id):
            raise ClassificationJobPayloadError(
                "Payload submission_id must match the owning submission.",
            )
        if str(self.payload["job_id"]) != str(self.job_id):
            raise ClassificationJobPayloadError("Payload job_id must match the durable job_id.")

        attempt = self.payload["attempt"]
        if type(attempt) is not int or attempt < 1:
            raise ClassificationJobPayloadError("Payload attempt must be a positive integer.")
        if not str(self.payload["requested_at"]).strip():
            raise ClassificationJobPayloadError(
                "Payload requested_at must be a non-empty timestamp.",
            )

    def transition_publish_status(self, target_status: str, *, save: bool = True) -> None:
        allowed = JOB_PUBLISH_STATUS_TRANSITIONS.get(self.publish_status, ())
        if target_status not in allowed:
            msg = f"Cannot transition publish status {self.publish_status!r} to {target_status!r}."
            raise PublishStatusTransitionError(msg)

        self.publish_status = target_status
        now = timezone.now()
        if target_status == PUBLISH_STATUS_PUBLISHING:
            self.locked_at = now
        if target_status == PUBLISH_STATUS_PUBLISHED:
            self.published_at = now
        if target_status == PUBLISH_STATUS_FAILED:
            self.locked_at = None
        if save:
            self.save(
                update_fields=[
                    "publish_status",
                    "published_at",
                    "locked_at",
                    "updated_at",
                ],
            )

    def record_publish_error(
        self,
        error: str,
        *,
        max_attempts: int = RABBITMQ_PUBLISH_MAX_ATTEMPTS,
        save: bool = True,
    ) -> bool:
        if self.publish_status in {PUBLISH_STATUS_PUBLISHED, PUBLISH_STATUS_FAILED}:
            msg = f"Cannot record a publish error from terminal status {self.publish_status!r}."
            raise PublishStatusTransitionError(msg)

        self.attempt_count += 1
        self.last_error = error
        target_status = (
            PUBLISH_STATUS_FAILED
            if self.attempt_count >= max_attempts
            else PUBLISH_STATUS_RETRY_SCHEDULED
        )
        allowed = JOB_PUBLISH_STATUS_TRANSITIONS.get(self.publish_status, ())
        if target_status not in allowed:
            msg = f"Cannot transition publish status {self.publish_status!r} to {target_status!r}."
            raise PublishStatusTransitionError(msg)

        self.publish_status = target_status
        self.locked_at = None
        if save:
            self.save(
                update_fields=[
                    "attempt_count",
                    "last_error",
                    "publish_status",
                    "locked_at",
                    "updated_at",
                ],
            )
        return self.publish_status == PUBLISH_STATUS_FAILED


class ClassificationResult(models.Model):
    """Normalized, safety-validated classifier output for a submission-review job."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    submission = models.ForeignKey(
        "submissions.Submission",
        on_delete=models.CASCADE,
        related_name="classification_results",
    )
    job_id = models.UUIDField(unique=True)
    classification_type = models.CharField(
        max_length=40,
        default=CLASSIFICATION_TYPE_SUBMISSION_REVIEW,
    )
    category = models.CharField(
        max_length=50,
        choices=[(category, category) for category in CLASSIFICATION_CATEGORIES],
    )
    review_decision = models.CharField(
        max_length=50,
        choices=[(decision, decision) for decision in REVIEW_DECISIONS],
    )
    score = models.FloatField(
        null=True,
        blank=True,
        validators=[MinValueValidator(0.0), MaxValueValidator(1.0)],
    )
    confidence_score = models.FloatField(
        null=True,
        blank=True,
        validators=[MinValueValidator(0.0), MaxValueValidator(1.0)],
    )
    reason = models.TextField(blank=True)
    reasons = models.JSONField(default=list, blank=True)
    provider = models.CharField(
        max_length=50,
        choices=[(provider, provider) for provider in CLASSIFIER_PROVIDERS],
        default=PROVIDER_RULE_BASED,
    )
    classifier_version = models.CharField(max_length=50, default=CLASSIFIER_VERSION)
    schema_version = models.CharField(max_length=50, default=CLASSIFICATION_SCHEMA_VERSION)
    photo_type = models.CharField(max_length=100, blank=True)
    image_quality = models.CharField(max_length=100, blank=True)
    technical_status = models.CharField(max_length=100, blank=True)
    content_safety_status = models.CharField(max_length=100, blank=True)
    profile_suitability = models.CharField(max_length=100, blank=True)
    provider_metadata = models.JSONField(default=dict, blank=True)
    raw_response = models.JSONField(default=dict, blank=True)
    is_fallback = models.BooleanField(default=False)
    fallback_reason = models.CharField(max_length=255, blank=True)
    error_code = models.CharField(max_length=100, blank=True)
    classified_at = models.DateTimeField()
    classification_duration_ms = models.PositiveIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["submission"], name="class_result_submission_idx"),
            models.Index(fields=["job_id"], name="class_result_job_idx"),
            models.Index(fields=["category"], name="class_result_category_idx"),
            models.Index(fields=["review_decision"], name="class_result_decision_idx"),
            models.Index(fields=["provider"], name="class_result_provider_idx"),
            models.Index(fields=["classified_at"], name="class_result_classified_idx"),
            models.Index(fields=["created_at"], name="class_result_created_idx"),
            models.Index(
                fields=["submission", "-created_at"],
                name="class_result_sub_latest_idx",
            ),
            models.Index(fields=["category", "review_decision"], name="class_result_cat_dec_idx"),
        ]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(classification_type=CLASSIFICATION_TYPE_SUBMISSION_REVIEW),
                name="class_result_type_submission_review",
            ),
            models.CheckConstraint(
                condition=models.Q(category__in=CLASSIFICATION_CATEGORIES),
                name="class_result_category_allowed",
            ),
            models.CheckConstraint(
                condition=models.Q(review_decision__in=REVIEW_DECISIONS),
                name="class_result_decision_allowed",
            ),
            models.CheckConstraint(
                condition=models.Q(provider__in=CLASSIFIER_PROVIDERS),
                name="class_result_provider_allowed",
            ),
            models.CheckConstraint(
                condition=models.Q(score__isnull=True) | models.Q(score__gte=0.0, score__lte=1.0),
                name="class_result_score_range",
            ),
            models.CheckConstraint(
                condition=models.Q(confidence_score__isnull=True)
                | models.Q(confidence_score__gte=0.0, confidence_score__lte=1.0),
                name="class_result_confidence_range",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.submission_id} {self.category} ({self.review_decision})"
