from __future__ import annotations

import pytest
from django.urls import reverse
from rest_framework import status

from apps.classification.models import ClassificationJob, ClassificationResult
from apps.submissions.models import Submission
from factories import RecordingStorageClient, make_user, submission_payload

pytestmark = pytest.mark.django_db


@pytest.fixture
def recording_storage(monkeypatch: pytest.MonkeyPatch) -> RecordingStorageClient:
    client = RecordingStorageClient()
    monkeypatch.setattr("apps.submissions.storage_service.ObjectStorageClient", lambda: client)
    return client


def test_submission_create_does_not_call_classifier_synchronously(
    api_client,
    recording_storage: RecordingStorageClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = make_user("responsive-owner")
    classifier_calls: list[str] = []

    def fail_if_called(*_args, **_kwargs):
        classifier_calls.append("called")
        raise AssertionError("Upload path must not call the classifier synchronously.")

    monkeypatch.setattr("apps.classification.client.ClassifierClient.classify", fail_if_called)
    api_client.force_authenticate(user=user)

    response = api_client.post(
        reverse("submission-list"),
        submission_payload(),
        format="multipart",
    )

    assert response.status_code == status.HTTP_201_CREATED
    assert response.data["classification"] is None
    assert response["X-Classification-Queued"] == "true"
    assert classifier_calls == []
    assert Submission.objects.count() == 1
    assert ClassificationJob.objects.count() == 1
    assert ClassificationResult.objects.count() == 0


def test_submission_create_only_publishes_minimal_async_job_when_not_eager(
    api_client,
    recording_storage: RecordingStorageClient,
    settings,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    settings.CELERY_TASK_ALWAYS_EAGER = False
    user = make_user("async-boundary-owner")
    sent_jobs: list[dict[str, object]] = []

    def record_send_task(_task_name, *, kwargs, queue):
        sent_jobs.append({"kwargs": kwargs, "queue": queue})

    monkeypatch.setattr("apps.classification.publisher.celery_app.send_task", record_send_task)
    api_client.force_authenticate(user=user)

    response = api_client.post(
        reverse("submission-list"),
        submission_payload(),
        format="multipart",
    )

    assert response.status_code == status.HTTP_201_CREATED
    assert response["X-Classification-Queued"] == "true"
    assert len(sent_jobs) == 1
    assert sent_jobs[0]["queue"] == "classification"
    payload = sent_jobs[0]["kwargs"]
    assert set(payload) == {"submission_id", "job_id", "attempt", "requested_at"}
    payload_text = str(payload).lower()
    assert "alex" not in payload_text
    assert "berlin" not in payload_text
    assert "germany" not in payload_text
