"""Celery application wiring for the Django service."""

import os

from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

app = Celery("photo_classification")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()
