from __future__ import annotations

from os import path
from typing import Any

from django.conf import settings
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.core.images import ImageValidationError, NormalizedImage, validate_and_normalize_image

from .models import Submission


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

    @extend_schema_field(serializers.JSONField(allow_null=True))
    def get_classification(self, _obj: Submission) -> None:
        return None


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
