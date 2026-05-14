# Tasks: Photo Classification Platform

**Input**: Design documents from `/specs/001-photo-classification-platform/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`
**Tests**: Included because `spec.md`, `plan.md`, and `quickstart.md` require API, worker, contract, database, safety, Docker, and CI validation.
**Organization**: Tasks are grouped by user story so each story can be implemented and tested independently after the shared foundation is complete.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it touches different files and has no dependency on incomplete tasks.
- **[Story]**: User story label from `spec.md`.
- Every task includes concrete file or directory paths.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize the implementation structure for the accepted Django/DRF, FastAPI, PostgreSQL, MinIO/S3, RabbitMQ, Celery, and Docker Compose architecture.

- [ ] T001 Create root Python/tooling configuration with Django, DRF, FastAPI, Celery, pytest, ruff, and formatting settings in `pyproject.toml`
- [ ] T002 [P] Create local environment template with PostgreSQL, RabbitMQ, MinIO, Django, Celery, and classifier settings in `.env.example`
- [ ] T003 [P] Create implementation ignore rules for Python, Docker, local env files, media, coverage, and caches in `.gitignore`
- [ ] T004 Create implementation directory skeleton under `services/main/`, `services/classifier/`, `tests/contracts/`, `tests/safety/`, `infra/docker/`, `infra/k8s/`, and `scripts/`
- [ ] T005 [P] Create Django/Celery service image definition in `services/main/Dockerfile`
- [ ] T006 [P] Create FastAPI classifier service image definition in `services/classifier/Dockerfile`
- [ ] T007 Create local runtime composition for `web`, `worker`, `classifier`, `postgres`, `rabbitmq`, `minio`, optional `minio-init`, and `nginx` in `docker-compose.yml`
- [ ] T008 [P] Create local Nginx routing that exposes Django only and keeps classifier internal in `infra/docker/nginx.conf`
- [ ] T009 [P] Create CI workflow skeleton for lint, tests, migrations, contract tests, safety tests, and Docker image builds in `.github/workflows/ci.yml`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build the shared project foundation that must exist before user stories are implemented.

**Critical**: No user story work should begin until this phase is complete.

- [ ] T010 Create Django project entrypoints and base configuration in `services/main/manage.py`, `services/main/config/settings.py`, `services/main/config/urls.py`, `services/main/config/asgi.py`, and `services/main/config/wsgi.py`
- [ ] T011 [P] Create Django app configs for accounts, submissions, classification, and core utilities in `services/main/apps/accounts/apps.py`, `services/main/apps/submissions/apps.py`, `services/main/apps/classification/apps.py`, and `services/main/apps/core/apps.py`
- [ ] T012 [P] Configure shared pytest, pytest-django, FastAPI test client, temporary media/storage, and Celery eager fixtures in `tests/conftest.py`
- [ ] T013 Create the custom Django user model and configure `AUTH_USER_MODEL` in `services/main/apps/accounts/models.py` and `services/main/config/settings.py`
- [ ] T014 Create the initial accounts migration for the custom user model in `services/main/apps/accounts/migrations/0001_initial.py`
- [ ] T015 Configure Django REST Framework, authentication defaults, pagination, schema generation, and installed apps in `services/main/config/settings.py`
- [ ] T016 [P] Implement consistent API error response helpers in `services/main/apps/core/errors.py`
- [ ] T017 [P] Implement S3-compatible object storage settings and client wrapper for MinIO/S3 in `services/main/apps/core/storage.py`
- [ ] T018 [P] Implement image upload validation helpers for content type, signature, size, dimensions, and parseability in `services/main/apps/core/images.py`
- [ ] T019 Create Celery application configuration and task routing for RabbitMQ in `services/main/config/celery.py` and `services/main/config/__init__.py`
- [ ] T020 [P] Create FastAPI application shell with internal health route in `services/classifier/app/main.py`
- [ ] T021 [P] Define accepted status, category, decision, provider, and schema constants in `services/main/apps/classification/constants.py`
- [ ] T022 [P] Define classifier request and response schemas shared by classifier code in `services/classifier/app/schemas.py`
- [ ] T023 [P] Implement Django health endpoint and route in `services/main/apps/core/views.py` and `services/main/config/urls.py`

**Checkpoint**: The repository has runnable service shells, shared settings, test fixtures, health endpoints, and infrastructure wiring.

---

## Phase 3: User Story 1 - Register and log in (Priority: P1) - MVP

**Goal**: Anonymous users can register non-admin accounts, log in, and retrieve their own account profile.

**Independent Test**: Register a new non-admin user, log in with valid credentials, call the authenticated profile endpoint, and verify invalid login attempts fail generically.

### Tests for User Story 1

- [ ] T024 [P] [US1] Add contract tests for `POST /api/auth/register/`, `POST /api/auth/login/`, and `GET /api/auth/me/` in `tests/contracts/test_auth_api.py`
- [ ] T025 [P] [US1] Add integration tests for registration, login, token/session use, and profile retrieval in `services/main/apps/accounts/tests/test_auth_flow.py`
- [ ] T026 [P] [US1] Add permission regression tests proving public registration cannot set `is_staff` or `is_superuser` in `services/main/apps/accounts/tests/test_registration_permissions.py`

### Implementation for User Story 1

- [ ] T027 [US1] Implement account registration, login, and profile serializers in `services/main/apps/accounts/serializers.py`
- [ ] T028 [US1] Implement account registration, login, and profile views in `services/main/apps/accounts/views.py`
- [ ] T029 [US1] Wire account API routes under `/api/auth/` in `services/main/apps/accounts/urls.py` and `services/main/config/urls.py`
- [ ] T030 [US1] Configure API authentication behavior and token/session settings in `services/main/config/settings.py`
- [ ] T031 [US1] Register the custom user model for controlled admin management in `services/main/apps/accounts/admin.py`
- [ ] T032 [US1] Generate and verify OpenAPI schemas for auth endpoints in `services/main/config/urls.py` and `services/main/apps/accounts/serializers.py`

**Checkpoint**: User Story 1 is independently functional and testable.

---

## Phase 4: User Story 2 - Submit a photo with required metadata (Priority: P2)

**Goal**: Authenticated users can create one-photo submissions with required metadata, private object storage, and an initial queued classification state.

**Independent Test**: Submit a valid JPEG, PNG, or WebP with required metadata as an authenticated user, then verify the photo is privately stored, metadata is persisted, status is `pending_classification`, and a classification job is queued without exposing secrets or image bytes.

### Tests for User Story 2

- [ ] T033 [P] [US2] Add contract tests for `POST /api/submissions/`, `GET /api/submissions/`, and `GET /api/submissions/{id}/` in `tests/contracts/test_submissions_api.py`
- [ ] T034 [P] [US2] Add integration tests for valid photo submission, object storage write, database persistence, pending status, and RabbitMQ publish failure after object storage upload without leaving a pending orphan in `services/main/apps/submissions/tests/test_submission_create.py`
- [ ] T035 [P] [US2] Add validation tests for missing metadata, age outside 0-120 inclusive, description over 1,000 characters, unsupported image type outside JPEG/PNG/WebP, files over 5 MB, empty files, dimensions outside 300x300 through 5000x5000 pixels inclusive, spoofed content type, and corrupted image in `services/main/apps/submissions/tests/test_submission_validation.py`
- [ ] T036 [P] [US2] Add ownership tests proving users can list and retrieve only their own submissions in `services/main/apps/submissions/tests/test_submission_permissions.py`

### Implementation for User Story 2

- [ ] T037 [US2] Implement the `Submission` model with private photo reference fields, metadata fields, status fields, indexes, and constraints in `services/main/apps/submissions/models.py`
- [ ] T038 [US2] Create the initial submissions migration with indexes and constraints in `services/main/apps/submissions/migrations/0001_initial.py`
- [ ] T039 [US2] Implement submission storage orchestration and cleanup behavior for object storage writes in `services/main/apps/submissions/storage_service.py`
- [ ] T040 [US2] Implement submission create/list/retrieve serializers with exact metadata and file validation limits: age 0-120 inclusive, optional description maximum 1,000 characters, JPEG/PNG/WebP only, non-empty files up to 5 MB, and image dimensions from 300x300 through 5000x5000 pixels inclusive in `services/main/apps/submissions/serializers.py`
- [ ] T041 [US2] Implement user-owned submission viewset behavior in `services/main/apps/submissions/views.py`
- [ ] T042 [US2] Wire user submission API routes under `/api/submissions/` in `services/main/apps/submissions/urls.py` and `services/main/config/urls.py`
- [ ] T043 [US2] Implement classification job publisher using Celery/RabbitMQ payload rules and explicit publish-failure exceptions in `services/main/apps/classification/publisher.py`
- [ ] T044 [US2] Integrate job publishing into successful submission creation without embedding image bytes, credentials, tokens, or demographic metadata, and handle publish failure by rolling back/cleaning the object or storing a retryable `classification_failed` state in `services/main/apps/submissions/views.py`
- [ ] T045 [US2] Add submission OpenAPI request/response schema details for multipart upload and validation errors in `services/main/apps/submissions/serializers.py`

**Checkpoint**: User Story 2 works independently with authenticated users and a queued classification job.

---

## Phase 5: User Story 3 - Receive submission-review classification (Priority: P3)

**Goal**: Accepted submissions are classified asynchronously through RabbitMQ/Celery and the internal FastAPI classifier, then stored as normalized submission-review results.

**Independent Test**: Create a valid submission, process the Celery job, call the classifier internally, persist a normalized result, update submission status, and retrieve the latest result through the user submission API.

### Tests for User Story 3

- [ ] T046 [P] [US3] Add classifier API contract tests for `POST /classify` and allowed response schema in `tests/contracts/test_classifier_api.py`
- [ ] T047 [P] [US3] Add deterministic rule-based classifier tests for supported JPEG/PNG/WebP images, empty files, files over 5 MB, images outside 300x300 through 5000x5000 pixels inclusive, invalid files, unsupported types, incomplete metadata, and category priority in `services/classifier/tests/test_rule_based_classifier.py`
- [ ] T048 [P] [US3] Add Celery worker integration tests for successful classification processing in `services/main/apps/classification/tests/test_worker_success.py`
- [ ] T049 [P] [US3] Add worker retry, timeout, malformed response, missing object, and duplicate delivery tests in `services/main/apps/classification/tests/test_worker_failures.py`
- [ ] T050 [P] [US3] Add status mapping and latest-result persistence tests in `services/main/apps/classification/tests/test_status_mapping.py`

### Implementation for User Story 3

- [ ] T051 [US3] Implement `ClassificationResult` model and latest result relationship fields in `services/main/apps/classification/models.py` and `services/main/apps/submissions/models.py`
- [ ] T052 [US3] Create classification result and submission latest-pointer migrations in `services/main/apps/classification/migrations/0001_initial.py` and `services/main/apps/submissions/migrations/0002_latest_classification.py`
- [ ] T053 [US3] Implement classifier Pydantic request/response models, enums, and validation rules in `services/classifier/app/schemas.py`
- [ ] T054 [US3] Implement deterministic rule-based submission-review classifier logic with exact limits for JPEG/PNG/WebP support, non-empty files up to 5 MB, image dimensions from 300x300 through 5000x5000 pixels inclusive, incomplete metadata handling, and safe category priority in `services/classifier/app/rules.py`
- [ ] T055 [US3] Implement internal `POST /classify` endpoint using multipart image input and minimal technical metadata in `services/classifier/app/main.py`
- [ ] T056 [US3] Implement classifier provider selection and rule-based fallback behavior in `services/classifier/app/providers.py`
- [ ] T057 [US3] Implement Django worker client for calling the internal classifier with timeout handling in `services/main/apps/classification/client.py`
- [ ] T058 [US3] Implement Celery classification task with submission loading, object storage fetch, classifier call, retry policy, and duplicate-delivery checks in `services/main/apps/classification/tasks.py`
- [ ] T059 [US3] Implement classifier response validation before persistence in `services/main/apps/classification/validators.py`
- [ ] T060 [US3] Implement transactional result persistence, latest result pointer update, and status mapping in `services/main/apps/classification/services.py`
- [ ] T061 [US3] Include latest classification result in user submission responses in `services/main/apps/submissions/serializers.py`
- [ ] T062 [US3] Wire Celery task discovery and retry/backoff settings in `services/main/config/settings.py`

**Checkpoint**: User Story 3 completes the async classification loop without exposing the classifier publicly.

---

## Phase 6: User Story 4 - Review submissions as an admin (Priority: P4)

**Goal**: Admin users can search, filter, and inspect submissions, metadata, photo references, statuses, latest results, and classification history.

**Independent Test**: Log in as staff/admin, list submissions, filter by required metadata and review fields, inspect details and history, and verify non-admin users are denied.

### Tests for User Story 4

- [ ] T063 [P] [US4] Add Django Admin tests for list display, search, filters, detail fields, and classification inline/history behavior in `services/main/apps/submissions/tests/test_admin.py`
- [ ] T064 [P] [US4] Add admin API contract tests for `/api/admin/submissions/` list/detail filters, invalid filter values, and broad search query pagination/capping in `tests/contracts/test_admin_submissions_api.py`
- [ ] T065 [P] [US4] Add admin permission tests proving non-admin users cannot access admin APIs or Django Admin views in `services/main/apps/submissions/tests/test_admin_permissions.py`

### Implementation for User Story 4

- [ ] T066 [US4] Register `Submission` and `ClassificationResult` in Django Admin with search, list filters, readonly fields, and history display in `services/main/apps/submissions/admin.py` and `services/main/apps/classification/admin.py`
- [ ] T067 [US4] Implement admin-only submission serializers with owner summary, latest result, and classification history in `services/main/apps/submissions/admin_serializers.py`
- [ ] T068 [US4] Implement admin-only submission list/detail views with metadata, status, category, decision, timestamp, search, ordering filters, invalid-filter validation, and broad search query bounds in `services/main/apps/submissions/admin_views.py`
- [ ] T069 [US4] Wire admin API routes under `/api/admin/submissions/` in `services/main/apps/submissions/admin_urls.py` and `services/main/config/urls.py`
- [ ] T070 [US4] Add admin OpenAPI schema details and permission metadata in `services/main/apps/submissions/admin_serializers.py`

**Checkpoint**: User Story 4 supports operational review through Django Admin and admin-only APIs.

---

## Phase 7: User Story 5 - Preserve safe classification boundaries (Priority: P5)

**Goal**: Classification remains limited to submission review state and never infers forbidden person traits or uses demographic metadata to score acceptability, suitability, quality, safety, priority, or pass/fail outcome.

**Independent Test**: Run classifier, worker, API, and safety tests that fail if forbidden trait fields appear, demographic metadata affects classification, or the classifier receives unnecessary demographic metadata.

### Tests for User Story 5

- [ ] T071 [P] [US5] Add safety tests rejecting forbidden inferred trait fields in classifier output in `tests/safety/test_forbidden_trait_outputs.py`
- [ ] T072 [P] [US5] Add demographic invariance tests proving age, gender, country, place, and name do not affect classifier decision outcomes in `tests/safety/test_demographic_invariance.py`
- [ ] T073 [P] [US5] Add worker-to-classifier payload tests proving unnecessary demographic metadata, tokens, secrets, and object storage credentials are not sent in `tests/safety/test_classifier_payload_minimization.py`
- [ ] T074 [P] [US5] Add storage and logging safety tests for image bytes, signed URLs, passwords, tokens, and secrets in `tests/safety/test_data_exposure.py`

### Implementation for User Story 5

- [ ] T075 [US5] Implement classifier-side forbidden field and submission-review-only guardrails in `services/classifier/app/safety.py`
- [ ] T076 [US5] Integrate classifier safety guardrails into the `POST /classify` response path in `services/classifier/app/main.py`
- [ ] T077 [US5] Implement Django-side safety validation for classifier responses before persistence in `services/main/apps/classification/validators.py`
- [ ] T078 [US5] Restrict worker classifier requests to image bytes plus minimal technical metadata in `services/main/apps/classification/client.py`
- [ ] T079 [US5] Add safe logging filters and request ID logging without personal data, image bytes, tokens, credentials, or signed URLs in `services/main/apps/core/logging.py` and `services/main/config/settings.py`
- [ ] T080 [US5] Document enforced implementation safety gates and test commands in `specs/001-photo-classification-platform/checklists/safety.md` without editing original source documents

**Checkpoint**: Safety boundaries are enforced by tests and runtime validation, not only by documentation.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Finish deployment readiness, documentation alignment, and end-to-end verification after selected user stories are complete.

- [ ] T081 [P] Add API schema and docs endpoint configuration for generated OpenAPI output in `services/main/config/urls.py` and `services/main/config/settings.py`
- [ ] T082 [P] Create local development and smoke-test instructions aligned with `quickstart.md` in `README.md`
- [ ] T083 [P] Create Kubernetes manifests for namespace, configmap, secrets placeholders, deployments, services, ingress, and migration job under `infra/k8s/`
- [ ] T084 [P] Create Docker Compose smoke test script for auth, upload, async worker processing, and admin verification in `scripts/smoke_photo_classification_flow.sh`
- [ ] T085 [P] Add database migration check and fixture/factory helpers for CI reliability in `tests/factories.py`
- [ ] T086 Run the validation path from `specs/001-photo-classification-platform/quickstart.md` and record any command corrections in `README.md`
- [ ] T087 Run the full CI-equivalent checks from `.github/workflows/ci.yml` and fix failures in the touched implementation files

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Phase 1 and blocks all user stories.
- **User Story 1 (Phase 3)**: Depends on Phase 2 and is the MVP.
- **User Story 2 (Phase 4)**: Depends on Phase 2; real end-to-end use also depends on User Story 1 authentication.
- **User Story 3 (Phase 5)**: Depends on Phase 2 and integrates with User Story 2 submissions.
- **User Story 4 (Phase 6)**: Depends on Phase 2 and is most useful after User Stories 2 and 3.
- **User Story 5 (Phase 7)**: Depends on Phase 2 and must be complete before any final demo or implementation approval.
- **Polish (Phase 8)**: Depends on the selected implemented stories.

### User Story Dependencies

- **US1 Register and log in**: First MVP increment.
- **US2 Submit a photo**: Can be implemented after foundation, but uses US1 for real authenticated flows.
- **US3 Receive classification**: Requires stored submissions and queued jobs from US2.
- **US4 Admin review**: Requires submission data from US2 and benefits from classification data from US3.
- **US5 Safety boundaries**: Cross-cuts US2 and US3; run before final acceptance even if implemented in parallel.

### Within Each User Story

- Tests should be written first and should fail before implementation.
- Models and migrations before services.
- Services before API views or worker integration.
- Contracts before endpoint implementation.
- Story checkpoint validation before moving to the next priority when working sequentially.

### Parallel Opportunities

- Setup tasks marked `[P]` can run in parallel after `T001` where dependency tooling is needed.
- Foundational tasks marked `[P]` can run in parallel after the Django/FastAPI skeleton exists.
- Tests inside each user story marked `[P]` can be written in parallel.
- US5 safety tests can be drafted while US2 and US3 implementation is underway.
- Docker, Kubernetes, README, and smoke script polish tasks marked `[P]` can run in parallel after core paths exist.

---

## Parallel Examples

### User Story 1

```text
Task: T024 Add auth contract tests in tests/contracts/test_auth_api.py
Task: T025 Add auth flow integration tests in services/main/apps/accounts/tests/test_auth_flow.py
Task: T026 Add registration permission tests in services/main/apps/accounts/tests/test_registration_permissions.py
```

### User Story 2

```text
Task: T033 Add submission API contract tests in tests/contracts/test_submissions_api.py
Task: T034 Add valid submission and queue-publish-failure integration tests in services/main/apps/submissions/tests/test_submission_create.py
Task: T035 Add upload and metadata validation tests for age 0-120, description <=1,000 characters, JPEG/PNG/WebP, <=5 MB, non-empty files, and 300x300-5000x5000 dimensions in services/main/apps/submissions/tests/test_submission_validation.py
Task: T036 Add ownership tests in services/main/apps/submissions/tests/test_submission_permissions.py
```

### User Story 3

```text
Task: T046 Add classifier contract tests in tests/contracts/test_classifier_api.py
Task: T047 Add classifier rule tests for JPEG/PNG/WebP, <=5 MB, non-empty files, 300x300-5000x5000 dimensions, invalid files, and unsupported types in services/classifier/tests/test_rule_based_classifier.py
Task: T048 Add successful worker tests in services/main/apps/classification/tests/test_worker_success.py
Task: T049 Add worker failure tests in services/main/apps/classification/tests/test_worker_failures.py
Task: T050 Add status mapping tests in services/main/apps/classification/tests/test_status_mapping.py
```

### User Story 5

```text
Task: T071 Add forbidden trait safety tests in tests/safety/test_forbidden_trait_outputs.py
Task: T072 Add demographic invariance tests in tests/safety/test_demographic_invariance.py
Task: T073 Add classifier payload minimization tests in tests/safety/test_classifier_payload_minimization.py
Task: T074 Add data exposure safety tests in tests/safety/test_data_exposure.py
```

---

## Implementation Strategy

### MVP First

1. Complete Phase 1 and Phase 2.
2. Complete User Story 1.
3. Stop and validate registration, login, and profile retrieval.
4. Add User Story 2 to create authenticated submissions and queued jobs.
5. Add User Story 3 to complete async classification.
6. Complete User Story 5 safety gates before final demo.

### Incremental Delivery

1. Foundation ready: service shells, settings, health, test fixtures, Docker Compose.
2. US1 ready: users can register and authenticate.
3. US2 ready: users can submit photos and jobs are queued.
4. US3 ready: queued jobs produce normalized classification results.
5. US4 ready: admins can review and filter submissions.
6. US5 ready: runtime and test safety gates enforce submission-review-only classification.

### Suggested First Scope

For the first implementation pass, complete Phases 1-3, then validate the MVP. Continue to US2 and US3 only after auth and project foundation are stable.

---

## Task Summary

- **Total tasks**: 87
- **Setup**: 9 tasks
- **Foundational**: 14 tasks
- **US1 Register and log in**: 9 tasks
- **US2 Submit a photo**: 13 tasks
- **US3 Receive classification**: 17 tasks
- **US4 Admin review**: 8 tasks
- **US5 Safety boundaries**: 10 tasks
- **Polish**: 7 tasks

All implementation tasks preserve the accepted architecture decisions in `research.md` and the source documents under `supporting-docs/` and `decisions/`.
