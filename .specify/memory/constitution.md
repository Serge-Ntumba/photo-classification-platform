<!--
Sync Impact Report
Version change: none -> 1.0.0
Modified principles: N/A (initial constitution)
Added principles:
- I. Safety-Bounded Classification
- II. Demographic Metadata Separation
- III. Single Application Data Owner
- IV. Stateless Classifier Boundary
- V. Private Binary Storage
- VI. Async Classification
Removed sections: None
Templates requiring updates:
- .specify/templates/plan-template.md: reviewed; no targeted change required
- .specify/templates/spec-template.md: reviewed; no targeted change required
- .specify/templates/tasks-template.md: reviewed; no targeted change required
Follow-up TODOs: None
-->
# Photo Classification Platform Constitution

## Core Principles

### I. Safety-Bounded Classification

The classifier MUST classify submission review state only. It MUST NOT identify
people or infer sensitive, protected, subjective, demographic, or
identity-related traits from photos.

### II. Demographic Metadata Separation

User-provided demographic metadata MUST NOT influence acceptability,
suitability, safety, quality, priority, or pass/fail classification outcomes.

### III. Single Application Data Owner

Django/DRF MUST own authentication, authorization, submissions, metadata
validation, storage orchestration, database writes, admin behavior, and job
publishing.

### IV. Stateless Classifier Boundary

FastAPI classifier MUST remain stateless and MUST NOT own persistence, object
storage credentials, authentication, authorization, or admin behavior.

### V. Private Binary Storage

PostgreSQL MUST store structured records and private object references only.
Photo bytes MUST live in private MinIO/S3-compatible object storage.

### VI. Async Classification

Classification MUST run asynchronously through RabbitMQ and Celery. Upload
requests MUST not depend on synchronous classifier availability.

## Governance

This constitution records non-negotiable hard gates for the Photo Classification
Platform. Spec Kit planning, task generation, implementation, and review MUST
preserve these principles unless the project owner explicitly approves a
constitution amendment.

Accepted ADRs and source documentation may add stricter implementation details,
but they MUST NOT weaken these principles. Changes to these principles require
an explicit documentation update, review of dependent Spec Kit artifacts, and a
clear migration note before implementation work proceeds.

**Version**: 1.0.0 | **Ratified**: 2026-05-15 | **Last Amended**: 2026-05-15
