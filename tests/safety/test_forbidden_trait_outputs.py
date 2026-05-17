from __future__ import annotations

import re
from io import BytesIO
from typing import Any

import pytest
from PIL import Image

from apps.classification.tests.factories import classifier_response
from apps.classification.validators import (
    ClassifierResponseValidationError,
    validate_classifier_response,
)


def image_bytes() -> bytes:
    image = Image.new("RGB", (320, 320), color=(80, 20, 120))
    output = BytesIO()
    image.save(output, format="JPEG")
    return output.getvalue()


def flattened_keys(value: Any) -> set[str]:
    if isinstance(value, dict):
        keys = {str(key).lower() for key in value}
        for nested in value.values():
            keys.update(flattened_keys(nested))
        return keys
    if isinstance(value, list):
        keys: set[str] = set()
        for nested in value:
            keys.update(flattened_keys(nested))
        return keys
    return set()


@pytest.mark.parametrize(
    "field_name",
    ["predicted_gender", "estimated_age", "race", "attractiveness_score", "identity_match"],
)
def test_classifier_output_rejects_forbidden_inferred_trait_fields(field_name: str) -> None:
    payload = classifier_response(**{field_name: "unsafe"})

    with pytest.raises(ClassifierResponseValidationError):
        validate_classifier_response(payload)


def test_provider_metadata_rejects_nested_forbidden_trait_fields() -> None:
    payload = classifier_response(
        provider_metadata={
            "provider": {
                "person": {
                    "religion": "unsafe",
                },
            },
        },
    )

    with pytest.raises(ClassifierResponseValidationError, match="Forbidden"):
        validate_classifier_response(payload)


def test_raw_response_rejects_nested_provider_specific_forbidden_traits() -> None:
    payload = classifier_response(
        raw_response={
            "model_output": {
                "personality_score": 0.7,
            },
        },
    )

    with pytest.raises(ClassifierResponseValidationError, match="Forbidden"):
        validate_classifier_response(payload)


def test_classifier_endpoint_omits_forbidden_person_trait_fields(fastapi_client) -> None:
    content = image_bytes()

    response = fastapi_client.post(
        "/classify",
        files={"file": ("profile.jpg", content, "image/jpeg")},
        data={
            "submission_id": "submission-1",
            "content_type": "image/jpeg",
            "size_bytes": str(len(content)),
            "metadata_complete": "true",
        },
    )

    payload = response.json()
    payload_text = str(payload).lower()
    keys = flattened_keys(payload)
    assert response.status_code == 200
    assert "ethnicity" not in keys
    assert "race" not in keys
    assert "gender" not in keys
    assert "age" not in keys
    assert "nationality" not in keys
    assert "trustworthiness" not in keys
    assert re.search(r"\b(age|gender|race|nationality|trustworthiness)\b", payload_text) is None
