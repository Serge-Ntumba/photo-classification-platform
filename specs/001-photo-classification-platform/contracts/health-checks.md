# Contract: Health Checks

**Sources**: [supporting-docs/api-design.md](../supporting-docs/api-design.md) and [supporting-docs/deployment-strategy.md](../supporting-docs/deployment-strategy.md)

Health checks support Docker Compose, CI smoke tests, and Kubernetes liveness/readiness.

## Django/DRF Main Service

Endpoint:

```http
GET /health
```

Access: public or infrastructure-only depending on deployment choice.

Basic response:

```json
{
  "service": "main-api",
  "status": "ok",
  "version": "1.0.0"
}
```

Recommended split:

- Liveness: Django process is running.
- Readiness: Django can serve traffic and reach critical dependencies.

Readiness may include:

- PostgreSQL connectivity.
- RabbitMQ connectivity.
- Object storage connectivity.

For the first assessment version, a simple readiness check is acceptable if deeper dependency checks are documented as production hardening.

## FastAPI Classification Service

Endpoint:

```http
GET /health
```

Access: internal only.

Basic response:

```json
{
  "service": "classification-api",
  "status": "ok",
  "provider": "rule_based",
  "version": "rules-v1"
}
```

The classifier health check should verify that the service is running and the configured classifier provider is available. In rule-based mode, no external provider secrets should be required.

## Celery Worker

Celery workers do not need an HTTP endpoint in the first version.

Accepted first-version checks:

- Worker process health.
- Worker logs.
- RabbitMQ queue depth.
- Celery task success/failure logs.

Future production options:

- Celery inspect checks.
- Worker health sidecar.
- Metrics on queue depth, task duration, retry count, and failure rate.

## Exposure Rules

- Public users may reach the main public entry point.
- The classifier health endpoint should not be exposed through public ingress.
- PostgreSQL, RabbitMQ, MinIO/S3, worker, and classifier should remain private/internal.
- Production should use ingress/load balancer routing only for public web/API traffic.
