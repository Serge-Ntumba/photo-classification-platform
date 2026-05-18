from __future__ import annotations

from os import path
from typing import Any

from django.conf import settings
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.core.images import ImageValidationError, NormalizedImage, validate_and_normalize_image

from .models import Submission

PUBLIC_CLASSIFICATION_RESULT_FIELDS = frozenset(
    {
        "classification_type",
        "category",
        "review_decision",
        "score",
        "confidence_score",
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
    },
)


class SubmissionClassificationSerializer(serializers.Serializer):
    classification_type = serializers.CharField(read_only=True)
    category = serializers.CharField(read_only=True)
    review_decision = serializers.CharField(read_only=True)
    score = serializers.FloatField(read_only=True, allow_null=True)
    confidence_score = serializers.FloatField(read_only=True, allow_null=True)
    reasons = serializers.ListField(child=serializers.CharField(), read_only=True)
    provider = serializers.CharField(read_only=True)
    classifier_version = serializers.CharField(read_only=True)
    schema_version = serializers.CharField(read_only=True)
    photo_type = serializers.CharField(read_only=True, allow_blank=True)
    image_quality = serializers.CharField(read_only=True, allow_blank=True)
    technical_status = serializers.CharField(read_only=True, allow_blank=True)
    content_safety_status = serializers.CharField(read_only=True, allow_blank=True)
    profile_suitability = serializers.CharField(read_only=True, allow_blank=True)
    is_fallback = serializers.BooleanField(read_only=True)
    fallback_reason = serializers.CharField(read_only=True, allow_blank=True)
    error_code = serializers.CharField(read_only=True, allow_blank=True)
    classified_at = serializers.DateTimeField(read_only=True)
    classification_duration_ms = serializers.IntegerField(read_only=True, allow_null=True)


class SubmissionPhotoReferenceSerializer(serializers.Serializer):
    object_key = serializers.CharField(source="photo_object_key", read_only=True)
    original_filename = serializers.CharField(source="photo_original_filename", read_only=True)
    content_type = serializers.CharField(source="photo_content_type", read_only=True)
    size_bytes = serializers.IntegerField(source="photo_size_bytes", read_only=True)


class SubmissionReadSerializer(serializers.ModelSerializer):
    photo = SubmissionPhotoReferenceSerializer(source="*", read_only=True)
    classification = serializers.SerializerMethodField()

    class Meta:
        model = Submission
        fields = [
            "id",
            "name",
            "age",
            "place_of_living",
            "gender",
            "country_of_origin",
            "description",
            "photo",
            "status",
            "classification",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    @extend_schema_field(SubmissionClassificationSerializer(allow_null=True))
    def get_classification(self, obj: Submission) -> dict[str, Any] | None:
        result = getattr(obj, "latest_classification_result", None)
        if result is None:
            return None
        return SubmissionClassificationSerializer(result).data


class SubmissionCreateSerializer(serializers.Serializer):
    photo = serializers.FileField(
        write_only=True,
        help_text="JPEG, PNG, or WebP image, 300x300 through 5000x5000 pixels, max 5 MB.",
    )
    name = serializers.CharField(max_length=255)
    age = serializers.IntegerField(min_value=0, max_value=120)
    place_of_living = serializers.CharField(max_length=255)
    gender = serializers.CharField(max_length=100)
    country_of_origin = serializers.CharField(max_length=255)
    description = serializers.CharField(
        max_length=1000,
        allow_blank=True,
        required=False,
        default="",
    )

    _normalized_image: NormalizedImage | None = None
    _original_filename: str = ""

    @property
    def normalized_image(self) -> NormalizedImage:
        if self._normalized_image is None:
            raise RuntimeError("Submission image has not been validated.")
        return self._normalized_image

    @property
    def original_filename(self) -> str:
        return self._original_filename or "upload"

    def validate_photo(self, photo) -> Any:
        content = photo.read()
        if hasattr(photo, "seek"):
            photo.seek(0)

        try:
            self._normalized_image = validate_and_normalize_image(
                content,
                getattr(photo, "content_type", None),
                max_bytes=settings.PHOTO_MAX_UPLOAD_BYTES,
                min_width=settings.PHOTO_MIN_WIDTH,
                min_height=settings.PHOTO_MIN_HEIGHT,
                max_width=settings.PHOTO_MAX_WIDTH,
                max_height=settings.PHOTO_MAX_HEIGHT,
            )
        except ImageValidationError as exc:
            raise serializers.ValidationError(str(exc), code=exc.code) from exc

        self._original_filename = path.basename(getattr(photo, "name", "") or "upload")
        return photo
