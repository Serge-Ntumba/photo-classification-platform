# Implementation Plan: Photo Classification Platform

**Branch**: `001-photo-classification-platform`  
**Date**: 2026-05-14  
**Spec**: [spec.md](spec.md)  
**Status**: Migrated from accepted architecture and ADRs. Do not run `/speckit.plan` unless intentionally regenerating planning artifacts.

## Summary

Build a cloud-deployable photo submission and classification platform with two application service boundaries:

1. Django + Django REST Framework main service for authentication, users, submissions, metadata validation, object storage orchestration, PostgreSQL writes, RabbitMQ job publishing, API documentation, and Django Admin.
2. FastAPI classification service for stateless submission-review classification through `/classify` and `/health`.

Classification is asynchronous. Django stores a valid submission and publishes a job to RabbitMQ. A Celery worker consumes the job, loads the submission through the Django ORM, fetches the private photo object from MinIO/S3-compatible storage, calls the internal FastAPI classifier, validates the normalized response, stores a `ClassificationResult`, and updates submission status.

This plan treats the ADRs in [decisions/](decisions/) as accepted decisions. The implementation should not reopen Django vs FastAPI, PostgreSQL vs alternatives, MinIO/S3 vs database blobs, submission-review classification scope, deterministic rule-based default classification, or RabbitMQ/Celery async processing.

## Technical Context

**Language/Version**: Python 3.11 or newer recommended; exact version to be pinned during implementation.  
**Primary Dependencies**: Django, Django REST Framework, DRF Spectacular or equivalent OpenAPI tooling, FastAPI, Pydantic, Celery, RabbitMQ broker, PostgreSQL driver, S3-compatible storage client, image validation library, pytest ecosystem.  
**Storage**: PostgreSQL for structured records; MinIO locally and S3-compatible object storage in production for photo bytes.  
**Testing**: pytest, pytest-django, DRF APIClient, FastAPI TestClient, Celery eager-mode tests, contract tests, safety tests, migration checks, Docker image build checks, optional Docker Compose smoke tests.  
**Target Platform**: Docker Compose locally; Kubernetes-oriented cloud deployment with managed PostgreSQL/object storage/broker preferred in production.  
**Project Type**: Backend platform with two application microservices plus worker and supporting infrastructure.  
**Performance Goals**: Upload endpoint stays responsive by queuing classification work; worker/classifier scale independently as needed.  
**Constraints**: Classify submission review state only; keep classifier stateless; do not expose internal services publicly; do not store image bytes in PostgreSQL; do not use external model-provider credentials for the default path.  
**Scale/Scope**: Take-home assessment v1 with production-aware boundaries and documentation.

## Constitution Check

No `.specify/memory/constitution.md` existed before this migration. The accepted safety and architecture documents act as hard gates until a constitution is created separately.

Required gates:

- The classifier must not classify the person in the photo.
- The classifier must not infer sensitive or protected traits from the photo.
- Demographic metadata must not influence acceptability, suitability, safety, priority, or quality scoring.
- Django owns auth, submissions, storage orchestration, database writes, admin, and job publishing.
- FastAPI classifier remains stateless and does not own persistence, object storage credentials, auth, or admin behavior.
- RabbitMQ and Celery are the accepted async processing model.
- PostgreSQL stores metadata and classification results; MinIO/S3-compatible storage stores photo bytes.

## Project Structure

The exact source tree can be finalized during task generation, but implementation should preserve these service boundaries:

```text
services/
  main/
    # Django + DRF app, Django Admin, Celery app/tasks, migrations
  classifier/
    # FastAPI classifier service
tests/
  contracts/
  safety/
infra/
  docker/
  k8s/
```

Local runtime components:

```text
nginx
web          # Django/DRF
worker       # Celery worker using Django app boundary
classifier   # FastAPI
postgres
rabbitmq
minio
minio-init   # optional bucket bootstrap
```

## Accepted Architecture Decisions

- Main service: Django + Django REST Framework.
- Classification service: FastAPI.
- Database: PostgreSQL.
- Object storage: MinIO locally and S3-compatible storage in production.
- Queue/background processing: RabbitMQ + Celery.
- Admin panel: Django Admin.
- Classification scope: submission-review classification only, not person classification.
- Classifier default: deterministic rule-based classifier.
- Processing model: async classification through RabbitMQ and Celery.
- Django owns authentication, submissions, storage orchestration, database writes, admin, and job publishing.
- FastAPI classifier is stateless and does not own persistence, object storage credentials, or auth.

## Architecture Flow

1. Browser or client calls Nginx/public entry point.
2. Nginx routes application traffic to Django/DRF.
3. Django authenticates the user and validates metadata and photo upload.
4. Django stores photo bytes in private MinIO/S3-compatible object storage.
5. Django stores metadata and photo object reference in PostgreSQL with `pending_classification`.
6. Django publishes a classification job to RabbitMQ.
7. Celery worker consumes the job and loads the submission through the Django ORM.
8. Worker fetches photo bytes from object storage using internal credentials.
9. Worker calls FastAPI `/classify` with image bytes and minimal technical metadata.
10. FastAPI classifier returns normalized submission-review classification.
11. Worker validates the response and stores the result through Django models.
12. Worker updates submission status and latest-result pointer transactionally.
13. Users and admins retrieve the submission state through Django APIs or Django Admin.

## Service Responsibilities

### Django/DRF Main Service

- User registration and login.
- Authentication and authorization.
- Regular-user submission APIs.
- Admin review APIs and Django Admin.
- Metadata and upload validation.
- Object storage upload orchestration.
- PostgreSQL schema, migrations, and writes.
- Classification job publishing.
- OpenAPI documentation for public/admin APIs.
- Health endpoint for the main service.

### Celery Worker

- Consume RabbitMQ classification jobs.
- Load submissions with the Django ORM.
- Enforce idempotency and skip already terminal submissions unless explicit reclassification exists.
- Fetch private photo objects.
- Call the FastAPI classifier with timeout and minimal technical metadata.
- Validate classifier response.
- Save `ClassificationResult` and update `Submission` status in a transaction.
- Retry temporary failures and mark safe failure states after retry exhaustion.

### FastAPI Classifier

- Expose internal `POST /classify`.
- Expose internal `GET /health`.
- Apply deterministic rule-based classification by default.
- Return the normalized classification response schema.
- Support future model-provider mode behind the same contract.
- Avoid database writes, object storage access, auth ownership, admin behavior, and persistent state.

## Data and Storage Plan

PostgreSQL stores:

- Users and authentication records.
- Submissions and user-provided metadata.
- Private photo object keys and file metadata.
- Submission status fields.
- Classification results and history.
- Latest classification result pointer where implemented.
- Created, updated, classified, and result timestamps.

Object storage stores:

- Uploaded photo bytes as private objects.
- No public permanent URLs.

RabbitMQ/Celery payloads carry:

- `submission_id`
- `job_id`
- `attempt`
- `requested_at`

Payloads must not include image bytes, storage credentials, JWTs, user session tokens, secrets, or unnecessary personal metadata.

## Classification Plan

Default provider: `rule_based`.

Allowed categories:

```text
valid_profile_candidate
invalid_file
unsupported_image_type
suspicious_file
low_quality_image
incomplete_metadata
non_profile_image
unsafe_content
```

Allowed review decisions:

```text
passes_automated_checks
fails_automated_checks
needs_manual_review
```

Accepted status mapping:

```text
passes_automated_checks -> classified
needs_manual_review     -> needs_manual_review
fails_automated_checks  -> rejected
technical failure       -> classification_failed or needs_manual_review
```

The classifier may evaluate file-level and submission-level technical signals: file presence, MIME type, signature match, parseability, size, dimensions, metadata completeness, age validation, description length, corruption, suspicious files, and whether the record needs manual review.

The classifier must not evaluate the person in the photo or infer sensitive traits.

## API Plan

Public/user-facing Django APIs:

- `POST /api/auth/register/`
- `POST /api/auth/login/`
- `GET /api/auth/me/`
- `POST /api/submissions/`
- `GET /api/submissions/`
- `GET /api/submissions/{id}/`

Admin Django APIs and/or Django Admin:

- `GET /api/admin/submissions/`
- `GET /api/admin/submissions/{id}/`
- Django Admin submission list/detail with required filters and search.

Internal classifier API:

- `POST /classify`
- `GET /health`

Health:

- Django `GET /health`
- FastAPI `GET /health`
- Worker health through process checks, logs, and queue/task observability.

## Testing Plan

Required test areas:

- Django registration, login, permissions, admin-only access.
- Submission creation, metadata validation, upload validation, storage reference persistence.
- User ownership and admin filtering/search.
- Classifier endpoint shape, deterministic rule priority, allowed enums, and forbidden sensitive traits.
- Worker job publishing, processing, retry/failure handling, idempotency, and transactional result persistence.
- Contract tests for worker-to-classifier request and response.
- Database migrations, constraints, indexes, and latest-result pointer behavior.
- Safety tests proving submission-review classification only and no demographic scoring.
- Docker image build checks and optional Docker Compose smoke flow.

CI must not require external model-provider credentials because the rule-based classifier is the default.

## Deployment Plan

Local:

- Docker Compose with web, worker, classifier, PostgreSQL, RabbitMQ, MinIO, optional MinIO bootstrap, and Nginx.
- `.env.example` with placeholders only.
- Local access through `http://localhost`, `/admin/`, `/api/docs/`, optional MinIO/RabbitMQ consoles for debugging.

Cloud/Kubernetes:

- Deploy web, worker, and classifier as separate workloads.
- Prefer managed PostgreSQL, managed RabbitMQ or broker, and managed S3-compatible object storage.
- Use ConfigMaps for non-sensitive settings and Secrets for credentials.
- Run migrations as a release step or Kubernetes Job before rolling out web containers.
- Expose only public HTTP entry point; keep classifier, database, broker, and storage private.
- Add readiness/liveness probes for web and classifier.

## Complexity Tracking

No new complexity exceptions are introduced by this migration. Existing complexity is accepted by ADRs:

- RabbitMQ/Celery is accepted to keep classification async and retryable.
- Separate FastAPI classifier is accepted to satisfy the microservice boundary.
- MinIO/S3 object storage is accepted to keep photo bytes out of PostgreSQL.

## Next Spec Kit Step

After reviewing these migrated artifacts, generate tasks with:

```text
$speckit-tasks
```

Then review `tasks.md` before implementation. Do not run `$speckit-implement` until `tasks.md` has been reviewed.
