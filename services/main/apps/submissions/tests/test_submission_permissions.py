from __future__ import annotations

from io import BytesIO

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from PIL import Image
from rest_framework import status

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


def make_user(username: str):
    return get_user_model().objects.create_user(
        username=username,
        email=f"{username}@example.com",
        password=TEST_PASSWORD,
    )


def image_upload() -> BytesIO:
    image = Image.new("RGB", (320, 320), color=(120, 80, 40))
    output = BytesIO()
    image.save(output, format="JPEG")
    output.seek(0)
    output.name = "profile.jpg"  # type: ignore[attr-defined]
    output.content_type = "image/jpeg"  # type: ignore[attr-defined]
    return output


def create_submission(api_client, user, name: str):
    api_client.force_authenticate(user=user)
    return api_client.post(
        reverse("submission-list"),
        {
            "name": name,
            "age": "29",
            "place_of_living": "Berlin",
            "gender": "non_binary",
            "country_of_origin": "Germany",
            "description": "",
            "photo": image_upload(),
        },
        format="multipart",
    )


def test_users_list_only_their_own_submissions(api_client):
    owner = make_user("owner")
    other = make_user("other")
    owner_response = create_submission(api_client, owner, "Owner Submission")
    create_submission(api_client, other, "Other Submission")

    api_client.force_authenticate(user=owner)
    response = api_client.get(reverse("submission-list"))

    assert response.status_code == status.HTTP_200_OK
    assert response.data["count"] == 1
    assert response.data["results"][0]["id"] == owner_response.data["id"]
    assert response.data["results"][0]["name"] == "Owner Submission"


def test_users_cannot_retrieve_another_users_submission(api_client):
    owner = make_user("detail-owner")
    other = make_user("detail-other")
    other_response = create_submission(api_client, other, "Other Submission")

    api_client.force_authenticate(user=owner)
    response = api_client.get(
        reverse("submission-detail", kwargs={"pk": other_response.data["id"]}),
    )

    assert response.status_code == status.HTTP_404_NOT_FOUND
