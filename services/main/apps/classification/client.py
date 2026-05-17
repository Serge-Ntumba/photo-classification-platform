"""HTTP client for the internal classifier service."""

from __future__ import annotations

from typing import Any

import httpx
from django.conf import settings


class ClassifierClientError(RuntimeError):
    """Raised when the worker cannot obtain a classifier response."""


SAFE_CLASSIFIER_FILENAMES = {
    "image/jpeg": "photo.jpg",
    "image/png": "photo.png",
    "image/webp": "photo.webp",
}


def safe_classifier_filename(content_type: str) -> str:
    normalized_content_type = content_type.split(";", 1)[0].strip().lower()
    return SAFE_CLASSIFIER_FILENAMES.get(normalized_content_type, "photo")


def build_classifier_request(
    *,
    submission,
    image_bytes: bytes,
) -> dict[str, Any]:
    return {
        "files": {
            "file": (
                safe_classifier_filename(submission.photo_content_type),
                image_bytes,
                submission.photo_content_type,
            ),
        },
        "data": {
            "submission_id": str(submission.id),
            "content_type": submission.photo_content_type,
            "size_bytes": str(len(image_bytes)),
            "metadata_complete": "true",
        },
    }


class ClassifierClient:
    def __init__(self, *, base_url: str | None = None, timeout: int | None = None) -> None:
        self.base_url = (base_url or settings.CLASSIFIER_URL).rstrip("/")
        self.timeout = timeout if timeout is not None else settings.CLASSIFIER_TIMEOUT_SECONDS

    def classify(self, *, submission, image_bytes: bytes) -> dict[str, Any]:
        request = build_classifier_request(submission=submission, image_bytes=image_bytes)
        try:
            with httpx.Client(timeout=self.timeout) as client:
                response = client.post(f"{self.base_url}/classify", **request)
                response.raise_for_status()
                payload = response.json()
        except (httpx.HTTPError, ValueError) as exc:
            raise ClassifierClientError(str(exc)) from exc
        if not isinstance(payload, dict):
            raise ClassifierClientError("Classifier response was not a JSON object.")
        return payload
