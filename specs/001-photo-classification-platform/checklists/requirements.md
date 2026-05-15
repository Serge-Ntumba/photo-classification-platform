# Requirements Review Checklist

**Feature**: Photo Classification Platform  
**Purpose**: Review gate before generated implementation tasks are accepted.

## Completeness

- [x] `spec.md` reflects all accepted product behavior from `supporting-docs/product-spec.md`.
- [x] `plan.md` reflects all accepted architecture decisions from ADRs.
- [x] `research.md` treats ADRs as resolved decisions, not open research.
- [x] `data-model.md` reflects users, submissions, classification results, status lifecycle, indexes, and privacy rules.
- [x] `contracts/` covers main API, classifier API, job payload, and health checks.
- [x] `quickstart.md` covers local, async, safety, CI, and deployment validation paths.
- [x] Original source documents remain preserved under `supporting-docs/` and `decisions/`.

## Implementation Readiness

- [x] The generated `tasks.md` must not reopen accepted architecture choices.
- [x] Tasks preserve Django/DRF as the main service.
- [x] Tasks preserve FastAPI as the classification service.
- [x] Tasks preserve PostgreSQL for metadata and classification results.
- [x] Tasks preserve MinIO/S3-compatible object storage for photo bytes.
- [x] Tasks preserve RabbitMQ and Celery for async classification.
- [x] Tasks preserve Django Admin for the initial admin panel.
- [x] Tasks include tests for auth, submissions, admin filtering, worker behavior, classifier behavior, contracts, and safety boundaries.

## Review Gate

- [x] Review `tasks.md` before running `$speckit-implement`.
- [x] Do not run `$speckit-plan` unless intentional regeneration is approved.
