from __future__ import annotations

import pytest

from apps.classification.constants import (
    SUBMISSION_STATUS_CLASSIFICATION_FAILED,
    SUBMISSION_STATUS_CLASSIFIED,
    SUBMISSION_STATUS_CLASSIFYING,
    SUBMISSION_STATUS_NEEDS_MANUAL_REVIEW,
    SUBMISSION_STATUS_PENDING_CLASSIFICATION,
    SUBMISSION_STATUS_REJECTED,
    TERMINAL_SUBMISSION_STATUSES,
)
from apps.submissions.status import (
    StatusTransitionError,
    can_transition,
    failure_status_after_retry_exhaustion,
    is_terminal_status,
    validate_transition,
)


def test_allowed_status_transitions() -> None:
    assert can_transition(SUBMISSION_STATUS_PENDING_CLASSIFICATION, SUBMISSION_STATUS_CLASSIFYING)
    assert can_transition(SUBMISSION_STATUS_CLASSIFYING, SUBMISSION_STATUS_CLASSIFIED)
    assert can_transition(SUBMISSION_STATUS_CLASSIFYING, SUBMISSION_STATUS_NEEDS_MANUAL_REVIEW)
    assert can_transition(SUBMISSION_STATUS_CLASSIFYING, SUBMISSION_STATUS_REJECTED)
    assert can_transition(SUBMISSION_STATUS_CLASSIFYING, SUBMISSION_STATUS_CLASSIFICATION_FAILED)


@pytest.mark.parametrize(
    ("current_status", "target_status"),
    [
        (SUBMISSION_STATUS_PENDING_CLASSIFICATION, SUBMISSION_STATUS_CLASSIFIED),
        (SUBMISSION_STATUS_CLASSIFIED, SUBMISSION_STATUS_CLASSIFYING),
        (SUBMISSION_STATUS_REJECTED, SUBMISSION_STATUS_PENDING_CLASSIFICATION),
        (SUBMISSION_STATUS_NEEDS_MANUAL_REVIEW, SUBMISSION_STATUS_CLASSIFIED),
    ],
)
def test_rejected_status_transitions(current_status: str, target_status: str) -> None:
    with pytest.raises(StatusTransitionError):
        validate_transition(current_status, target_status)


@pytest.mark.parametrize("status", TERMINAL_SUBMISSION_STATUSES)
def test_terminal_statuses_are_immutable(status: str) -> None:
    assert is_terminal_status(status)
    with pytest.raises(StatusTransitionError, match="Terminal"):
        validate_transition(status, SUBMISSION_STATUS_CLASSIFYING)


def test_classification_failed_is_terminal() -> None:
    assert SUBMISSION_STATUS_CLASSIFICATION_FAILED in TERMINAL_SUBMISSION_STATUSES
    assert not can_transition(
        SUBMISSION_STATUS_CLASSIFICATION_FAILED,
        SUBMISSION_STATUS_PENDING_CLASSIFICATION,
    )


def test_retry_exhaustion_transitions_to_classification_failed() -> None:
    assert (
        failure_status_after_retry_exhaustion(SUBMISSION_STATUS_CLASSIFYING)
        == SUBMISSION_STATUS_CLASSIFICATION_FAILED
    )
