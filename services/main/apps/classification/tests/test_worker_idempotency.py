from __future__ import annotations

import pytest

from apps.classification.models import ClassificationResult
from apps.classification.services import persist_classification_result
from apps.classification.tasks import process_classification_job_payload

from .factories import FakeClassifierClient, FakeStorageClient, classifier_response, make_job

pytestmark = pytest.mark.django_db


def test_duplicate_job_delivery_does_not_create_duplicate_results_or_latest_updates() -> None:
    job = make_job()

    first = process_classification_job_payload(
        job.payload,
        client=FakeClassifierClient(),
        storage_client=FakeStorageClient(),
    )
    second = process_classification_job_payload(
        job.payload,
        client=FakeClassifierClient(response=classifier_response(score=0.5)),
        storage_client=FakeStorageClient(),
    )

    job.submission.refresh_from_db()
    result = ClassificationResult.objects.get(job_id=job.job_id)
    assert first.status == "classified"
    assert second.status == "duplicate"
    assert ClassificationResult.objects.filter(job_id=job.job_id).count() == 1
    assert result.score == 1.0
    assert job.submission.latest_classification_result_id == result.id


def test_persistence_is_idempotent_for_same_job_id() -> None:
    job = make_job()
    first = persist_classification_result(job=job, response_payload=classifier_response())
    second = persist_classification_result(
        job=job,
        response_payload=classifier_response(score=0.5),
    )

    assert first.id == second.id
    assert ClassificationResult.objects.count() == 1
