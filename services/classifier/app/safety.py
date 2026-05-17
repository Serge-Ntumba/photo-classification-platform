"""Runtime safety guardrails for classifier responses."""

from __future__ import annotations

import re
from typing import Any

from pydantic import BaseModel

from .schemas import ClassificationType, ClassifierResponse


class ClassifierSafetyError(ValueError):
    """Raised when a classifier response would break the safety boundary."""


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

FORBIDDEN_PROVIDER_TERMS = (
    "account_id",
    "name",
    "full_name",
    "first_name",
    "last_name",
    "user_id",
    "email",
    "phone",
    "address",
    "ip_address",
    "place_of_living",
    "country_of_origin",
    "session",
    "password",
    "token",
    "access_token",
    "refresh_token",
    "bearer_token",
    "jwt",
    "secret",
    "credential",
    "credentials",
    "authorization",
    "api_key",
    "access_key",
    "secret_access_key",
    "aws_access_key_id",
    "aws_secret_access_key",
    "signed_url",
    "presigned_url",
    "public_url",
    "raw_prompt",
    "prompt",
    "image_bytes",
    "image_data",
    "base64_image",
    "raw_image",
    "photo_bytes",
    "photo_data",
    "raw_response",
    "provider_raw_data",
)

FORBIDDEN_PROVIDER_COMPONENT_TERMS = frozenset(
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

FORBIDDEN_TRAIT_RE = re.compile(
    r"\b("
    + "|".join(re.escape(term).replace("_", r"[_\s-]?") for term in FORBIDDEN_TRAIT_TERMS)
    + r")\b",
    re.IGNORECASE,
)

FORBIDDEN_VALUE_RE = re.compile(
    r"|".join(
        [
            r"\b(?:bearer|basic)\s+[a-z0-9._~+/=-]{8,}",
            r"[?&](?:x-amz-signature|x-amz-credential|x-amz-security-token|signature)=",
            r"\b(?:api[_\s-]?key|access[_\s-]?key|secret[_\s-]?access[_\s-]?key|"
            r"access[_\s-]?token|refresh[_\s-]?token|session[_\s-]?token|bearer"
            r"[_\s-]?token|token|jwt|password|secret|credential|signed[_\s-]?url|"
            r"pre[_\s-]?signed[_\s-]?url|public[_\s-]?url|raw[_\s-]?prompt|"
            r"image[_\s-]?bytes|photo[_\s-]?bytes)"
            r"s?\s*[:=]\s*\S+",
            r"\b(?:raw|system|user|developer|assistant)\s+prompt\b",
            r"\bdata:image/(?:jpeg|jpg|png|webp);base64,",
            r"\b(?:image|photo)[_\s-]?(?:bytes|data)\b\s*[:=]\s*\S+",
            r"\b(?:name|email|phone|address|place[_\s-]?of[_\s-]?living|"
            r"country[_\s-]?of[_\s-]?origin|gender|age|user[_\s-]?id)\s*[:=]\s*\S+",
        ],
    ),
    re.IGNORECASE,
)

CAMEL_BOUNDARY_RE = re.compile(r"(?<=[a-z0-9])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])")
NON_ALNUM_RE = re.compile(r"[^a-z0-9]+")

FORBIDDEN_PROVIDER_NORMALIZED_TERMS = frozenset(
    NON_ALNUM_RE.sub("_", CAMEL_BOUNDARY_RE.sub("_", term).lower()).strip("_")
    for term in FORBIDDEN_PROVIDER_TERMS
)
FORBIDDEN_PROVIDER_COMPACT_TERMS = frozenset(
    NON_ALNUM_RE.sub("", term.lower()) for term in FORBIDDEN_PROVIDER_TERMS
)
ALLOWED_RESPONSE_FIELDS = frozenset(ClassifierResponse.model_fields)


def validate_classifier_response_safety(response: ClassifierResponse | dict[str, Any]) -> None:
    """Validate classifier output before the service returns it to the worker."""

    payload = _response_payload(response)
    unknown_fields = sorted(set(payload) - ALLOWED_RESPONSE_FIELDS)
    if unknown_fields:
        raise ClassifierSafetyError("Classifier response included unsupported fields.")
    if payload.get("classification_type") != ClassificationType.SUBMISSION_REVIEW.value:
        raise ClassifierSafetyError("Classifier response must classify submission review only.")
    _reject_unsafe_content(payload)


def _response_payload(response: ClassifierResponse | dict[str, Any]) -> dict[str, Any]:
    if isinstance(response, BaseModel):
        return response.model_dump(mode="json", exclude_none=True)
    if isinstance(response, dict):
        return response
    raise ClassifierSafetyError("Classifier response must be a structured object.")


def _reject_unsafe_content(value: Any, *, path: str = "response") -> None:
    if isinstance(value, dict):
        for key, nested in value.items():
            _reject_unsafe_key(str(key), path)
            _reject_unsafe_content(nested, path=f"{path}.{key}")
    elif isinstance(value, list):
        for index, nested in enumerate(value):
            _reject_unsafe_content(nested, path=f"{path}[{index}]")
    elif isinstance(value, str):
        if FORBIDDEN_TRAIT_RE.search(value):
            raise ClassifierSafetyError("Classifier response included forbidden trait content.")
        if FORBIDDEN_VALUE_RE.search(value):
            raise ClassifierSafetyError("Classifier response included sensitive provider content.")


def _reject_unsafe_key(key: str, path: str) -> None:
    normalized = _normalize_key(key)
    compact = NON_ALNUM_RE.sub("", normalized)
    components = frozenset(component for component in normalized.split("_") if component)
    if FORBIDDEN_TRAIT_RE.search(normalized.replace("_", " ")):
        raise ClassifierSafetyError("Classifier response included a forbidden trait field.")
    if (
        normalized in FORBIDDEN_PROVIDER_NORMALIZED_TERMS
        or compact in FORBIDDEN_PROVIDER_COMPACT_TERMS
        or components & FORBIDDEN_PROVIDER_COMPONENT_TERMS
    ):
        raise ClassifierSafetyError("Classifier response included a sensitive provider field.")


def _normalize_key(key: str) -> str:
    key_with_boundaries = CAMEL_BOUNDARY_RE.sub("_", key)
    return NON_ALNUM_RE.sub("_", key_with_boundaries.lower()).strip("_")
