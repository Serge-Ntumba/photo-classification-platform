# ADR-001: Main Service Framework

## 1. Status

Accepted.

## 2. Context

The Photo Classification Platform requires a Python backend that can support user registration, login, authenticated photo submissions, metadata validation, relational persistence, admin-only access, filtering, searching, API documentation, and security controls.

The main service is responsible for the core application workflow: users create submissions, photos are stored in object storage, metadata is stored in PostgreSQL, and classification jobs are published for asynchronous processing.

These responsibilities are application and data ownership concerns. Authentication, permissions, validation, persistence, and admin review all depend on the same core domain model.

The assessment also expects clear API design, validation, documentation, schema design, migrations, indexing, security awareness, Docker support, and a cloud-deployable architecture.

## 3. Decision

Use **Django + Django REST Framework** for the main service.

The Django/DRF main service will own:

- User registration and login.
- Authentication and authorization.
- Submission creation.
- Metadata validation.
- Upload orchestration.
- Writing submission records to PostgreSQL.
- Uploading photos to MinIO/S3-compatible storage.
- Publishing classification jobs to RabbitMQ.
- Exposing API documentation through OpenAPI, for example with DRF Spectacular.
- Providing Django Admin as the admin panel.
- Enforcing admin-only access to review workflows.

The FastAPI classification service remains a separate microservice focused only on classification logic.

## 4. Alternatives considered

### Alternative 1: FastAPI-only main service

A FastAPI-only main service would provide a lightweight API layer and strong support for explicit request/response schemas.

This was rejected for the main service because the platform needs built-in support for authentication, authorization, admin review, database-backed models, migrations, filtering, and operational CRUD workflows. These features can be built with FastAPI, but doing so would require additional libraries and more custom application code.

FastAPI is still a good fit for the separate classification service because that service is stateless, narrow in scope, and does not own users, admin behavior, or database writes.

### Alternative 2: Django + DRF

Django + DRF provides a practical default for the main application service.

It includes mature support for authentication, permissions, ORM models, migrations, validation, admin tooling, and REST API development. Django Admin also satisfies the assessment requirement for an admin panel that can search, filter, and review submitted records without building unnecessary custom frontend complexity.

This option was accepted.

### Alternative 3: Separate frontend/admin service

A separate custom admin service or frontend could provide a more tailored review experience.

This was rejected for the first version because the assessment does not require a custom admin UI. Splitting admin behavior into another service would add extra authentication integration, authorization logic, APIs, deployment configuration, and testing burden.

Django Admin is sufficient for the take-home scope and can be replaced or extended later if the product needs a custom review experience.

## 5. Rationale

Django + DRF is the right choice for the main service because the main service owns the core domain model and workflow.

The platform needs one authoritative place for:

- User identity.
- Submission ownership.
- Metadata validation.
- Permission checks.
- Database writes.
- Admin review.
- API behavior.
- Job publishing.

Keeping these responsibilities together avoids duplicated validation, fragmented permissions, and unclear data ownership.

Django also provides a strong implementation path for the assessment:

- Django ORM and migrations support relational schema design.
- Django permissions and staff flags support admin-only access.
- Django Admin supports filtering, searching, and record inspection.
- DRF supports clear API endpoints and serializer validation.
- DRF Spectacular can expose OpenAPI documentation.
- The service can run cleanly in Docker Compose and Kubernetes.

This keeps the architecture practical, buildable, and defensible in a technical interview.

## 6. Consequences

Positive consequences:

- Faster implementation of authentication, permissions, admin review, and database-backed workflows.
- Clear ownership of users, submissions, metadata, and classification result persistence.
- Less custom code for common backend platform features.
- Built-in migration support for PostgreSQL schema evolution.
- Django Admin provides an immediately usable admin panel.
- DRF provides structured API development and validation.
- The main service remains easy to explain as the owner of application state.

Tradeoffs:

- Django is heavier than a minimal FastAPI service.
- Some Django conventions must be followed to keep the codebase maintainable.
- Django Admin is functional but less tailored than a custom admin frontend.
- Care is needed to keep classification logic out of the main service and inside the classifier boundary.

These tradeoffs are acceptable because the main service has broad application ownership responsibilities, while the classification service remains small and focused.

## 7. How this supports the assessment

This decision directly supports the assessment requirements.

Django + DRF helps deliver:

- User registration and login.
- Authenticated photo submissions.
- Metadata validation.
- PostgreSQL-backed persistence.
- Schema migrations.
- Admin-only access.
- Admin filtering and search.
- API documentation through OpenAPI.
- Security controls around users, submissions, and admin workflows.
- A Python backend that is practical to containerize and deploy.

Using Django + DRF for the main service and FastAPI for the classification service also satisfies the microservice requirement with two clear application service boundaries:

1. The Django/DRF main service owns the product workflow and data.
2. The FastAPI classification service owns classification logic.

This provides enough service separation to demonstrate cloud-ready architecture without over-engineering the take-home project.