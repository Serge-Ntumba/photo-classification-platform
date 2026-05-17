from __future__ import annotations

from uuid import uuid4

import pytest
from django.contrib import admin
from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone

from apps.classification.constants import (
    CATEGORY_INCOMPLETE_METADATA,
    CATEGORY_VALID_PROFILE_CANDIDATE,
    DECISION_NEEDS_MANUAL_REVIEW,
    DECISION_PASSES_AUTOMATED_CHECKS,
    SUBMISSION_STATUS_CLASSIFIED,
    SUBMISSION_STATUS_CLASSIFYING,
    SUBMISSION_STATUS_NEEDS_MANUAL_REVIEW,
)
from apps.classification.models import ClassificationResult
from apps.submissions.models import Submission

from .test_submission_permissions import TEST_PASSWORD

pytestmark = pytest.mark.django_db


def make_admin_user(username: str = "admin-reviewer"):
    return get_user_model().objects.create(
        username=username,
        email=f"{username}@example.com",
        is_staff=True,
        is_superuser=True,
        is_active=True,
    )


def make_regular_user(username: str):
    return get_user_model().objects.create_user(
        username=username,
        email=f"{username}@example.com",
        password=TEST_PASSWORD,
    )


def make_submission(
    *,
    user,
    name: str,
    age: int = 29,
    place_of_living: str = "Berlin",
    gender: str = "non_binary",
    country_of_origin: str = "Germany",
    status: str = SUBMISSION_STATUS_CLASSIFYING,
) -> Submission:
    return Submission.objects.create(
        user=user,
        name=name,
        age=age,
        place_of_living=place_of_living,
        gender=gender,
        country_of_origin=country_of_origin,
        description="Admin review submission.",
        photo_object_key=f"uploads/submissions/{uuid4()}/profile.jpg",
        photo_original_filename=f"{name.lower().replace(' ', '-')}.jpg",
        photo_content_type="image/jpeg",
        photo_size_bytes=1024,
        photo_width=320,
        photo_height=320,
        status=status,
    )


def make_result(
    *,
    submission: Submission,
    category: str = CATEGORY_VALID_PROFILE_CANDIDATE,
    review_decision: str = DECISION_PASSES_AUTOMATED_CHECKS,
    provider_metadata: dict[str, object] | None = None,
    raw_response: dict[str, object] | None = None,
) -> ClassificationResult:
    return ClassificationResult.objects.create(
        submission=submission,
        job_id=uuid4(),
        category=category,
        review_decision=review_decision,
        score=1.0,
        reasons=["Submission passed automated review checks."],
        provider_metadata=provider_metadata or {},
        raw_response=raw_response or {},
        classified_at=timezone.now(),
    )


def attach_latest_result(
    submission: Submission,
    result: ClassificationResult,
    *,
    status: str = SUBMISSION_STATUS_CLASSIFIED,
) -> None:
    submission.status = status
    submission.latest_classification_result = result
    submission.classified_at = result.classified_at
    submission.save(
        update_fields=[
            "status",
            "latest_classification_result",
            "classified_at",
            "updated_at",
        ],
    )


def test_submission_and_classification_admins_are_registered_with_review_configuration() -> None:
    submission_admin = admin.site._registry[Submission]
    result_admin = admin.site._registry[ClassificationResult]

    assert "name" in submission_admin.search_fields
    assert "place_of_living" in submission_admin.search_fields
    assert "country_of_origin" in submission_admin.search_fields
    assert "photo_object_key" in submission_admin.search_fields
    assert "status" in submission_admin.list_filter
    assert "latest_classification_result__category" in submission_admin.list_filter
    assert "latest_classification_result__review_decision" in submission_admin.list_filter
    assert "photo_object_key" in submission_admin.readonly_fields
    assert "latest_category" in submission_admin.list_display
    assert "latest_review_decision" in submission_admin.list_display
    assert submission_admin.inlines
    assert submission_admin.inlines[0].model is ClassificationResult
    assert "provider_metadata" not in submission_admin.inlines[0].fields
    assert "raw_response" not in submission_admin.inlines[0].fields

    assert "raw_response" not in result_admin.get_fields(None)
    assert "provider_metadata" not in result_admin.get_fields(None)
    assert "category" in result_admin.list_filter
    assert "review_decision" in result_admin.list_filter
    assert "job_id" in result_admin.search_fields


def test_admin_changelist_supports_search_and_review_filters(client) -> None:
    admin_user = make_admin_user()
    owner = make_regular_user("owner")
    selected = make_submission(user=owner, name="Alex Berlin", place_of_living="Berlin")
    selected_result = make_result(submission=selected)
    attach_latest_result(selected, selected_result)
    other = make_submission(
        user=owner,
        name="Dana Paris",
        place_of_living="Paris",
        country_of_origin="France",
        status=SUBMISSION_STATUS_CLASSIFYING,
    )
    other_result = make_result(
        submission=other,
        category=CATEGORY_INCOMPLETE_METADATA,
        review_decision=DECISION_NEEDS_MANUAL_REVIEW,
    )
    attach_latest_result(
        other,
        other_result,
        status=SUBMISSION_STATUS_NEEDS_MANUAL_REVIEW,
    )

    client.force_login(admin_user)
    response = client.get(
        reverse("admin:submissions_submission_changelist"),
        {
            "q": "Alex",
            "status__exact": SUBMISSION_STATUS_CLASSIFIED,
            "latest_classification_result__category__exact": CATEGORY_VALID_PROFILE_CANDIDATE,
            "latest_classification_result__review_decision__exact": (
                DECISION_PASSES_AUTOMATED_CHECKS
            ),
        },
    )

    assert response.status_code == 200
    content = response.content.decode()
    assert "Alex Berlin" in content
    assert "Dana Paris" not in content
    assert CATEGORY_VALID_PROFILE_CANDIDATE in content
    assert DECISION_PASSES_AUTOMATED_CHECKS in content


def test_admin_changelist_supports_required_metadata_filters(client) -> None:
    admin_user = make_admin_user()
    owner = make_regular_user("metadata-filter-owner")
    selected = make_submission(
        user=owner,
        name="Metadata Match",
        age=42,
        gender="non_binary",
        place_of_living="Berlin",
        country_of_origin="Germany",
    )
    other = make_submission(
        user=owner,
        name="Metadata Miss",
        age=31,
        gender="woman",
        place_of_living="Paris",
        country_of_origin="France",
    )

    client.force_login(admin_user)
    required_metadata_filters = (
        {"age__exact": str(selected.age)},
        {"gender__exact": selected.gender},
        {"place_of_living__exact": selected.place_of_living},
        {"country_of_origin__exact": selected.country_of_origin},
    )

    for query_params in required_metadata_filters:
        response = client.get(reverse("admin:submissions_submission_changelist"), query_params)

        assert response.status_code == 200
        content = response.content.decode()
        assert selected.name in content
        assert other.name not in content


def test_admin_detail_displays_photo_reference_and_classification_history(client) -> None:
    admin_user = make_admin_user()
    owner = make_regular_user("history-owner")
    submission = make_submission(user=owner, name="History Candidate")
    older_result = make_result(
        submission=submission,
        category=CATEGORY_INCOMPLETE_METADATA,
        review_decision=DECISION_NEEDS_MANUAL_REVIEW,
    )
    latest_result = make_result(submission=submission)
    attach_latest_result(submission, latest_result)

    client.force_login(admin_user)
    response = client.get(
        reverse("admin:submissions_submission_change", kwargs={"object_id": submission.pk}),
    )

    assert response.status_code == 200
    content = response.content.decode()
    assert "History Candidate" in content
    assert submission.photo_object_key in content
    assert str(latest_result.job_id) in content
    assert str(older_result.job_id) in content
    assert CATEGORY_VALID_PROFILE_CANDIDATE in content
    assert CATEGORY_INCOMPLETE_METADATA in content


def test_admin_responses_minimize_raw_provider_data(client) -> None:
    admin_user = make_admin_user()
    owner = make_regular_user("safety-owner")
    submission = make_submission(user=owner, name="Safety Candidate")
    unsafe_result = make_result(
        submission=submission,
        provider_metadata={
            "debug": "Bearer abc.def.ghi",
            "url": "https://storage.example/photo?X-Amz-Signature=abc",
        },
        raw_response={
            "prompt": "Raw prompt: decide whether this person should pass",
            "api_key": "must-not-render",
        },
    )
    attach_latest_result(submission, unsafe_result)

    client.force_login(admin_user)
    submission_response = client.get(
        reverse("admin:submissions_submission_change", kwargs={"object_id": submission.pk}),
    )
    result_response = client.get(
        reverse(
            "admin:classification_classificationresult_change",
            kwargs={"object_id": unsafe_result.pk},
        ),
    )

    combined_content = (
        submission_response.content.decode().lower() + result_response.content.decode().lower()
    )
    assert submission_response.status_code == 200
    assert result_response.status_code == 200
    assert "x-amz-signature" not in combined_content
    assert "bearer abc.def.ghi" not in combined_content
    assert "raw prompt" not in combined_content
    assert "must-not-render" not in combined_content
