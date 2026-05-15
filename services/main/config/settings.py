"""Base Django settings for the photo classification platform."""

from __future__ import annotations

import os
from pathlib import Path
from urllib.parse import parse_qsl, urlparse

BASE_DIR = Path(__file__).resolve().parents[1]


def env_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def env_int(name: str, default: int) -> int:
    value = os.getenv(name)
    if value is None or value == "":
        return default
    return int(value)


def env_list(name: str, default: str = "") -> list[str]:
    value = os.getenv(name, default)
    return [item.strip() for item in value.split(",") if item.strip()]


SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "unsafe-local-development-secret")
DEBUG = env_bool("DJANGO_DEBUG", True)
ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1,web")
CSRF_TRUSTED_ORIGINS = env_list(
    "DJANGO_CSRF_TRUSTED_ORIGINS",
    "http://localhost,http://127.0.0.1",
)
TIME_ZONE = os.getenv("DJANGO_TIME_ZONE", "UTC")
USE_TZ = True
LANGUAGE_CODE = "en-us"

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "drf_spectacular",
    "django_filters",
    "apps.accounts",
    "apps.submissions",
    "apps.classification",
    "apps.core",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]


def database_from_url(url: str) -> dict[str, object]:
    parsed = urlparse(url)
    if parsed.scheme == "sqlite":
        return {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": parsed.path or BASE_DIR / "db.sqlite3",
        }

    query = dict(parse_qsl(parsed.query))
    return {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": parsed.path.lstrip("/"),
        "USER": parsed.username or "",
        "PASSWORD": parsed.password or "",
        "HOST": parsed.hostname or "",
        "PORT": str(parsed.port or ""),
        "OPTIONS": query,
    }


if database_url := os.getenv("DATABASE_URL"):
    DATABASES = {"default": database_from_url(database_url)}
elif os.getenv("POSTGRES_HOST"):
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": os.getenv("POSTGRES_DB", "photo_classification"),
            "USER": os.getenv("POSTGRES_USER", "photo_app"),
            "PASSWORD": os.getenv("POSTGRES_PASSWORD", ""),
            "HOST": os.getenv("POSTGRES_HOST", "postgres"),
            "PORT": os.getenv("POSTGRES_PORT", "5432"),
        },
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        },
    }

AUTH_USER_MODEL = "accounts.User"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": env_int("API_PAGE_SIZE", 20),
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.OrderingFilter",
        "rest_framework.filters.SearchFilter",
    ],
    "EXCEPTION_HANDLER": "apps.core.errors.api_exception_handler",
}

SPECTACULAR_SETTINGS = {
    "TITLE": "Photo Classification Platform API",
    "DESCRIPTION": "Django/DRF API for photo submission and async classification.",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
}

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_ROOT = Path(os.getenv("MEDIA_ROOT", BASE_DIR / "media"))
MEDIA_URL = "/media/"

PHOTO_MAX_UPLOAD_BYTES = env_int("PHOTO_MAX_UPLOAD_BYTES", 5 * 1024 * 1024)
PHOTO_MIN_WIDTH = env_int("PHOTO_MIN_WIDTH", 300)
PHOTO_MIN_HEIGHT = env_int("PHOTO_MIN_HEIGHT", 300)
PHOTO_MAX_WIDTH = env_int("PHOTO_MAX_WIDTH", 5000)
PHOTO_MAX_HEIGHT = env_int("PHOTO_MAX_HEIGHT", 5000)

S3_ENDPOINT_URL = os.getenv("S3_ENDPOINT_URL", "http://minio:9000")
S3_ACCESS_KEY_ID = os.getenv("S3_ACCESS_KEY_ID", "")
S3_SECRET_ACCESS_KEY = os.getenv("S3_SECRET_ACCESS_KEY", "")
S3_BUCKET_NAME = os.getenv("S3_BUCKET_NAME", "photo-submissions")
S3_REGION_NAME = os.getenv("S3_REGION_NAME", "us-east-1")
S3_USE_SSL = env_bool("S3_USE_SSL", False)

CLASSIFIER_URL = os.getenv("CLASSIFIER_URL", "http://classifier:8001")
CLASSIFIER_PROVIDER = os.getenv("CLASSIFIER_PROVIDER", "rule_based")
CLASSIFIER_TIMEOUT_SECONDS = env_int("CLASSIFIER_TIMEOUT_SECONDS", 5)
CLASSIFIER_MAX_RETRIES = env_int("CLASSIFIER_MAX_RETRIES", 3)
RABBITMQ_PUBLISH_MAX_ATTEMPTS = env_int("RABBITMQ_PUBLISH_MAX_ATTEMPTS", 3)
RETRY_BACKOFF_BASE_SECONDS = env_int("RETRY_BACKOFF_BASE_SECONDS", 2)
RETRY_BACKOFF_CAP_SECONDS = env_int("RETRY_BACKOFF_CAP_SECONDS", 60)

CELERY_BROKER_URL = os.getenv(
    "CELERY_BROKER_URL",
    "amqp://photo_app:photo_app_password@rabbitmq:5672/photo_app",
)
CELERY_RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", "rpc://")
CELERY_TASK_ALWAYS_EAGER = env_bool("CELERY_TASK_ALWAYS_EAGER", False)
CELERY_TASK_EAGER_PROPAGATES = env_bool("CELERY_TASK_EAGER_PROPAGATES", True)
CELERY_TASK_ROUTES = {
    "apps.classification.tasks.*": {"queue": "classification"},
}
CELERY_TASK_DEFAULT_QUEUE = "default"
CELERY_TASK_TIME_LIMIT = CLASSIFIER_TIMEOUT_SECONDS + 10
CELERY_TASK_SOFT_TIME_LIMIT = CLASSIFIER_TIMEOUT_SECONDS + 5
