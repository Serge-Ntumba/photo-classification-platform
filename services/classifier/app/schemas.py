"""Pydantic schemas shared by classifier routes and tests."""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field


class ClassificationType(StrEnum):
    SUBMISSION_REVIEW = "submission_review"


class Category(StrEnum):
    VALID_PROFILE_CANDIDATE = "valid_profile_candidate"
    INVALID_FILE = "invalid_file"
    UNSUPPORTED_IMAGE_TYPE = "unsupported_image_type"
    SUSPICIOUS_FILE = "suspicious_file"
    LOW_QUALITY_IMAGE = "low_quality_image"
    INCOMPLETE_METADATA = "incomplete_metadata"
    NON_PROFILE_IMAGE = "non_profile_image"
    UNSAFE_CONTENT = "unsafe_content"


class ReviewDecision(StrEnum):
    PASSES_AUTOMATED_CHECKS = "passes_automated_checks"
    FAILS_AUTOMATED_CHECKS = "fails_automated_checks"
    NEEDS_MANUAL_REVIEW = "needs_manual_review"


class Provider(StrEnum):
    RULE_BASED = "rule_based"
    MODEL = "model"


class ClassifierHealthResponse(BaseModel):
    service: str = "classification-api"
    status: str = "ok"
    provider: str = "rule_based"
    version: str = "rules-v1"


class ClassifierRequestMetadata(BaseModel):
    model_config = ConfigDict(extra="forbid")

    submission_id: str
    content_type: str
    size_bytes: int = Field(ge=0)
    metadata_complete: bool


class ClassifierResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    classification_type: ClassificationType = ClassificationType.SUBMISSION_REVIEW
    category: Category
    review_decision: ReviewDecision
    score: float | None = Field(default=None, ge=0.0, le=1.0)
    reasons: list[str] = Field(default_factory=list)
    provider: Provider = Provider.RULE_BASED
    classifier_version: str = "rules-v1"
    schema_version: str = "classification-result-v1"
    is_fallback: bool = False
    error_code: str | None = None
    classified_at: datetime
    photo_type: str | None = None
    image_quality: str | None = None
    technical_status: str | None = None
    content_safety_status: str | None = None
    profile_suitability: str | None = None
    confidence_score: float | None = Field(default=None, ge=0.0, le=1.0)
    classification_duration_ms: int | None = Field(default=None, ge=0)
    fallback_reason: str | None = None
    provider_metadata: dict[str, object] | None = None
