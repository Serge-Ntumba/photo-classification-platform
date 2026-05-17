from __future__ import annotations

from io import BytesIO

from django.contrib.auth import get_user_model
from django.utils import timezone
from PIL import Image

from apps.classification.constants import (
    CATEGORY_VALID_PROFILE_CANDIDATE,
    CLASSIFICATION_SCHEMA_VERSION,
    CLASSIFICATION_TYPE_SUBMISSION_REVIEW,
    CLASSIFIER_VERSION,
    DECISION_PASSES_AUTOMATED_CHECKS,
    PROVIDER_RULE_BASED,
    SUBMISSION_STATUS_PENDING_CLASSIFICATION,
)
from apps.classification.publisher import create_classification_job
from apps.submissions.models import Submission

TEST_PASSWORD = "StrongPassword123!"  # noqa: S105


def make_user(username: str = "classification-owner"):
    return get_user_model().objects.create_user(
        username=username,
        email=f"{username}@example.com",
        password=TEST_PASSWORD,
    )


def image_bytes(format_name: str = "JPEG", *, size: tuple[int, int] = (320, 320)) -> bytes:
    image = Image.new("RGB", size, color=(120, 70, 30))
    output = BytesIO()
    image.save(output, format=format_name)
    return output.getvalue()


def make_submission(*, user=None, status: str = SUBMISSION_STATUS_PENDING_CLASSIFICATION):
    user = user or make_user()
    content = image_bytes()
    return Submission.objects.create(
        user=user,
        name="Alex Morgan",
        age=29,
        place_of_living="Berlin",
        gender="non_binary",
        country_of_origin="Germany",
        description="Profile review submission.",
        photo_object_key=f"uploads/submissions/test/{timezone.now().timestamp()}.jpg",
        photo_original_filename="profile.jpg",
        photo_content_type="image/jpeg",
        photo_size_bytes=len(content),
        photo_width=320,
        photo_height=320,
        status=status,
    )


def make_job(submission=None):
    return create_classification_job(submission or make_submission())


def classifier_response(**overrides: object) -> dict[str, object]:
    payload: dict[str, object] = {
        "classification_type": CLASSIFICATION_TYPE_SUBMISSION_REVIEW,
        "category": CATEGORY_VALID_PROFILE_CANDIDATE,
        "review_decision": DECISION_PASSES_AUTOMATED_CHECKS,
        "score": 1.0,
        "reasons": ["Image and required metadata passed automated review checks."],
        "provider": PROVIDER_RULE_BASED,
        "classifier_version": CLASSIFIER_VERSION,
        "schema_version": CLASSIFICATION_SCHEMA_VERSION,
        "is_fallback": False,
        "error_code": None,
        "classified_at": timezone.now().isoformat(),
        "image_quality": "acceptable",
        "technical_status": "valid",
        "content_safety_status": "not_evaluated",
        "profile_suitability": "suitable",
    }
    payload.update(overrides)
    return payload


class FakeStorageClient:
    def __init__(self, content: bytes | None = None, *, error: Exception | None = None) -> None:
        self.content = content if content is not None else image_bytes()
        self.error = error

    def get_bytes(self, *, key: str) -> bytes:
        if self.error is not None:
            raise self.error
        return self.content


class FakeClassifierClient:
    def __init__(
        self,
        response: dict[str, object] | None = None,
        *,
        error: Exception | None = None,
    ):
        self.response = response if response is not None else classifier_response()
        self.error = error
        self.calls = 0

    def classify(self, *, submission, image_bytes: bytes) -> dict[str, object]:
        self.calls += 1
        if self.error is not None:
            raise self.error
        return self.response
