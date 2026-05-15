from __future__ import annotations

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status


pytestmark = pytest.mark.django_db


def test_public_registration_cannot_set_staff_or_superuser(api_client):
    response = api_client.post(
        reverse("auth-register"),
        {
            "email": "taylor@example.com",
            "username": "taylor",
            "password": "StrongPassword123!",
            "is_staff": True,
            "is_superuser": True,
            "groups": [1],
            "user_permissions": [1],
        },
        format="json",
    )

    assert response.status_code == status.HTTP_201_CREATED
    user = get_user_model().objects.get(email="taylor@example.com")
    assert user.is_staff is False
    assert user.is_superuser is False
    assert user.groups.count() == 0
    assert user.user_permissions.count() == 0
    assert response.data["is_staff"] is False


def test_public_registration_response_omits_admin_and_password_fields(api_client):
    response = api_client.post(
        reverse("auth-register"),
        {
            "email": "pat@example.com",
            "username": "pat",
            "password": "StrongPassword123!",
        },
        format="json",
    )

    assert response.status_code == status.HTTP_201_CREATED
    assert "password" not in response.data
    assert "is_superuser" not in response.data
    assert "groups" not in response.data
    assert "user_permissions" not in response.data
