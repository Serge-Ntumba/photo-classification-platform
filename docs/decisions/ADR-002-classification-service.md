# ADR-002: Classification Service Boundary

## 1. Status

Accepted.

## 2. Context

The Photo Classification Platform must return a classification result for every submitted photo/profile record. The assessment also requires at least two microservices, Docker-based delivery, and a cloud-deployable architecture.

The exact meaning of “classification” is not fully defined by the assessment. For this implementation, classification means **submission-review classification**: the system evaluates whether a submitted record is technically valid, complete enough for review, and suitable for automated acceptance or manual review.

Classification does **not** mean classifying the person in the photo. The classifier must not infer or return sensitive personal traits such as ethnicity, race, attractiveness, gender, nationality, identity, health status, religion, political affiliation, or social background.

The first implementation should be practical for a take-home assessment. It should work locally, in CI, and in Docker Compose without requiring external AI provider keys. At the same time, the design should leave room for future ML or model-provider classification behind the same service interface.

## 3. Decision

Use a separate **FastAPI classification service** for classification logic.

The classification service will:

- Run as its own containerized microservice.
- Expose a small HTTP API, including `/classify` and `/health`.
- Implement rule-based submission-review classification as the default mode.
- Return a normalized classification response to the main application.
- Keep classification logic separate from authentication, submission ownership, admin access, and database persistence.
- Support a future model-provider classifier behind the same interface.

The Django/DRF main service remains responsible for users, authentication, submissions, metadata validation, object storage orchestration, admin access, and database writes.

For the initial take-home implementation, Django may call the FastAPI classifier synchronously after a submission is accepted and the photo is available. This keeps the first version easier to build, test, and demonstrate.

"Earlier synchronous classification was considered acceptable for a smaller first version, but the final implementation uses RabbitMQ and Celery for asynchronous classification."

An asynchronous worker and queue-based flow can be added later when classification becomes slower, more expensive, or more operationally complex.

## 4. Alternatives considered

### Alternative 1: Put classification inside the Django service

This would place rule-based classification directly inside the Django/DRF main service.

Benefits:

- Simplest implementation.
- Fewer containers and fewer network calls.
- Easier local debugging.
- No service-to-service API needed.

Drawbacks:

- Does not create a meaningful classification service boundary.
- Makes it harder to satisfy the assessment requirement for at least two microservices.
- Couples classification logic to the main application workflow.
- Makes future ML/model-provider classification harder to isolate, scale, and test independently.
- Risks mixing product workflow concerns with classification implementation details.

This option was rejected because classification is a distinct capability and the assessment benefits from a clear second microservice.

### Alternative 2: Separate FastAPI classification service

This creates a dedicated classification microservice with a small, explicit API.

Benefits:

- Satisfies the two-microservice requirement with a real service boundary.
- Keeps classification logic isolated from authentication, admin access, and persistence.
- Makes the classifier independently testable.
- Allows the classification implementation to evolve without changing the main service API.
- Keeps the default rule-based implementation simple while leaving room for a future model provider.
- Allows independent scaling later if classification becomes CPU-heavy or model-backed.

Drawbacks:

- Adds one more container and deployment unit.
- Requires service-to-service communication.
- Requires a normalized request/response contract.
- Adds some operational complexity compared with in-process classification.

This option was accepted because it is practical, defensible, and aligned with the assessment’s microservice requirement.

### Alternative 3: Async worker/queue-based classification

This would use a message broker and worker process for classification.

A typical flow would be:

1. Django accepts the submission.
2. Django stores metadata and the photo reference.
3. Django marks the submission as `pending_classification`.
4. Django publishes a classification job.
5. A worker consumes the job.
6. The worker calls the classification service.
7. The worker stores the classification result and updates the submission status.

Benefits:

- Keeps upload requests responsive.
- Supports retries and timeout handling.
- Allows workers to scale independently from web traffic.
- Better matches production behavior for slow or expensive classification.
- Provides a clean path to dead-letter queues, retry policies, and reclassification jobs.

Drawbacks:

- Adds RabbitMQ/Celery or equivalent infrastructure.
- Adds more moving parts for a take-home assessment.
- Requires more status handling, retry logic, and operational documentation.
- Makes the first implementation harder to complete and demonstrate reliably.

This option is a strong future direction, but it is not required for the first implementation. For the take-home version, synchronous classification is acceptable because the default classifier is rule-based, deterministic, and fast.

## 5. Rationale

A separate FastAPI classification service is useful even when the first classifier is rule-based.

The service boundary makes classification a separate product capability rather than a helper function hidden inside Django. This is important because the classification logic may later change from deterministic rules to a model-provider implementation. The main application should not need to know whether the result came from rules, an internal model, or an external provider. It should only consume a normalized classification result.

FastAPI is a good fit for this service because the classifier is narrow, stateless, and API-oriented. It does not need Django’s ORM, admin interface, authentication system, or permission model. It only needs to accept classification input, apply classification logic, and return a structured result.

The rule-based default is intentional. It avoids external API keys, cost, nondeterminism, and provider outages. It also works in local development, CI, Docker Compose, and Kubernetes demo environments.

Synchronous classification is acceptable for the take-home implementation because the first classifier is expected to be fast. It also keeps the user journey simple to demonstrate: submit a photo and metadata, receive a classification result, and inspect the stored record in the admin panel.

Asynchronous classification can come later when classification becomes slower, when model-provider calls are introduced, or when retry handling becomes important. The separate FastAPI boundary supports that evolution because a future Celery worker can call the same `/classify` endpoint without changing the classifier’s external contract.

## 6. Consequences

Positive consequences:

- The system has two clear application microservices: Django/DRF main service and FastAPI classification service.
- Classification logic is isolated and independently testable.
- The main service remains focused on users, submissions, storage orchestration, admin access, and persistence.
- The classifier can evolve from rule-based logic to model-provider logic behind the same interface.
- The rule-based default keeps local development, CI, and demos reliable.
- The design is easy to explain in a technical interview.

Tradeoffs:

- The system has one extra service to run locally and deploy.
- The main service must handle classifier timeouts and failed classifier responses.
- Synchronous classification can slow down the submission response if classification becomes expensive.
- The first version needs a clear API contract between Django and FastAPI.

Operational consequences:

- The classifier should expose `/health` for readiness and deployment checks.
- Service-to-service calls should use internal Docker/Kubernetes networking.
- The classifier should not expose database credentials.
- The classifier should not own submission persistence.
- The classifier should avoid logging image bytes, sensitive metadata, or raw provider responses.
- The Django service should validate and store only normalized classification results.

## 7. Current implementation

The current implementation uses a separate FastAPI classification service with rule-based submission-review classification.

The service exposes:

```http
POST /classify
GET /health
```

The default classifier evaluates safe, deterministic signals such as:

- Whether the uploaded file exists.
- Whether the file type is supported.
- Whether the file can be processed as an image.
- Whether the image dimensions are within configured limits.
- Whether required metadata is present.
- Whether metadata values pass basic validation.
- Whether the submission should pass automated checks, fail automated checks, or require manual review.

The classifier returns normalized fields such as:

```text
classification_type
category
review_decision
score
reasons
provider
classifier_version
schema_version
classified_at
```

Example categories:

```text
valid_profile_candidate
invalid_file
unsupported_image_type
suspicious_file
low_quality_image
incomplete_metadata
non_profile_image
unsafe_content
```

Example review decisions:

```text
passes_automated_checks
fails_automated_checks
needs_manual_review
```

The classifier does not infer personal traits from the photo. User-provided demographic metadata may be stored and used for validation, display, and admin filtering, but it must not be used to judge whether a person is acceptable or suitable.

The Django/DRF service is responsible for calling the classifier, saving the normalized classification result in PostgreSQL, and exposing the result through the user and admin workflows.

## 8. Future evolution

The classification design can evolve without changing the main service’s core responsibilities.

Possible future improvements:

- Add RabbitMQ and Celery for asynchronous classification jobs.
- Store submissions first with status `pending_classification`.
- Let a Celery worker call the same FastAPI `/classify` endpoint.
- Add retry policies for temporary classifier failures.
- Add timeout handling and a safe `classification_failed` or `needs_manual_review` state.
- Add idempotency keys to avoid duplicate classification results during retries.
- Add dead-letter queue handling for permanently failed jobs.
- Add a model-provider classifier behind the same normalized interface.
- Add provider fallback behavior from model-provider mode to rule-based mode.
- Add classification versioning and reclassification support.
- Add admin filters for classification category, review decision, provider, and classification timestamp.

Any future model-provider implementation must preserve the same safety boundary: the platform classifies the submission review state, not the person in the photo. It must not infer sensitive personal traits, identify the person, or use demographic metadata to score suitability.

# Note Important
"Earlier synchronous classification was considered acceptable for a smaller first version, but the final implementation uses RabbitMQ and Celery for asynchronous classification."