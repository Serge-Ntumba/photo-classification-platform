# Quickstart: Photo Classification Platform

**Purpose**: Validation path for the migrated Spec Kit feature. This file describes the expected local and CI verification flow once implementation exists. It does not replace the original documentation in [supporting-docs/](supporting-docs/).

## Prerequisites

Expected local tools:

- Docker and Docker Compose.
- Python runtime matching the implementation pin.
- Access to this repository on branch `001-photo-classification-platform`.

Expected local services through Docker Compose:

- `nginx`
- `web` for Django/DRF
- `worker` for Celery
- `classifier` for FastAPI
- `postgres`
- `rabbitmq`
- `minio`
- optional `minio-init`

## Local Setup Flow

Once implementation files exist, the expected local flow is:

```bash
cp .env.example .env
docker compose build
docker compose up
docker compose exec web python manage.py migrate
docker compose exec web python manage.py createsuperuser
```

Expected local URLs:

```text
Application/API through Nginx:  http://localhost
Django Admin:                   http://localhost/admin/
API docs:                       http://localhost/api/docs/
Main health:                    http://localhost/health
Classifier health:              internal service GET /health
MinIO console, if exposed:      http://localhost:9001
RabbitMQ console, if exposed:   http://localhost:15672
```

MinIO and RabbitMQ consoles are local debugging aids only. They should not be publicly exposed in production.

## Functional Smoke Test

1. Register a normal user through `POST /api/auth/register/`.
2. Log in through `POST /api/auth/login/`.
3. Create a submission through `POST /api/submissions/` with:
   - JPEG, PNG, or WebP photo.
   - `name`
   - `age`
   - `place_of_living`
   - `gender`
   - `country_of_origin`
   - optional `description`
4. Confirm the response contains:
   - submission ID
   - stored metadata
   - private photo object reference
   - `status = pending_classification`
   - `classification = null` or pending equivalent
5. Wait for the Celery worker to process the RabbitMQ job.
6. Retrieve `GET /api/submissions/{id}/`.
7. Confirm the submission has a final or review status and a normalized classification result.
8. Confirm the result uses `classification_type = submission_review`.
9. Confirm the result does not include forbidden person-trait fields.
10. Log in as admin and verify the submission appears in Django Admin.
11. Filter/search by age, gender, place of living, and country of origin.

## Async Processing Validation

Expected successful path:

```text
POST /api/submissions/
  -> Django validates metadata and file
  -> Django stores photo in MinIO/S3-compatible storage
  -> Django stores submission in PostgreSQL
  -> Django publishes RabbitMQ job
  -> Celery worker consumes job
  -> worker fetches photo bytes from object storage
  -> worker calls FastAPI POST /classify
  -> worker validates classifier response
  -> worker stores ClassificationResult through Django ORM
  -> worker updates submission status and latest result pointer
```

Expected safe failure checks:

- Stop classifier temporarily and verify worker retry/failure behavior.
- Submit unsupported file type and verify rejection or safe classification.
- Submit corrupted image and verify `invalid_file` or safe failure.
- Deliver duplicate job and verify no duplicate latest result is created.
- Confirm the classifier is not publicly exposed through Nginx.

## Safety Validation

Run or manually confirm tests that prove:

- Classifier output never infers ethnicity, race, attractiveness, identity, gender, age, nationality, health, religion, political affiliation, social background, economic background, personality, trustworthiness, competence, desirability, or similar traits.
- Classifier output describes submission review state only.
- Demographic metadata is not sent to the classifier by default.
- Demographic metadata does not affect classification score, review decision, suitability, priority, quality, safety, or pass/fail outcome.
- Uploaded photo bytes are stored in object storage, not PostgreSQL.
- PostgreSQL stores private object keys, not permanent public URLs.
- Logs do not contain image bytes, passwords, tokens, storage credentials, signed URLs, or raw secrets.

## Test Commands

Exact commands should be finalized during implementation. The accepted testing strategy expects the following categories:

```bash
python manage.py makemigrations --check --dry-run
python manage.py migrate --check
pytest services/main
pytest services/classifier
pytest tests/contracts
pytest tests/safety
```

Celery-focused tests should use eager mode for most CI runs:

```text
CELERY_TASK_ALWAYS_EAGER=true
CELERY_TASK_EAGER_PROPAGATES=true
```

Docker image checks:

```bash
docker build -t ghcr.io/<owner>/<repo>/web:${GITHUB_SHA} -f services/main/Dockerfile .
docker build -t ghcr.io/<owner>/<repo>/worker:${GITHUB_SHA} -f services/main/Dockerfile .
docker build -t ghcr.io/<owner>/<repo>/classifier:${GITHUB_SHA} -f services/classifier/Dockerfile .
```

## Kubernetes Validation Direction

When Kubernetes manifests exist, CI can validate them without a live cluster using dry-run or schema tools. With cluster credentials configured, the deployment flow should:

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

Production deployment must keep the classifier, PostgreSQL, RabbitMQ, and object storage private. Only the public HTTP entry point should be exposed.

## Spec Kit Next Step

After reviewing this migrated feature directory:

```text
$speckit-tasks
```

Then review:

```text
specs/001-photo-classification-platform/tasks.md
```

Optional consistency pass:

```text
$speckit-analyze
```

Only after reviewing and approving generated tasks:

```text
$speckit-implement
```

Do not run `$speckit-plan` unless you intentionally want Spec Kit to regenerate planning artifacts.
