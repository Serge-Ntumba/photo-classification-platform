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

- [X] T001 Create root Python/tooling configuration with Django, DRF, FastAPI, Celery, pytest, ruff, and formatting settings in `pyproject.toml`
- [X] T002 [P] Create local environment template with PostgreSQL, RabbitMQ, MinIO, Django, Celery, and classifier settings in `.env.example`
- [X] T003 [P] Create implementation ignore rules for Python, Docker, local env files, media, coverage, and caches in `.gitignore`
- [X] T004 Create implementation directory skeleton under `services/main/`, `services/classifier/`, `tests/contracts/`, `tests/safety/`, `infra/docker/`, `infra/k8s/`, and `scripts/`
- [X] T005 Create Django/Celery service image definition in `services/main/Dockerfile`
- [X] T006 Create FastAPI classifier service image definition in `services/classifier/Dockerfile`
- [X] T007 Create local runtime composition for `web`, `worker`, `classifier`, `postgres`, `rabbitmq`, `minio`, optional `minio-init`, and `nginx` in `docker-compose.yml`
- [X] T008 Create local Nginx routing that exposes Django only and keeps classifier internal in `infra/docker/nginx.conf`
- [X] T009 Create CI workflow skeleton for lint, tests, migrations, contract tests, safety tests, Docker image builds, Docker Compose smoke coverage, and credential-free default classifier validation with no external model-provider credentials in `.github/workflows/ci.yml`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build the shared project foundation that must exist before user stories are implemented.

**Critical**: No user story work should begin until this phase is complete.

**Locked task decisions before implementation**:

- Admin v1 uses Django Admin only. Do not implement `/api/admin/submissions/` unless the spec is changed later.
- Uploaded images must be normalized by stripping EXIF/GPS/application metadata before object storage and classifier handoff.
- Accepted submissions may enter `pending_classification` only when a durable Django-owned `ClassificationJob` outbox row exists.
- RabbitMQ publish failures are recorded on the outbox job and retried; retry exhaustion transitions the submission to `classification_failed`.
- Submission status changes must go through one state-machine service; terminal states are immutable unless explicit reclassification is added later.
- Outbox publish status lifecycle is `pending -> publishing -> published`; publish errors move to `publish_retry_scheduled`; exhausted publish attempts move to `publish_failed` and then transition the submission to `classification_failed`.
- Retry policy for v1 is explicit: RabbitMQ publish max attempts = 3, worker/classifier max retries = 3, classifier request timeout = 5 seconds, exponential backoff with jitter uses a 2 second base and 60 second cap.
- `classification_failed` is terminal in v1; any future reclassification flow must add a new explicit state-machine transition and task set.
- Image normalization must preserve the accepted source format family (JPEG, PNG, or WebP), revalidate dimensions after rewrite, and reject images that cannot be safely rewritten without metadata.
- Classification history is preserved while the submission exists; permanent deletion removes the photo object and submission-linked personal data/results, retaining only sanitized operational audit records when needed.
- Provider metadata and raw classifier responses may be stored only after sanitizer validation removes forbidden traits, secrets, signed URLs, prompts, raw personal data, and nested provider-specific sensitive fields.

- [X] T010 Create Django project entrypoints and base configuration in `services/main/manage.py`, `services/main/config/settings.py`, `services/main/config/urls.py`, `services/main/config/asgi.py`, and `services/main/config/wsgi.py`
- [X] T011 Create Django app configs for accounts, submissions, classification, and core utilities in `services/main/apps/accounts/apps.py`, `services/main/apps/submissions/apps.py`, `services/main/apps/classification/apps.py`, and `services/main/apps/core/apps.py`
- [X] T012 Configure shared pytest, pytest-django, FastAPI test client, temporary media/storage, and Celery eager fixtures in `tests/conftest.py`
- [X] T013 [P] Add image helper tests for EXIF/GPS/application metadata stripping, sanitized image bytes, accepted format-family preservation, post-normalization dimension validation, and safe-rewrite rejection in `services/main/apps/core/tests/test_images.py`
- [X] T014 [P] Add `ClassificationJob` outbox model tests for required fields, unique `job_id`, explicit publish status lifecycle values, attempt/error tracking, lock fields, and submission ownership in `services/main/apps/classification/tests/test_classification_job_model.py`
- [X] T015 [P] Add submission state-machine unit tests for allowed transitions, rejected transitions, terminal-state immutability, terminal `classification_failed`, and retry-exhaustion failure paths in `services/main/apps/submissions/tests/test_status_state_machine.py`
- [X] T016 Create the custom Django user model and configure `AUTH_USER_MODEL` in `services/main/apps/accounts/models.py` and `services/main/config/settings.py`
- [X] T017 Create the initial accounts migration for the custom user model in `services/main/apps/accounts/migrations/0001_initial.py`
- [X] T018 Configure Django REST Framework, authentication defaults, pagination, schema generation, and installed apps in `services/main/config/settings.py`
- [X] T019 Implement consistent API error response helpers in `services/main/apps/core/errors.py`
- [X] T020 Implement S3-compatible object storage settings and client wrapper for MinIO/S3 in `services/main/apps/core/storage.py`
- [X] T021 Implement image upload validation and normalization helpers for content type, signature, size, dimensions, parseability, accepted format-family preservation, post-normalization dimension validation, safe-rewrite rejection, and EXIF/GPS/application metadata stripping in `services/main/apps/core/images.py`
- [X] T022 Create Celery application configuration and task routing for RabbitMQ in `services/main/config/celery.py` and `services/main/config/__init__.py`
- [X] T023 [P] Create FastAPI application shell with internal health route in `services/classifier/app/main.py`
- [X] T024 Define accepted status, category, decision, provider, explicit job publish status lifecycle, retry/backoff/timeout settings, and schema constants in `services/main/apps/classification/constants.py`
- [X] T025 [P] Define classifier request and response schemas shared by classifier code in `services/classifier/app/schemas.py`
- [X] T026 Implement Django health endpoint and route in `services/main/apps/core/views.py` and `services/main/config/urls.py`

**Checkpoint**: The repository has runnable service shells, shared settings, test fixtures, health endpoints, safety-first image helpers, durable outbox tests, and infrastructure wiring.

---

## Phase 3: User Story 1 - Register and log in (Priority: P1) - MVP

**Goal**: Anonymous users can register non-admin accounts, log in, and retrieve their own account profile.

**Independent Test**: Register a new non-admin user, log in with valid credentials, call the authenticated profile endpoint, and verify invalid login attempts fail generically.

### Tests for User Story 1

- [X] T027 [P] [US1] Add contract tests for `POST /api/auth/register/`, `POST /api/auth/login/`, and `GET /api/auth/me/` in `tests/contracts/test_auth_api.py`
- [X] T028 [P] [US1] Add integration tests for registration, login, token/session use, and profile retrieval in `services/main/apps/accounts/tests/test_auth_flow.py`
- [X] T029 [P] [US1] Add permission regression tests proving public registration cannot set `is_staff` or `is_superuser` in `services/main/apps/accounts/tests/test_registration_permissions.py`

### Implementation for User Story 1

- [X] T030 [US1] Implement account registration, login, and profile serializers in `services/main/apps/accounts/serializers.py`
- [X] T031 [US1] Implement account registration, login, and profile views in `services/main/apps/accounts/views.py`
- [X] T032 [US1] Wire account API routes under `/api/auth/` in `services/main/apps/accounts/urls.py` and `services/main/config/urls.py`
- [X] T033 [US1] Configure API authentication behavior and token/session settings in `services/main/config/settings.py`
- [X] T034 [US1] Register the custom user model for controlled admin management in `services/main/apps/accounts/admin.py`
- [X] T035 [US1] Generate and verify OpenAPI schemas for auth endpoints in `services/main/config/urls.py` and `services/main/apps/accounts/serializers.py`

**Checkpoint**: User Story 1 is independently functional and testable.

---

## Phase 4: User Story 2 - Submit a photo with required metadata (Priority: P2)

**Goal**: Authenticated users can create one-photo submissions with required metadata, private object storage, and an initial queued classification state.

**Independent Test**: Submit a valid JPEG, PNG, or WebP with required metadata as an authenticated user, then verify the photo is privately stored, metadata is persisted, status is `pending_classification`, and a classification job is queued without exposing secrets or image bytes.

### Tests for User Story 2

- [ ] T036 [P] [US2] Add contract tests for `POST /api/submissions/`, `GET /api/submissions/`, and `GET /api/submissions/{id}/` in `tests/contracts/test_submissions_api.py`
- [ ] T037 [P] [US2] Add integration tests for valid photo submission, object storage write of sanitized bytes, database persistence, durable `ClassificationJob` outbox row creation, pending status only when the durable job exists, and RabbitMQ publish failure/retry exhaustion without leaving a pending orphan in `services/main/apps/submissions/tests/test_submission_create.py`
- [ ] T038 [P] [US2] Add validation tests for missing metadata, age outside 0-120 inclusive, description over 1,000 characters, unsupported image type outside JPEG/PNG/WebP, files over 5 MB, empty files, dimensions outside 300x300 through 5000x5000 pixels inclusive before and after normalization, spoofed content type, corrupted image, safe-rewrite failure, accepted format-family preservation, and EXIF/GPS metadata removal in `services/main/apps/submissions/tests/test_submission_validation.py`
- [ ] T039 [P] [US2] Add ownership tests proving users can list and retrieve only their own submissions in `services/main/apps/submissions/tests/test_submission_permissions.py`

### Implementation for User Story 2

- [ ] T040 [US2] Implement the `Submission` model with private photo reference fields, metadata fields, status fields, indexes, constraints, and centralized status transition validation in `services/main/apps/submissions/models.py`
- [ ] T041 [US2] Implement durable `ClassificationJob` outbox model with `submission`, `job_id`, `payload`, `publish_status`, `attempt_count`, `last_error`, `published_at`, `locked_at`, timestamps, and uniqueness/idempotency constraints in `services/main/apps/classification/models.py`
- [ ] T042 [US2] Create initial submissions and classification job outbox migrations with indexes and constraints in `services/main/apps/submissions/migrations/0001_initial.py` and `services/main/apps/classification/migrations/0001_initial.py`
- [ ] T043 [US2] Implement submission storage orchestration, sanitized image byte handling, post-normalization validation, and cleanup behavior for object storage writes in `services/main/apps/submissions/storage_service.py`
- [ ] T044 [US2] Implement submission create/list/retrieve serializers with exact metadata and file validation limits: age 0-120 inclusive, optional description maximum 1,000 characters, JPEG/PNG/WebP only, non-empty files up to 5 MB, and image dimensions from 300x300 through 5000x5000 pixels inclusive in `services/main/apps/submissions/serializers.py`
- [ ] T045 [US2] Implement user-owned submission viewset behavior in `services/main/apps/submissions/views.py`
- [ ] T046 [US2] Wire user submission API routes under `/api/submissions/` in `services/main/apps/submissions/urls.py` and `services/main/config/urls.py`
- [ ] T047 [US2] Implement transactional `ClassificationJob` outbox publisher using Celery/RabbitMQ payload rules, explicit publish status transitions, broker publish-attempt tracking, configured retry scheduling, and retry-exhaustion failure hooks in `services/main/apps/classification/publisher.py`
- [ ] T048 [US2] Integrate durable job creation and outbox publishing into successful submission creation without embedding image bytes, credentials, tokens, or demographic metadata; rollback and clean object storage only when the database transaction or durable job row creation fails in `services/main/apps/submissions/views.py`
- [ ] T049 [US2] Add submission OpenAPI request/response schema details for multipart upload and validation errors in `services/main/apps/submissions/serializers.py`

**Checkpoint**: User Story 2 works independently with authenticated users, sanitized private object storage, a durable outbox job, and unambiguous queue publish failure handling.

---

## Phase 5: User Story 3 - Receive submission-review classification (Priority: P3)

**Goal**: Accepted submissions are classified asynchronously through RabbitMQ/Celery and the internal FastAPI classifier, then stored as normalized submission-review results.

**Independent Test**: Create a valid submission, process the Celery job, call the classifier internally, persist a normalized result, update submission status, and retrieve the latest result through the user submission API.

### Tests for User Story 3

- [ ] T050 [P] [US3] Add classifier API contract tests for `POST /classify` and allowed response schema in `tests/contracts/test_classifier_api.py`
- [ ] T051 [P] [US3] Add deterministic rule-based classifier tests for supported JPEG/PNG/WebP images, empty files, files over 5 MB, images outside 300x300 through 5000x5000 pixels inclusive, invalid files, unsupported types, incomplete metadata, and category priority in `services/classifier/tests/test_rule_based_classifier.py`
- [ ] T052 [P] [US3] Add Celery worker integration tests for successful classification processing in `services/main/apps/classification/tests/test_worker_success.py`
- [ ] T053 [P] [US3] Add worker retry, timeout, malformed response, missing object, deleted-submission race, terminal-submission skip, retry-exhaustion failure, and duplicate delivery tests in `services/main/apps/classification/tests/test_worker_failures.py`
- [ ] T054 [P] [US3] Add status mapping and latest-result persistence tests in `services/main/apps/classification/tests/test_status_mapping.py`
- [ ] T055 [P] [US3] Add persisted idempotency tests proving duplicate `job_id` delivery does not create duplicate `ClassificationResult` rows or advance the latest pointer twice in `services/main/apps/classification/tests/test_worker_idempotency.py`
- [ ] T056 [P] [US3] Add provider selection and rule-based fallback tests in `services/classifier/tests/test_providers.py`
- [ ] T057 [P] [US3] Add Celery routing, retry count, classifier timeout, backoff, jitter, and cap configuration tests in `services/main/apps/classification/tests/test_celery_config.py`

### Cross-Cutting Safety Tests Required Before User Story 3 Implementation

- [ ] T058 [P] [US5] Add safety tests rejecting forbidden inferred trait fields in classifier output, provider metadata, raw responses, and nested provider-specific structures in `tests/safety/test_forbidden_trait_outputs.py`
- [ ] T059 [P] [US5] Add demographic invariance tests proving current and future demographic-like fields do not affect category, decision, score, priority, quality, safety, suitability, or pass/fail outcomes in `tests/safety/test_demographic_invariance.py`
- [ ] T060 [P] [US5] Add worker-to-classifier payload tests proving unnecessary current and future demographic-like metadata, tokens, secrets, object storage credentials, and user/session identifiers are not sent in `tests/safety/test_classifier_payload_minimization.py`
- [ ] T061 [P] [US5] Add storage, API/admin response, raw-response, and logging safety tests for image bytes, signed URLs, passwords, tokens, secrets, raw prompts, provider raw data, and personal metadata in `tests/safety/test_data_exposure.py`

### Implementation for User Story 3

- [ ] T062 [US3] Implement `ClassificationResult` model with persisted `job_id` uniqueness/idempotency fields, sanitized `provider_metadata`/`raw_response` fields, and latest result relationship fields in `services/main/apps/classification/models.py` and `services/main/apps/submissions/models.py`
- [ ] T063 [US3] Create classification result and submission latest-pointer migrations in `services/main/apps/classification/migrations/0002_classification_result.py` and `services/main/apps/submissions/migrations/0002_latest_classification.py`
- [ ] T064 [US3] Implement classifier Pydantic request/response models, enums, and validation rules in `services/classifier/app/schemas.py`
- [ ] T065 [US3] Implement deterministic rule-based submission-review classifier logic with exact limits for JPEG/PNG/WebP support, non-empty files up to 5 MB, image dimensions from 300x300 through 5000x5000 pixels inclusive, incomplete metadata handling, and safe category priority in `services/classifier/app/rules.py`
- [ ] T066 [US3] Implement internal `POST /classify` endpoint using multipart image input and minimal technical metadata in `services/classifier/app/main.py`
- [ ] T067 [US3] Implement classifier provider selection and rule-based fallback behavior in `services/classifier/app/providers.py`
- [ ] T068 [US3] Implement Django worker client for calling the internal classifier with configured timeout handling and minimal allowed technical metadata in `services/main/apps/classification/client.py`
- [ ] T069 [US3] Implement Celery classification task with durable job loading, row-level claim/lock behavior, submission loading, `pending_classification -> classifying` transition, object storage fetch, classifier call, configured retry policy, deleted-submission handling, terminal-state skip, and duplicate-delivery checks in `services/main/apps/classification/tasks.py`
- [ ] T070 [US3] Implement classifier response validation before persistence, including forbidden nested provider fields and sanitized `provider_metadata`/`raw_response` rules, in `services/main/apps/classification/validators.py`
- [ ] T071 [US3] Implement transactional result persistence, unique `job_id`/idempotency handling, latest result pointer update, retry-exhaustion failure mapping, sanitized provider metadata persistence, and state-machine transition enforcement in `services/main/apps/classification/services.py`
- [ ] T072 [US3] Include latest classification result in user submission responses while omitting raw provider data, secrets, signed URLs, image bytes, and unnecessary personal metadata in `services/main/apps/submissions/serializers.py`
- [ ] T073 [US3] Wire Celery task discovery, explicit retry count, timeout, backoff, jitter, and cap settings in `services/main/config/settings.py`

**Checkpoint**: User Story 3 completes the async classification loop without exposing the classifier publicly and with safety tests already in place.

---

## Phase 6: User Story 4 - Review submissions as an admin (Priority: P4)

**Goal**: Admin users can search, filter, and inspect submissions, metadata, photo references, statuses, latest results, and classification history.

**Independent Test**: Log in as staff/admin, list submissions, filter by required metadata and review fields, inspect details and history, and verify non-admin users are denied.

### Tests for User Story 4

- [ ] T074 [P] [US4] Add Django Admin tests for list display, search, filters, readonly/detail fields, response minimization, and classification inline/history behavior in `services/main/apps/submissions/tests/test_admin.py`
- [ ] T075 [P] [US4] Add admin permission tests proving non-admin users cannot access Django Admin views in `services/main/apps/submissions/tests/test_admin_permissions.py`

### Implementation for User Story 4

- [ ] T076 [US4] Register `Submission` and `ClassificationResult` in Django Admin with search, list filters, readonly fields, minimized sensitive/raw fields, and history display in `services/main/apps/submissions/admin.py` and `services/main/apps/classification/admin.py`

**Checkpoint**: User Story 4 supports operational review through Django Admin.

---

## Phase 7: User Story 5 - Preserve safe classification boundaries (Priority: P5)

**Goal**: Classification remains limited to submission review state and never infers forbidden person traits or uses demographic metadata to score acceptability, suitability, quality, safety, priority, or pass/fail outcome.

**Independent Test**: Run classifier, worker, API, and safety tests that fail if forbidden trait fields appear, demographic metadata affects classification, or the classifier receives unnecessary demographic metadata.

**Safety tests for this story are scheduled before User Story 3 implementation in Phase 5 so classifier and worker code are written against those boundaries.**

### Implementation for User Story 5

- [ ] T077 [US5] Implement classifier-side forbidden field, future provider metadata, and submission-review-only guardrails in `services/classifier/app/safety.py`
- [ ] T078 [US5] Integrate classifier safety guardrails into the `POST /classify` response path in `services/classifier/app/main.py`
- [ ] T079 [US5] Implement Django-side safety validation for classifier responses, provider metadata, raw responses, and nested provider-specific fields before persistence in `services/main/apps/classification/validators.py`
- [ ] T080 [US5] Restrict worker classifier requests to image bytes plus allowlisted minimal technical metadata and exclude current or future demographic-like fields in `services/main/apps/classification/client.py`
- [ ] T081 [US5] Add safe logging filters and request ID logging without personal data, image bytes, tokens, credentials, signed URLs, raw provider responses, or raw prompts in `services/main/apps/core/logging.py` and `services/main/config/settings.py`
- [ ] T082 [US5] Document enforced implementation safety gates and test commands in `specs/001-photo-classification-platform/checklists/safety.md` without editing original source documents

**Checkpoint**: Safety boundaries are enforced by early tests and runtime validation, not only by documentation.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Finish deployment readiness, documentation alignment, and end-to-end verification after selected user stories are complete.

- [ ] T083 [P] Add OpenAPI/docs endpoint availability tests in `tests/contracts/test_openapi_docs.py`
- [ ] T084 Add API schema and docs endpoint configuration for generated OpenAPI output in `services/main/config/urls.py` and `services/main/config/settings.py`
- [ ] T085 [P] Create local development and smoke-test instructions aligned with `quickstart.md` in `README.md`
- [ ] T086 [P] Add Kubernetes manifest validation command/check coverage for private classifier, PostgreSQL, RabbitMQ, object storage, and debug console exposure rules in `.github/workflows/ci.yml` before creating manifests under `infra/k8s/`
- [ ] T087 Create Kubernetes manifests for namespace, configmap, secrets placeholders, deployments, private services, public ingress only for Nginx/Django, and migration job under `infra/k8s/`
- [ ] T088 [P] Create Docker Compose smoke test script for auth, upload, async worker processing, latest result retrieval, admin verification, duplicate delivery handling, forbidden trait absence, credential-free rule-based classifier mode, and internal-only classifier exposure in `scripts/smoke_photo_classification_flow.sh`
- [ ] T089 [P] Add database migration check and fixture/factory helpers for CI reliability in `tests/factories.py`
- [ ] T090 [P] Add permanent submission deletion, object deletion failure, retention/audit conflict, and worker-racing-with-deleted-submission tests in `services/main/apps/submissions/tests/test_submission_deletion_retention.py` and `services/main/apps/classification/tests/test_worker_deleted_submission.py`
- [ ] T091 [P] Add provider metadata, raw response, API response, and Django Admin response minimization regression tests in `tests/safety/test_response_data_minimization.py`
- [ ] T092 [P] Add upload responsiveness and nonblocking classification boundary tests proving submission creation does not synchronously call the classifier in `services/main/apps/submissions/tests/test_submission_responsiveness.py`
- [ ] T093 [P] Add worker health, queue depth, retry counter, task state, and safe failure observability tests in `services/main/apps/classification/tests/test_worker_observability.py`
- [ ] T094 Implement permanent deletion and retention orchestration that deletes private photo objects, handles object deletion failures safely, resolves classification-history retention behavior, and skips deleted submissions in worker flows in `services/main/apps/submissions/retention_service.py`, `services/main/apps/submissions/admin.py`, and `services/main/apps/classification/tasks.py`
- [ ] T095 Implement provider metadata/raw-response sanitizer hardening and API/Admin response minimization for classification output in `services/main/apps/classification/validators.py`, `services/main/apps/classification/services.py`, `services/main/apps/submissions/serializers.py`, and `services/main/apps/classification/admin.py`
- [ ] T096 Implement worker health and queue/task observability plus upload-path nonblocking instrumentation in `services/main/apps/classification/health.py`, `services/main/apps/core/views.py`, `services/main/apps/submissions/views.py`, and `services/main/config/urls.py`
- [ ] T097 Run the validation path from `specs/001-photo-classification-platform/quickstart.md` and record any command corrections in `README.md`
- [ ] T098 Run the full CI-equivalent checks from `.github/workflows/ci.yml`, including safety tests and no-external-model-provider-credential validation, and fix failures in the touched implementation files

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Phase 1 and blocks all user stories.
- **User Story 1 (Phase 3)**: Depends on Phase 2 and is the MVP.
- **User Story 2 (Phase 4)**: Depends on Phase 2; real end-to-end use also depends on User Story 1 authentication.
- **User Story 3 (Phase 5)**: Depends on Phase 2 and integrates with User Story 2 submissions; safety tests T058-T061 must be written before classifier and worker implementation tasks T064-T071.
- **User Story 4 (Phase 6)**: Depends on Phase 2 and is most useful after User Stories 2 and 3.
- **User Story 5 (Phase 7)**: Depends on Phase 2; tests T058-T061 are intentionally scheduled before User Story 3 implementation and runtime gates T077-T082 must be complete before final demo or implementation approval.
- **Polish (Phase 8)**: Depends on the selected implemented stories; production-readiness closure tests T090-T093 must precede implementation tasks T094-T096, and final validation tasks T097-T098 run last.

### User Story Dependencies

- **US1 Register and log in**: First MVP increment.
- **US2 Submit a photo**: Can be implemented after foundation, but uses US1 for real authenticated flows.
- **US3 Receive classification**: Requires stored submissions and durable queued jobs from US2.
- **US4 Admin review**: Requires submission data from US2 and benefits from classification data from US3.
- **US5 Safety boundaries**: Cross-cuts US2 and US3; tests T058-T061 run before classifier/worker implementation and runtime gates finish before final acceptance.

### Within Each User Story

- Tests should be written first and should fail before implementation.
- Models and migrations before services.
- Services before API views or worker integration.
- Contracts before endpoint implementation.
- State-machine, durable outbox, and idempotency tests before related model/service implementation.
- Safety tests before classifier and worker implementation.
- Production-readiness closure tests T090-T093 before retention, response-minimization, observability, and responsiveness implementation tasks T094-T096.
- Story checkpoint validation before moving to the next priority when working sequentially.

### Parallel Opportunities

- Setup tasks T002 and T003 can run in parallel after T001; T005-T009 require the directory skeleton from T004 and should be sequenced with the runtime wiring they reference.
- Foundational tests T013-T015 can be written in parallel after T010-T012 create app shells and test fixtures.
- FastAPI shell/schema tasks T023 and T025 can run in parallel after T004 creates `services/classifier/`.
- Tests inside each user story marked `[P]` can be written in parallel after their prerequisite foundation exists: T027-T029, T036-T039, T050-T061, and T074-T075.
- US5 safety tests T058-T061 can be drafted with US3 tests but must be complete before implementation tasks T064-T071 and T080.
- Polish tasks T083, T085, T086, T088, T089, and T090-T093 can run in parallel after core paths exist; T084 follows T083, T087 follows T086, T094-T096 follow their corresponding tests, and T097-T098 run after the implementation tasks they validate.

---

## Parallel Examples

### User Story 1

```text
Task: T027 Add auth contract tests in tests/contracts/test_auth_api.py
Task: T028 Add auth flow integration tests in services/main/apps/accounts/tests/test_auth_flow.py
Task: T029 Add registration permission tests in services/main/apps/accounts/tests/test_registration_permissions.py
```

### User Story 2

```text
Task: T036 Add submission API contract tests in tests/contracts/test_submissions_api.py
Task: T037 Add valid submission, durable outbox, sanitized storage, and queue-publish-failure tests in services/main/apps/submissions/tests/test_submission_create.py
Task: T038 Add upload, metadata validation, and EXIF/GPS stripping tests in services/main/apps/submissions/tests/test_submission_validation.py
Task: T039 Add ownership tests in services/main/apps/submissions/tests/test_submission_permissions.py
```

### User Story 3

```text
Task: T050 Add classifier contract tests in tests/contracts/test_classifier_api.py
Task: T051 Add classifier rule tests for JPEG/PNG/WebP, <=5 MB, non-empty files, 300x300-5000x5000 dimensions, invalid files, and unsupported types in services/classifier/tests/test_rule_based_classifier.py
Task: T052 Add successful worker tests in services/main/apps/classification/tests/test_worker_success.py
Task: T053 Add worker retry, failure, terminal-state skip, and duplicate-delivery tests in services/main/apps/classification/tests/test_worker_failures.py
Task: T055 Add persisted idempotency tests in services/main/apps/classification/tests/test_worker_idempotency.py
Task: T057 Add Celery routing and retry configuration tests in services/main/apps/classification/tests/test_celery_config.py
```

### User Story 5

```text
Task: T058 Add forbidden trait safety tests in tests/safety/test_forbidden_trait_outputs.py
Task: T059 Add demographic invariance tests in tests/safety/test_demographic_invariance.py
Task: T060 Add classifier payload minimization tests in tests/safety/test_classifier_payload_minimization.py
Task: T061 Add data exposure safety tests in tests/safety/test_data_exposure.py
```

### Production Readiness Closure

```text
Task: T090 Add deletion, retention, and deleted-submission worker race tests in services/main/apps/submissions/tests/test_submission_deletion_retention.py and services/main/apps/classification/tests/test_worker_deleted_submission.py
Task: T091 Add provider metadata and response minimization tests in tests/safety/test_response_data_minimization.py
Task: T092 Add upload responsiveness tests in services/main/apps/submissions/tests/test_submission_responsiveness.py
Task: T093 Add worker observability tests in services/main/apps/classification/tests/test_worker_observability.py
```

---

## Implementation Strategy

### MVP First

1. Complete Phase 1 and Phase 2.
2. Complete User Story 1.
3. Stop and validate registration, login, and profile retrieval.
4. Add User Story 2 to create authenticated submissions, sanitized private storage, durable outbox rows, and queued jobs.
5. Add User Story 3 tests and US5 safety tests before implementing classifier and worker logic.
6. Complete User Story 3 async classification and User Story 5 runtime safety gates before final demo.
7. Complete Phase 8 production-readiness closure tasks before running quickstart and CI-equivalent validation.

### Incremental Delivery

1. Foundation ready: service shells, settings, health, test fixtures, Docker Compose.
2. US1 ready: users can register and authenticate.
3. US2 ready: users can submit photos and durable jobs are queued.
4. US3 ready: queued jobs produce normalized classification results idempotently.
5. US4 ready: admins can review and filter submissions in Django Admin.
6. US5 ready: runtime and test safety gates enforce submission-review-only classification.
7. Production readiness ready: deletion/retention, response minimization, observability, responsiveness, quickstart, and CI gates pass.

### Suggested First Scope

For the first implementation pass, complete Phases 1-3, then validate the MVP. Continue to US2 and US3 only after auth and project foundation are stable.

---

## Task Summary

- **Total tasks**: 98
- **Setup**: 9 tasks
- **Foundational**: 17 tasks
- **US1 Register and log in**: 9 tasks
- **US2 Submit a photo**: 14 tasks
- **US3 Receive classification**: 20 tasks
- **US4 Admin review**: 3 tasks
- **US5 Safety boundaries**: 10 tasks
- **Polish**: 16 tasks

All implementation tasks preserve the accepted architecture decisions in `research.md` and the source documents under `supporting-docs/` and `decisions/`.
