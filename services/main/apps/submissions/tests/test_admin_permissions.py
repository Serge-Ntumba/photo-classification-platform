from __future__ import annotations

import pytest
from django.urls import reverse

from .test_admin import make_admin_user, make_regular_user

pytestmark = pytest.mark.django_db


def test_superuser_can_access_django_admin_index(client) -> None:
    client.force_login(make_admin_user())

    response = client.get(reverse("admin:index"))

    assert response.status_code == 200


def test_non_admin_user_cannot_access_django_admin_index(client) -> None:
    client.force_login(make_regular_user("regular-admin-denied"))

    response = client.get(reverse("admin:index"))

    assert response.status_code == 302
    assert response.url.startswith(reverse("admin:login"))


def test_non_admin_user_cannot_access_submission_admin_views(client) -> None:
    client.force_login(make_regular_user("regular-submission-admin-denied"))

    response = client.get(reverse("admin:submissions_submission_changelist"))

    assert response.status_code == 302
    assert response.url.startswith(reverse("admin:login"))
