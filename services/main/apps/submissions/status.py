"""Centralized submission status state machine."""

from __future__ import annotations

from apps.classification.constants import (
    SUBMISSION_STATUS_CLASSIFICATION_FAILED,
    SUBMISSION_STATUS_CLASSIFIED,
    SUBMISSION_STATUS_CLASSIFYING,
    SUBMISSION_STATUS_NEEDS_MANUAL_REVIEW,
    SUBMISSION_STATUS_PENDING_CLASSIFICATION,
    SUBMISSION_STATUS_REJECTED,
    SUBMISSION_STATUSES,
    TERMINAL_SUBMISSION_STATUSES,
)

ALLOWED_STATUS_TRANSITIONS = {
    SUBMISSION_STATUS_PENDING_CLASSIFICATION: (
        SUBMISSION_STATUS_CLASSIFYING,
        SUBMISSION_STATUS_CLASSIFICATION_FAILED,
    ),
    SUBMISSION_STATUS_CLASSIFYING: (
        SUBMISSION_STATUS_CLASSIFIED,
        SUBMISSION_STATUS_NEEDS_MANUAL_REVIEW,
        SUBMISSION_STATUS_REJECTED,
        SUBMISSION_STATUS_CLASSIFICATION_FAILED,
    ),
    SUBMISSION_STATUS_CLASSIFIED: (),
    SUBMISSION_STATUS_NEEDS_MANUAL_REVIEW: (),
    SUBMISSION_STATUS_REJECTED: (),
    SUBMISSION_STATUS_CLASSIFICATION_FAILED: (),
}


class StatusTransitionError(ValueError):
    """Raised when a submission status transition violates the state machine."""


def is_terminal_status(status: str) -> bool:
    return status in TERMINAL_SUBMISSION_STATUSES


def can_transition(current_status: str, target_status: str) -> bool:
    if current_status not in SUBMISSION_STATUSES:
        return False
    if target_status not in SUBMISSION_STATUSES:
        return False
    return target_status in ALLOWED_STATUS_TRANSITIONS[current_status]


def validate_transition(current_status: str, target_status: str) -> str:
    if can_transition(current_status, target_status):
        return target_status

    if is_terminal_status(current_status):
        msg = f"Terminal submission status {current_status!r} cannot transition."
    else:
        msg = f"Cannot transition submission status {current_status!r} to {target_status!r}."
    raise StatusTransitionError(msg)


def failure_status_after_retry_exhaustion(current_status: str) -> str:
    validate_transition(current_status, SUBMISSION_STATUS_CLASSIFICATION_FAILED)
    return SUBMISSION_STATUS_CLASSIFICATION_FAILED
