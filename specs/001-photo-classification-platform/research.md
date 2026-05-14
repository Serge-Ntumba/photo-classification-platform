# Research: Photo Classification Platform

**Status**: Resolved decision log migrated from accepted ADRs and supporting docs. This is not an open research backlog.

## Source Decisions

- [ADR-001-main-service-framework.md](decisions/ADR-001-main-service-framework.md)
- [ADR-002-classification-service.md](decisions/ADR-002-classification-service.md)
- [ADR-003-database-choice.md](decisions/ADR-003-database-choice.md)
- [ADR-004-object-storage-choice.md](decisions/ADR-004-object-storage-choice.md)
- [ADR-005-classification-scope.md](decisions/ADR-005-classification-scope.md)
- [ADR-006-async-classification-processing.md](decisions/ADR-006-async-classification-processing.md)
- [supporting-docs/classification-service-design-note.md](supporting-docs/classification-service-design-note.md)

## Decision 1: Main Service Framework

**Decision**: Use Django + Django REST Framework for the main service.

**Rationale**: The main service owns users, authentication, authorization, submissions, metadata validation, admin review, PostgreSQL persistence, object storage orchestration, API documentation, and classification job publishing. Django/DRF gives mature support for auth, permissions, ORM, migrations, admin, serializers, and REST APIs. Django Admin satisfies the assessment admin panel requirement without a custom frontend.

**Alternatives considered**:

- FastAPI-only main service: rejected because core product workflow needs built-in auth, admin, ORM, migrations, permissions, and CRUD support.
- Separate frontend/admin service: rejected for the first version because it adds extra auth, authorization, deployment, and testing scope without assessment value.

## Decision 2: Classification Service Boundary

**Decision**: Use a separate FastAPI classification service.

**Rationale**: Classification is a distinct capability and the assessment requires at least two microservices. FastAPI is a good fit because the classifier is narrow, stateless, API-oriented, and independent from auth, admin, persistence, and storage orchestration.

**Alternatives considered**:

- Put classification inside Django: rejected because it weakens the classification service boundary and makes future classifier evolution harder.
- Separate FastAPI classifier: accepted.
- Earlier synchronous Django-to-FastAPI classification: considered acceptable for a smaller first version, but superseded by the accepted async RabbitMQ/Celery design.

## Decision 3: Database

**Decision**: Use PostgreSQL as the primary relational database for metadata and application records.

**Rationale**: The platform needs users, submissions, classification results, timestamps, status fields, constraints, migrations, and indexed admin filtering. PostgreSQL fits Django ORM, relational integrity, transactions, JSONB where useful, and production deployment patterns.

**Alternatives considered**:

- MySQL: reasonable but not selected because PostgreSQL is the stronger default for this Django use case.
- SQLite: rejected because the platform is containerized, cloud-deployable, and requires production-like concurrency and persistence.
- NoSQL/document database: rejected because the data is structured and relational, with known filters and ownership relationships.

## Decision 4: Object Storage

**Decision**: Store uploaded photos in MinIO locally and S3-compatible object storage in production.

**Rationale**: Photos are binary objects and should not be stored as PostgreSQL blobs. Object storage keeps app containers stateless, maps cleanly to cloud deployment, and lets the database store private object references only.

**Alternatives considered**:

- PostgreSQL image blobs: rejected because it bloats database backups, increases database load, and mixes binary storage with relational metadata.
- Local filesystem: rejected as the main design because containers are ephemeral and multiple replicas would not share files safely.
- Object storage: accepted.

## Decision 5: Classification Scope

**Decision**: Classify submission review state, not the person in the photo.

**Rationale**: The assessment requires a classification result but does not require sensitive person inference or real ML. Submission-review classification satisfies the requirement while reducing privacy, bias, compliance, and safety risks. The classifier may evaluate technical submission signals, file validity, metadata completeness, and whether the record should pass automated checks, fail checks, or require manual review.

**Alternatives considered**:

- Person/demographic classification: rejected as unnecessary and unsafe.
- Real ML-only classifier: rejected as the default because it adds external dependencies, cost, nondeterminism, secrets, latency, and demo/CI risk.
- Rule-based submission-review classifier: accepted as the default.
- Provider-pluggable classifier: accepted as a future extensibility strategy.

## Decision 6: Async Classification Processing

**Decision**: Use RabbitMQ and Celery for asynchronous classification.

**Rationale**: Upload requests should not block on classifier latency, downtime, external provider behavior, or retry handling. RabbitMQ is a dedicated message broker, and Celery fits Python/Django workers that need ORM access, transactions, and shared domain models.

**Alternatives considered**:

- Synchronous classification inside upload request: rejected because upload latency and reliability become coupled to classification.
- Django directly calling FastAPI synchronously: rejected for the final design because it keeps the public API waiting on classifier availability.
- Celery with Redis: reasonable but rejected in favor of RabbitMQ's dedicated broker semantics.
- Celery with RabbitMQ: accepted.
- Kafka/full event streaming: rejected as disproportionate for task/job processing in this assessment.

## Decision 7: Admin Panel

**Decision**: Use Django Admin as the first admin panel.

**Rationale**: The requirement is to search, filter, and inspect submitted records. Django Admin provides authentication, permissions, list filters, search fields, detail pages, and rapid demonstration value. A custom admin UI would add scope without improving the first assessment outcome.

**Alternatives considered**:

- Custom admin frontend: deferred until there is a product need that Django Admin cannot satisfy.

## Decision 8: Default Classifier

**Decision**: Implement deterministic rule-based classification by default.

**Rationale**: Rule-based classification works locally, in CI, in Docker Compose, and in Kubernetes without external API keys. It is deterministic, explainable, testable, and sufficient for submission-review state. It guarantees a classification result even when no model provider is configured.

**Alternatives considered**:

- Model-provider-only classification: rejected as the default.
- Provider-pluggable architecture: accepted for future optional model integration behind the same response schema and safety boundaries.

## Decision 9: Privacy and Safety Boundary

**Decision**: The platform must not classify people or infer sensitive traits from photos, and must not use demographic metadata for acceptability or suitability decisions.

**Rationale**: The platform processes personal metadata and photos. Restricting classification to submission review state avoids identity, biometric, demographic, and subjective person scoring.

**Required constraints**:

- Do not infer ethnicity, race, attractiveness, identity, gender, age, nationality, health, religion, political affiliation, social background, economic background, personality, trustworthiness, competence, desirability, or similar traits from photos.
- Do not send unnecessary demographic metadata to the classifier by default.
- Do not store sensitive inferred traits.
- Validate classifier output before persistence.

## Decision 10: Implementation Boundaries

**Decision**: Django owns persistence and orchestration. FastAPI owns only classification logic.

**Rationale**: Keeping one data owner avoids split database ownership, duplicated permissions, and inconsistent validation. The classifier remains replaceable, independently testable, and low privilege.

**Implications**:

- The classifier does not get PostgreSQL credentials.
- The classifier does not get object storage credentials.
- The classifier does not authenticate users or authorize submissions.
- The worker fetches photos and persists results through Django models.
- External clients never call RabbitMQ, PostgreSQL, MinIO/S3, Celery, or the classifier directly.

## Open Research

None for the architecture decisions above. Exact package versions, directory names, and implementation details can be finalized during task generation and coding, but the service boundaries and safety constraints are accepted.
