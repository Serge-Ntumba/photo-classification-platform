from __future__ import annotations

import pytest
from django.contrib.staticfiles import finders
from django.urls import reverse

from apps.submissions.tests.test_admin import make_admin_user

pytestmark = pytest.mark.django_db


def test_admin_index_loads_platform_branding_and_custom_stylesheet(client) -> None:
    client.force_login(make_admin_user("branding-admin"))

    response = client.get(reverse("admin:index"))

    assert response.status_code == 200
    content = response.content.decode()
    assert "Photo Classification Platform" in content
    assert 'href="/static/admin/css/photo-admin.css"' in content


def test_custom_admin_stylesheet_is_discoverable_by_staticfiles() -> None:
    assert finders.find("admin/css/photo-admin.css") is not None
