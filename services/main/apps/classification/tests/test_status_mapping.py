from __future__ import annotations

import pytest

from apps.classification.constants import (
    CATEGORY_INCOMPLETE_METADATA,
    CATEGORY_UNSUPPORTED_IMAGE_TYPE,
    DECISION_FAILS_AUTOMATED_CHECKS,
    DECISION_NEEDS_MANUAL_REVIEW,
    DECISION_PASSES_AUTOMATED_CHECKS,
    SUBMISSION_STATUS_CLASSIFIED,
    SUBMISSION_STATUS_NEEDS_MANUAL_REVIEW,
    SUBMISSION_STATUS_REJECTED,
)
from apps.classification.services import persist_classification_result, status_for_review_decision

from .factories import classifier_response, make_job

pytestmark = pytest.mark.django_db


@pytest.mark.parametrize(
    ("decision", "status"),
    [
        (DECISION_PASSES_AUTOMATED_CHECKS, SUBMISSION_STATUS_CLASSIFIED),
        (DECISION_NEEDS_MANUAL_REVIEW, SUBMISSION_STATUS_NEEDS_MANUAL_REVIEW),
        (DECISION_FAILS_AUTOMATED_CHECKS, SUBMISSION_STATUS_REJECTED),
    ],
)
def test_review_decisions_map_to_submission_statuses(decision: str, status: str) -> None:
    assert status_for_review_decision(decision) == status


def test_persisting_manual_review_result_updates_latest_pointer() -> None:
    job = make_job()
    response = classifier_response(
        category=CATEGORY_INCOMPLETE_METADATA,
        review_decision=DECISION_NEEDS_MANUAL_REVIEW,
        score=0.4,
    )

    result = persist_classification_result(job=job, response_payload=response)

    job.submission.refresh_from_db()
    assert result.review_decision == DECISION_NEEDS_MANUAL_REVIEW
    assert job.submission.status == SUBMISSION_STATUS_NEEDS_MANUAL_REVIEW
    assert job.submission.latest_classification_result_id == result.id


def test_persisting_failed_review_result_rejects_submission() -> None:
    job = make_job()
    response = classifier_response(
        category=CATEGORY_UNSUPPORTED_IMAGE_TYPE,
        review_decision=DECISION_FAILS_AUTOMATED_CHECKS,
        score=0.0,
    )

    result = persist_classification_result(job=job, response_payload=response)

    job.submission.refresh_from_db()
    assert result.review_decision == DECISION_FAILS_AUTOMATED_CHECKS
    assert job.submission.status == SUBMISSION_STATUS_REJECTED
