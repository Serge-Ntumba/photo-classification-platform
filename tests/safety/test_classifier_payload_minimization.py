from __future__ import annotations

import pytest

from apps.classification.client import build_classifier_request
from apps.classification.tests.factories import image_bytes, make_submission

pytestmark = pytest.mark.django_db


def request_without_image_bytes(request):
    filename, _content, content_type = request["files"]["file"]
    return {
        "files": {"file": (filename, "<image-bytes>", content_type)},
        "data": request["data"],
    }


def test_worker_to_classifier_request_contains_only_image_and_allowed_technical_metadata() -> None:
    submission = make_submission()
    submission.photo_original_filename = "Alex_Morgan_Germany_token_profile.jpg"
    submission.session_token = "session-secret"  # noqa: S105
    submission.storage_credentials = "minio-secret"  # noqa: S105
    submission.future_ethnicity = "example"
    content = image_bytes()

    request = build_classifier_request(submission=submission, image_bytes=content)

    assert set(request) == {"files", "data"}
    assert set(request["data"]) == {
        "submission_id",
        "content_type",
        "size_bytes",
        "metadata_complete",
    }
    assert request["files"]["file"][0] == "photo.jpg"
    request_text = str(request_without_image_bytes(request)).lower()
    assert "alex" not in request_text
    assert "morgan" not in request_text
    assert "berlin" not in request_text
    assert "germany" not in request_text
    assert "non_binary" not in request_text
    assert "session-secret" not in request_text
    assert "minio-secret" not in request_text
    assert "ethnicity" not in request_text


def test_worker_to_classifier_request_does_not_send_credentials_or_user_identifiers() -> None:
    submission = make_submission()
    submission.photo_original_filename = f"{submission.user_id}_token_secret_profile.jpg"
    content = image_bytes()

    request = build_classifier_request(submission=submission, image_bytes=content)

    assert request["files"]["file"][0] == "photo.jpg"
    request_text = str(request_without_image_bytes(request)).lower()
    assert "password" not in request_text
    assert "token" not in request_text
    assert "secret" not in request_text
    assert "access_key" not in request_text
    assert "user_id" not in request_text
    assert str(submission.user_id) not in request_text
