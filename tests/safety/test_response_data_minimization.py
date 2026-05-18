from __future__ import annotations

import pytest
from django.urls import reverse

from apps.classification.validators import (
    ClassifierResponseValidationError,
    validate_classifier_response,
)
from factories import (
    classifier_response,
    make_admin_user,
    make_classification_result,
    make_submission,
)

pytestmark = pytest.mark.django_db


@pytest.mark.parametrize(
    "sensitive_value",
    [
        "rawPrompt=classify Alex Morgan",
        "raw_prompt=classify Alex Morgan",
        "signedURL=https://storage.example/photo.jpg",
        "Bearer abc.def.ghi",
    ],
)
def test_provider_payload_values_are_rejected_even_under_neutral_keys(
    sensitive_value: str,
) -> None:
    payload = classifier_response(raw_response={"provider_payload": {"debug": sensitive_value}})

    with pytest.raises(ClassifierResponseValidationError, match="Forbidden sensitive value"):
        validate_classifier_response(payload)


def test_user_api_response_never_exposes_provider_metadata_or_raw_response(api_client) -> None:
    submission = make_submission()
    make_classification_result(
        submission=submission,
        provider_metadata={"debug": "Bearer abc.def.ghi"},
        raw_response={"prompt": "rawPrompt=classify Alex Morgan"},
    )
    api_client.force_authenticate(user=submission.user)

    response = api_client.get(reverse("submission-detail", kwargs={"pk": submission.id}))

    assert response.status_code == 200
    response_text = str(response.data).lower()
    assert "provider_metadata" not in response_text
    assert "raw_response" not in response_text
    assert "bearer abc.def.ghi" not in response_text
    assert "rawprompt" not in response_text
    assert "prompt" not in response_text


def test_django_admin_responses_never_render_provider_metadata_or_raw_response(client) -> None:
    admin_user = make_admin_user("minimization-admin")
    submission = make_submission(name="Minimization Candidate")
    result = make_classification_result(
        submission=submission,
        provider_metadata={"debug": "signedURL=https://storage.example/photo.jpg"},
        raw_response={"prompt": "rawPrompt=classify Alex Morgan", "apiKey": "secret"},
    )
    client.force_login(admin_user)

    submission_response = client.get(
        reverse("admin:submissions_submission_change", kwargs={"object_id": submission.pk}),
    )
    result_response = client.get(
        reverse(
            "admin:classification_classificationresult_change",
            kwargs={"object_id": result.pk},
        ),
    )

    assert submission_response.status_code == 200
    assert result_response.status_code == 200
    rendered = (submission_response.content + result_response.content).decode().lower()
    assert "provider_metadata" not in rendered
    assert "raw_response" not in rendered
    assert "signedurl" not in rendered
    assert "rawprompt" not in rendered
    assert "apikey" not in rendered
    assert "secret" not in rendered
