from __future__ import annotations

import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.classification.constants import (
    SUBMISSION_STATUS_PENDING_CLASSIFICATION,
    SUBMISSION_STATUSES,
)
from apps.core.images import MAX_UPLOAD_BYTES

from .status import StatusTransitionError, validate_transition


class Submission(models.Model):
    """User-owned photo submission with private object-storage references only."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="submissions",
    )
    name = models.CharField(max_length=255)
    age = models.PositiveSmallIntegerField()
    place_of_living = models.CharField(max_length=255)
    gender = models.CharField(max_length=100)
    country_of_origin = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    photo_object_key = models.CharField(max_length=1024, unique=True)
    photo_original_filename = models.CharField(max_length=255, blank=True)
    photo_content_type = models.CharField(max_length=50)
    photo_size_bytes = models.PositiveIntegerField()
    photo_width = models.PositiveIntegerField()
    photo_height = models.PositiveIntegerField()
    status = models.CharField(
        max_length=40,
        choices=[(status, status) for status in SUBMISSION_STATUSES],
        default=SUBMISSION_STATUS_PENDING_CLASSIFICATION,
    )
    latest_classification_result = models.ForeignKey(
        "classification.ClassificationResult",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    classified_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user"], name="submission_user_idx"),
            models.Index(fields=["age"], name="submission_age_idx"),
            models.Index(fields=["gender"], name="submission_gender_idx"),
            models.Index(fields=["place_of_living"], name="submission_place_idx"),
            models.Index(fields=["country_of_origin"], name="submission_country_idx"),
            models.Index(fields=["status"], name="submission_status_idx"),
            models.Index(
                fields=["latest_classification_result"],
                name="submission_latest_result_idx",
            ),
            models.Index(fields=["created_at"], name="submission_created_idx"),
            models.Index(fields=["updated_at"], name="submission_updated_idx"),
            models.Index(fields=["created_at", "status"], name="submission_created_status_idx"),
        ]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(age__gte=0, age__lte=120),
                name="submission_age_0_120",
            ),
            models.CheckConstraint(
                condition=models.Q(photo_size_bytes__gt=0, photo_size_bytes__lte=MAX_UPLOAD_BYTES),
                name="submission_photo_size_allowed",
            ),
            models.CheckConstraint(
                condition=models.Q(status__in=SUBMISSION_STATUSES),
                name="submission_status_allowed",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.name} ({self.status})"

    def save(self, *args, **kwargs) -> None:
        if self.pk and not self._state.adding:
            old_status = (
                type(self).objects.filter(pk=self.pk).values_list("status", flat=True).first()
            )
            if old_status is not None and old_status != self.status:
                validate_transition(old_status, self.status)
        super().save(*args, **kwargs)

    def transition_status(self, target_status: str, *, save: bool = True) -> None:
        if self.status == target_status:
            return
        try:
            validate_transition(self.status, target_status)
        except StatusTransitionError:
            raise
        self.status = target_status
        if save:
            self.save(update_fields=["status", "updated_at"])
