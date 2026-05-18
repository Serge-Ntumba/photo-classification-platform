from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent
MAIN_SERVICE = ROOT / "services" / "main"
CLASSIFIER_SERVICE = ROOT / "services" / "classifier"
TEST_HELPERS = ROOT / "tests"

for path in (MAIN_SERVICE, CLASSIFIER_SERVICE, TEST_HELPERS):
    path_text = str(path)
    if path_text not in sys.path:
        sys.path.insert(0, path_text)

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
os.environ["DJANGO_SECRET_KEY"] = "test-secret-key-with-at-least-32-bytes"  # noqa: S105
os.environ["JWT_SIGNING_KEY"] = "test-jwt-signing-key-with-at-least-32-bytes"  # noqa: S105
os.environ["DJANGO_DEBUG"] = "false"
os.environ["CELERY_TASK_ALWAYS_EAGER"] = "true"
os.environ["CELERY_TASK_EAGER_PROPAGATES"] = "true"
os.environ.setdefault("CLASSIFIER_PROVIDER", "rule_based")
os.environ.setdefault("MODEL_PROVIDER_API_KEY", "")


@pytest.fixture
def fastapi_client():
    from fastapi.testclient import TestClient

    from app.main import app

    return TestClient(app)


@pytest.fixture
def api_client():
    from rest_framework.test import APIClient

    return APIClient()


@pytest.fixture(autouse=True)
def temporary_media_root(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path / "media"
    return settings.MEDIA_ROOT


@pytest.fixture(autouse=True)
def celery_eager(settings):
    settings.CELERY_TASK_ALWAYS_EAGER = True
    settings.CELERY_TASK_EAGER_PROPAGATES = True
