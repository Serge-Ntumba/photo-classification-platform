from __future__ import annotations

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status

pytestmark = pytest.mark.django_db
TEST_PASSWORD = "StrongPassword123!"  # noqa: S105


REGISTER_URL = reverse("auth-register")
LOGIN_URL = reverse("auth-login")
ME_URL = reverse("auth-me")


def test_register_contract_creates_non_admin_user(api_client):
    response = api_client.post(
        REGISTER_URL,
        {
            "email": "casey@example.com",
            "username": "casey",
            "password": TEST_PASSWORD,
            "is_staff": True,
            "is_superuser": True,
        },
        format="json",
    )

    assert response.status_code == status.HTTP_201_CREATED
    assert set(response.data) == {"id", "email", "username", "is_staff", "created_at"}
    assert response.data["email"] == "casey@example.com"
    assert response.data["username"] == "casey"
    assert response.data["is_staff"] is False

    user = get_user_model().objects.get(email="casey@example.com")
    assert user.check_password(TEST_PASSWORD)
    assert user.is_staff is False
    assert user.is_superuser is False


def test_login_contract_returns_tokens_and_user(api_client):
    get_user_model().objects.create_user(
        username="riley",
        email="riley@example.com",
        password=TEST_PASSWORD,
    )

    response = api_client.post(
        LOGIN_URL,
        {"email": "riley@example.com", "password": TEST_PASSWORD},
        format="json",
    )

    assert response.status_code == status.HTTP_200_OK
    assert set(response.data) == {"access", "refresh", "user"}
    assert response.data["access"]
    assert response.data["refresh"]
    assert response.data["user"] == {
        "id": str(get_user_model().objects.get(email="riley@example.com").id),
        "email": "riley@example.com",
        "username": "riley",
        "is_staff": False,
    }


def test_me_contract_requires_authentication_and_returns_profile(api_client):
    user = get_user_model().objects.create_user(
        username="morgan",
        email="morgan@example.com",
        password=TEST_PASSWORD,
    )

    unauthenticated = api_client.get(ME_URL)
    assert unauthenticated.status_code == status.HTTP_401_UNAUTHORIZED

    api_client.force_authenticate(user=user)
    response = api_client.get(ME_URL)

    assert response.status_code == status.HTTP_200_OK
    assert set(response.data) == {"id", "email", "username", "is_staff", "date_joined"}
    assert response.data["id"] == str(user.id)
    assert response.data["email"] == "morgan@example.com"
    assert response.data["username"] == "morgan"
    assert response.data["is_staff"] is False


def test_openapi_schema_includes_auth_endpoints(api_client):
    response = api_client.get(reverse("schema"), HTTP_ACCEPT="application/json")

    assert response.status_code == status.HTTP_200_OK
    assert "/api/auth/register/" in response.data["paths"]
    assert "/api/auth/login/" in response.data["paths"]
    assert "/api/auth/me/" in response.data["paths"]
