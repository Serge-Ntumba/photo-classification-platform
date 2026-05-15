from __future__ import annotations

from io import BytesIO

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from PIL import Image
from rest_framework import status

pytestmark = pytest.mark.django_db


SUBMISSIONS_URL = reverse("submission-list")
TEST_PASSWORD = "StrongPassword123!"  # noqa: S105


class RecordingStorageClient:
    def __init__(self) -> None:
        self.objects: dict[str, dict[str, object]] = {}
        self.deleted: list[str] = []

    def upload_bytes(self, *, key: str, content: bytes, content_type: str) -> None:
        self.objects[key] = {"content": content, "content_type": content_type}

    def delete_object(self, *, key: str) -> None:
        self.deleted.append(key)
        self.objects.pop(key, None)


@pytest.fixture
def recording_storage(monkeypatch: pytest.MonkeyPatch) -> RecordingStorageClient:
    client = RecordingStorageClient()
    monkeypatch.setattr("apps.submissions.storage_service.ObjectStorageClient", lambda: client)
    return client


@pytest.fixture
def user():
    return get_user_model().objects.create_user(
        username="casey-submissions",
        email="casey-submissions@example.com",
        password=TEST_PASSWORD,
    )


def image_bytes(format_name: str = "JPEG", *, size: tuple[int, int] = (320, 320)) -> bytes:
    image = Image.new("RGB", size, color=(80, 120, 160))
    output = BytesIO()
    image.save(output, format=format_name)
    return output.getvalue()


def upload_payload(**overrides: object) -> dict[str, object]:
    payload: dict[str, object] = {
        "name": "Alex Morgan",
        "age": "29",
        "place_of_living": "Berlin",
        "gender": "non_binary",
        "country_of_origin": "Germany",
        "description": "Optional user-provided description.",
        "photo": BytesIO(image_bytes("JPEG")),
    }
    payload["photo"].name = "profile.jpg"  # type: ignore[attr-defined]
    payload["photo"].content_type = "image/jpeg"  # type: ignore[attr-defined]
    payload.update(overrides)
    return payload


def test_create_submission_contract_requires_authentication(api_client):
    response = api_client.post(SUBMISSIONS_URL, upload_payload(), format="multipart")

    assert response.status_code == status.HTTP_401_UNAUTHORIZED


def test_create_submission_contract_returns_private_photo_reference(
    api_client,
    recording_storage: RecordingStorageClient,
    user,
):
    api_client.force_authenticate(user=user)

    response = api_client.post(SUBMISSIONS_URL, upload_payload(), format="multipart")

    assert response.status_code == status.HTTP_201_CREATED
    assert set(response.data) == {
        "id",
        "name",
        "age",
        "place_of_living",
        "gender",
        "country_of_origin",
        "description",
        "photo",
        "status",
        "classification",
        "created_at",
        "updated_at",
    }
    assert response.data["status"] == "pending_classification"
    assert response.data["classification"] is None
    assert response.data["photo"] == {
        "object_key": response.data["photo"]["object_key"],
        "original_filename": "profile.jpg",
        "content_type": "image/jpeg",
        "size_bytes": response.data["photo"]["size_bytes"],
    }
    assert response.data["photo"]["object_key"] in recording_storage.objects
    assert "content" not in response.data["photo"]
    assert "secret" not in str(response.data).lower()


def test_list_and_retrieve_submission_contract(api_client, recording_storage, user):
    api_client.force_authenticate(user=user)
    created = api_client.post(SUBMISSIONS_URL, upload_payload(), format="multipart")

    list_response = api_client.get(SUBMISSIONS_URL)
    detail_response = api_client.get(
        reverse("submission-detail", kwargs={"pk": created.data["id"]}),
    )

    assert list_response.status_code == status.HTTP_200_OK
    assert list_response.data["count"] == 1
    assert list_response.data["results"][0]["id"] == created.data["id"]
    assert detail_response.status_code == status.HTTP_200_OK
    assert detail_response.data["id"] == created.data["id"]


def test_openapi_schema_includes_submission_endpoints(api_client):
    response = api_client.get(reverse("schema"), HTTP_ACCEPT="application/json")

    assert response.status_code == status.HTTP_200_OK
    assert "/api/submissions/" in response.data["paths"]
    assert "/api/submissions/{id}/" in response.data["paths"]
