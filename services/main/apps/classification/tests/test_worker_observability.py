from __future__ import annotations

import pytest
from django.urls import reverse

from apps.classification.constants import PUBLISH_STATUS_FAILED
from apps.classification.health import worker_health_snapshot

from .factories import make_job, make_submission

pytestmark = pytest.mark.django_db


def test_worker_health_snapshot_reports_queue_task_retry_and_safe_failure_state() -> None:
    retrying = make_job()
    failed = make_job(make_submission(user=retrying.submission.user))
    retrying.attempt_count = 2
    retrying.last_error = "token=must-not-leak"
    retrying.save(update_fields=["attempt_count", "last_error", "updated_at"])
    failed.publish_status = PUBLISH_STATUS_FAILED
    failed.attempt_count = 3
    failed.last_error = "signedURL=https://storage.example/private.jpg"
    failed.save(update_fields=["publish_status", "attempt_count", "last_error", "updated_at"])

    snapshot = worker_health_snapshot(include_broker_depth=False)

    assert snapshot["service"] == "classification-worker"
    assert snapshot["queue"] == "classification"
    assert snapshot["task_name"] == "apps.classification.tasks.process_classification_job"
    assert snapshot["queue_depth"] is None
    assert snapshot["retry_policy"]["max_retries"] == 3
    assert snapshot["job_counts_by_publish_status"][PUBLISH_STATUS_FAILED] == 1
    assert snapshot["retry_counters"]["jobs_with_retries"] == 2
    assert snapshot["retry_counters"]["max_attempt_count"] == 3
    assert snapshot["safe_failure_observability"]["failed_jobs"] == 1
    assert "must-not-leak" not in str(snapshot)
    assert "signedURL" not in str(snapshot)


def test_worker_health_endpoint_exposes_safe_snapshot(api_client) -> None:
    make_job()

    response = api_client.get(reverse("worker-health"))

    assert response.status_code == 200
    payload = response.json()
    assert payload["service"] == "classification-worker"
    assert payload["queue"] == "classification"
    assert payload["task_state"]["pending_or_published_jobs"] == 1
    assert "last_error" not in str(payload).lower()


def test_worker_health_snapshot_can_include_broker_queue_depth(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr("apps.classification.health._broker_queue_depth", lambda: 7)

    snapshot = worker_health_snapshot(include_broker_depth=True)

    assert snapshot["queue_depth"] == 7
    assert snapshot["queue_depth_available"] is True
