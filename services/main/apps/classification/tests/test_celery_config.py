from __future__ import annotations

from apps.classification.constants import WORKER_CLASSIFIER_MAX_RETRIES
from apps.classification.tasks import process_classification_job, retry_countdown


def test_classification_task_route_retry_timeout_and_backoff_settings(settings) -> None:
    route = settings.CELERY_TASK_ROUTES["apps.classification.tasks.process_classification_job"]
    annotations = settings.CELERY_TASK_ANNOTATIONS[
        "apps.classification.tasks.process_classification_job"
    ]

    assert route == {"queue": "classification"}
    assert settings.CLASSIFIER_MAX_RETRIES == WORKER_CLASSIFIER_MAX_RETRIES
    assert settings.CLASSIFIER_TIMEOUT_SECONDS == 5
    assert settings.RETRY_BACKOFF_BASE_SECONDS == 2
    assert settings.RETRY_BACKOFF_CAP_SECONDS == 60
    assert settings.RETRY_BACKOFF_JITTER is True
    assert annotations["max_retries"] == WORKER_CLASSIFIER_MAX_RETRIES
    assert annotations["soft_time_limit"] == settings.CLASSIFIER_TIMEOUT_SECONDS + 5
    assert annotations["time_limit"] == settings.CLASSIFIER_TIMEOUT_SECONDS + 10
    assert process_classification_job.max_retries == WORKER_CLASSIFIER_MAX_RETRIES


def test_retry_countdown_uses_exponential_backoff_with_cap(settings) -> None:
    settings.RETRY_BACKOFF_BASE_SECONDS = 2
    settings.RETRY_BACKOFF_CAP_SECONDS = 10
    settings.RETRY_BACKOFF_JITTER = False

    assert retry_countdown(0) == 2
    assert retry_countdown(1) == 4
    assert retry_countdown(2) == 8
    assert retry_countdown(10) == 10


def test_retry_countdown_applies_configured_jitter(settings, monkeypatch) -> None:
    calls: list[tuple[float, int]] = []

    def fake_uniform(lower: float, upper: int) -> float:
        calls.append((lower, upper))
        return 6.7

    settings.RETRY_BACKOFF_BASE_SECONDS = 2
    settings.RETRY_BACKOFF_CAP_SECONDS = 10
    settings.RETRY_BACKOFF_JITTER = True
    monkeypatch.setattr("apps.classification.tasks.random.uniform", fake_uniform)

    assert retry_countdown(2) == 6
    assert calls == [(4.0, 8)]
