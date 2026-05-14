# Deployment Strategy

## 1. Purpose

This document explains the deployment strategy for the Photo Classification Platform.

The assessment requires the project to be containerized, runnable locally, and cloud-deployable. This document describes:

- How the platform runs locally with Docker Compose.
- How the platform would be deployed to Kubernetes.
- How environment configuration, secrets, scaling, health checks, observability, and CI/CD are handled.
- What is included in the take-home assessment and what would be added in a production deployment.

This is a **deployable strategy** for a take-home assessment. It does not assume that a live production Kubernetes cluster is already running. If Kubernetes cluster credentials are configured in CI/CD, the deployment step can apply the manifests and roll out the services.

## 2. Deployment Assumptions

The deployment strategy uses the following assumptions:

- Docker Compose is used for local development and demonstration.
- Kubernetes manifests are included to show a cloud deployment strategy.
- PostgreSQL runs locally in Docker for development.
- Production should use managed PostgreSQL where possible.
- MinIO runs locally in Docker as S3-compatible object storage.
- Production should use S3 or another managed S3-compatible object storage provider.
- RabbitMQ runs locally in Docker and may be self-hosted or managed in production.
- GitHub Actions is used for CI/CD.
- Docker images are pushed to GHCR or another container registry.
- The FastAPI classifier is an internal service and is not exposed publicly.
- Nginx is the public entry point locally; in Kubernetes, ingress can replace or sit in front of Nginx depending on deployment choice.

## 3. Local Development Strategy

Local development uses Docker Compose so the full platform can run on a developer machine with production-like service boundaries.

The local setup should support:

- User registration and login through the Django/DRF service.
- Photo upload and metadata submission.
- Photo storage in MinIO.
- Metadata and classification result storage in PostgreSQL.
- Classification job publishing through RabbitMQ.
- Asynchronous classification through Celery.
- Internal classification through the FastAPI classifier.
- Admin review through Django Admin.
- Public routing through Nginx.

The goal of the local environment is not to duplicate production perfectly. The goal is to make the full system easy to run, test, and demonstrate.

A typical local workflow is:

```bash
cp .env.example .env
docker compose build
docker compose up
docker compose exec web python manage.py migrate
docker compose exec web python manage.py createsuperuser
```

After startup, the user should be able to access:

```text
Application/API through Nginx:  http://localhost
Django Admin:                   http://localhost/admin/
API docs:                       http://localhost/api/docs/
MinIO console, if exposed:       http://localhost:9001
RabbitMQ console, if exposed:    http://localhost:15672
```

MinIO and RabbitMQ management consoles are useful for local debugging, but they should not be publicly exposed in production.

## 4. Docker Compose Services

The local `docker-compose.yml` should include the following services.

| Service | Purpose | Public locally? |
|---|---|---:|
| `nginx` | Reverse proxy and local public entry point | Yes |
| `web` | Django/DRF main application service | Behind Nginx |
| `worker` | Celery worker for classification jobs | No |
| `classifier` | FastAPI classification service | No |
| `postgres` | Local PostgreSQL database | No, except optional local port binding |
| `rabbitmq` | Message broker for Celery jobs | No, except optional management UI |
| `minio` | Local S3-compatible object storage | No, except optional local console |
| `minio-init` | Optional bucket creation/bootstrap container | No |

### Service responsibilities

#### `nginx`

Nginx receives local HTTP traffic and routes it to the Django/DRF service.

It can also enforce request size limits for uploads.

#### `web`

The Django/DRF service owns:

- Authentication.
- User registration and login.
- Submission APIs.
- Metadata validation.
- Upload orchestration.
- PostgreSQL writes.
- Object storage writes.
- Classification job publishing.
- Django Admin.
- OpenAPI documentation.

#### `worker`

The Celery worker:

- Consumes jobs from RabbitMQ.
- Fetches uploaded photos from MinIO/S3.
- Sends image bytes to the classifier.
- Validates the classifier response.
- Saves classification results through the Django application layer.
- Updates submission status.

#### `classifier`

The FastAPI classifier:

- Exposes `/classify`.
- Exposes `/health`.
- Performs rule-based classification by default.
- Does not own authentication.
- Does not write to PostgreSQL.
- Does not receive object storage credentials.
- Is called only by the Celery worker.

#### `postgres`

PostgreSQL stores:

- Users.
- Submissions.
- Classification results.
- Status fields.
- Timestamps.
- Audit-friendly structured data.

#### `rabbitmq`

RabbitMQ decouples submission creation from classification processing.

This prevents upload requests from being blocked by classification work.

#### `minio`

MinIO stores uploaded photos locally using an S3-compatible interface.

Production should use S3 or another managed S3-compatible storage provider.

## 5. Environment Configuration

Configuration should be provided through environment variables.

The repository should include `.env.example` with safe placeholder values. The real `.env` file should not be committed.

### Common environment variables

| Variable | Used by | Purpose |
|---|---|---|
| `DJANGO_SECRET_KEY` | `web`, `worker` | Django cryptographic secret |
| `DJANGO_DEBUG` | `web`, `worker` | Enables/disables debug behavior |
| `DJANGO_ALLOWED_HOSTS` | `web` | Allowed hostnames |
| `DATABASE_URL` | `web`, `worker` | PostgreSQL connection string |
| `CELERY_BROKER_URL` | `web`, `worker` | RabbitMQ broker URL |
| `CELERY_RESULT_BACKEND` | `worker` | Optional Celery result backend |
| `CLASSIFIER_URL` | `worker` | Internal URL for FastAPI classifier |
| `OBJECT_STORAGE_ENDPOINT` | `web`, `worker` | MinIO/S3 endpoint |
| `OBJECT_STORAGE_BUCKET` | `web`, `worker` | Bucket for uploaded photos |
| `OBJECT_STORAGE_ACCESS_KEY` | `web`, `worker` | Object storage access key |
| `OBJECT_STORAGE_SECRET_KEY` | `web`, `worker` | Object storage secret key |
| `OBJECT_STORAGE_REGION` | `web`, `worker` | S3 region, if needed |
| `OBJECT_STORAGE_USE_SSL` | `web`, `worker` | Whether object storage uses TLS |
| `MAX_UPLOAD_SIZE_BYTES` | `web`, `classifier` | Upload size limit |
| `ALLOWED_IMAGE_TYPES` | `web`, `classifier` | Allowed image MIME types |
| `CLASSIFIER_PROVIDER` | `classifier` | `rule_based` by default |
| `CLASSIFIER_VERSION` | `classifier` | Rule/model version |
| `LOG_LEVEL` | all services | Logging verbosity |

### Configuration principles

- Keep configuration out of source code.
- Commit `.env.example`, not `.env`.
- Use safe defaults for local development.
- Use Kubernetes Secrets for sensitive production values.
- Give each service only the configuration it needs.
- Do not provide PostgreSQL or object storage credentials to the classifier.

## 6. Production Kubernetes Strategy

The Kubernetes strategy separates stateless application services from stateful infrastructure.

Recommended production approach:

- Run Django/DRF, Celery worker, and FastAPI classifier as Kubernetes workloads.
- Use managed PostgreSQL instead of running PostgreSQL in the cluster.
- Use managed S3-compatible object storage instead of running MinIO in the cluster.
- Use managed RabbitMQ if available, or deploy RabbitMQ with a trusted Helm chart.
- Expose only the public HTTP entry point through Ingress.
- Keep the classifier, database, broker, and object storage access internal/private.
- Store secrets in Kubernetes Secrets or an external secret manager.
- Run database migrations as a release step or Kubernetes Job before rolling out the new web containers.

For the take-home assessment, Kubernetes manifests can demonstrate this strategy even if no live cluster is attached.

## 7. Kubernetes Resources Needed

The deployment can be represented with standard Kubernetes resources.

| Resource | Component | Purpose |
|---|---|---|
| `Deployment` | `web` | Runs Django/DRF web replicas |
| `Deployment` | `worker` | Runs Celery workers |
| `Deployment` | `classifier` | Runs FastAPI classifier replicas |
| `Service` | `web` | Internal stable address for Django/DRF |
| `Service` | `classifier` | Internal stable address for FastAPI |
| `Ingress` | public HTTP | Routes public traffic to web/Nginx |
| `ConfigMap` | app config | Non-sensitive configuration |
| `Secret` | credentials | Database, broker, Django, and object storage secrets |
| `Job` | migrations | Runs Django migrations before deployment |
| `HorizontalPodAutoscaler` | optional | Scales web, worker, or classifier based on load |
| `NetworkPolicy` | optional first version, recommended production | Restricts internal service communication |
| `ServiceAccount` | workloads | Allows controlled workload identity where supported |

### Optional local/demo Kubernetes resources

For a local Kubernetes demo, such as kind or minikube, the repository may include optional manifests for:

- PostgreSQL.
- MinIO.
- RabbitMQ.
- PersistentVolumeClaims for local stateful services.

These are useful for demonstration, but production should prefer managed infrastructure.

## 8. Kubernetes Traffic Flow

Production traffic should follow this path:

```text
Browser / Client
    ↓
Ingress / Load Balancer
    ↓
Nginx or Django/DRF web service
    ↓
PostgreSQL, object storage, RabbitMQ as private dependencies
```

Classification flow:

```text
Django/DRF web service
    ↓ publishes job
RabbitMQ
    ↓ consumed by
Celery worker
    ↓ fetches photo
S3-compatible object storage
    ↓ sends image bytes
FastAPI classifier
    ↓ returns normalized result
Celery worker
    ↓ saves result
PostgreSQL through Django application layer
```

The classifier should not be reachable from the public internet.

## 9. Scaling Strategy

The system can scale by component.

| Component | Scaling approach | Reason |
|---|---|---|
| `web` | Increase replicas behind Service/Ingress | Handles more API and admin traffic |
| `worker` | Increase Celery worker replicas | Handles more classification jobs |
| `classifier` | Increase replicas | Handles more classification requests from workers |
| PostgreSQL | Use managed database sizing, read replicas if needed later | Stores relational metadata and results |
| RabbitMQ | Use managed broker or clustered deployment if needed | Buffers classification jobs |
| Object storage | Use managed S3-compatible storage | Avoids local disk dependence |

Most likely scaling pressure is classification throughput. The architecture supports this by separating:

- Web request handling.
- Queue processing.
- Classification execution.

A practical first scaling strategy:

1. Scale `web` replicas for API/admin traffic.
2. Scale `worker` replicas for queue backlog.
3. Scale `classifier` replicas if workers are waiting on classifier responses.
4. Increase managed PostgreSQL and RabbitMQ capacity only when metrics show bottlenecks.

## 10. Secrets Strategy

Secrets must not be committed to the repository.

### Local development

Local development uses:

```text
.env
```

The repository commits only:

```text
.env.example
```

The local `.env` can contain development-only credentials.

### Kubernetes

Kubernetes deployment should use:

- Kubernetes Secrets for sensitive values.
- ConfigMaps for non-sensitive values.
- External secret managers in production where available.

Sensitive values include:

- `DJANGO_SECRET_KEY`
- PostgreSQL username/password
- RabbitMQ username/password
- Object storage access key and secret key
- Optional model-provider API keys
- Registry pull secrets, if needed

The classifier should not receive database credentials or object storage credentials.

### Production improvement

In production, prefer:

- Cloud IAM roles or workload identity instead of long-lived static keys.
- External secret manager integration.
- Secret rotation.
- CI secret scanning.
- Restricted access to deployment secrets.

## 11. Observability Strategy

The take-home implementation should include basic observability without adding unnecessary infrastructure.

### Included in the assessment version

- Structured logs from Django/DRF.
- Structured logs from Celery worker.
- Structured logs from FastAPI classifier.
- Nginx access logs.
- Health endpoints for web and classifier.
- Submission status fields visible to admins.
- Celery task success/failure logs.
- Request IDs where practical.

### Useful signals

| Signal | Why it matters |
|---|---|
| API request count and error rate | Shows whether the public service is healthy |
| Upload validation failures | Helps debug rejected submissions |
| Classification job failures | Shows worker/classifier problems |
| Queue depth | Shows whether workers are keeping up |
| Classification duration | Shows classifier performance |
| Database errors | Shows persistence problems |
| Object storage errors | Shows photo storage/fetching problems |

### Production improvement

Production observability should add:

- Centralized logging.
- Metrics collection with Prometheus or managed monitoring.
- Dashboards for API, worker, queue, classifier, and database health.
- Alerts for queue backlog, high error rate, failed migrations, and classifier failures.
- Distributed tracing if request flow becomes difficult to debug.

## 12. Health Checks and Readiness Checks

Health checks should support both local Docker Compose and Kubernetes.

### Django/DRF service

Recommended endpoint:

```text
GET /health
```

Basic response:

```json
{
  "service": "main-api",
  "status": "ok",
  "version": "1.0.0"
}
```

Recommended checks:

| Check type | Meaning |
|---|---|
| Liveness | The Django process is running |
| Readiness | Django can serve traffic and reach critical dependencies |

Readiness may check:

- PostgreSQL connectivity.
- RabbitMQ connectivity.
- Object storage connectivity.

For the first assessment version, it is acceptable to keep readiness simple and document deeper dependency checks as production hardening.

### FastAPI classifier

Recommended endpoint:

```text
GET /health
```

Basic response:

```json
{
  "service": "classification-api",
  "status": "ok",
  "provider": "rule_based",
  "version": "rules-v1"
}
```

The classifier health check should confirm that the service is running and that the configured classifier provider is available.

### Celery worker

Celery workers do not usually expose HTTP endpoints by default.

Practical first-version options:

- Rely on worker process health.
- Use logs to confirm task consumption.
- Use RabbitMQ queue depth to confirm worker throughput.

Production options:

- Add a worker health sidecar.
- Use Celery inspect commands.
- Monitor queue depth and task failure rate.

## 13. CI/CD Deployment Flow

GitHub Actions should automate validation and image publishing.

### Pull request workflow

For pull requests:

1. Check out code.
2. Set up Python.
3. Install dependencies.
4. Run linting.
5. Run unit tests.
6. Run API/schema checks where practical.
7. Optionally build Docker images without pushing.

### Main branch workflow

For merges to `main`:

1. Check out code.
2. Run linting and tests.
3. Build Docker images for:
   - Django/DRF web service.
   - FastAPI classifier.
   - Celery worker, if packaged separately.
4. Tag images with:
   - Git commit SHA.
   - Branch name or release tag.
   - Optional `latest` for main branch.
5. Push images to GHCR or another registry.
6. Deploy to Kubernetes if cluster credentials are configured.

### Deployment step when cluster credentials are configured

When Kubernetes credentials are available in GitHub Actions, the deployment step can:

1. Authenticate to the Kubernetes cluster.
2. Authenticate to the container registry if needed.
3. Render or select the Kubernetes manifests.
4. Update image tags to the newly built commit SHA.
5. Apply Kubernetes manifests.
6. Run the database migration Job.
7. Roll out the `web`, `worker`, and `classifier` deployments.
8. Wait for rollout status.
9. Optionally run a smoke test against `/health`.

Example deployment commands:

```bash
kubectl apply -f infra/k8s/namespace.yaml
kubectl apply -f infra/k8s/configmap.yaml
kubectl apply -f infra/k8s/secrets.yaml
kubectl apply -f infra/k8s/services/
kubectl apply -f infra/k8s/jobs/migrate.yaml
kubectl wait --for=condition=complete job/django-migrate --timeout=120s
kubectl apply -f infra/k8s/deployments/
kubectl apply -f infra/k8s/ingress.yaml
kubectl rollout status deployment/web
kubectl rollout status deployment/worker
kubectl rollout status deployment/classifier
```

In a more mature setup, Kustomize, Helm, or a GitOps tool such as Argo CD could manage manifest rendering and rollout.

## 14. Image Tagging Strategy

Images should be tagged with immutable identifiers.

Recommended tags:

```text
ghcr.io/<owner>/<repo>/web:<git-sha>
ghcr.io/<owner>/<repo>/worker:<git-sha>
ghcr.io/<owner>/<repo>/classifier:<git-sha>
```

Optional convenience tags:

```text
ghcr.io/<owner>/<repo>/web:main
ghcr.io/<owner>/<repo>/classifier:main
```

Kubernetes manifests should use immutable SHA tags for reproducible deployments.

## 15. Database Migration Strategy

Django migrations should be committed to the repository.

Local development:

```bash
docker compose exec web python manage.py migrate
```

Kubernetes:

- Run migrations as a Kubernetes Job before rolling out the new web deployment.
- Fail the deployment if migrations fail.
- Avoid running migrations automatically in every web container startup unless intentionally chosen.

This makes schema changes explicit and easier to debug.

## 16. Known Limitations of the Take-Home Deployment

The take-home deployment is intentionally practical, not fully production-grade.

Known limitations:

- A live Kubernetes cluster may not be included.
- Kubernetes manifests demonstrate deployability but may require cluster-specific values.
- PostgreSQL runs in Docker locally, while production should use managed PostgreSQL.
- MinIO runs locally, while production should use managed S3-compatible object storage.
- RabbitMQ may be local only unless a production broker is configured.
- TLS/HTTPS may be documented but not enabled in local Docker Compose.
- Advanced network policies may be documented but not fully enforced locally.
- Basic logs and health checks are included, but a full monitoring stack is not required.
- CI/CD may build and push images even if deployment is skipped without cluster credentials.
- External model-provider integration is not required for the first version.
- The classifier is rule-based by default.

These limitations are acceptable for the assessment because the goal is to show a working local system and a credible cloud deployment strategy.

## 17. Future Production Hardening

Production hardening should include:

- HTTPS enforcement with managed certificates.
- Kubernetes NetworkPolicies.
- Managed PostgreSQL with automated backups.
- Managed RabbitMQ or equivalent broker.
- Managed S3-compatible object storage with encryption and access logging.
- External secret manager integration.
- Secret rotation.
- Image vulnerability scanning.
- Dependency scanning.
- Container runtime security policies.
- Pod security standards.
- Resource requests and limits for all workloads.
- HorizontalPodAutoscalers for web, worker, and classifier.
- Centralized logs and metrics.
- Alerts for queue backlog, high error rates, failed jobs, and failed migrations.
- Dead-letter queues for failed classification jobs.
- Admin audit logs.
- Rate limiting.
- Web application firewall, if exposed publicly.
- Data retention and deletion workflows.
- Backup and restore testing.
- Disaster recovery plan.
- Formal privacy and security review before handling real production users.

## 18. Summary

The deployment strategy is designed to satisfy the assessment without over-engineering the project.

Docker Compose provides a complete local development and demonstration environment. Kubernetes manifests describe how the same services can be deployed to a cloud environment. GitHub Actions validates the code, builds Docker images, pushes them to a registry, and can deploy to Kubernetes when cluster credentials are configured.

The strategy is honest about the take-home scope: it includes a deployable architecture and deployment path, but not necessarily a live production cluster.
