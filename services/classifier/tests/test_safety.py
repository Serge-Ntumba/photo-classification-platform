from __future__ import annotations

from datetime import UTC, datetime
from io import BytesIO

from PIL import Image

from app.safety import ClassifierSafetyError, validate_classifier_response_safety
from app.schemas import Category, ClassifierResponse, ReviewDecision


def image_bytes() -> bytes:
    image = Image.new("RGB", (320, 320), color=(40, 90, 140))
    output = BytesIO()
    image.save(output, format="JPEG")
    return output.getvalue()


def response_with_provider_metadata(provider_metadata: dict[str, object]) -> ClassifierResponse:
    return ClassifierResponse(
        category=Category.VALID_PROFILE_CANDIDATE,
        review_decision=ReviewDecision.PASSES_AUTOMATED_CHECKS,
        score=1.0,
        reasons=["Image and required metadata passed automated review checks."],
        classified_at=datetime.now(UTC),
        provider_metadata=provider_metadata,
    )


def test_classifier_safety_rejects_future_provider_trait_metadata() -> None:
    response = response_with_provider_metadata(
        {
            "provider": {
                "predictedGender": "unsafe",
            },
        },
    )

    try:
        validate_classifier_response_safety(response)
    except ClassifierSafetyError as exc:
        assert "forbidden trait" in str(exc).lower()
    else:
        raise AssertionError("Unsafe provider metadata was accepted.")


def test_classifier_safety_rejects_sensitive_provider_values() -> None:
    response = response_with_provider_metadata(
        {
            "debug": "signedURL=https://example.test/photo",
        },
    )

    try:
        validate_classifier_response_safety(response)
    except ClassifierSafetyError as exc:
        assert "sensitive provider" in str(exc).lower()
    else:
        raise AssertionError("Sensitive provider metadata was accepted.")


def test_classifier_endpoint_blocks_unsafe_provider_response_without_leaking_it(
    fastapi_client,
    monkeypatch,
) -> None:
    unsafe_value = "Bearer abc.def.ghi"

    def unsafe_provider_response(*_args, **_kwargs) -> ClassifierResponse:
        return response_with_provider_metadata({"debug": unsafe_value})

    monkeypatch.setattr("app.main.classify_with_configured_provider", unsafe_provider_response)
    content = image_bytes()

    response = fastapi_client.post(
        "/classify",
        files={"file": ("photo.jpg", content, "image/jpeg")},
        data={
            "submission_id": "submission-1",
            "content_type": "image/jpeg",
            "size_bytes": str(len(content)),
            "metadata_complete": "true",
        },
    )

    assert response.status_code == 502
    assert "safety validation" in response.text
    assert unsafe_value not in response.text
