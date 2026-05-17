"""Classifier provider selection."""

from __future__ import annotations

import os

from .rules import classify_submission_review
from .schemas import ClassifierRequestMetadata, ClassifierResponse, Provider


def classify_with_configured_provider(
    *,
    image_bytes: bytes,
    metadata: ClassifierRequestMetadata,
) -> ClassifierResponse:
    provider = os.getenv("CLASSIFIER_PROVIDER", Provider.RULE_BASED.value).strip().lower()
    if provider == Provider.RULE_BASED.value:
        return classify_submission_review(image_bytes=image_bytes, metadata=metadata)

    response = classify_submission_review(image_bytes=image_bytes, metadata=metadata)
    response.is_fallback = True
    response.fallback_reason = "Configured model provider is unavailable; used rule-based fallback."
    return response
