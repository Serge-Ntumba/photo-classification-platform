from __future__ import annotations

from django.contrib import admin

from apps.classification.models import ClassificationResult

from .models import Submission


class ClassificationResultInline(admin.TabularInline):
    """Readonly classification history without raw provider payloads."""

    model = ClassificationResult
    fields = (
        "job_id",
        "classification_type",
        "category",
        "review_decision",
        "score",
        "provider",
        "classifier_version",
        "schema_version",
        "is_fallback",
        "error_code",
        "classified_at",
        "created_at",
    )
    readonly_fields = fields
    extra = 0
    can_delete = False
    show_change_link = True
    ordering = ("-created_at",)

    def has_add_permission(self, request, obj=None) -> bool:
        return False

    def has_delete_permission(self, request, obj=None) -> bool:
        return False


@admin.register(Submission)
class SubmissionAdmin(admin.ModelAdmin):
    """Django Admin review surface for submitted photos and normalized results."""

    fields = (
        "id",
        "user",
        "name",
        "age",
        "place_of_living",
        "gender",
        "country_of_origin",
        "description",
        "photo_object_key",
        "photo_original_filename",
        "photo_content_type",
        "photo_size_bytes",
        "photo_width",
        "photo_height",
        "status",
        "latest_classification_result",
        "latest_category",
        "latest_review_decision",
        "latest_provider",
        "classified_at",
        "created_at",
        "updated_at",
    )
    readonly_fields = fields
    list_display = (
        "id",
        "name",
        "user",
        "status",
        "age",
        "gender",
        "place_of_living",
        "country_of_origin",
        "latest_category",
        "latest_review_decision",
        "classified_at",
        "created_at",
    )
    list_display_links = ("id", "name")
    list_filter = (
        "status",
        "age",
        "gender",
        "place_of_living",
        "country_of_origin",
        "latest_classification_result__category",
        "latest_classification_result__review_decision",
        "created_at",
        "classified_at",
    )
    search_fields = (
        "name",
        "place_of_living",
        "country_of_origin",
        "photo_object_key",
        "photo_original_filename",
        "user__username",
        "user__email",
    )
    ordering = ("-created_at",)
    date_hierarchy = "created_at"
    list_select_related = ("user", "latest_classification_result")
    inlines = (ClassificationResultInline,)

    @admin.display(description="Latest category", ordering="latest_classification_result__category")
    def latest_category(self, obj: Submission) -> str:
        result = obj.latest_classification_result
        return result.category if result else ""

    @admin.display(
        description="Latest review decision",
        ordering="latest_classification_result__review_decision",
    )
    def latest_review_decision(self, obj: Submission) -> str:
        result = obj.latest_classification_result
        return result.review_decision if result else ""

    @admin.display(description="Latest provider", ordering="latest_classification_result__provider")
    def latest_provider(self, obj: Submission) -> str:
        result = obj.latest_classification_result
        return result.provider if result else ""

    def has_add_permission(self, request) -> bool:
        return False

    def has_delete_permission(self, request, obj=None) -> bool:
        return False
