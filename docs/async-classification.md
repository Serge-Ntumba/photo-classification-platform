# Async Classification

## 1. Purpose

The Photo Classification Platform uses asynchronous classification so that photo submissions can be accepted quickly while classification work happens in a separate worker process.

When a user uploads a photo and metadata, the Django/DRF API validates and stores the submission first. It then publishes a classification job to RabbitMQ. A Celery worker later consumes the job, fetches the uploaded photo from object storage, calls the FastAPI classification service, and stores the normalized result through the Django ORM.

This design keeps the upload API responsive and isolates classification latency, retries, and failures from the user-facing request path.

The classifier classifies the **submission review state**, not the person in the photo. It returns an operational result such as whether the submission passes automated checks, fails automated checks, or needs manual review.

## 2. Why classification is not done inside the upload request

Classification is not performed directly inside the upload request because classification may become slower, less reliable, or more expensive than normal API validation.

Even if the first classifier is rule-based and fast, keeping classification asynchronous provides a safer and more cloud-ready architecture:

- The upload request does not need to wait for classifier processing.
- Temporary classifier failures do not cause the entire submission flow to fail.
- Classification work can be retried without asking the user to upload again.
- Web/API traffic and classification workload can scale independently.
- A future model-backed classifier can be introduced without changing the public submission API.
- The system can show clear intermediate states such as `pending_classification` or `classification_failed`.

The upload request is responsible for accepting a valid submission. The worker is responsible for completing classification.

## 3. Component responsibilities

### Django/DRF API

The Django/DRF service owns the product workflow and application data model.

Responsibilities:

- Authenticate the user.
- Validate metadata and uploaded file constraints.
- Store submission metadata in PostgreSQL.
- Store the uploaded photo in MinIO or S3-compatible object storage.
- Create the submission with `classification_status=pending_classification`.
- Publish a classification job to RabbitMQ.
- Expose submission and classification status through user and admin APIs.
- Enforce authorization rules for users and admins.

Django owns the database schema and all persistent application records. Classification results are saved through Django models, not directly by the classifier service.

### RabbitMQ

RabbitMQ is the message broker used to decouple submission creation from classification processing.

Responsibilities:

- Store classification jobs until workers are ready to process them.
- Buffer classification work during traffic spikes.
- Allow workers to retry failed jobs.
- Keep the Django API from directly depending on classifier availability during the upload request.

RabbitMQ does not perform classification and does not own application state. It only transports jobs.

### Celery worker

The Celery worker executes classification jobs.

Responsibilities:

- Consume classification jobs from RabbitMQ.
- Load the corresponding submission from PostgreSQL using the Django ORM.
- Check whether the submission still requires classification.
- Fetch the photo from object storage using internal credentials.
- Send image bytes and minimal technical metadata to the FastAPI classifier.
- Validate the classifier response.
- Save the classification result through the Django ORM.
- Update the submission status.
- Retry temporary failures according to the configured retry policy.

The worker is part of the Django application boundary because it uses the same Django models, migrations, validation assumptions, and data ownership rules.

### FastAPI classification service

The FastAPI classifier is a stateless internal microservice.

Responsibilities:

- Expose `POST /classify` for classification requests.
- Expose `GET /health` for health checks.
- Apply rule-based submission-review classification by default.
- Return a normalized classification response.
- Avoid storing data or writing directly to PostgreSQL.
- Avoid owning object storage credentials.
- Avoid inferring sensitive personal traits from the photo.

The classifier receives image bytes from the worker. It does not fetch photos from storage and does not know about user accounts, admin permissions, or database tables.

### PostgreSQL

PostgreSQL stores structured application data.

Responsibilities:

- User records.
- Submission metadata.
- Photo object references.
- Submission processing status.
- Classification result records.
- Timestamps and audit-friendly fields.

PostgreSQL stores photo references, not raw image bytes.

### Object storage

MinIO is used locally as an S3-compatible object storage service. In production, the same interface can be backed by S3 or another compatible provider.

Responsibilities:

- Store uploaded photo objects.
- Keep binary image data outside PostgreSQL.
- Keep photos private by default.
- Allow internal services with appropriate credentials to fetch photo objects.

The Celery worker fetches the photo from object storage. The classifier does not receive storage credentials.

## 4. Full upload-to-classification sequence

The full asynchronous flow is:

1. A user submits metadata and a photo through the Django/DRF API.
2. Django authenticates the request.
3. Django validates required metadata fields.
4. Django validates the uploaded file at the API boundary, including allowed content type and size.
5. Django uploads the photo to MinIO or S3-compatible object storage.
6. Django creates a submission record in PostgreSQL.
7. The submission is created with `classification_status=pending_classification`.
8. Django publishes a classification job to RabbitMQ.
9. The API returns the created submission to the user.
10. A Celery worker consumes the classification job.
11. The worker loads the submission using the Django ORM.
12. The worker confirms that the submission still requires classification.
13. The worker fetches the photo object from storage using internal credentials.
14. The worker sends the image bytes and minimal technical metadata to the FastAPI classifier.
15. The FastAPI classifier applies rule-based submission-review classification.
16. The classifier returns a normalized classification result.
17. The worker validates the response shape and allowed enum values.
18. The worker saves a `ClassificationResult` record through the Django ORM.
19. The worker updates the submission status based on the classification result.
20. Users and admins can retrieve the final classification result through the Django API or Django Admin.

External clients do not call RabbitMQ, Celery, object storage, PostgreSQL, or the classifier directly.

## 5. Submission status lifecycle

A submission moves through a small set of explicit states.

Recommended status values:

| Status | Meaning |
|---|---|
| `pending_classification` | The submission was accepted and a classification job has been queued or is waiting to run. |
| `classifying` | A worker has started processing the classification job. |
| `classified` | Classification completed successfully and the submission passed automated checks. |
| `needs_manual_review` | Classification completed, but the result requires admin review. |
| `rejected` | Classification completed and the submission failed automated checks. |
| `classification_failed` | Classification could not be completed after retries or due to an unrecoverable error. |

The exact mapping from classifier response to submission status should be centralized in the Django application code.

Example mapping:

| Classifier `review_decision` | Submission status |
|---|---|
| `passes_automated_checks` | `classified` |
| `needs_manual_review` | `needs_manual_review` |
| `fails_automated_checks` | `rejected` |

A technical failure, such as the classifier being unavailable after retries, should result in `classification_failed` or `needs_manual_review`, depending on the desired operational policy.

## 6. Classification job payload

The RabbitMQ/Celery job payload should be small and should not contain image bytes.

Recommended payload:

```json
{
  "submission_id": "45f36c63-05e9-4e1d-893f-5061f2c83c10",
  "job_id": "a56c5e9d-6f84-4212-a75a-7a5e3349a07c",
  "attempt": 1,
  "requested_at": "2026-05-14T10:20:01Z"
}
```

The worker should use `submission_id` to load all required database fields and the photo object key.

The job should not include:

- Raw image bytes.
- Object storage credentials.
- JWTs or user session tokens.
- Raw secrets.
- Unnecessary personal metadata.

The classifier request should include only what the classifier needs. For example:

```text
file=@profile.jpg
submission_id=45f36c63-05e9-4e1d-893f-5061f2c83c10
content_type=image/jpeg
size_bytes=348221
metadata_complete=true
```

The classifier should not need name, gender, country of origin, place of living, or other demographic metadata to decide technical review state.

## 7. Worker behavior

A Celery worker should process a classification job in a predictable sequence:

1. Receive the job from RabbitMQ.
2. Load the submission using the Django ORM.
3. If the submission does not exist, stop safely and log the issue.
4. If the submission is already in a terminal state, skip the job to avoid duplicate work.
5. Mark the submission as `classifying`.
6. Fetch the photo from object storage.
7. Call the FastAPI classifier with a timeout.
8. Validate the classifier response.
9. Save the classification result in PostgreSQL through the Django ORM.
10. Update the submission status.
11. Log the successful classification without logging image bytes or secrets.

The worker should treat the classifier as an internal dependency. It should handle timeouts, malformed responses, and temporary service unavailability.

The worker should not bypass Django models or write directly to the database with separate SQL ownership. Keeping persistence inside the Django ORM ensures the same schema, constraints, and business rules are used consistently.

## 8. Retry and failure handling

Classification failures should be handled explicitly.

### Retryable failures

Retryable failures include:

- Temporary classifier unavailability.
- Classifier request timeout.
- Temporary object storage read failure.
- Temporary RabbitMQ or network interruption.
- Transient database connection issue.

For retryable failures, Celery should retry the job with a limited number of attempts and a backoff delay.

Example policy:

```text
max_retries = 3
backoff = true
retry_delay = increasing delay per attempt
```

### Non-retryable failures

Non-retryable failures include:

- Submission does not exist.
- Photo object key is missing.
- Photo object was permanently deleted.
- Classifier returns a valid rejection result for an invalid image.
- Classifier response fails schema validation repeatedly.

For non-retryable failures, the worker should mark the submission as `classification_failed` or store a classification result that maps to `rejected`, depending on the case.

### Safe failure states

If classification cannot be completed, the system should not lose the submission. The metadata and photo reference should remain available for admin inspection.

A failed classification should be visible to admins with enough information to understand the problem, such as:

- Submission ID.
- Current status.
- Last error code.
- Last classification attempt time.
- Number of attempts, if tracked.

Logs should include operational context but must not include raw secrets, raw image bytes, or unnecessary personal data.

## 9. Idempotency strategy

Classification jobs may be retried, duplicated, or delivered more than once. The worker should be safe to run more than once for the same submission.

Recommended idempotency strategy:

- Use `submission_id` as the primary idempotency scope.
- Check the current submission status before processing.
- Skip processing if the submission is already in a terminal state and reclassification was not explicitly requested.
- Store `job_id` or `classification_run_id` on classification results if duplicate detection is needed.
- Use database transactions when saving the classification result and updating the latest result pointer.
- Ensure only one latest classification result is selected for normal admin display.

Terminal states may include:

- `classified`
- `needs_manual_review`
- `rejected`
- `classification_failed`

If future reclassification is supported, it should be explicit. For example, an admin-triggered reclassification should create a new job with a new `classification_run_id` and should be allowed to create a new classification result while preserving older results.

For the take-home implementation, a practical approach is:

1. Skip the job if the submission already has a latest classification result.
2. Otherwise classify and save the result in a transaction.
3. Update the submission's latest classification pointer and status in the same transaction.

This is simple, understandable, and sufficient for the assessment.

## 10. How classification results are persisted

Classification results are stored in PostgreSQL as separate records from submissions.

The submission is the user-created source record. The classification result is the classifier output generated at a point in time.

A typical `classification_results` record stores:

- `id`
- `submission_id`
- `category`
- `review_decision`
- `confidence_score` or `score`
- `reason` or `reasons`
- `provider`
- `classifier_version`
- `schema_version`
- `is_fallback`
- `error_code`
- `created_at`

The `submissions` table may also store:

- `classification_status`
- `latest_classification_result_id`
- `classified_at`
- `updated_at`

The worker should save the classification result and update the submission inside a database transaction. This avoids a partial state where a result exists but the submission still points to an old status, or where the submission status changes without a corresponding result.

The FastAPI classifier does not persist results. It returns a normalized response only. The Celery worker persists the response through the Django ORM because the Django service owns the data model.

## 11. Admin visibility

Admins should be able to see the classification state of every submission.

In Django Admin or admin APIs, the submission list should expose fields such as:

- Submission ID.
- User.
- Name.
- Age.
- Gender.
- Place of living.
- Country of origin.
- Photo object reference.
- Classification status.
- Latest classification category.
- Latest review decision.
- Created timestamp.
- Updated timestamp.
- Classified timestamp, where available.

Recommended admin behavior:

| Status | Admin visibility |
|---|---|
| `pending_classification` | Show that the submission was accepted but classification has not completed yet. |
| `classifying` | Show that a worker is currently processing the submission. |
| `classified` | Show the latest successful classification result. |
| `needs_manual_review` | Make the submission easy to filter for manual inspection. |
| `rejected` | Show the rejection category and reason. |
| `classification_failed` | Show the failure state and operational error information. |

Admin filtering should support classification status, category, review decision, and timestamps in addition to the assessment-required metadata filters.

Regular users should only be able to view their own submissions and their own classification results.

## 12. Operational considerations

### Docker Compose

A practical local Docker Compose setup should include:

- Django/DRF API service.
- FastAPI classifier service.
- Celery worker service.
- RabbitMQ service.
- PostgreSQL service.
- MinIO service.
- Nginx, if used as the local entry point.

The Django API and Celery worker should share the same application image or codebase, because both use Django settings and models.

The FastAPI classifier should run as a separate image/container.

Important local configuration values include:

- `DATABASE_URL`
- `CELERY_BROKER_URL`
- `OBJECT_STORAGE_ENDPOINT`
- `OBJECT_STORAGE_BUCKET`
- `OBJECT_STORAGE_ACCESS_KEY`
- `OBJECT_STORAGE_SECRET_KEY`
- `CLASSIFIER_URL`
- `DJANGO_SECRET_KEY`
- `ALLOWED_HOSTS`

The default rule-based classifier should not require external AI provider credentials. This keeps local setup and CI reliable.

### Kubernetes

In Kubernetes, each runtime component can be deployed separately:

- Django API Deployment.
- Celery worker Deployment.
- FastAPI classifier Deployment.
- PostgreSQL, preferably managed in production.
- RabbitMQ, preferably managed or deployed through a chart.
- Object storage, preferably managed in production.
- Ingress for public HTTP/HTTPS traffic.

Recommended Kubernetes practices:

- Use ConfigMaps for non-sensitive configuration.
- Use Secrets for credentials.
- Add readiness and liveness probes for Django and FastAPI.
- Keep RabbitMQ, PostgreSQL, object storage, and the classifier off the public internet.
- Scale Django API replicas based on web traffic.
- Scale Celery workers based on queue depth and classification throughput.
- Scale the classifier independently if classification becomes CPU-heavy.
- Run migrations as a release step or one-off Kubernetes Job before rolling out Django.

The classifier should be reachable only on the internal cluster network. It should not be exposed through the public ingress.

## 13. Trade-offs compared with synchronous classification

### Benefits of asynchronous classification

- Upload requests stay responsive.
- Classifier latency is isolated from the user-facing request.
- Temporary classifier failures can be retried.
- Classification workers can scale independently.
- The system has clearer operational states.
- Future model-provider classification can be added more safely.
- Queue depth provides a useful operational signal.

### Costs of asynchronous classification

- More infrastructure is required.
- RabbitMQ and Celery add operational complexity.
- The user may initially see `pending_classification` instead of a final result.
- More status handling is needed.
- Retry and idempotency behavior must be implemented carefully.
- Local development requires more containers.

### Why the trade-off is acceptable

For this assessment, asynchronous classification is defensible because it demonstrates cloud-ready design while still staying practical.

RabbitMQ and Celery are not used to make the system look more complex. They are used to solve a specific problem: classification can have different latency and failure behavior from normal API validation.

The design keeps the public API simple while giving the backend a reliable way to process, retry, and observe classification work.

## 14. Take-home implementation vs production improvements

### Implemented for the take-home

The take-home implementation should focus on a small, working, demonstrable version:

- Django/DRF accepts authenticated submissions.
- Metadata and uploaded photo files are validated.
- Photos are stored in MinIO/S3-compatible storage.
- Submission metadata is stored in PostgreSQL.
- Submissions start with `classification_status=pending_classification`.
- Django publishes classification jobs to RabbitMQ.
- Celery workers consume jobs.
- Workers fetch photos from object storage.
- Workers call the FastAPI classifier.
- The classifier returns deterministic rule-based results.
- Workers save classification results through the Django ORM.
- Admins can view pending, failed, and completed classification states.
- Docker Compose runs the full local stack.

This is enough to demonstrate the architecture, service boundaries, safety rules, and operational flow.

### Production improvements

A production version could improve the design with:

- Dead-letter queues for permanently failed jobs.
- More detailed job attempt tracking.
- Admin-triggered reclassification.
- Scheduled cleanup for stale pending jobs.
- Stronger idempotency using explicit classification run IDs.
- Metrics for queue depth, classification duration, failure rate, and retry count.
- Structured logs with correlation IDs.
- Distributed tracing across Django, Celery, and FastAPI.
- Network policies limiting which services can call the classifier.
- Optional internal service authentication between the worker and classifier.
- Virus scanning or malware detection for uploaded files.
- Short-lived signed URLs for admin photo preview.
- External secret management instead of plain Kubernetes Secrets.
- Managed PostgreSQL, managed RabbitMQ, and managed object storage.

These are useful improvements, but they are not required to prove the take-home architecture. The first version should remain focused: accept submissions, classify asynchronously, persist results safely, and expose clear admin visibility.
