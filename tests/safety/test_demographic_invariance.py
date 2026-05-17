from __future__ import annotations

from io import BytesIO

from PIL import Image


def image_bytes() -> bytes:
    image = Image.new("RGB", (320, 320), color=(20, 120, 100))
    output = BytesIO()
    image.save(output, format="JPEG")
    return output.getvalue()


def classify_with_extra_demographics(fastapi_client, **extra_fields: str) -> dict[str, object]:
    content = image_bytes()
    data = {
        "submission_id": "submission-1",
        "content_type": "image/jpeg",
        "size_bytes": str(len(content)),
        "metadata_complete": "true",
    }
    data.update(extra_fields)
    response = fastapi_client.post(
        "/classify",
        files={"file": ("profile.jpg", content, "image/jpeg")},
        data=data,
    )
    assert response.status_code == 200
    return response.json()


def outcome_fields(payload: dict[str, object]) -> dict[str, object]:
    return {
        "category": payload["category"],
        "review_decision": payload["review_decision"],
        "score": payload["score"],
        "image_quality": payload["image_quality"],
        "content_safety_status": payload["content_safety_status"],
        "profile_suitability": payload["profile_suitability"],
    }


def test_current_and_future_demographic_like_fields_do_not_change_classifier_outcomes(
    fastapi_client,
) -> None:
    first = classify_with_extra_demographics(
        fastapi_client,
        name="Alex",
        age="20",
        gender="non_binary",
        country_of_origin="Germany",
        place_of_living="Berlin",
        future_ethnicity="example",
        future_income="example",
    )
    second = classify_with_extra_demographics(
        fastapi_client,
        name="Sam",
        age="75",
        gender="female",
        country_of_origin="Brazil",
        place_of_living="Sao Paulo",
        future_ethnicity="different",
        future_income="different",
    )

    assert outcome_fields(first) == outcome_fields(second)
