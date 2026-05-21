# Photo Classification Platform

Django/DRF owns the public API, authentication, submissions, object-storage orchestration, PostgreSQL writes, Django Admin, and Celery job publishing. FastAPI owns the internal stateless classifier. Classification is asynchronous through RabbitMQ/Celery and uses the credential-free rule-based classifier by default.

Architecture:

- Current system diagram: [docs/architecture-diagram.md](docs/architecture-diagram.md)
- Architecture notes: [docs/architecture.md](docs/architecture.md)

## Local Development

Prerequisites:

- Docker and Docker Compose
- Python 3.12 if running tests outside Docker

Start the stack:

```bash
cp .env.example .env
docker compose build
docker compose up -d
docker compose exec web python manage.py migrate
docker compose exec web python manage.py createsuperuser
```

Local URLs:

- Application and API: `http://localhost`
- Django Admin: `http://localhost/admin/`
- OpenAPI schema: `http://localhost/api/schema/`
- API docs: `http://localhost/api/docs/`
- Main health: `http://localhost/health`
- Worker observability snapshot: `http://localhost/health/worker`

The classifier, PostgreSQL, RabbitMQ, and MinIO services are internal to the Docker network. The classifier is intentionally not routed through Nginx.

## Validation

Run tests inside Docker after rebuilding the web image:

```bash
docker compose build web classifier
docker compose up -d
docker compose exec web python manage.py migrate
docker compose exec web python -m pytest
```

Run the Phase 8 smoke flow:

```bash
scripts/smoke_photo_classification_flow.sh
```

Useful targeted checks:

```bash
docker compose exec web python manage.py makemigrations --check --dry-run
docker compose exec web python manage.py migrate --check
docker compose exec web python manage.py check
docker compose exec web python -m pytest tests/contracts tests/safety services/main services/classifier
python scripts/validate_k8s_manifests.py
```

The default classifier mode must remain credential-free:

```bash
test "${CLASSIFIER_PROVIDER:-rule_based}" = "rule_based"
test -z "${MODEL_PROVIDER_API_KEY:-}"
```

## Kubernetes

Kubernetes manifests live under `infra/k8s/` and are deployment-oriented placeholders. Replace `ghcr.io/example/...:latest`, hostnames, and `change-me-*` secret values before applying them to a real cluster.

Validate exposure boundaries before deployment:

```bash
python scripts/validate_k8s_manifests.py
```

Expected deployment order, corrected from the quickstart's generic ordering for
these in-cluster placeholder dependency manifests:

```bash
kubectl apply -f infra/k8s/namespace.yaml
kubectl apply -f infra/k8s/configmap.yaml
kubectl apply -f infra/k8s/secrets.yaml
kubectl apply -f infra/k8s/services/
kubectl apply -f infra/k8s/deployments/postgres.yaml
kubectl apply -f infra/k8s/deployments/rabbitmq.yaml
kubectl apply -f infra/k8s/deployments/minio.yaml
kubectl rollout status deployment/postgres -n photo-classification
kubectl rollout status deployment/rabbitmq -n photo-classification
kubectl rollout status deployment/minio -n photo-classification
kubectl apply -f infra/k8s/jobs/migrate.yaml
kubectl wait --for=condition=complete job/django-migrate -n photo-classification --timeout=120s
kubectl apply -f infra/k8s/deployments/web.yaml
kubectl apply -f infra/k8s/deployments/worker.yaml
kubectl apply -f infra/k8s/deployments/classifier.yaml
kubectl apply -f infra/k8s/deployments/nginx.yaml
kubectl apply -f infra/k8s/ingress.yaml
kubectl rollout status deployment/web -n photo-classification
kubectl rollout status deployment/worker -n photo-classification
kubectl rollout status deployment/classifier -n photo-classification
kubectl rollout status deployment/nginx -n photo-classification
```

Only the Nginx/Django public HTTP path should be exposed by ingress. Classifier, PostgreSQL, RabbitMQ, MinIO, and worker surfaces must remain private ClusterIP services.
