# Feature Specification: Photo Classification Platform

**Feature Branch**: `001-photo-classification-platform`  
**Created**: 2026-05-14  
**Status**: Migrated from accepted source documentation  
**Input**: Existing product, architecture, API, database, safety, async processing, testing, deployment, ADR, and classifier design documents.

## Source Documents

The accepted source documents are preserved verbatim in this feature directory:

- [supporting-docs/product-spec.md](supporting-docs/product-spec.md)
- [supporting-docs/architecture.md](supporting-docs/architecture.md)
- [supporting-docs/database-design.md](supporting-docs/database-design.md)
- [supporting-docs/api-design.md](supporting-docs/api-design.md)
- [supporting-docs/safety-rules.md](supporting-docs/safety-rules.md)
- [supporting-docs/async-classification.md](supporting-docs/async-classification.md)
- [supporting-docs/testing-and-ci.md](supporting-docs/testing-and-ci.md)
- [supporting-docs/deployment-strategy.md](supporting-docs/deployment-strategy.md)
- [supporting-docs/classification-service-design-note.md](supporting-docs/classification-service-design-note.md)
- [decisions/](decisions/)

This file normalizes the accepted product behavior into the Spec Kit `spec.md` shape. It does not replace or supersede the original documents.

## User Scenarios & Testing

### User Story 1 - Register and log in

As an anonymous user, I can register an account and log in so that I can create photo submissions.

**Why this priority**: Submission creation is only available to authenticated users, so account access is the first required path.

**Independent Test**: Register a new non-admin user, log in with valid credentials, receive authenticated access, and verify invalid login attempts fail safely.

**Acceptance Scenarios**:

1. Given an anonymous user with valid registration data, when they register, then a non-admin account is created.
2. Given an anonymous user with valid credentials, when they log in, then the platform returns an authenticated session or token.
3. Given invalid login credentials, when login is attempted, then the response is a generic authentication failure that does not reveal whether the email or password was wrong.

---

### User Story 2 - Submit a photo with required metadata

As a registered user, I can submit one photo with required metadata so that the platform records my submission and starts review classification.

**Why this priority**: Photo and metadata submission is the core user workflow.

**Independent Test**: As an authenticated user, submit a valid JPEG, PNG, or WebP image with name, age, place of living, gender, and country of origin, then verify the submission is stored with a private photo reference and initial classification status.

**Acceptance Scenarios**:

1. Given an authenticated user and valid photo plus required metadata, when the user creates a submission, then the platform stores metadata, stores the photo in object storage, records a private object reference, and returns the created submission.
2. Given a submission with missing required metadata, when creation is attempted, then the API returns validation errors and does not accept the submission as valid.
3. Given a missing, empty, unsupported, oversized, unreadable, or corrupted photo, when creation or classification occurs, then the platform rejects the input or produces a safe review/failure state.

---

### User Story 3 - Receive submission-review classification

As a registered user, I can receive the review classification for my own submitted record so that I know whether it passed automated checks, failed checks, or requires review.

**Why this priority**: The assessment requires every accepted submission to receive a classification result.

**Independent Test**: Create a valid submission, process the queued classification job, retrieve the submission, and verify a normalized classification result is available for that user's own submission.

**Acceptance Scenarios**:

1. Given an accepted submission, when the classification worker processes the job, then the platform stores a normalized classification result linked to that submission.
2. Given a classifier result with `passes_automated_checks`, when the worker saves it, then the submission status becomes `classified`.
3. Given a classifier result with `needs_manual_review`, when the worker saves it, then the submission status becomes `needs_manual_review`.
4. Given a classifier result with `fails_automated_checks`, when the worker saves it, then the submission status becomes `rejected`.
5. Given classification cannot complete after safe retries, when the worker exhausts the retry policy, then the submission remains traceable and moves to `classification_failed` or `needs_manual_review` according to policy.

---

### User Story 4 - Review submissions as an admin

As an admin, I can search, filter, and inspect submitted records so that I can review operational submission state.

**Why this priority**: Admin review is required by the assessment and depends on correctly persisted submission and classification data.

**Independent Test**: Log in as a staff/admin user, list submissions, filter by required metadata fields, and inspect metadata, photo reference, classification result, and timestamps.

**Acceptance Scenarios**:

1. Given an admin user, when they access the admin submission area, then they can view submitted records.
2. Given submitted records, when an admin filters by age, gender, place of living, or country of origin, then only matching records are shown.
3. Given classification data, when an admin filters by status, category, or review decision where implemented, then matching records are shown.
4. Given a non-admin user, when they access admin-only routes or views, then access is denied.

---

### User Story 5 - Preserve safe classification boundaries

As a platform operator, I need classification to describe the submission review state only so that the platform does not perform unsafe person classification.

**Why this priority**: Safety boundaries are core requirements, not optional hardening.

**Independent Test**: Run classifier, worker, and API tests that fail if sensitive trait fields appear, demographic metadata affects review outcome, or the classifier attempts identity/person classification.

**Acceptance Scenarios**:

1. Given a photo submission, when classification runs, then the classifier does not identify the person in the photo.
2. Given a photo submission, when classification runs, then the classifier does not infer ethnicity, race, attractiveness, identity, gender, age, nationality, health, religion, political affiliation, social background, economic background, personality, trustworthiness, competence, desirability, or similar traits.
3. Given user-provided demographic metadata, when classification runs, then that metadata is not used to judge whether a person is acceptable, suitable, safe, higher priority, lower priority, or more likely to pass review.
4. Given a classification result, when it is returned or stored, then it describes submission review state only.

### Edge Cases

- Anonymous users attempt to upload photos or view submissions.
- Regular users attempt to access another user's submission.
- Public registration includes `is_staff` or `is_superuser` fields.
- Required metadata is missing or invalid.
- Age is outside the configured range.
- Optional description exceeds configured length.
- Uploaded file is empty, oversized, unsupported, spoofed, corrupted, or unreadable.
- Object storage upload succeeds but RabbitMQ publish fails.
- RabbitMQ delivers duplicate jobs.
- The classifier is unavailable, times out, or returns malformed JSON.
- A submission is deleted or already terminal when a worker receives a job.
- A future model provider is configured incorrectly or becomes unavailable.
- Admin filters receive invalid values or broad search queries.

## Requirements

### Functional Requirements

- **FR-001**: The platform MUST support public registration for non-admin users.
- **FR-002**: The platform MUST support user login.
- **FR-003**: Public registration MUST NOT create admin users or allow users to set staff/superuser permissions.
- **FR-004**: The platform MUST distinguish regular users from admins.
- **FR-005**: Anonymous users MUST NOT create submissions or view submission data.
- **FR-006**: Registered users MUST be able to create a submission with one photo and required metadata.
- **FR-007**: Each submission MUST include name, age, place of living, gender, country of origin, and photo.
- **FR-008**: Each submission MAY include an optional description subject to length validation.
- **FR-009**: The platform MUST validate required metadata before accepting a submission.
- **FR-010**: The platform MUST validate uploaded files before processing.
- **FR-011**: The platform MUST store structured metadata and photo references separately from photo bytes.
- **FR-012**: The platform MUST store photo bytes in private object storage.
- **FR-013**: The platform MUST store private object keys or references in PostgreSQL, not permanent public URLs.
- **FR-014**: Each accepted submission MUST receive a submission-review classification result.
- **FR-015**: Classification MUST be asynchronous through RabbitMQ and Celery.
- **FR-016**: Submission creation MUST create or expose an initial state such as `pending_classification`.
- **FR-017**: The Celery worker MUST fetch photo bytes from object storage and call the internal FastAPI classifier.
- **FR-018**: The FastAPI classifier MUST return a normalized classification response.
- **FR-019**: The worker MUST validate classifier responses before saving them.
- **FR-020**: Classification results MUST be stored through the Django application layer or ORM.
- **FR-021**: The platform MUST store classification history separately from the submission source record.
- **FR-022**: The platform SHOULD expose the latest classification result by default while preserving historical results.
- **FR-023**: Regular users MUST only list and retrieve submissions they created.
- **FR-024**: Admins MUST be able to view submitted records.
- **FR-025**: Admins MUST be able to search submissions.
- **FR-026**: Admins MUST be able to filter submissions by age, gender, place of living, and country of origin.
- **FR-027**: Admins SHOULD be able to filter by submission status, classification category, review decision, and timestamps where implemented.
- **FR-028**: Admins MUST be able to view metadata, photo reference, classification result, creation timestamp, and update timestamp.
- **FR-029**: Non-admin users MUST NOT access admin-only submission lists, filters, or views.
- **FR-030**: The Django/DRF main service MUST own authentication, submissions, metadata validation, storage orchestration, database writes, admin, and job publishing.
- **FR-031**: The FastAPI classifier MUST remain stateless and MUST NOT own persistence, object storage credentials, authentication, authorization, or admin behavior.
- **FR-032**: Docker Compose MUST be able to run the local system boundaries: web, worker, classifier, PostgreSQL, RabbitMQ, MinIO, and Nginx where used.
- **FR-033**: The repository MUST include a credible Kubernetes deployment strategy.
- **FR-034**: The repository MUST include testing and CI guidance that covers API, classifier, worker, contract, database, safety, Docker, and deployment checks.

### Classification Safety Requirements

- **SR-001**: The classifier MUST classify submission review state only.
- **SR-002**: The classifier MUST NOT classify the person in the photo.
- **SR-003**: The classifier MUST NOT infer ethnicity, race, attractiveness, identity, gender, age, nationality, health, religion, political affiliation, social background, economic background, personality, trustworthiness, competence, desirability, or similar traits from the photo.
- **SR-004**: The platform MUST NOT use user-provided demographic metadata to decide whether a person is acceptable, suitable, safe, high quality, higher priority, lower priority, or more likely to pass review.
- **SR-005**: Demographic metadata MAY be stored and used for required validation, display, search, and admin filtering only.
- **SR-006**: The worker SHOULD NOT send name, gender, country of origin, place of living, or other unnecessary demographic metadata to the classifier by default.
- **SR-007**: Classifier responses MUST NOT contain sensitive inferred trait fields.
- **SR-008**: Unsafe, unsupported, invalid, or failed classification inputs MUST produce safe rejection, manual review, or failure states rather than unsafe assumptions.

### Key Entities

- **User**: Authenticated account with standard Django authentication fields and admin/staff flags.
- **Submission**: User-created record containing required metadata, optional description, private photo object reference, processing status, and timestamps.
- **ClassificationResult**: Normalized classifier output linked to one submission, including category, review decision, score or confidence where applicable, reasons, provider, classifier version, schema version, fallback/error fields, and timestamps.
- **ClassificationJob**: RabbitMQ/Celery job payload that identifies a submission and job attempt without embedding image bytes, secrets, tokens, or unnecessary personal metadata.
- **PhotoObject**: Private object storage item referenced by a submission through an internal object key.

## Success Criteria

- **SC-001**: A user can register, log in, submit a valid photo with required metadata, and retrieve their own submission state.
- **SC-002**: An accepted submission moves through async processing and receives a normalized submission-review classification result.
- **SC-003**: Admins can search, filter, and inspect submitted records by required metadata and review fields.
- **SC-004**: Regular users cannot view other users' submissions and cannot access admin review views.
- **SC-005**: The classifier and stored results never infer or expose forbidden person traits.
- **SC-006**: The system is runnable locally with Docker Compose and has documented cloud-deployable Kubernetes direction.
- **SC-007**: CI can validate unit, service, contract, async worker, database, safety, and Docker build behavior without requiring external model-provider credentials.

## Assumptions

- This is a take-home assessment, so the first version prioritizes a working, defensible, cloud-deployable implementation over enterprise breadth.
- Django Admin is the accepted admin panel for the first version.
- The default classifier is deterministic and rule-based.
- Optional model-provider classification is future-capable but not required for the first implementation.
- One photo is accepted per submission.
- Admin users are created through a controlled administrative process, not public registration.
- Production can replace local MinIO with S3-compatible managed object storage.

## Out of Scope

- Facial recognition or person identification.
- Biometric analysis.
- Inferring protected, sensitive, subjective, or identity-related traits from photos.
- Using demographic metadata for suitability, safety, desirability, trustworthiness, competence, or priority scoring.
- Advanced ML model training as a required first-version feature.
- A custom admin frontend for the first version.
- Multi-photo submissions.
- Public galleries, sharing, payment, billing, subscriptions, mobile apps, real-time notifications, and advanced analytics.
- Full production hardening such as MFA, malware scanning, full audit dashboards, centralized monitoring, and formal privacy/compliance programs, except where documented as future improvements.
