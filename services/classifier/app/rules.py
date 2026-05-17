"""Deterministic rule-based submission-review classifier."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from io import BytesIO
from time import monotonic

from PIL import Image, UnidentifiedImageError

from .schemas import Category, ClassifierRequestMetadata, ClassifierResponse, ReviewDecision

ALLOWED_CONTENT_TYPES = {
    "image/jpeg": "JPEG",
    "image/png": "PNG",
    "image/webp": "WEBP",
}
MAX_FILE_BYTES = 5 * 1024 * 1024
MIN_IMAGE_WIDTH = 300
MIN_IMAGE_HEIGHT = 300
MAX_IMAGE_WIDTH = 5000
MAX_IMAGE_HEIGHT = 5000


@dataclass(frozen=True, slots=True)
class RuleOutcome:
    category: Category
    review_decision: ReviewDecision
    score: float
    reason: str
    error_code: str | None = None
    image_quality: str | None = None
    technical_status: str | None = None
    profile_suitability: str | None = None


def classify_submission_review(
    *,
    image_bytes: bytes,
    metadata: ClassifierRequestMetadata,
) -> ClassifierResponse:
    """Classify review state from technical image and metadata-completeness signals only."""

    started_at = monotonic()
    outcome = _evaluate_rules(image_bytes=image_bytes, metadata=metadata)
    duration_ms = int((monotonic() - started_at) * 1000)
    return ClassifierResponse(
        category=outcome.category,
        review_decision=outcome.review_decision,
        score=outcome.score,
        reasons=[outcome.reason],
        error_code=outcome.error_code,
        classified_at=datetime.now(UTC),
        image_quality=outcome.image_quality,
        technical_status=outcome.technical_status,
        profile_suitability=outcome.profile_suitability,
        classification_duration_ms=duration_ms,
    )


def _evaluate_rules(*, image_bytes: bytes, metadata: ClassifierRequestMetadata) -> RuleOutcome:
    if not image_bytes or metadata.size_bytes == 0:
        return RuleOutcome(
            category=Category.INVALID_FILE,
            review_decision=ReviewDecision.FAILS_AUTOMATED_CHECKS,
            score=0.0,
            reason="File was empty.",
            error_code="EMPTY_FILE",
            technical_status="invalid",
            profile_suitability="unsuitable",
        )

    if metadata.size_bytes > MAX_FILE_BYTES or len(image_bytes) > MAX_FILE_BYTES:
        return RuleOutcome(
            category=Category.INVALID_FILE,
            review_decision=ReviewDecision.FAILS_AUTOMATED_CHECKS,
            score=0.0,
            reason="File exceeded the maximum supported size.",
            error_code="FILE_TOO_LARGE",
            technical_status="invalid",
            profile_suitability="unsuitable",
        )

    parsed = _parse_image(image_bytes)
    if parsed is None:
        return RuleOutcome(
            category=Category.INVALID_FILE,
            review_decision=ReviewDecision.FAILS_AUTOMATED_CHECKS,
            score=0.0,
            reason="File could not be opened as a valid image.",
            error_code="IMAGE_UNREADABLE",
            technical_status="invalid",
            profile_suitability="unsuitable",
        )

    content_type = metadata.content_type.lower()
    if content_type not in ALLOWED_CONTENT_TYPES:
        return RuleOutcome(
            category=Category.UNSUPPORTED_IMAGE_TYPE,
            review_decision=ReviewDecision.FAILS_AUTOMATED_CHECKS,
            score=0.0,
            reason="Image type is not supported.",
            error_code="UNSUPPORTED_IMAGE_TYPE",
            technical_status="unsupported",
            profile_suitability="unsuitable",
        )

    expected_format = ALLOWED_CONTENT_TYPES[content_type]
    image_format, width, height = parsed
    if image_format != expected_format:
        return RuleOutcome(
            category=Category.SUSPICIOUS_FILE,
            review_decision=ReviewDecision.NEEDS_MANUAL_REVIEW,
            score=0.2,
            reason="Image content did not match the declared type.",
            error_code="SIGNATURE_MISMATCH",
            technical_status="suspicious",
            profile_suitability="uncertain",
        )

    if not metadata.metadata_complete:
        return RuleOutcome(
            category=Category.INCOMPLETE_METADATA,
            review_decision=ReviewDecision.NEEDS_MANUAL_REVIEW,
            score=0.4,
            reason="Required metadata was incomplete.",
            error_code="INCOMPLETE_METADATA",
            technical_status="valid",
            profile_suitability="uncertain",
        )

    if (
        width < MIN_IMAGE_WIDTH
        or height < MIN_IMAGE_HEIGHT
        or width > MAX_IMAGE_WIDTH
        or height > MAX_IMAGE_HEIGHT
    ):
        return RuleOutcome(
            category=Category.LOW_QUALITY_IMAGE,
            review_decision=ReviewDecision.NEEDS_MANUAL_REVIEW,
            score=0.5,
            reason="Image dimensions were outside the accepted review range.",
            error_code="DIMENSIONS_OUT_OF_RANGE",
            image_quality="out_of_range",
            technical_status="valid",
            profile_suitability="uncertain",
        )

    return RuleOutcome(
        category=Category.VALID_PROFILE_CANDIDATE,
        review_decision=ReviewDecision.PASSES_AUTOMATED_CHECKS,
        score=1.0,
        reason="Image and required metadata passed automated review checks.",
        image_quality="acceptable",
        technical_status="valid",
        profile_suitability="suitable",
    )


def _parse_image(image_bytes: bytes) -> tuple[str, int, int] | None:
    try:
        with Image.open(BytesIO(image_bytes)) as image:
            image.load()
            image_format = image.format
            width, height = image.size
    except (OSError, UnidentifiedImageError):
        return None
    if image_format is None:
        return None
    return image_format.upper(), width, height
