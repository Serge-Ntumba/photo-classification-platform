from __future__ import annotations

from io import BytesIO
from uuid import uuid4

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
    SUBMISSION_STATUS_CLASSIFIED,
    SUBMISSION_STATUS_PENDING_CLASSIFICATION,
)
from apps.classification.models import ClassificationResult
from apps.submissions.models import Submission

TEST_PASSWORD = "StrongPassword123!"  # noqa: S105


class RecordingStorageClient:
    def __init__(self, *, delete_error: Exception | None = None) -> None:
        self.objects: dict[str, dict[str, object]] = {}
        self.deleted: list[str] = []
        self.delete_error = delete_error

    def upload_bytes(self, *, key: str, content: bytes, content_type: str) -> None:
        self.objects[key] = {"content": content, "content_type": content_type}

    def get_bytes(self, *, key: str) -> bytes:
        return self.objects[key]["content"]  # type: ignore[return-value]

    def delete_object(self, *, key: str) -> None:
        if self.delete_error is not None:
            raise self.delete_error
        self.deleted.append(key)
        self.objects.pop(key, None)


def make_user(username: str = "factory-user"):
    return get_user_model().objects.create_user(
        username=username,
        email=f"{username}@example.com",
        password=TEST_PASSWORD,
    )


def make_admin_user(username: str = "factory-admin"):
    return get_user_model().objects.create_superuser(
        username=username,
        email=f"{username}@example.com",
        password=TEST_PASSWORD,
    )


def image_bytes(format_name: str = "JPEG", *, size: tuple[int, int] = (320, 320)) -> bytes:
    image = Image.new("RGB", size, color=(80, 120, 160))
    output = BytesIO()
    image.save(output, format=format_name)
    return output.getvalue()


def image_upload(
    *,
    filename: str = "profile.jpg",
    content_type: str = "image/jpeg",
    format_name: str = "JPEG",
) -> BytesIO:
    output = BytesIO(image_bytes(format_name))
    output.seek(0)
    output.name = filename  # type: ignore[attr-defined]
    output.content_type = content_type  # type: ignore[attr-defined]
    return output


def submission_payload(**overrides: object) -> dict[str, object]:
    payload: dict[str, object] = {
        "name": "Alex Morgan",
        "age": "29",
        "place_of_living": "Berlin",
        "gender": "non_binary",
        "country_of_origin": "Germany",
        "description": "Profile review submission.",
        "photo": image_upload(),
    }
    payload.update(overrides)
    return payload


def make_submission(
    *,
    user=None,
    status: str = SUBMISSION_STATUS_PENDING_CLASSIFICATION,
    name: str = "Alex Morgan",
    photo_object_key: str | None = None,
) -> Submission:
    user = user or make_user()
    content = image_bytes()
    submission_id = uuid4()
    return Submission.objects.create(
        id=submission_id,
        user=user,
        name=name,
        age=29,
        place_of_living="Berlin",
        gender="non_binary",
        country_of_origin="Germany",
        description="Profile review submission.",
        photo_object_key=photo_object_key or f"uploads/submissions/{submission_id}/profile.jpg",
        photo_original_filename="profile.jpg",
        photo_content_type="image/jpeg",
        photo_size_bytes=len(content),
        photo_width=320,
        photo_height=320,
        status=status,
    )


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


def make_classification_result(
    *,
    submission: Submission,
    provider_metadata: dict[str, object] | None = None,
    raw_response: dict[str, object] | None = None,
) -> ClassificationResult:
    result = ClassificationResult.objects.create(
        submission=submission,
        job_id=uuid4(),
        classification_type=CLASSIFICATION_TYPE_SUBMISSION_REVIEW,
        category=CATEGORY_VALID_PROFILE_CANDIDATE,
        review_decision=DECISION_PASSES_AUTOMATED_CHECKS,
        score=1.0,
        reasons=["Safe normalized reason."],
        provider=PROVIDER_RULE_BASED,
        classifier_version=CLASSIFIER_VERSION,
        schema_version=CLASSIFICATION_SCHEMA_VERSION,
        provider_metadata=provider_metadata or {},
        raw_response=raw_response or {},
        classified_at=timezone.now(),
    )
    Submission.objects.filter(pk=submission.pk).update(
        status=SUBMISSION_STATUS_CLASSIFIED,
        latest_classification_result=result,
        classified_at=result.classified_at,
        updated_at=timezone.now(),
    )
    submission.refresh_from_db()
    return result
