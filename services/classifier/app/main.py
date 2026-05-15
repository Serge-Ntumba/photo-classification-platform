"""FastAPI application shell for the internal classifier service."""

from __future__ import annotations

import os

from fastapi import FastAPI

from .schemas import ClassifierHealthResponse

app = FastAPI(
    title="Photo Classification Service",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)


@app.get("/health", response_model=ClassifierHealthResponse)
def health() -> ClassifierHealthResponse:
    return ClassifierHealthResponse(
        service="classification-api",
        status="ok",
        provider=os.getenv("CLASSIFIER_PROVIDER", "rule_based"),
        version="rules-v1",
    )
