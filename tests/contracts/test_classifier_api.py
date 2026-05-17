from __future__ import annotations

from io import BytesIO

from PIL import Image


def image_bytes(format_name: str = "JPEG", *, size: tuple[int, int] = (320, 320)) -> bytes:
    image = Image.new("RGB", size, color=(20, 80, 140))
    output = BytesIO()
    image.save(output, format=format_name)
    return output.getvalue()


def test_classifier_contract_accepts_multipart_image_and_returns_allowed_schema(fastapi_client):
    content = image_bytes("JPEG")

    response = fastapi_client.post(
        "/classify",
        files={"file": ("profile.jpg", content, "image/jpeg")},
        data={
            "submission_id": "45f36c63-05e9-4e1d-893f-5061f2c83c10",
            "content_type": "image/jpeg",
            "size_bytes": str(len(content)),
            "metadata_complete": "true",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["classification_type"] == "submission_review"
    assert payload["category"] == "valid_profile_candidate"
    assert payload["review_decision"] == "passes_automated_checks"
    assert payload["provider"] == "rule_based"
    assert payload["classifier_version"] == "rules-v1"
    assert payload["schema_version"] == "classification-result-v1"
    assert isinstance(payload["reasons"], list)
    forbidden_text = str(payload).lower()
    assert "ethnicity" not in forbidden_text
    assert "race" not in forbidden_text
    assert "attractiveness" not in forbidden_text
    assert "identity" not in forbidden_text
    assert "gender" not in forbidden_text
    assert "nationality" not in forbidden_text


def test_classifier_contract_returns_normalized_invalid_file_response(fastapi_client):
    response = fastapi_client.post(
        "/classify",
        files={"file": ("empty.jpg", b"", "image/jpeg")},
        data={
            "submission_id": "45f36c63-05e9-4e1d-893f-5061f2c83c10",
            "content_type": "image/jpeg",
            "size_bytes": "0",
            "metadata_complete": "true",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["category"] == "invalid_file"
    assert payload["review_decision"] == "fails_automated_checks"
    assert payload["error_code"] == "EMPTY_FILE"
