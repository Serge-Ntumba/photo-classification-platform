# ADR-006: Async Classification Processing

## 1. Status

Accepted.

## 2. Context

The Photo Classification Platform must return a classification result for each uploaded photo/profile submission. A user submits metadata and a photo through the Django/DRF API, and the platform stores the structured metadata in PostgreSQL and the photo in object storage.

Classification may be fast in the first rule-based implementation, but it can become slower, model-provider dependent, or temporarily unavailable as the system evolves. The upload request should not be blocked by classification latency, classifier downtime, external provider failures, or retry behavior.

The system also needs a cloud-deployable architecture that can scale API traffic and classification work independently while preserving clear service boundaries.

## 3. Decision

Use asynchronous classification with RabbitMQ and Celery.

The processing flow is:

1. The Django/DRF API authenticates the user and validates the submitted metadata and photo.
2. Django stores the photo in object storage.
3. Django creates the submission record in PostgreSQL with a pending classification status.
4. Django publishes a classification job to RabbitMQ.
5. A Celery worker consumes the job from RabbitMQ.
6. The worker loads the submission through the Django ORM.
7. The worker fetches the photo from object storage.
8. The worker calls the internal FastAPI classification service.
9. The worker validates the classifier response.
10. The worker saves the classification result through the Django ORM and updates the submission status.

The FastAPI classifier remains stateless. It does not write to PostgreSQL, does not own persistence, and does not need object storage credentials. It only receives classification input from the worker and returns a normalized classification response.

## 4. Alternatives considered

### Alternative 1: Synchronous classification inside the upload request

This approach would run classification logic directly in the upload request handler.

Benefits:

- Simplest request flow.
- Fewer moving parts.
- Easier to implement for a very small prototype.

Drawbacks:

- Upload latency becomes tied to classification latency.
- Classifier failures can cause the entire submission request to fail.
- Retry behavior is harder to manage safely.
- Scaling API traffic and classification work independently is difficult.
- Future model-provider calls would make the upload path less reliable.

This option was rejected because classification has different latency and failure characteristics from normal API validation.

### Alternative 2: Django directly calling FastAPI synchronously

This approach keeps the FastAPI classification service separate but has Django call it during the upload request.

Benefits:

- Keeps a separate classification service boundary.
- Easier than queue-based processing.
- Returns a classification result immediately when the classifier is healthy and fast.

Drawbacks:

- The public API still waits for the classifier.
- Classifier downtime still affects submission creation.
- Timeouts and external provider failures still impact the user-facing request.
- Retries can lead to duplicated request work or poor user experience.

This option was rejected for the final design because it preserves the service boundary but does not solve the responsiveness and resilience problem.

### Alternative 3: Celery with Redis

This approach would use Celery workers with Redis as the broker.

Benefits:

- Common Python/Celery setup.
- Simple local development.
- Redis is lightweight and easy to run in Docker Compose.

Drawbacks:

- Redis is primarily an in-memory data store, not a dedicated message broker.
- Durable job semantics and broker behavior are less explicit than with RabbitMQ.
- RabbitMQ provides a clearer fit for queued work, acknowledgements, and message durability.

This option was considered reasonable for a smaller setup, but rejected in favor of RabbitMQ because classification jobs benefit from a dedicated message broker.

### Alternative 4: Celery with RabbitMQ

This approach uses Celery workers with RabbitMQ as the broker.

Benefits:

- RabbitMQ is a dedicated message broker.
- It supports durable queues, acknowledgements, routing, and reliable job delivery patterns.
- Celery fits naturally with Python and Django.
- Workers can use the Django ORM, models, settings, and transactions safely.
- API replicas, workers, and classifier replicas can scale independently.
- The design is production-like without adding unnecessary domain microservices.

Drawbacks:

- Adds RabbitMQ as another infrastructure dependency.
- Requires explicit retry, timeout, and idempotency handling.
- Local development needs one more container.

This option was accepted because it gives the platform reliable asynchronous processing while keeping the domain model simple.

### Alternative 5: Full event streaming/Kafka

This approach would use Kafka or a similar event streaming platform for classification events.

Benefits:

- Strong fit for high-throughput event streams.
- Good replay and event history capabilities.
- Useful if many downstream consumers need the same events.

Drawbacks:

- Too heavy for the assessment scope.
- Adds significant operational complexity.
- Requires more event design, topic management, consumer coordination, and deployment work.
- The platform needs task/job processing, not a full event-streaming backbone.

This option was rejected because Kafka would be disproportionate for the current requirements.

## 5. Rationale

Asynchronous classification keeps the API responsive. The upload request only needs to authenticate the user, validate the input, store the photo and metadata, create a submission, and enqueue a classification job. Classification then happens outside the user-facing request path.

RabbitMQ is chosen because it is a dedicated message broker with durable job semantics, acknowledgements, and a strong fit for queue-based background processing. Classification jobs should not be treated as incidental in-memory work; they represent required processing that should survive normal worker restarts and temporary service interruptions.

Celery is chosen because it fits naturally with Python and Django. The worker can reuse Django settings, models, validation assumptions, database transactions, and ORM access. This keeps persistence inside the Django application boundary while allowing classification work to run independently from web requests.

This design keeps the architecture honest: there are still two domain microservices, the Django/DRF main service and the FastAPI classification service. RabbitMQ and Celery add processing infrastructure, not extra domain microservices. That gives a production-like architecture without unnecessary service fragmentation.

## 6. Consequences

Positive consequences:

- Upload requests remain fast and predictable.
- Classification latency is isolated from the public API.
- Temporary classifier failures can be retried.
- Django API replicas and Celery workers can scale independently.
- The classifier remains stateless and independently deployable.
- The platform can support future model-provider classification without changing the public submission API.
- Submission status becomes explicit and observable through states such as `pending_classification`, `classifying`, `classified`, `needs_manual_review`, `rejected`, and `classification_failed`.

Tradeoffs:

- The system has more infrastructure than a synchronous-only design.
- RabbitMQ and Celery require operational configuration.
- Users may initially receive a pending status instead of an immediate final classification.
- Retry and idempotency behavior must be implemented carefully.
- Developers must understand the distinction between the Django web process and the Celery worker process.

These tradeoffs are acceptable because they solve a real reliability and scaling problem without splitting the product into unnecessary additional services.

## 7. Failure handling

Classification failures must be explicit and safe.

Retryable failures include:

- Temporary classifier unavailability.
- Classifier request timeout.
- Temporary object storage read failure.
- Temporary RabbitMQ interruption.
- Transient database connection failure.

For retryable failures, the Celery worker should retry with a limited retry count and backoff.

Non-retryable failures include:

- Submission does not exist.
- Photo object key is missing.
- Photo was permanently deleted.
- Classifier response is invalid after repeated attempts.
- The classifier returns a valid rejection result for an invalid image.

For non-retryable failures, the worker should mark the submission as `classification_failed`, `rejected`, or `needs_manual_review`, depending on the failure type and operational policy.

The worker should be idempotent. If a duplicate job is delivered, it should check the current submission state before processing. If the submission is already in a terminal state and no explicit reclassification was requested, the worker should skip the job safely.

Classification result persistence should happen inside a database transaction. The worker should save the classification result, update the submission status, and update the latest-result pointer together so the database does not end up in a partial state.

Logs should include useful operational context, but must not include raw image bytes, raw secrets, access tokens, or unnecessary personal data.

## 8. Scaling implications

The design allows each runtime component to scale according to its workload:

- Scale Django/DRF API replicas for user and admin traffic.
- Scale Celery workers based on queue depth and classification throughput.
- Scale the FastAPI classifier independently if classification becomes CPU-heavy or model-provider backed.
- Keep PostgreSQL, RabbitMQ, and object storage as shared infrastructure with production-appropriate sizing or managed services.

The most likely scaling pressure is classification throughput, not normal API traffic. Using RabbitMQ and Celery gives a clear path to add more workers without changing the public API or the data model.

Queue depth, retry count, classification duration, and failure rate become useful operational signals for future monitoring.

## 9. Why this is not over-engineering for the assessment

This is not over-engineering because the queue and worker solve a specific problem: classification can be slower and less reliable than normal API validation.

The design also supports the assessment requirements directly:

- It demonstrates at least two real application service boundaries.
- It keeps the upload API responsive.
- It gives clear Docker and Kubernetes deployment units.
- It supports retryable background processing.
- It keeps the classifier stateless and replaceable.
- It avoids adding unnecessary domain microservices such as separate auth, upload, admin, metadata, or result services.

RabbitMQ and Celery make the system more production-like without making the domain architecture unnecessarily fragmented. The Django service still owns users, submissions, permissions, persistence, and admin workflows. The FastAPI service still owns only classification logic.

## 10. Future evolution

Future improvements may include:

- Dead-letter queues for permanently failed classification jobs.
- Explicit classification run IDs for stronger idempotency.
- Admin-triggered reclassification.
- Scheduled cleanup or alerting for stale `pending_classification` submissions.
- More detailed classification attempt tracking.
- Separate queues for rule-based and model-provider classification.
- Priority queues for manual-review or admin-triggered jobs.
- Metrics for queue depth, classification latency, retry count, failure rate, and manual-review rate.
- Distributed tracing across Django, Celery, RabbitMQ, and FastAPI.
- Internal service authentication between the worker and classifier.
- Kubernetes network policies restricting which services can call the classifier.
- Managed RabbitMQ or cloud-native queue services in production.

Any future evolution must preserve the core boundary: the FastAPI classifier remains stateless and returns normalized classification results, while the Django application boundary owns persistence, permissions, and submission state.


## 11 Assumptions

- The initial upload response may return `pending_classification` rather than the final classification result.
- The final classification result is retrieved later through the submission detail API or admin panel.
- The default classifier is rule-based and fast, but the architecture should support slower provider-backed classification later.
- RabbitMQ durability depends on configuring durable queues/messages and worker acknowledgements correctly.