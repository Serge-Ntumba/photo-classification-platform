from __future__ import annotations

from io import BytesIO

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from PIL import Image
from rest_framework import status

from apps.core.images import ImageValidationError

pytestmark = pytest.mark.django_db
TEST_PASSWORD = "StrongPassword123!"  # noqa: S105


class NoopStorageClient:
    def upload_bytes(self, *, key: str, content: bytes, content_type: str) -> None:
        return None

    def delete_object(self, *, key: str) -> None:
        return None


@pytest.fixture(autouse=True)
def noop_storage(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("apps.submissions.storage_service.ObjectStorageClient", NoopStorageClient)


@pytest.fixture
def user():
    return get_user_model().objects.create_user(
        username="validation-owner",
        email="validation-owner@example.com",
        password=TEST_PASSWORD,
    )


def image_file(
    format_name: str = "JPEG",
    *,
    content_type: str | None = None,
    size: tuple[int, int] = (320, 320),
    name: str | None = None,
) -> BytesIO:
    image = Image.new("RGB", size, color=(20, 30, 40))
    output = BytesIO()
    image.save(output, format=format_name)
    output.seek(0)
    output.name = name or f"profile.{format_name.lower()}"  # type: ignore[attr-defined]
    if content_type is not None:
        output.content_type = content_type  # type: ignore[attr-defined]
    return output


def base_payload(**overrides: object) -> dict[str, object]:
    data: dict[str, object] = {
        "name": "Alex Morgan",
        "age": "29",
        "place_of_living": "Berlin",
        "gender": "non_binary",
        "country_of_origin": "Germany",
        "description": "Optional user-provided description.",
        "photo": image_file("JPEG", content_type="image/jpeg", name="profile.jpg"),
    }
    data.update(overrides)
    return data


def post(api_client, user, **overrides: object):
    api_client.force_authenticate(user=user)
    return api_client.post(
        reverse("submission-list"),
        base_payload(**overrides),
        format="multipart",
    )


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("name", ""),
        ("age", ""),
        ("place_of_living", ""),
        ("gender", ""),
        ("country_of_origin", ""),
    ],
)
def test_required_metadata_fields(api_client, user, field: str, value: object):
    response = post(api_client, user, **{field: value})

    assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.parametrize("age", ["-1", "121"])
def test_age_must_be_between_zero_and_120(api_client, user, age: str):
    response = post(api_client, user, age=age)

    assert response.status_code == status.HTTP_400_BAD_REQUEST


def test_description_is_limited_to_1000_characters(api_client, user):
    response = post(api_client, user, description="x" * 1001)

    assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.parametrize(
    "photo",
    [
        BytesIO(b"plain text"),
        BytesIO(b""),
        BytesIO(b"x" * (5 * 1024 * 1024 + 1)),
        image_file("JPEG", content_type="image/png", name="spoofed.png"),
        image_file("JPEG", size=(299, 320), name="too-small.jpg"),
        image_file("JPEG", size=(5001, 320), name="too-large.jpg"),
        BytesIO(b"\xff\xd8\xffnot-a-real-jpeg"),
    ],
)
def test_invalid_photo_uploads_are_rejected(api_client, user, photo: BytesIO):
    photo.name = getattr(photo, "name", "upload.jpg")  # type: ignore[attr-defined]

    response = post(api_client, user, photo=photo)

    assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.parametrize(
    ("format_name", "content_type", "suffix"),
    [
        ("JPEG", "image/jpeg", "jpg"),
        ("PNG", "image/png", "png"),
        ("WEBP", "image/webp", "webp"),
    ],
)
def test_jpeg_png_and_webp_are_accepted(
    api_client,
    user,
    format_name: str,
    content_type: str,
    suffix: str,
):
    photo = image_file(format_name, content_type=content_type, name=f"profile.{suffix}")

    response = post(api_client, user, photo=photo)

    assert response.status_code == status.HTTP_201_CREATED
    assert response.data["photo"]["content_type"] == content_type


def test_safe_rewrite_failures_are_rejected(api_client, user, monkeypatch: pytest.MonkeyPatch):
    def fail_normalization(*_args, **_kwargs):
        raise ImageValidationError(
            "Uploaded image could not be safely rewritten.",
            code="safe_rewrite_failed",
        )

    monkeypatch.setattr(
        "apps.submissions.serializers.validate_and_normalize_image",
        fail_normalization,
    )

    response = post(api_client, user)

    assert response.status_code == status.HTTP_400_BAD_REQUEST
