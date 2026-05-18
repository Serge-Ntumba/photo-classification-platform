from __future__ import annotations

import logging
import sys

import pytest
from django.http import HttpResponse
from django.urls import reverse
from django.utils import timezone

from apps.classification.constants import (
    CATEGORY_VALID_PROFILE_CANDIDATE,
    CLASSIFICATION_SCHEMA_VERSION,
    CLASSIFICATION_TYPE_SUBMISSION_REVIEW,
    CLASSIFIER_VERSION,
    DECISION_PASSES_AUTOMATED_CHECKS,
    PROVIDER_RULE_BASED,
    SUBMISSION_STATUS_CLASSIFIED,
)
from apps.classification.models import ClassificationResult
from apps.classification.services import persist_classification_result
from apps.classification.tests.factories import classifier_response, make_job, make_submission
from apps.classification.validators import (
    ClassifierResponseValidationError,
    validate_classifier_response,
)
from apps.core.logging import (
    RESPONSE_REQUEST_ID_HEADER,
    RequestIdMiddleware,
    SafeFormatter,
    SafeLogFilter,
    reset_request_id,
    set_request_id,
)

pytestmark = pytest.mark.django_db


def test_raw_responses_with_secrets_signed_urls_or_prompts_are_rejected() -> None:
    payload = classifier_response(
        raw_response={
            "token": "secret-token",
            "signed_url": "https://example.test/photo?signature=abc",
            "raw_prompt": "classify this person",
        },
    )

    with pytest.raises(ClassifierResponseValidationError, match="Forbidden"):
        validate_classifier_response(payload)


@pytest.mark.parametrize("container", ["provider_metadata", "raw_response"])
@pytest.mark.parametrize(
    "field_name",
    [
        "apiKey",
        "signedURL",
        "rawPrompt",
        "imageBytes",
        "secretAccessKey",
        "accessToken",
    ],
)
def test_provider_data_rejects_sensitive_key_variants(
    container: str,
    field_name: str,
) -> None:
    payload = classifier_response(
        **{container: {"provider_payload": {field_name: "must-not-store"}}},
    )

    with pytest.raises(ClassifierResponseValidationError, match="Forbidden sensitive field"):
        validate_classifier_response(payload)


@pytest.mark.parametrize("container", ["provider_metadata", "raw_response"])
@pytest.mark.parametrize(
    "sensitive_value",
    [
        "https://example.test/photo?X-Amz-Signature=abc",
        "Bearer abc.def.ghi",
        "must-not-store-secret-value",
        "Raw prompt: decide whether this profile should pass",
        "api_key=must-not-store",
        "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD",
        "name: Alex Morgan",
    ],
)
def test_provider_data_rejects_sensitive_values_hidden_under_neutral_keys(
    container: str,
    sensitive_value: str,
) -> None:
    payload = classifier_response(
        **{container: {"provider_payload": {"debug": sensitive_value}}},
    )

    with pytest.raises(ClassifierResponseValidationError, match="Forbidden sensitive value"):
        validate_classifier_response(payload)


def test_unsafe_raw_response_is_rejected_before_storage_without_logging(caplog) -> None:
    job = make_job()
    unsafe_value = "must-not-store-secret-value"
    payload = classifier_response(
        raw_response={
            "model_payload": {
                "signedURL": unsafe_value,
            },
        },
    )

    with caplog.at_level(logging.INFO):
        with pytest.raises(ClassifierResponseValidationError, match="Forbidden sensitive field"):
            persist_classification_result(job=job, response_payload=payload)

    job.submission.refresh_from_db()
    assert ClassificationResult.objects.count() == 0
    assert job.submission.latest_classification_result_id is None
    assert unsafe_value not in caplog.text
    assert "signedURL" not in caplog.text


def test_sensitive_raw_response_value_is_rejected_before_storage_without_logging(caplog) -> None:
    job = make_job()
    unsafe_value = "Bearer abc.def.ghi"
    payload = classifier_response(
        raw_response={
            "model_payload": {
                "debug": unsafe_value,
            },
        },
    )

    with caplog.at_level(logging.INFO):
        with pytest.raises(ClassifierResponseValidationError, match="Forbidden sensitive value"):
            persist_classification_result(job=job, response_payload=payload)

    job.submission.refresh_from_db()
    assert ClassificationResult.objects.count() == 0
    assert job.submission.latest_classification_result_id is None
    assert unsafe_value not in caplog.text


def test_safe_log_filter_redacts_sensitive_values_and_attaches_request_id() -> None:
    record = logging.LogRecord(
        name="safety-test",
        level=logging.INFO,
        pathname=__file__,
        lineno=1,
        msg=(
            "token=secret-token signed_url=https://example.test/photo?X-Amz-Signature=abc "
            "raw prompt: classify name: Alex"
        ),
        args=(),
        exc_info=None,
    )
    token = set_request_id("req-test-123")
    try:
        assert SafeLogFilter().filter(record) is True
    finally:
        reset_request_id(token)

    redacted = record.getMessage()
    assert record.request_id == "req-test-123"
    assert "secret-token" not in redacted
    assert "X-Amz-Signature=abc" not in redacted
    assert "raw prompt" not in redacted.lower()
    assert "Alex" not in redacted


@pytest.mark.parametrize(
    "message",
    [
        "rawPrompt=classify Alex Morgan",
        "raw_prompt=classify Alex Morgan",
        "raw-prompt=classify Alex Morgan",
        "signedURL=https://example.test/photo",
        "imageBytes=/9j/4AAQSkZJRgABAQAAAQABAAD",
    ],
)
def test_safe_log_filter_redacts_sensitive_key_variants(message: str) -> None:
    record = logging.LogRecord(
        name="safety-test",
        level=logging.INFO,
        pathname=__file__,
        lineno=1,
        msg=message,
        args=(),
        exc_info=None,
    )

    assert SafeLogFilter().filter(record) is True

    redacted = record.getMessage()
    assert "Alex" not in redacted
    assert "rawPrompt" not in redacted
    assert "raw_prompt" not in redacted
    assert "signedURL" not in redacted
    assert "imageBytes" not in redacted


def test_safe_formatter_redacts_exception_text() -> None:
    try:
        raise RuntimeError("password=secret-token")
    except RuntimeError:
        record = logging.LogRecord(
            name="safety-test",
            level=logging.ERROR,
            pathname=__file__,
            lineno=1,
            msg="classification failed",
            args=(),
            exc_info=sys.exc_info(),
        )

    formatted = SafeFormatter("%(message)s").format(record)

    assert "secret-token" not in formatted
    assert "password=" not in formatted


def test_request_id_middleware_sets_safe_response_header(rf) -> None:
    def get_response(request):
        assert request.request_id == "req-test-123"
        return HttpResponse("ok")

    request = rf.get("/health", HTTP_X_REQUEST_ID="req-test-123")
    response = RequestIdMiddleware(get_response)(request)

    assert response[RESPONSE_REQUEST_ID_HEADER] == "req-test-123"


def test_user_submission_api_omits_raw_provider_data_and_image_bytes(api_client) -> None:
    submission = make_submission(status=SUBMISSION_STATUS_CLASSIFIED)
    result = ClassificationResult.objects.create(
        submission=submission,
        job_id="11111111-1111-4111-8111-111111111111",
        classification_type=CLASSIFICATION_TYPE_SUBMISSION_REVIEW,
        category=CATEGORY_VALID_PROFILE_CANDIDATE,
        review_decision=DECISION_PASSES_AUTOMATED_CHECKS,
        score=1.0,
        reasons=["Safe normalized reason."],
        provider=PROVIDER_RULE_BASED,
        classifier_version=CLASSIFIER_VERSION,
        schema_version=CLASSIFICATION_SCHEMA_VERSION,
        provider_metadata={"safe_provider": "metadata"},
        raw_response={"token": "must-not-leak", "image_bytes": "must-not-leak"},
        classified_at=timezone.now(),
    )
    submission.latest_classification_result = result
    submission.save(update_fields=["latest_classification_result", "updated_at"])
    api_client.force_authenticate(user=submission.user)

    response = api_client.get(reverse("submission-detail", kwargs={"pk": submission.id}))

    assert response.status_code == 200
    response_text = str(response.data)
    assert response.data["classification"]["category"] == CATEGORY_VALID_PROFILE_CANDIDATE
    assert "raw_response" not in response_text
    assert "provider_metadata" not in response_text
    assert "must-not-leak" not in response_text
    assert "image_bytes" not in response_text
    assert "photo_bytes" not in response_text
