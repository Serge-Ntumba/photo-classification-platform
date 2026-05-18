from __future__ import annotations

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status

pytestmark = pytest.mark.django_db
TEST_PASSWORD = "StrongPassword123!"  # noqa: S105


def test_registration_login_token_use_and_profile_retrieval(api_client):
    register_response = api_client.post(
        reverse("auth-register"),
        {
            "email": "alex@example.com",
            "username": "alex",
            "password": TEST_PASSWORD,
        },
        format="json",
    )
    assert register_response.status_code == status.HTTP_201_CREATED

    login_response = api_client.post(
        reverse("auth-login"),
        {"email": "alex@example.com", "password": TEST_PASSWORD},
        format="json",
    )
    assert login_response.status_code == status.HTTP_200_OK
    assert login_response.data["access"]
    assert login_response.data["refresh"]

    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {login_response.data['access']}")
    profile_response = api_client.get(reverse("auth-me"))

    assert profile_response.status_code == status.HTTP_200_OK
    assert profile_response.data["email"] == "alex@example.com"
    assert profile_response.data["username"] == "alex"
    assert profile_response.data["is_staff"] is False


def test_invalid_login_attempts_fail_generically(api_client):
    get_user_model().objects.create_user(
        username="sam",
        email="sam@example.com",
        password=TEST_PASSWORD,
    )

    wrong_password = api_client.post(
        reverse("auth-login"),
        {"email": "sam@example.com", "password": "WrongPassword123!"},
        format="json",
    )
    unknown_email = api_client.post(
        reverse("auth-login"),
        {"email": "missing@example.com", "password": "WrongPassword123!"},
        format="json",
    )

    assert wrong_password.status_code == status.HTTP_400_BAD_REQUEST
    assert unknown_email.status_code == status.HTTP_400_BAD_REQUEST
    assert wrong_password.data == unknown_email.data
    assert "password" not in str(wrong_password.data).lower()
    assert "email" not in str(wrong_password.data).lower()


def test_duplicate_registration_fields_return_validation_errors(api_client):
    get_user_model().objects.create_user(
        username="jordan",
        email="jordan@example.com",
        password=TEST_PASSWORD,
    )

    response = api_client.post(
        reverse("auth-register"),
        {
            "email": "jordan@example.com",
            "username": "jordan",
            "password": "AnotherStrongPassword123!",
        },
        format="json",
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
