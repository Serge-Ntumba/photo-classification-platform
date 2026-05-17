from __future__ import annotations

import pytest

from apps.classification.constants import SUBMISSION_STATUS_CLASSIFIED
from apps.classification.models import ClassificationResult
from apps.classification.tasks import process_classification_job_payload

from .factories import FakeClassifierClient, FakeStorageClient, make_job

pytestmark = pytest.mark.django_db


def test_worker_processes_job_persists_result_and_updates_latest_pointer() -> None:
    job = make_job()

    result = process_classification_job_payload(
        job.payload,
        client=FakeClassifierClient(),
        storage_client=FakeStorageClient(),
    )

    job.submission.refresh_from_db()
    classification = ClassificationResult.objects.get(job_id=job.job_id)
    assert result.status == "classified"
    assert job.submission.status == SUBMISSION_STATUS_CLASSIFIED
    assert job.submission.latest_classification_result == classification
    assert job.submission.classified_at == classification.classified_at
    assert classification.classification_type == "submission_review"
    assert classification.provider == "rule_based"
    assert classification.raw_response == {}
