"""Safe logging helpers for request correlation and sensitive-data redaction."""

from __future__ import annotations

import contextvars
import logging
import re
from typing import Any
from uuid import uuid4

REQUEST_ID_HEADER = "HTTP_X_REQUEST_ID"
RESPONSE_REQUEST_ID_HEADER = "X-Request-ID"
DEFAULT_REQUEST_ID = "-"
MAX_REQUEST_ID_LENGTH = 80
SAFE_REQUEST_ID_RE = re.compile(r"^[A-Za-z0-9._:-]+$")

_request_id: contextvars.ContextVar[str] = contextvars.ContextVar(
    "request_id",
    default=DEFAULT_REQUEST_ID,
)

SENSITIVE_LOG_RE = re.compile(
    r"|".join(
        [
            r"\b(?:bearer|basic)\s+[a-z0-9._~+/=-]{8,}",
            r"([?&](?:x-amz-signature|x-amz-credential|x-amz-security-token|"
            r"x-goog-signature|x-goog-credential|signature)=)[^&\s]+",
            r"\b(?:api[_\s-]?key|access[_\s-]?key|secret[_\s-]?access[_\s-]?key|"
            r"access[_\s-]?token|refresh[_\s-]?token|session[_\s-]?token|bearer"
            r"[_\s-]?token|token|jwt|"
            r"password|secret|credential|signed[_\s-]?url|pre[_\s-]?signed[_\s-]?url|"
            r"public[_\s-]?url|raw[_\s-]?provider[_\s-]?data|provider[_\s-]?raw"
            r"[_\s-]?data)s?\s*[:=]\s*\S+",
            r"\b(?:raw|system|user|developer|assistant)\s+prompt\s*[:=]?\s*.*",
            r"\bdata:image/(?:jpeg|jpg|png|webp);base64,[a-z0-9+/=\s]+",
            r"\b(?:image|photo)[_\s-]?(?:bytes|data)\b\s*[:=]\s*\S+",
            r"\b(?:name|full[_\s-]?name|first[_\s-]?name|last[_\s-]?name|"
            r"email|phone|address|place[_\s-]?of[_\s-]?living|country[_\s-]?of"
            r"[_\s-]?origin|gender|age|user[_\s-]?id)\s*[:=]\s*\S+",
        ],
    ),
    re.IGNORECASE,
)


def get_request_id() -> str:
    return _request_id.get()


def set_request_id(request_id: str) -> contextvars.Token[str]:
    return _request_id.set(request_id)


def reset_request_id(token: contextvars.Token[str]) -> None:
    _request_id.reset(token)


def sanitize_log_value(value: Any) -> str:
    return SENSITIVE_LOG_RE.sub("[REDACTED]", str(value))


class SafeLogFilter(logging.Filter):
    """Attach request IDs and redact common secrets from emitted log messages."""

    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = get_request_id()
        try:
            message = record.getMessage()
        except Exception:
            message = str(record.msg)
        record.msg = sanitize_log_value(message)
        record.args = ()
        return True


class SafeFormatter(logging.Formatter):
    """Redact the final rendered log line, including exception text."""

    def format(self, record: logging.LogRecord) -> str:
        return sanitize_log_value(super().format(record))


class RequestIdMiddleware:
    """Create or preserve a request ID for response headers and log records."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request_id = _safe_request_id(request.META.get(REQUEST_ID_HEADER))
        token = set_request_id(request_id)
        request.request_id = request_id
        try:
            response = self.get_response(request)
            response[RESPONSE_REQUEST_ID_HEADER] = request_id
            return response
        finally:
            reset_request_id(token)


def _safe_request_id(header_value: object) -> str:
    if isinstance(header_value, str):
        candidate = header_value.strip()
        if (
            candidate
            and len(candidate) <= MAX_REQUEST_ID_LENGTH
            and SAFE_REQUEST_ID_RE.fullmatch(candidate)
        ):
            return candidate
    return f"req-{uuid4().hex}"
