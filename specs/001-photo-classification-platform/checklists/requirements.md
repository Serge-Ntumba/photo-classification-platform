# Requirements Review Checklist

**Feature**: Photo Classification Platform  
**Purpose**: Review gate before generated implementation tasks are accepted.

## Completeness

- [ ] `spec.md` reflects all accepted product behavior from `supporting-docs/product-spec.md`.
- [ ] `plan.md` reflects all accepted architecture decisions from ADRs.
- [ ] `research.md` treats ADRs as resolved decisions, not open research.
- [ ] `data-model.md` reflects users, submissions, classification results, status lifecycle, indexes, and privacy rules.
- [ ] `contracts/` covers main API, classifier API, job payload, and health checks.
- [ ] `quickstart.md` covers local, async, safety, CI, and deployment validation paths.
- [ ] Original source documents remain preserved under `supporting-docs/` and `decisions/`.

## Implementation Readiness

- [ ] The generated `tasks.md` must not reopen accepted architecture choices.
- [ ] Tasks preserve Django/DRF as the main service.
- [ ] Tasks preserve FastAPI as the classification service.
- [ ] Tasks preserve PostgreSQL for metadata and classification results.
- [ ] Tasks preserve MinIO/S3-compatible object storage for photo bytes.
- [ ] Tasks preserve RabbitMQ and Celery for async classification.
- [ ] Tasks preserve Django Admin for the initial admin panel.
- [ ] Tasks include tests for auth, submissions, admin filtering, worker behavior, classifier behavior, contracts, and safety boundaries.

## Review Gate

- [ ] Review `tasks.md` before running `$speckit-implement`.
- [ ] Do not run `$speckit-plan` unless intentional regeneration is approved.
