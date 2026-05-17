"""Validation and sanitization for classifier responses before persistence."""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from django.utils import timezone
from django.utils.dateparse import parse_datetime

from .constants import (
    CLASSIFICATION_CATEGORIES,
    CLASSIFICATION_TYPE_SUBMISSION_REVIEW,
    CLASSIFIER_PROVIDERS,
    REVIEW_DECISIONS,
)


class ClassifierResponseValidationError(ValueError):
    """Raised when classifier output is malformed or unsafe to persist."""


FORBIDDEN_TRAIT_TERMS = (
    "ethnicity",
    "race",
    "racial",
    "attractiveness",
    "identity",
    "gender",
    "age",
    "nationality",
    "health",
    "religion",
    "political",
    "social_background",
    "economic_background",
    "personality",
    "trustworthiness",
    "competence",
    "desirability",
    "biometric",
    "face_identity",
)

FORBIDDEN_METADATA_TERMS = (
    "account_id",
    "name",
    "full_name",
    "first_name",
    "last_name",
    "user_id",
    "user_name",
    "email",
    "phone",
    "address",
    "ip_address",
    "place_of_living",
    "country_of_origin",
    "session",
    "session_id",
    "password",
    "password_hash",
    "token",
    "access_token",
    "refresh_token",
    "session_token",
    "bearer_token",
    "jwt",
    "secret",
    "credential",
    "credentials",
    "authorization",
    "api_key",
    "access_key",
    "access_key_id",
    "secret_access_key",
    "aws_access_key_id",
    "aws_secret_access_key",
    "signed_url",
    "signed_uri",
    "presigned_url",
    "pre_signed_url",
    "public_url",
    "raw_prompt",
    "prompt",
    "prompt_text",
    "prompt_input",
    "image_bytes",
    "image_data",
    "base64_image",
    "raw_image",
    "photo_bytes",
    "photo_data",
    "raw_photo",
    "provider_raw_data",
    "raw_provider_data",
)

FORBIDDEN_METADATA_COMPONENT_TERMS = frozenset(
    {
        "authorization",
        "credential",
        "credentials",
        "password",
        "secret",
        "session",
        "token",
    },
)

ALLOWED_RESPONSE_FIELDS = {
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
    "provider_metadata",
    "raw_response",
    "is_fallback",
    "fallback_reason",
    "error_code",
    "classified_at",
    "classification_duration_ms",
}

REQUIRED_RESPONSE_FIELDS = {
    "classification_type",
    "category",
    "review_decision",
    "provider",
    "classifier_version",
    "schema_version",
    "classified_at",
}

FORBIDDEN_RE = re.compile(
    r"\b("
    + "|".join(re.escape(term).replace("_", r"[_\s-]?") for term in FORBIDDEN_TRAIT_TERMS)
    + r")\b",
    re.IGNORECASE,
)

FORBIDDEN_SENSITIVE_VALUE_PATTERNS = (
    r"\b(?:bearer|basic)\s+[a-z0-9._~+/=-]{8,}",
    r"[?&](?:"
    r"x-amz-signature|x-amz-credential|x-amz-security-token|"
    r"x-goog-signature|x-goog-credential|x-goog-algorithm|"
    r"awsaccesskeyid|signature"
    r")=",
    r"\b(?:"
    r"api[_\s-]?key|access[_\s-]?key|secret[_\s-]?access[_\s-]?key|"
    r"access[_\s-]?token|refresh[_\s-]?token|session[_\s-]?token|"
    r"jwt|password|secret|credential"
    r")s?\s*[:=]\s*\S+",
    r"\b(?:secret|token|password|credential)[-_][a-z0-9._~+/=-]{4,}",
    r"\b[a-z0-9._~+/=-]{4,}[-_](?:secret|token|password|credential)\b",
    r"\b(?:raw|system|user|developer|assistant)\s+prompt\b",
    r"\bdata:image/(?:jpeg|jpg|png|webp);base64,",
    r"\b(?:image|photo)[_\s-]?(?:bytes|data)\b\s*[:=]\s*\S+",
    r"\b(?:"
    r"name|full[_\s-]?name|first[_\s-]?name|last[_\s-]?name|"
    r"email|phone|address|place[_\s-]?of[_\s-]?living|country[_\s-]?of[_\s-]?origin|"
    r"gender|age|user[_\s-]?id"
    r")\s*[:=]\s*\S+",
)

FORBIDDEN_SENSITIVE_VALUE_RE = re.compile(
    "|".join(f"(?:{pattern})" for pattern in FORBIDDEN_SENSITIVE_VALUE_PATTERNS),
    re.IGNORECASE,
)

CAMEL_BOUNDARY_RE = re.compile(r"(?<=[a-z0-9])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])")
NON_ALNUM_RE = re.compile(r"[^a-z0-9]+")

FORBIDDEN_METADATA_NORMALIZED_TERMS = frozenset(
    NON_ALNUM_RE.sub("_", CAMEL_BOUNDARY_RE.sub("_", term).lower()).strip("_")
    for term in FORBIDDEN_METADATA_TERMS
)
FORBIDDEN_METADATA_COMPACT_TERMS = frozenset(
    NON_ALNUM_RE.sub("", term.lower()) for term in FORBIDDEN_METADATA_TERMS
)


@dataclass(frozen=True, slots=True)
class ValidatedClassifierResponse:
    classification_type: str
    category: str
    review_decision: str
    score: float | None
    confidence_score: float | None
    reason: str
    reasons: list[str]
    provider: str
    classifier_version: str
    schema_version: str
    photo_type: str
    image_quality: str
    technical_status: str
    content_safety_status: str
    profile_suitability: str
    provider_metadata: dict[str, Any]
    raw_response: dict[str, Any]
    is_fallback: bool
    fallback_reason: str
    error_code: str
    classified_at: datetime
    classification_duration_ms: int | None


def validate_classifier_response(payload: dict[str, Any]) -> ValidatedClassifierResponse:
    if not isinstance(payload, dict):
        raise ClassifierResponseValidationError("Classifier response must be a JSON object.")

    _reject_unknown_fields(payload)
    _require_fields(payload)
    _reject_forbidden_content(payload)

    classification_type = _string(payload["classification_type"], "classification_type")
    if classification_type != CLASSIFICATION_TYPE_SUBMISSION_REVIEW:
        raise ClassifierResponseValidationError(
            "Classifier response type must be submission_review.",
        )

    category = _choice(payload["category"], CLASSIFICATION_CATEGORIES, "category")
    review_decision = _choice(payload["review_decision"], REVIEW_DECISIONS, "review_decision")
    provider = _choice(payload["provider"], CLASSIFIER_PROVIDERS, "provider")
    score = _score(payload.get("score"), "score")
    confidence_score = _score(payload.get("confidence_score"), "confidence_score")
    reasons = _reasons(payload.get("reasons"))
    provider_metadata = _safe_mapping(payload.get("provider_metadata"), "provider_metadata")
    raw_response = _safe_mapping(payload.get("raw_response"), "raw_response")
    classified_at = _datetime(payload["classified_at"])
    duration = payload.get("classification_duration_ms")
    if duration is not None and (type(duration) is not int or duration < 0):
        raise ClassifierResponseValidationError("classification_duration_ms must be non-negative.")

    return ValidatedClassifierResponse(
        classification_type=classification_type,
        category=category,
        review_decision=review_decision,
        score=score,
        confidence_score=confidence_score,
        reason=_string(payload.get("reason", ""), "reason", allow_blank=True),
        reasons=reasons,
        provider=provider,
        classifier_version=_string(payload["classifier_version"], "classifier_version"),
        schema_version=_string(payload["schema_version"], "schema_version"),
        photo_type=_string(payload.get("photo_type", ""), "photo_type", allow_blank=True),
        image_quality=_string(payload.get("image_quality", ""), "image_quality", allow_blank=True),
        technical_status=_string(
            payload.get("technical_status", ""),
            "technical_status",
            allow_blank=True,
        ),
        content_safety_status=_string(
            payload.get("content_safety_status", ""),
            "content_safety_status",
            allow_blank=True,
        ),
        profile_suitability=_string(
            payload.get("profile_suitability", ""),
            "profile_suitability",
            allow_blank=True,
        ),
        provider_metadata=provider_metadata,
        raw_response=raw_response,
        is_fallback=bool(payload.get("is_fallback", False)),
        fallback_reason=_string(
            payload.get("fallback_reason", ""),
            "fallback_reason",
            allow_blank=True,
        ),
        error_code=_string(payload.get("error_code", ""), "error_code", allow_blank=True),
        classified_at=classified_at,
        classification_duration_ms=duration,
    )


def _reject_unknown_fields(payload: dict[str, Any]) -> None:
    unknown = sorted(set(payload) - ALLOWED_RESPONSE_FIELDS)
    if unknown:
        _reject_forbidden_content({key: payload[key] for key in unknown})
        raise ClassifierResponseValidationError(
            f"Unexpected classifier response fields: {unknown}.",
        )


def _require_fields(payload: dict[str, Any]) -> None:
    missing = sorted(field for field in REQUIRED_RESPONSE_FIELDS if field not in payload)
    if missing:
        raise ClassifierResponseValidationError(f"Missing classifier response fields: {missing}.")


def _reject_forbidden_content(value: Any, *, path: str = "response") -> None:
    if isinstance(value, dict):
        for key, nested in value.items():
            _reject_forbidden_key(str(key), path)
            _reject_forbidden_content(nested, path=f"{path}.{key}")
    elif isinstance(value, list):
        for index, nested in enumerate(value):
            _reject_forbidden_content(nested, path=f"{path}[{index}]")
    elif isinstance(value, str):
        if FORBIDDEN_RE.search(value):
            raise ClassifierResponseValidationError(
                f"Forbidden inferred trait content found in {path}.",
            )
        if FORBIDDEN_SENSITIVE_VALUE_RE.search(value):
            raise ClassifierResponseValidationError(
                f"Forbidden sensitive value found in {path}.",
            )


def _reject_forbidden_key(key: str, path: str) -> None:
    normalized = _normalize_key(key)
    compact = NON_ALNUM_RE.sub("", normalized)
    components = frozenset(component for component in normalized.split("_") if component)
    if (
        normalized in FORBIDDEN_METADATA_NORMALIZED_TERMS
        or compact in FORBIDDEN_METADATA_COMPACT_TERMS
        or components & FORBIDDEN_METADATA_COMPONENT_TERMS
    ):
        raise ClassifierResponseValidationError(f"Forbidden sensitive field {key!r} in {path}.")
    if FORBIDDEN_RE.search(normalized.replace("_", " ")):
        raise ClassifierResponseValidationError(
            f"Forbidden inferred trait field {key!r} in {path}.",
        )


def _normalize_key(key: str) -> str:
    key_with_boundaries = CAMEL_BOUNDARY_RE.sub("_", key)
    return NON_ALNUM_RE.sub("_", key_with_boundaries.lower()).strip("_")


def _choice(value: Any, allowed: tuple[str, ...], field_name: str) -> str:
    value = _string(value, field_name)
    if value not in allowed:
        raise ClassifierResponseValidationError(f"{field_name} is not allowed.")
    return value


def _string(value: Any, field_name: str, *, allow_blank: bool = False) -> str:
    if value is None and allow_blank:
        return ""
    if not isinstance(value, str):
        raise ClassifierResponseValidationError(f"{field_name} must be a string.")
    if not allow_blank and not value.strip():
        raise ClassifierResponseValidationError(f"{field_name} must not be blank.")
    _reject_forbidden_content(value, path=field_name)
    return value


def _score(value: Any, field_name: str) -> float | None:
    if value is None:
        return None
    if type(value) not in {int, float}:
        raise ClassifierResponseValidationError(f"{field_name} must be numeric.")
    score = float(value)
    if score < 0.0 or score > 1.0:
        raise ClassifierResponseValidationError(f"{field_name} must be between 0 and 1.")
    return score


def _reasons(value: Any) -> list[str]:
    if value is None:
        return []
    if not isinstance(value, list):
        raise ClassifierResponseValidationError("reasons must be a list.")
    reasons: list[str] = []
    for item in value:
        reasons.append(_string(item, "reasons item"))
    return reasons


def _safe_mapping(value: Any, field_name: str) -> dict[str, Any]:
    if value in (None, ""):
        return {}
    if not isinstance(value, dict):
        raise ClassifierResponseValidationError(f"{field_name} must be an object.")
    _reject_forbidden_content(value, path=field_name)
    return value


def _datetime(value: Any) -> datetime:
    if isinstance(value, datetime):
        parsed = value
    elif isinstance(value, str):
        parsed = parse_datetime(value)
    else:
        parsed = None
    if parsed is None:
        raise ClassifierResponseValidationError("classified_at must be an ISO datetime.")
    if timezone.is_naive(parsed):
        parsed = timezone.make_aware(parsed, timezone.utc)
    return parsed
