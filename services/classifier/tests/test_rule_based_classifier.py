from __future__ import annotations

from io import BytesIO

import pytest
from PIL import Image

from app.rules import MAX_FILE_BYTES, classify_submission_review
from app.schemas import Category, ClassifierRequestMetadata, ReviewDecision


def image_bytes(format_name: str = "JPEG", *, size: tuple[int, int] = (320, 320)) -> bytes:
    image = Image.new("RGB", size, color=(120, 40, 80))
    output = BytesIO()
    image.save(output, format=format_name)
    return output.getvalue()


def metadata(
    *,
    content_type: str = "image/jpeg",
    size_bytes: int | None = None,
    metadata_complete: bool = True,
) -> ClassifierRequestMetadata:
    content = image_bytes("JPEG")
    return ClassifierRequestMetadata(
        submission_id="submission-1",
        content_type=content_type,
        size_bytes=len(content) if size_bytes is None else size_bytes,
        metadata_complete=metadata_complete,
    )


@pytest.mark.parametrize(
    ("format_name", "content_type"),
    [
        ("JPEG", "image/jpeg"),
        ("PNG", "image/png"),
        ("WEBP", "image/webp"),
    ],
)
def test_supported_images_pass_automated_checks(format_name: str, content_type: str) -> None:
    content = image_bytes(format_name)

    result = classify_submission_review(
        image_bytes=content,
        metadata=metadata(content_type=content_type, size_bytes=len(content)),
    )

    assert result.category == Category.VALID_PROFILE_CANDIDATE
    assert result.review_decision == ReviewDecision.PASSES_AUTOMATED_CHECKS
    assert result.score == 1.0


def test_empty_file_is_invalid_file() -> None:
    result = classify_submission_review(
        image_bytes=b"",
        metadata=metadata(size_bytes=0),
    )

    assert result.category == Category.INVALID_FILE
    assert result.error_code == "EMPTY_FILE"


def test_file_over_five_mb_is_invalid_file() -> None:
    content = b"0" * (MAX_FILE_BYTES + 1)

    result = classify_submission_review(
        image_bytes=content,
        metadata=metadata(size_bytes=len(content)),
    )

    assert result.category == Category.INVALID_FILE
    assert result.error_code == "FILE_TOO_LARGE"


@pytest.mark.parametrize("size", [(299, 320), (320, 299), (5001, 320), (320, 5001)])
def test_dimensions_outside_range_need_manual_review(size: tuple[int, int]) -> None:
    content = image_bytes("JPEG", size=size)

    result = classify_submission_review(
        image_bytes=content,
        metadata=metadata(size_bytes=len(content)),
    )

    assert result.category == Category.LOW_QUALITY_IMAGE
    assert result.review_decision == ReviewDecision.NEEDS_MANUAL_REVIEW


def test_invalid_file_bytes_are_invalid_file() -> None:
    content = b"not an image"

    result = classify_submission_review(
        image_bytes=content,
        metadata=metadata(size_bytes=len(content)),
    )

    assert result.category == Category.INVALID_FILE
    assert result.error_code == "IMAGE_UNREADABLE"


def test_unsupported_type_is_rejected_after_image_parseability_is_known() -> None:
    content = image_bytes("JPEG")

    result = classify_submission_review(
        image_bytes=content,
        metadata=metadata(content_type="image/gif", size_bytes=len(content)),
    )

    assert result.category == Category.UNSUPPORTED_IMAGE_TYPE
    assert result.review_decision == ReviewDecision.FAILS_AUTOMATED_CHECKS


def test_incomplete_metadata_needs_manual_review() -> None:
    content = image_bytes("JPEG")

    result = classify_submission_review(
        image_bytes=content,
        metadata=metadata(size_bytes=len(content), metadata_complete=False),
    )

    assert result.category == Category.INCOMPLETE_METADATA
    assert result.review_decision == ReviewDecision.NEEDS_MANUAL_REVIEW


def test_category_priority_prefers_invalid_file_over_unsupported_type() -> None:
    result = classify_submission_review(
        image_bytes=b"",
        metadata=metadata(content_type="image/gif", size_bytes=0),
    )

    assert result.category == Category.INVALID_FILE
