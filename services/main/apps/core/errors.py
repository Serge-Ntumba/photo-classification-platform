"""Consistent API error response helpers."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler


def error_payload(
    detail: str,
    *,
    code: str = "error",
    extra: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "error": {
            "code": code,
            "detail": detail,
        },
    }
    if extra:
        payload["error"]["extra"] = dict(extra)
    return payload


def api_error(
    detail: str,
    *,
    code: str = "error",
    status_code: int = status.HTTP_400_BAD_REQUEST,
    extra: Mapping[str, Any] | None = None,
) -> Response:
    return Response(error_payload(detail, code=code, extra=extra), status=status_code)


def api_exception_handler(exc: Exception, context: dict[str, Any]) -> Response | None:
    response = exception_handler(exc, context)
    if response is None:
        return None

    data = response.data
    if isinstance(data, Mapping) and "error" in data:
        return response

    detail = data.get("detail", data) if isinstance(data, Mapping) else data
    response.data = error_payload(str(detail), code=getattr(exc, "default_code", "api_error"))
    return response
