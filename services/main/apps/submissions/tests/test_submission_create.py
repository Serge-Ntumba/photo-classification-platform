from __future__ import annotations

from io import BytesIO

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from PIL import Image
from rest_framework import status

from apps.classification.constants import (
    PUBLISH_STATUS_FAILED,
    PUBLISH_STATUS_PUBLISHED,
    RABBITMQ_PUBLISH_MAX_ATTEMPTS,
    SUBMISSION_STATUS_CLASSIFICATION_FAILED,
    SUBMISSION_STATUS_PENDING_CLASSIFICATION,
)
from apps.classification.models import ClassificationJob
from apps.submissions.models import Submission

pytestmark = pytest.mark.django_db
TEST_PASSWORD = "StrongPassword123!"  # noqa: S105


class RecordingStorageClient:
    def __init__(self) -> None:
        self.objects: dict[str, dict[str, object]] = {}
        self.deleted: list[str] = []

    def upload_bytes(self, *, key: str, content: bytes, content_type: str) -> None:
        self.objects[key] = {"content": content, "content_type": content_type}

    def delete_object(self, *, key: str) -> None:
        self.deleted.append(key)
        self.objects.pop(key, None)


@pytest.fixture
def recording_storage(monkeypatch: pytest.MonkeyPatch) -> RecordingStorageClient:
    client = RecordingStorageClient()
    monkeypatch.setattr("apps.submissions.storage_service.ObjectStorageClient", lambda: client)
    return client


@pytest.fixture
def user():
    return get_user_model().objects.create_user(
        username="submission-owner",
        email="submission-owner@example.com",
        password=TEST_PASSWORD,
    )


def image_bytes(format_name: str = "JPEG", *, metadata: bool = False) -> bytes:
    image = Image.new("RGB", (320, 320), color=(120, 80, 40))
    output = BytesIO()
    if format_name == "JPEG" and metadata:
        exif = image.getexif()
        exif[0x010E] = "private description"
        image.save(output, format=format_name, exif=exif.tobytes())
    else:
        image.save(output, format=format_name)
    return output.getvalue()


def payload(**overrides: object) -> dict[str, object]:
    photo = BytesIO(image_bytes("JPEG", metadata=True))
    photo.name = "profile.jpg"  # type: ignore[attr-defined]
    data: dict[str, object] = {
        "name": "Alex Morgan",
        "age": "29",
        "place_of_living": "Berlin",
        "gender": "non_binary",
        "country_of_origin": "Germany",
        "description": "Optional user-provided description.",
        "photo": photo,
    }
    photo.content_type = "image/jpeg"  # type: ignore[attr-defined]
    data.update(overrides)
    return data


def stored_image_info(content: bytes) -> dict[str, object]:
    with Image.open(BytesIO(content)) as image:
        return {"format": image.format, "info_keys": {key.lower() for key in image.info}}


def test_valid_submission_persists_sanitized_object_submission_and_outbox_job(
    api_client,
    recording_storage: RecordingStorageClient,
    user,
):
    api_client.force_authenticate(user=user)

    response = api_client.post(reverse("submission-list"), payload(), format="multipart")

    assert response.status_code == status.HTTP_201_CREATED
    submission = Submission.objects.get(id=response.data["id"])
    job = ClassificationJob.objects.get(submission=submission)
    stored = recording_storage.objects[submission.photo_object_key]
    info = stored_image_info(stored["content"])

    assert submission.user == user
    assert submission.status == SUBMISSION_STATUS_PENDING_CLASSIFICATION
    assert submission.photo_original_filename == "profile.jpg"
    assert submission.photo_content_type == "image/jpeg"
    assert submission.photo_size_bytes == len(stored["content"])
    assert info["format"] == "JPEG"
    assert "exif" not in info["info_keys"]
    assert job.publish_status == PUBLISH_STATUS_PUBLISHED
    assert job.payload == {
        "submission_id": str(submission.id),
        "job_id": str(job.job_id),
        "attempt": 1,
        "requested_at": job.payload["requested_at"],
    }
    forbidden_payload_text = str(job.payload).lower()
    assert "alex" not in forbidden_payload_text
    assert "germany" not in forbidden_payload_text
    assert "secret" not in forbidden_payload_text


def test_submission_is_not_left_pending_when_publish_retries_are_exhausted(
    api_client,
    recording_storage,
    settings,
    monkeypatch: pytest.MonkeyPatch,
    user,
):
    settings.CELERY_TASK_ALWAYS_EAGER = False

    def fail_publish(*_args, **_kwargs) -> None:
        raise RuntimeError("broker unavailable")

    monkeypatch.setattr("apps.classification.publisher.celery_app.send_task", fail_publish)
    api_client.force_authenticate(user=user)

    response = api_client.post(reverse("submission-list"), payload(), format="multipart")

    assert response.status_code == status.HTTP_201_CREATED
    submission = Submission.objects.get(id=response.data["id"])
    job = ClassificationJob.objects.get(submission=submission)
    assert submission.status == SUBMISSION_STATUS_CLASSIFICATION_FAILED
    assert job.publish_status == PUBLISH_STATUS_FAILED
    assert job.attempt_count == RABBITMQ_PUBLISH_MAX_ATTEMPTS
    assert "broker unavailable" in job.last_error
    assert submission.photo_object_key in recording_storage.objects


def test_storage_object_is_cleaned_when_durable_job_creation_fails(
    api_client,
    recording_storage: RecordingStorageClient,
    monkeypatch: pytest.MonkeyPatch,
    user,
):
    def fail_create(*_args, **_kwargs):
        raise RuntimeError("database unavailable")

    monkeypatch.setattr("apps.classification.models.ClassificationJob.objects.create", fail_create)
    api_client.force_authenticate(user=user)

    with pytest.raises(RuntimeError, match="database unavailable"):
        api_client.post(reverse("submission-list"), payload(), format="multipart")

    assert Submission.objects.count() == 0
    assert ClassificationJob.objects.count() == 0
    assert recording_storage.objects == {}
    assert recording_storage.deleted
