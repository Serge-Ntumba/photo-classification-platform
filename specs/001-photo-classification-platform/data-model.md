# Data Model: Photo Classification Platform

**Source**: [supporting-docs/database-design.md](supporting-docs/database-design.md) and accepted ADRs.

## Data Ownership

Django/DRF owns the application data model, migrations, and all PostgreSQL writes. The Celery worker is part of the Django application boundary and persists classification results through Django models/ORM.

The FastAPI classifier does not own tables, migrations, persistence, user permissions, or object storage access.

## Entity Relationship Summary

```text
User 1 -> many Submission
Submission 1 -> many ClassificationResult
Submission 0..1 -> 1 latest ClassificationResult
Submission 1 -> 1 private PhotoObject reference
```

## User

Recommended implementation: custom Django user model based on `AbstractUser`, using UUID primary keys consistently with other domain records.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `username` | varchar | Unique if username login is used |
| `email` | varchar | Unique if email login is used |
| `password` | varchar | Hashed by Django |
| `is_active` | boolean | Standard Django account state |
| `is_staff` | boolean | Grants Django Admin access |
| `is_superuser` | boolean | Full admin permissions |
| `date_joined` | timestamp | Account creation time |
| `last_login` | timestamp nullable | Last login time |

### User Constraints

- Public registration must not set `is_staff` or `is_superuser`.
- Passwords must use Django password hashing.
- Regular users can only access their own submissions.
- Admin users can access all submissions for review.

## Submission

Stores user-provided metadata, private photo reference, processing state, and timestamps.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `user_id` | foreign key | References `users.id`; required |
| `name` | varchar | User-provided; required |
| `age` | integer | User-provided; required |
| `place_of_living` | varchar | User-provided; required |
| `gender` | varchar | User-provided metadata only; required |
| `country_of_origin` | varchar | User-provided; required |
| `description` | text nullable | Optional, length-limited |
| `photo_object_key` | varchar | Private object storage key; required |
| `photo_original_filename` | varchar nullable | For admin/debugging |
| `photo_content_type` | varchar | Declared or detected MIME type |
| `photo_size_bytes` | integer | Uploaded file size |
| `status` | varchar | Processing state |
| `latest_classification_result_id` | foreign key nullable | Latest result pointer |
| `classified_at` | timestamp nullable | Latest classification time |
| `created_at` | timestamp | Creation time |
| `updated_at` | timestamp | Last update time |

### Submission Status Values

```text
pending_classification
classifying
classified
needs_manual_review
rejected
classification_failed
```

### Status Mapping

| Classifier `review_decision` | Submission status |
|---|---|
| `passes_automated_checks` | `classified` |
| `needs_manual_review` | `needs_manual_review` |
| `fails_automated_checks` | `rejected` |
| technical failure after retries | `classification_failed` or `needs_manual_review` |

### Submission Constraints

- `user_id`, `name`, `age`, `place_of_living`, `gender`, `country_of_origin`, `photo_object_key`, `photo_content_type`, `photo_size_bytes`, `status`, `created_at`, and `updated_at` are required.
- `age` must be constrained to `0 <= age <= 120`.
- `photo_size_bytes` must be positive and no larger than 5 MB.
- Uploaded photo MIME type must be JPEG, PNG, or WebP.
- Uploaded photo dimensions must be from 300x300 through 5000x5000 pixels inclusive.
- `status` must be limited to known values.
- `description` must be limited to 1,000 characters at the application level.
- The database stores photo references, not photo bytes.
- Permanent public photo URLs must not be stored.

### Submission Indexes

Recommended:

- `user_id`
- `age`
- `gender`
- `place_of_living`
- `country_of_origin`
- `status`
- `created_at`
- `updated_at`
- `latest_classification_result_id`
- `(created_at, status)` for recent status/admin views

Search can start with Django Admin/DRF search on:

- `name`
- `place_of_living`
- `country_of_origin`
- `photo_object_key`

## ClassificationResult

Stores normalized classifier output. A submission may have multiple results for retries, reclassification, rule changes, or future provider changes.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `submission_id` | foreign key | References `submissions.id`; required |
| `job_id` | UUID/string nullable | Job/run correlation where implemented |
| `classification_type` | varchar | Must be `submission_review` |
| `category` | varchar | Allowed category enum |
| `review_decision` | varchar | Allowed decision enum |
| `score` | decimal/integer nullable | Rule-based score where used |
| `confidence_score` | decimal nullable | Optional calibrated provider confidence |
| `reason` | text nullable | Human-readable summary |
| `reasons` | JSONB nullable | Normalized reason list |
| `provider` | varchar | Example: `rule_based`, `model_provider` |
| `classifier_version` | varchar | Rule/model version |
| `schema_version` | varchar | Result schema version |
| `photo_type` | varchar nullable | Future/provider field, safe submission-image type only |
| `image_quality` | varchar nullable | Future/provider or deterministic field |
| `technical_status` | varchar nullable | Image technical processing state |
| `content_safety_status` | varchar nullable | Safe/unsafe/uncertain/not_evaluated |
| `profile_suitability` | varchar nullable | suitable/unsuitable/uncertain/not_evaluated |
| `provider_metadata` | JSONB nullable | Sanitized safe provider metadata |
| `raw_response` | JSONB nullable | Optional sanitized output only |
| `is_fallback` | boolean | Whether fallback was used |
| `fallback_reason` | varchar nullable | Why fallback was used |
| `error_code` | varchar nullable | Operational/classification error identifier |
| `classified_at` | timestamp | Time classifier produced result |
| `classification_duration_ms` | integer nullable | Duration where available |
| `created_at` | timestamp | Persistence time |

### Allowed Categories

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

### Allowed Review Decisions

```text
passes_automated_checks
fails_automated_checks
needs_manual_review
```

### Classification Result Constraints

- `classification_type` must be `submission_review`.
- `category` must be a known category.
- `review_decision` must be a known decision.
- `provider`, `classifier_version`, `schema_version`, and `created_at` are required.
- `score` or `confidence_score`, if present, must be between `0` and `1`.
- Responses containing sensitive inferred traits must be rejected and not stored as trusted results.
- `raw_response`, if used later, must be sanitized and must not contain secrets, signed URLs, raw prompts, unnecessary personal data, or sensitive inferred traits.

### Classification Result Indexes

Recommended:

- `submission_id`
- `category`
- `review_decision`
- `provider`
- `created_at`
- `classified_at`
- `(submission_id, created_at DESC)` for latest result retrieval
- `(category, review_decision)` for admin filtering

## ClassificationJob Payload

RabbitMQ/Celery job payload should be small:

```json
{
  "submission_id": "45f36c63-05e9-4e1d-893f-5061f2c83c10",
  "job_id": "a56c5e9d-6f84-4212-a75a-7a5e3349a07c",
  "attempt": 1,
  "requested_at": "2026-05-14T10:20:01Z"
}
```

The payload must not contain:

- Raw image bytes.
- Object storage credentials.
- JWTs or session tokens.
- Raw secrets.
- Unnecessary personal or demographic metadata.

## PhotoObject Reference

Photo bytes live in private object storage. The database stores a reference.

Recommended object key pattern:

```text
uploads/submissions/{submission_id}/{filename}
```

Rules:

- Store object keys, not permanent public URLs.
- Keep buckets private.
- Django and worker may have object storage credentials.
- FastAPI classifier must not receive object storage credentials.
- Photo preview, if implemented, should use a permission-checked backend stream or short-lived signed URL.

## Data Retention and Privacy

Assessment version:

- Keep submissions and classification results until deleted by an admin or future retention job.
- Preserve classification history for auditability and debugging.
- Delete the object storage photo when the related submission is permanently deleted.

Privacy rules:

- Do not store raw image bytes in PostgreSQL.
- Do not store sensitive inferred traits.
- Do not use demographic metadata to judge acceptability, suitability, priority, quality, safety, desirability, competence, or trustworthiness.
- Restrict regular users to their own submissions.
- Restrict admin views to staff/admin users.
- Avoid logging raw personal metadata, image bytes, credentials, tokens, or signed URLs.
