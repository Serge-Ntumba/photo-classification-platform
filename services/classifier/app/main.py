"""FastAPI application shell for the internal classifier service."""

from __future__ import annotations

import os
from typing import Annotated

from fastapi import FastAPI, File, Form, HTTPException, UploadFile

from .providers import classify_with_configured_provider
from .safety import ClassifierSafetyError, validate_classifier_response_safety
from .schemas import ClassifierHealthResponse, ClassifierRequestMetadata, ClassifierResponse

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


@app.post("/classify", response_model=ClassifierResponse)
async def classify(
    file: Annotated[UploadFile, File()],
    submission_id: Annotated[str, Form()],
    content_type: Annotated[str, Form()],
    size_bytes: Annotated[int, Form()],
    metadata_complete: Annotated[bool, Form()],
) -> ClassifierResponse:
    image_bytes = await file.read()
    metadata = ClassifierRequestMetadata(
        submission_id=submission_id,
        content_type=content_type,
        size_bytes=size_bytes,
        metadata_complete=metadata_complete,
    )
    response = classify_with_configured_provider(image_bytes=image_bytes, metadata=metadata)
    try:
        validate_classifier_response_safety(response)
    except ClassifierSafetyError as exc:
        raise HTTPException(
            status_code=502,
            detail="Classifier response failed safety validation.",
        ) from exc
    return response
