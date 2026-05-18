from __future__ import annotations

import pytest
from django.urls import reverse
from rest_framework import status

pytestmark = pytest.mark.django_db


def test_openapi_schema_endpoint_is_available_and_documents_public_paths(api_client) -> None:
    response = api_client.get(reverse("schema"), HTTP_ACCEPT="application/json")

    assert response.status_code == status.HTTP_200_OK
    assert response.data["info"]["title"] == "Photo Classification Platform API"
    assert response.data["info"]["version"] == "1.0.0"
    assert "/api/auth/register/" in response.data["paths"]
    assert "/api/auth/login/" in response.data["paths"]
    assert "/api/auth/me/" in response.data["paths"]
    assert "/api/submissions/" in response.data["paths"]
    assert "/api/submissions/{id}/" in response.data["paths"]
    assert "/classify" not in response.data["paths"]


def test_swagger_docs_endpoint_is_available_without_authentication(api_client) -> None:
    response = api_client.get(reverse("swagger-ui"))

    assert response.status_code == status.HTTP_200_OK
    assert b"swagger" in response.content.lower()
