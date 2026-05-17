from __future__ import annotations

from io import BytesIO

from PIL import Image

from app.providers import classify_with_configured_provider
from app.schemas import Category, ClassifierRequestMetadata


def image_bytes() -> bytes:
    image = Image.new("RGB", (320, 320), color=(80, 120, 40))
    output = BytesIO()
    image.save(output, format="JPEG")
    return output.getvalue()


def metadata(content: bytes) -> ClassifierRequestMetadata:
    return ClassifierRequestMetadata(
        submission_id="submission-1",
        content_type="image/jpeg",
        size_bytes=len(content),
        metadata_complete=True,
    )


def test_rule_based_provider_is_default(monkeypatch) -> None:
    content = image_bytes()
    monkeypatch.setenv("CLASSIFIER_PROVIDER", "rule_based")

    result = classify_with_configured_provider(image_bytes=content, metadata=metadata(content))

    assert result.category == Category.VALID_PROFILE_CANDIDATE
    assert result.provider == "rule_based"
    assert result.is_fallback is False


def test_model_provider_without_implementation_falls_back_to_rule_based(monkeypatch) -> None:
    content = image_bytes()
    monkeypatch.setenv("CLASSIFIER_PROVIDER", "model")
    monkeypatch.delenv("MODEL_PROVIDER_API_KEY", raising=False)

    result = classify_with_configured_provider(image_bytes=content, metadata=metadata(content))

    assert result.category == Category.VALID_PROFILE_CANDIDATE
    assert result.provider == "rule_based"
    assert result.is_fallback is True
    assert "fallback" in result.fallback_reason.lower()
