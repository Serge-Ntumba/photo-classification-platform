# Testing and CI Strategy

## 1. Purpose

This document describes the testing and CI/CD strategy for the Photo Classification Platform assessment.

The platform uses:

- Django + Django REST Framework as the main application service.
- FastAPI as the classification service.
- Celery workers for asynchronous classification jobs.
- RabbitMQ as the message broker.
- PostgreSQL for relational metadata and classification results.
- MinIO locally, or S3-compatible object storage in production, for uploaded photos.
- Docker Compose for local development and integration testing.
- GitHub Actions for CI/CD.

The goal is to prove that the system is correct, safe, containerized, and cloud-deployable without adding unnecessary testing infrastructure for a take-home assessment.

## 2. Testing Goals

The testing strategy should verify that:

- Users can register and log in.
- Authenticated users can create photo/profile submissions.
- Unauthenticated users cannot create submissions.
- Regular users can only view their own submissions.
- Admin users can search, filter, and review all submissions.
- Uploaded files are validated before processing.
- Metadata validation is enforced.
- Photos are stored in object storage and not in PostgreSQL.
- Classification jobs are published and processed asynchronously.
- The FastAPI classifier returns safe, normalized submission-review results.
- Classification results are persisted through the Django ORM.
- Failed classification jobs move submissions into safe failure states.
- Safety rules prevent person classification and sensitive trait inference.
- Docker images build successfully.
- Docker Compose can run the full local stack.
- Kubernetes deployment manifests can be applied when cluster credentials are available.

The tests should support confidence in the assessment demo and in a technical interview. They do not need to prove full production compliance.

## 3. Test Pyramid

The project should use a practical test pyramid.

| Level | Purpose | Examples |
|---|---|---|
| Unit tests | Fast feedback for isolated logic | Serializer validation, classifier rule ordering, status mapping |
| Service tests | Verify service-level behavior | Django API tests, FastAPI endpoint tests, Celery task tests |
| Contract tests | Verify service-to-service expectations | Worker request to `/classify`, classifier response schema |
| Integration tests | Verify multiple components together | Docker Compose upload-to-classification flow |
| Deployment checks | Verify deployability | Docker build, Kubernetes manifest validation, rollout commands |

Most tests should be unit and service tests. A smaller number of integration tests should cover the complete critical path.

## 4. Django Service Tests

The Django/DRF service owns authentication, submissions, metadata validation, object storage orchestration, admin access, job publishing, and persistence.

### Critical areas to test

- Registration and login.
- User permissions.
- Admin permissions.
- Submission creation.
- Upload validation.
- Metadata validation.
- Storage object key persistence.
- Classification job publishing.
- Submission status transitions.
- Admin filtering and search.

### Example test cases

#### Authentication

- Anonymous user can register with valid email, username, and password.
- Registration rejects duplicate email or username.
- Public registration cannot create `is_staff` or `is_superuser` users.
- Login returns credentials for valid credentials.
- Login returns a generic error for invalid credentials.

#### Submission permissions

- Anonymous user receives `401 Unauthorized` when creating a submission.
- Authenticated user can create a submission with valid metadata and image.
- Authenticated user can list only their own submissions.
- Authenticated user receives `404 Not Found` or `403 Forbidden` when requesting another user's submission.
- Admin user can list all submissions.

#### Admin permission tests

- Non-admin user cannot access `/api/admin/submissions/`.
- Admin user can access `/api/admin/submissions/`.
- Admin user can filter submissions by age.
- Admin user can filter submissions by gender.
- Admin user can filter submissions by place of living.
- Admin user can filter submissions by country of origin.
- Admin user can filter by classification status, category, and review decision where implemented.

#### Upload validation tests

- Missing photo is rejected.
- Empty file is rejected.
- File above `MAX_UPLOAD_SIZE_BYTES` is rejected.
- Unsupported MIME type is rejected.
- Spoofed MIME type with invalid file signature is rejected or classified safely.
- Corrupted image is rejected or classified as `invalid_file`.
- Valid JPEG, PNG, and WebP files are accepted when configured.

#### Metadata validation tests

- Missing `name` is rejected.
- Missing `age` is rejected.
- Missing `place_of_living` is rejected.
- Missing `gender` is rejected.
- Missing `country_of_origin` is rejected.
- Age below configured range is rejected.
- Age above configured range is rejected.
- Overlong description is rejected.

### Expected Django testing tools

Recommended tools:

- `pytest`
- `pytest-django`
- DRF `APIClient`
- Factory helpers such as `factory_boy`, if useful
- Mocked or local S3-compatible storage for most service tests
- Test PostgreSQL in CI for database-backed behavior

## 5. FastAPI Classification Service Tests

The FastAPI classifier owns rule-based submission-review classification. It must remain stateless and must not write to PostgreSQL.

### Critical areas to test

- `/health` returns a healthy response.
- `/classify` accepts valid image bytes and technical metadata.
- `/classify` rejects malformed requests.
- Response shape matches the normalized classification schema.
- Output values are restricted to allowed categories and review decisions.
- The classifier does not return sensitive trait fields.
- Rule priority is deterministic.

### Example classifier test cases

#### Valid submission

Given:

- Supported image type.
- Readable image.
- File size within limit.
- Image dimensions from 300x300 through 5000x5000 pixels inclusive.
- Metadata marked complete.

Expected result:

- `classification_type = submission_review`
- `category = valid_profile_candidate`
- `review_decision = passes_automated_checks`
- `provider = rule_based`

#### Invalid file

Given:

- File bytes cannot be opened as an image.

Expected result:

- `category = invalid_file`
- `review_decision = fails_automated_checks`
- Error code such as `IMAGE_UNREADABLE`

#### Unsupported image type

Given:

- Content type is not in the allowed image types.

Expected result:

- `category = unsupported_image_type`
- `review_decision = fails_automated_checks`

#### Low-quality image

Given:

- Image is readable but dimensions are below the configured threshold.

Expected result:

- `category = low_quality_image`
- `review_decision = needs_manual_review`

#### Incomplete metadata

Given:

- Image is valid.
- `metadata_complete = false`.

Expected result:

- `category = incomplete_metadata`
- `review_decision = needs_manual_review` or `fails_automated_checks`, depending on the configured policy.

### Classification priority-order tests

Classification rules must be ordered so serious or technical failures win over lower-priority review concerns.

Example priority order:

1. Missing or empty file.
2. Unsupported file type.
3. File signature mismatch or suspicious file.
4. Unreadable/corrupted image.
5. Unsafe content, if implemented.
6. Incomplete metadata.
7. Low-quality image.
8. Valid submission.

Critical priority tests:

- A file that is both unsupported and low-quality should return `unsupported_image_type`, not `low_quality_image`.
- A corrupted image with complete metadata should return `invalid_file`, not `valid_profile_candidate`.
- A valid image with incomplete metadata should return `incomplete_metadata`, not `valid_profile_candidate`.
- A suspicious file signature should return `suspicious_file` before any image-quality decision.
- A readable but too-small image should return `low_quality_image` instead of `valid_profile_candidate`.

These tests are important because deterministic rule ordering makes the classifier explainable and defensible.

### Expected FastAPI testing tools

Recommended tools:

- `pytest`
- FastAPI `TestClient`
- Small generated in-memory test images
- Pydantic schema validation tests

## 6. Celery and Background Job Tests

The Celery worker owns asynchronous classification processing. It consumes jobs from RabbitMQ, fetches photos from object storage, calls the classifier, validates the response, saves the classification result, and updates submission status.

### Critical areas to test

- Job is published after successful submission creation.
- Worker loads the correct submission.
- Worker skips already-classified submissions unless reclassification is explicit.
- Worker fetches the photo from object storage.
- Worker calls the classifier with only minimal technical metadata.
- Worker validates classifier output before saving.
- Worker saves `ClassificationResult` through Django ORM.
- Worker updates the submission status based on review decision.
- Worker retries temporary failures.
- Worker marks safe failure state after retry exhaustion.

### Async classification success tests

- Given a submission with `pending_classification`, when the worker receives a job and the classifier returns `passes_automated_checks`, then the worker creates a classification result and sets the submission status to `classified`.
- Given a classifier response with `needs_manual_review`, the worker sets the submission status to `needs_manual_review`.
- Given a classifier response with `fails_automated_checks`, the worker sets the submission status to `rejected`.
- The worker updates the latest classification pointer in the same transaction as saving the result.

### Async classification failure tests

- If the classifier times out, the worker retries the job.
- If object storage temporarily fails, the worker retries the job.
- If the classifier returns malformed JSON, the worker rejects the response and retries or marks failure according to policy.
- If retry limits are exceeded, the submission is marked `classification_failed` or `needs_manual_review` according to policy.
- If the photo object key is missing permanently, the worker marks the submission as `classification_failed`.
- If the submission no longer exists, the worker stops safely and logs the issue.

### Idempotency tests

- Duplicate job for an already terminal submission is skipped.
- Duplicate job does not create duplicate latest results.
- A retry does not corrupt the submission status.
- Classification result and submission status update happen in one database transaction.

### Expected Celery testing approach

For most CI tests, run Celery tasks in eager mode:

```text
CELERY_TASK_ALWAYS_EAGER=true
CELERY_TASK_EAGER_PROPAGATES=true
```

This keeps tests fast and deterministic.

A smaller Docker Compose integration test can run RabbitMQ and a real worker process to prove the real asynchronous path.

## 7. API Contract Tests

API contract tests make sure the Django worker and FastAPI classifier agree on request and response shape.

### Contracts to test

- Django/worker request to FastAPI `/classify`.
- FastAPI normalized classification response.
- Allowed classification categories.
- Allowed review decisions.
- Required fields such as `classification_type`, `category`, `review_decision`, `provider`, `classifier_version`, `schema_version`, and `classified_at`.
- Error response shape for malformed classifier requests.

### Critical contract test cases

- Worker sends `file`, `submission_id`, `content_type`, `size_bytes`, and `metadata_complete`.
- Worker does not send unnecessary demographic metadata such as name, gender, country of origin, or place of living.
- Classifier response contains only allowed enum values.
- Worker rejects unknown `category` values.
- Worker rejects unknown `review_decision` values.
- Worker rejects classifier responses containing unsafe sensitive trait fields.

For the take-home version, these can be implemented as shared schema tests or duplicated enum tests in both services. In production, this could evolve into generated OpenAPI schema checks or consumer-driven contract tests.

## 8. Database and Migration Tests

The project uses PostgreSQL for users, submissions, status fields, and classification results.

### Critical areas to test

- Migrations apply cleanly from an empty database.
- Required fields are enforced.
- Foreign keys enforce ownership relationships.
- Age constraints are enforced.
- Classification result constraints are enforced.
- Indexes exist for required admin filters.
- Latest classification pointer can be updated transactionally.

### Example migration/database tests

- Run `python manage.py migrate --check` in CI.
- Run migrations against a fresh PostgreSQL service in CI.
- Confirm `submissions.user_id` is required.
- Confirm `classification_results.submission_id` is required.
- Confirm age outside the valid range fails validation or database constraint.
- Confirm `classification_results.confidence_score`, if present, stays between configured bounds.
- Confirm status values are limited to known choices at the model layer.
- Confirm admin filtering fields have indexes where expected.

For the assessment, it is enough to verify migrations apply and model constraints behave correctly. Full migration rollback testing can be documented as a production improvement.

## 9. Security and Safety Rule Tests

Safety tests should prove that the platform follows the safety rules described in the project documentation.

### Authentication and authorization tests

- Anonymous users cannot create submissions.
- Regular users cannot access admin endpoints.
- Regular users cannot view other users' submissions.
- Public registration cannot create admins.
- Admin-only views require staff/admin permissions.

### Classification safety tests

- Classifier does not infer ethnicity, race, attractiveness, identity, nationality, gender, age, health, religion, political affiliation, social background, economic background, trustworthiness, competence, or desirability.
- Classifier response schema does not include sensitive trait fields.
- Demographic metadata is not sent to the classifier by default.
- Demographic metadata does not affect classification score or review decision.
- Classification result describes submission review state only.

### Upload and storage safety tests

- Uploaded photos are stored in object storage, not PostgreSQL.
- Database stores object keys, not raw image bytes.
- Permanent public photo URLs are not stored.
- Unsupported files are rejected or classified into safe failure categories.
- Logs do not include raw image bytes, passwords, access tokens, object storage credentials, or signed URLs.

### Configuration safety tests

- `.env` is ignored by Git.
- `.env.example` contains placeholders only.
- Classifier does not require database credentials.
- Classifier does not require object storage credentials.

For the take-home implementation, these tests can be a mix of automated tests and documented checks. Production should add secret scanning, dependency scanning, image scanning, and policy checks.

## 10. Docker Compose Integration Test Strategy

Docker Compose should be used to prove that the full system works together with production-like service boundaries.

### Services involved

- `nginx`
- `web`
- `worker`
- `classifier`
- `postgres`
- `rabbitmq`
- `minio`
- Optional `minio-init`

### Critical integration flow

A minimal end-to-end Docker Compose test should:

1. Start the full stack.
2. Run Django migrations.
3. Create an admin user or test user.
4. Register or authenticate a normal user.
5. Upload a valid image with required metadata.
6. Confirm the submission is created with `pending_classification`.
7. Wait for the Celery worker to process the job.
8. Retrieve the submission.
9. Confirm the submission has a final status and classification result.
10. Confirm the photo object exists in MinIO.
11. Confirm the admin can list/filter the submission.

### Additional Compose integration tests

- Upload invalid file and confirm safe rejection or safe classification result.
- Stop the classifier temporarily and confirm worker retry/failure behavior.
- Confirm the classifier is not exposed through the public Nginx route.
- Confirm RabbitMQ, PostgreSQL, and MinIO are not public application endpoints.

For the assessment, one reliable happy-path integration test plus a few failure-path tests are enough. The goal is to demonstrate real service wiring, not to create a large distributed test suite.

## 11. CI Pipeline Stages

GitHub Actions should run fast validation on pull requests and build/publish images from the main branch.

### Pull request pipeline

Recommended stages:

1. Check out code.
2. Set up Python.
3. Install Django service dependencies.
4. Install FastAPI classifier dependencies.
5. Run formatting check.
6. Run linting.
7. Run type checks, if configured.
8. Run Django unit and API tests.
9. Run FastAPI classifier tests.
10. Run Celery task tests in eager mode.
11. Run migration checks against PostgreSQL.
12. Run API contract tests.
13. Run safety/security rule tests.
14. Build Docker images without pushing.

### Main branch pipeline

Recommended stages:

1. Run all pull request checks.
2. Build Docker images for `web`, `worker`, and `classifier`.
3. Tag images with immutable Git SHA.
4. Push images to GHCR or another registry.
5. Optionally run Docker Compose smoke test.
6. Deploy to Kubernetes if cluster credentials are configured.
7. Run deployment smoke test against `/health`.

### Example CI commands

```bash
python manage.py makemigrations --check --dry-run
python manage.py migrate --check
pytest services/main
pytest services/classifier
pytest tests/contracts
pytest tests/safety
```

Example Docker commands:

```bash
docker build -t ghcr.io/<owner>/<repo>/web:${GITHUB_SHA} -f services/main/Dockerfile .
docker build -t ghcr.io/<owner>/<repo>/worker:${GITHUB_SHA} -f services/main/Dockerfile .
docker build -t ghcr.io/<owner>/<repo>/classifier:${GITHUB_SHA} -f services/classifier/Dockerfile .
```

The worker may use the same image as the Django web service with a different command, because both use the Django codebase and settings.

## 12. Docker Image Build and Push Strategy

Images should be built from CI and pushed only after tests pass.

Recommended images:

```text
ghcr.io/<owner>/<repo>/web:<git-sha>
ghcr.io/<owner>/<repo>/worker:<git-sha>
ghcr.io/<owner>/<repo>/classifier:<git-sha>
```

The `web` and `worker` images may be the same image with different runtime commands:

```text
web:     gunicorn config.wsgi:application
worker:  celery -A config worker --loglevel=info
```

The classifier should be a separate image because it is a separate FastAPI microservice.

Recommended push policy:

- Pull requests build images but do not push.
- Merges to `main` build and push SHA-tagged images.
- Release tags can also produce semver image tags.
- Kubernetes manifests should use immutable SHA tags for reproducible deployments.

Optional production improvements:

- Container vulnerability scanning.
- Software bill of materials generation.
- Image signing.
- Admission policy checks before deployment.

## 13. Kubernetes Deployment Step Strategy

The assessment should include a credible Kubernetes deployment strategy even if no live cluster is attached.

### When cluster credentials are not configured

CI should:

- Build and test the project.
- Build Docker images.
- Optionally push images.
- Validate Kubernetes manifests with tools such as `kubectl --dry-run=client`, `kubeconform`, or `kubeval`, if configured.
- Skip live deployment with a clear CI message.

### When cluster credentials are configured

CI can:

1. Authenticate to the container registry.
2. Authenticate to the Kubernetes cluster.
3. Apply ConfigMaps and Secrets references.
4. Run Django migrations as a Kubernetes Job.
5. Deploy or update `web`, `worker`, and `classifier` deployments.
6. Wait for rollout status.
7. Run a smoke test against the public `/health` endpoint.

Example commands:

```bash
kubectl apply -f infra/k8s/namespace.yaml
kubectl apply -f infra/k8s/configmap.yaml
kubectl apply -f infra/k8s/services/
kubectl apply -f infra/k8s/jobs/migrate.yaml
kubectl wait --for=condition=complete job/django-migrate --timeout=120s
kubectl apply -f infra/k8s/deployments/
kubectl apply -f infra/k8s/ingress.yaml
kubectl rollout status deployment/web
kubectl rollout status deployment/worker
kubectl rollout status deployment/classifier
```

Deployment should fail if migrations fail or if critical workloads do not roll out successfully.

For production, a GitOps tool such as Argo CD, Flux, Helm, or Kustomize could replace direct `kubectl apply` from CI.

## 14. Implemented for Take-Home vs Production Additions

### Implemented for the take-home assessment

The take-home implementation should include:

- Django serializer and permission tests.
- Django API tests for registration, login, submission creation, user-only access, and admin-only access.
- Upload validation tests for missing, oversized, unsupported, and corrupted files.
- FastAPI classifier tests for valid, invalid, unsupported, low-quality, and incomplete submissions.
- Classification priority-order tests.
- Celery task tests in eager mode.
- Async classification success and failure tests.
- Contract tests for worker-to-classifier request/response shape.
- Migration check in CI.
- Docker image build in CI.
- Optional Docker Compose smoke test.
- GitHub Actions workflow for linting, tests, Docker image build, and optional push.
- Documented Kubernetes deployment step.

This is enough to show that the project is testable, containerized, and cloud-deployable.

### Production additions

A production version should add:

- Full Docker Compose end-to-end tests in CI.
- More exhaustive retry and idempotency tests against real RabbitMQ.
- Load tests for upload and classification throughput.
- Security scanning for dependencies and containers.
- Secret scanning in CI.
- Static analysis and type checking enforced as required gates.
- OpenAPI schema compatibility checks.
- Consumer-driven contract tests.
- Kubernetes manifest validation with policy checks.
- Smoke tests after deployment.
- Canary or blue-green deployment strategy.
- Monitoring and alert checks for queue depth, failure rate, and latency.
- Backup and restore tests for PostgreSQL.
- Object storage lifecycle and access policy tests.
- Formal privacy/security regression tests if external model providers are added.

## 15. Summary

The testing and CI strategy is intentionally practical.

The assessment version should prove the critical product path: a user can submit a photo and metadata, the API stores the submission, a classification job is created, the worker calls the classifier, the classification result is persisted, and admins can review and filter the result.

The strategy also proves the most important safety boundaries: users cannot access other users' submissions, admins are protected, uploads are validated, the classifier classifies submission review state only, and internal services remain separate.

This gives enough confidence for the take-home assessment while leaving clear room for production hardening.
