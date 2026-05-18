from __future__ import annotations

from django.contrib import admin

from .models import ClassificationResult

SAFE_CLASSIFICATION_ADMIN_FIELDS = (
    "id",
    "submission",
    "job_id",
    "classification_type",
    "category",
    "review_decision",
    "score",
    "confidence_score",
    "reason",
    "reasons",
    "provider",
    "classifier_version",
    "schema_version",
    "photo_type",
    "image_quality",
    "technical_status",
    "content_safety_status",
    "profile_suitability",
    "is_fallback",
    "fallback_reason",
    "error_code",
    "classified_at",
    "classification_duration_ms",
    "created_at",
)


@admin.register(ClassificationResult)
class ClassificationResultAdmin(admin.ModelAdmin):
    """Readonly operational view of normalized classifier output."""

    fields = SAFE_CLASSIFICATION_ADMIN_FIELDS
    readonly_fields = fields
    list_display = (
        "id",
        "submission",
        "job_id",
        "category",
        "review_decision",
        "provider",
        "score",
        "is_fallback",
        "classified_at",
        "created_at",
    )
    list_filter = (
        "category",
        "review_decision",
        "provider",
        "is_fallback",
        "classification_type",
        "classified_at",
        "created_at",
    )
    search_fields = (
        "job_id",
        "submission__id",
        "submission__name",
        "submission__place_of_living",
        "submission__country_of_origin",
        "submission__photo_object_key",
        "classifier_version",
        "schema_version",
        "error_code",
    )
    ordering = ("-created_at",)
    date_hierarchy = "created_at"
    list_select_related = ("submission",)

    def has_add_permission(self, request) -> bool:
        return False

    def has_delete_permission(self, request, obj=None) -> bool:
        return False
