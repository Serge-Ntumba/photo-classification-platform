# Contract: Classification Job Payload

**Source**: [supporting-docs/async-classification.md](../supporting-docs/async-classification.md)

RabbitMQ and Celery decouple submission creation from classification work. Jobs identify the submission to process; they do not carry photos or secrets.

## Publisher

Django/DRF main service publishes the job after:

1. User is authenticated.
2. Metadata is validated.
3. Photo upload is validated enough for acceptance.
4. Photo is stored in private object storage.
5. Submission is stored in PostgreSQL with `pending_classification`.

If RabbitMQ publish fails, Django should avoid marking the submission as ready for classification unless the job is successfully queued, or should expose a safe retryable state.

## Consumer

Celery worker consumes the job and:

1. Loads the submission through the Django ORM.
2. Checks whether the submission still requires classification.
3. Marks the submission `classifying` where implemented.
4. Fetches the photo from object storage.
5. Calls the FastAPI classifier.
6. Validates the response.
7. Persists `ClassificationResult`.
8. Updates submission status and latest result pointer transactionally.

## Payload Shape

```json
{
  "submission_id": "45f36c63-05e9-4e1d-893f-5061f2c83c10",
  "job_id": "a56c5e9d-6f84-4212-a75a-7a5e3349a07c",
  "attempt": 1,
  "requested_at": "2026-05-14T10:20:01Z"
}
```

## Required Fields

| Field | Type | Required | Notes |
|---|---|---:|---|
| `submission_id` | UUID/string | yes | Worker uses this to load the submission |
| `job_id` | UUID/string | yes | Job correlation/idempotency aid |
| `attempt` | integer | yes | Current attempt count |
| `requested_at` | ISO datetime | yes | Time job was requested |

## Forbidden Payload Content

The job payload must not include:

- Raw image bytes.
- Object storage credentials.
- PostgreSQL credentials.
- JWTs.
- Session tokens.
- Raw secrets.
- Signed URLs.
- Name, gender, country of origin, place of living, or other unnecessary demographic metadata.

## Status Lifecycle

Recommended statuses:

```text
pending_classification
classifying
classified
needs_manual_review
rejected
classification_failed
```

Mapping:

```text
passes_automated_checks -> classified
needs_manual_review     -> needs_manual_review
fails_automated_checks  -> rejected
retry exhaustion         -> classification_failed or needs_manual_review
```

## Retryable Failures

Examples:

- Temporary classifier unavailability.
- Classifier request timeout.
- Temporary object storage read failure.
- Temporary RabbitMQ interruption.
- Transient database connection issue.

Celery should retry with limited attempts and backoff.

## Non-Retryable Failures

Examples:

- Submission does not exist.
- Photo object key is missing permanently.
- Photo was permanently deleted.
- Classifier returns a valid rejection result for an invalid image.
- Classifier response fails schema validation repeatedly.

The worker should mark a safe state such as `classification_failed`, `rejected`, or `needs_manual_review`, depending on the failure type and policy.

## Idempotency

Worker behavior must be safe under duplicate delivery:

- Use `submission_id` as the primary idempotency scope.
- Check current submission status before processing.
- Skip terminal submissions unless explicit reclassification exists.
- Store `job_id` or a classification run identifier where useful.
- Save classification result and update latest pointer in one database transaction.
- Avoid creating duplicate latest results.

Terminal states:

```text
classified
needs_manual_review
rejected
classification_failed
```

Future reclassification must be explicit and should create a new run/result while preserving older results.
