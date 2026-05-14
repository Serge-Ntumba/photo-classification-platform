# Database Design: Photo Classification Platform

## 1. Purpose

This document describes the PostgreSQL database design for the Photo Classification Platform.

It explains which data is stored in PostgreSQL, which data is stored outside the database, how the main entities relate to each other, and how the schema supports admin filtering, classification history, migrations, constraints, and privacy requirements.

The database stores structured metadata and photo references. It does **not** store raw image bytes.

Photos are stored in object storage, such as MinIO for local development or S3-compatible storage in production.

## 2. Assumptions

The assessment leaves some implementation details open. This database design uses the following assumptions:

- Django owns all database writes.
- PostgreSQL stores metadata and photo references only.
- Photos are stored in object storage, not in PostgreSQL.
- A submission belongs to the user who created it.
- A submission can be classified more than once.
- Classification results are stored as normalized classifier output.
- The admin panel shows the latest classification result by default.
- Historical classification results are kept for auditability, debugging, and future reclassification.
- User-provided demographic metadata is stored only because it is required by the assessment and needed for admin filtering.
- The classifier classifies the submission review state, not the person in the photo.

## 3. Why PostgreSQL Was Chosen

PostgreSQL is used as the metadata database because the platform needs reliable relational storage, filtering, constraints, migrations, and audit-friendly records.

The system stores structured application data such as users, submissions, classification results, statuses, and timestamps. PostgreSQL is a good fit because it provides:

- Strong relational integrity with foreign keys.
- Transactional writes for submissions and classification updates.
- Indexing for admin search and filtering.
- Mature support in Django through the Django ORM.
- Safe schema evolution through Django migrations.
- Good production deployment options through managed PostgreSQL services.

PostgreSQL stores metadata and references to uploaded photos. It does **not** store raw image bytes.

## 4. Data Ownership Boundaries

The Django/DRF main service owns the database schema and all database writes.

The main service owns:

- Users.
- Submissions.
- Metadata validation.
- Photo object references.
- Classification result persistence.
- Admin search and filtering.
- Submission status updates.

The FastAPI classification service does not own database tables and does not write to PostgreSQL directly.

The classification service receives image bytes from the Celery worker and returns a normalized classification response. The Celery worker then saves that response through the Django application layer and ORM.

This keeps data ownership simple and avoids multiple services writing directly to the same database.

## 5. Main Entities

The main database entities are:

1. `users`
2. `submissions`
3. `classification_results`

The relationship is:

```text
users 1 ─── * submissions
submissions 1 ─── * classification_results
submissions 0..1 ─── 1 latest classification_results
```

Meaning:

- One user can create many submissions.
- One submission belongs to one user.
- One submission can have one or many classification results.
- A submission may keep a pointer to its latest classification result.
- The admin panel should show the latest classification result by default.
- Historical classification results remain available for auditability, debugging, and reclassification.

## 6. User Table Design

The platform can use Django’s built-in user model or a custom user model based on `AbstractUser`.

For this assessment, using a custom user model from the start is recommended because it keeps the project flexible while still relying on Django’s authentication system.

Example table: `users`

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `username` | varchar | Unique login identifier if username login is used |
| `email` | varchar | Unique if email login is used |
| `password` | varchar | Hashed password managed by Django |
| `is_active` | boolean | Standard Django account status |
| `is_staff` | boolean | Allows access to Django Admin |
| `is_superuser` | boolean | Full admin permissions |
| `date_joined` | timestamp | Account creation time |
| `last_login` | timestamp nullable | Last login time |

The user table should not duplicate submission metadata such as age, gender, place of living, or country of origin. Those values belong to a specific submission, not necessarily to the account forever.

For implementation, this document recommends using UUID primary keys consistently for `users`, `submissions`, and `classification_results`. `BigAutoField` would also work, but choosing one convention avoids unnecessary ambiguity.

## 7. Submission Table Design

The `submissions` table stores user-provided metadata and the object storage key for the uploaded photo.

It stores a reference to the photo, not the raw image bytes.

Example table: `submissions`

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `user_id` | foreign key | References `users.id` |
| `name` | varchar | User-provided name |
| `age` | integer | User-provided age |
| `place_of_living` | varchar | User-provided location |
| `gender` | varchar | User-provided metadata, not inferred from photo |
| `country_of_origin` | varchar | User-provided country |
| `description` | text nullable | Optional description |
| `photo_object_key` | varchar | Private object storage key |
| `photo_original_filename` | varchar nullable | Original filename for admin/debugging |
| `photo_content_type` | varchar | Declared or detected MIME type |
| `photo_size_bytes` | integer | Uploaded file size |
| `status` | varchar | Submission processing status |
| `latest_classification_result_id` | foreign key nullable | Optional pointer to latest result |
| `created_at` | timestamp | Creation time |
| `updated_at` | timestamp | Last update time |

Recommended `status` values:

- `pending_classification`
- `classifying`
- `classified`
- `needs_manual_review`
- `classification_failed`
- `rejected`

The `latest_classification_result_id` field is optional but useful. It allows the admin panel to quickly show the latest result while older results remain in the `classification_results` table.

If this pointer is used, it should be updated transactionally when a new classification result is saved.

## 8. Classification Result Table Design

The `classification_results` table stores normalized classifier output.

A submission can have many classification results because the platform may reclassify a submission after rule changes, retry failures, or future model-provider changes.

Example table: `classification_results`

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `submission_id` | foreign key | References `submissions.id` |
| `job_id` | UUID/string nullable | Job/run correlation |
| `classification_type` | varchar | Must be `submission_review` |
| `category` | varchar | Normalized classification category |
| `review_decision` | varchar | Operational decision |
| `score` | decimal/integer nullable | Rule-based score where used |
| `confidence_score` | decimal nullable | Optional score if available |
| `reason` | text | Human-readable explanation |
| `reasons` | JSONB nullable | Normalized reason list |
| `provider` | varchar | Example: `rule_based`, `model_provider` |
| `classifier_version` | varchar | Version of rules/model used |
| `schema_version` | varchar | Version of result schema |
| `raw_response` | JSONB nullable | Optional sanitized provider response |
| `is_fallback` | boolean | Whether fallback classification was used |
| `fallback_reason` | varchar nullable | Why fallback was used |
| `error_code` | varchar nullable | Error identifier if classification failed |
| `classified_at` | timestamp | Time classifier produced result |
| `classification_duration_ms` | integer nullable | Duration where available |
| `created_at` | timestamp | Result creation time |

Recommended `category` values from ADR-005:

- `valid_profile_candidate`
- `invalid_file`
- `unsupported_image_type`
- `suspicious_file`
- `low_quality_image`
- `incomplete_metadata`
- `non_profile_image`
- `unsafe_content`

Recommended `review_decision` values from ADR-005:

- `passes_automated_checks`
- `fails_automated_checks`
- `needs_manual_review`

Classification result constraints:

- `classification_type` is required and must equal `submission_review`.
- `score`, if present, must be between `0` and `1`.
- `reasons`, if present, must contain safe submission-review explanations only.
- `classified_at` is required for successful classifier responses.

The category explains the reason for the classification. The review decision explains the operational next step.

The classifier must classify the submission review state, not the person in the photo. Classification results must not contain inferred sensitive traits such as ethnicity, race, attractiveness, identity, gender, age, nationality, social background, economic background, personality, trustworthiness, fitness, competence, or desirability.

The `raw_response` field is optional. If a future model provider is added, this field should store only sanitized provider output that is safe to retain. It must not store raw secrets, signed URLs, unnecessary personal data, or sensitive inferred traits.

## 9. Why Classification Results Are Stored Separately From Submissions

Classification results are stored separately from submissions because classification can change over time.

A submission is the source record created by the user. It contains the submitted metadata and photo reference.

A classification result is an output generated by a classifier at a point in time.

Keeping them separate allows the platform to:

- Preserve historical classification results.
- Support reclassification after rule changes.
- Compare old and new classifier behavior.
- Debug failed or unexpected classification outcomes.
- Store classifier version and provider information.
- Avoid overwriting audit-relevant data.
- Show the latest result by default while keeping previous results.

The trade-off is that admin queries may require a join or a denormalized latest-result pointer. This is acceptable because it preserves classification history while still allowing the admin panel to show the latest result efficiently.

For admin usability, the `submissions` table may keep a `latest_classification_result_id` pointer. This provides fast access to the latest result without deleting older results.

## 10. Migrations Strategy Using Django Migrations

Schema changes should be managed through Django migrations.

The expected workflow is:

1. Define or update Django models.
2. Run `python manage.py makemigrations`.
3. Review the generated migration file.
4. Run `python manage.py migrate` locally and in deployment.
5. Apply migrations before starting new application containers in production.

Migrations should be committed to the repository.

For this assessment, migrations should cover:

- Initial user model setup.
- Submission table creation.
- Classification result table creation.
- Indexes for admin filtering.
- Constraints for required fields and valid values.

In Kubernetes, migrations can be run as a one-off job or release step before the Django deployment is rolled out.

## 11. Indexing Strategy for Admin Filters

The admin panel must support filtering and searching by:

- Age.
- Gender.
- Place of living.
- Country of origin.
- Timestamps.
- Classification category.
- Review decision.

Django Admin should use these indexed fields through `list_filter`, `search_fields`, and default ordering.

Recommended indexes on `submissions`:

| Index | Purpose |
|---|---|
| `user_id` | Fetch submissions for a user |
| `age` | Admin filtering by age |
| `gender` | Admin filtering by gender |
| `place_of_living` | Admin filtering by location |
| `country_of_origin` | Admin filtering by country |
| `status` | Admin filtering by processing status |
| `created_at` | Sort/filter by submission time |
| `updated_at` | Sort/filter by update time |
| `latest_classification_result_id` | Join to latest result |

Recommended indexes on `classification_results`:

| Index | Purpose |
|---|---|
| `submission_id` | Fetch results for a submission |
| `category` | Admin filtering by classification category |
| `review_decision` | Admin filtering by review decision |
| `provider` | Debug/filter by classifier provider |
| `created_at` | Find latest or historical results |

Recommended composite indexes:

| Index | Purpose |
|---|---|
| `(submission_id, created_at DESC)` | Quickly fetch latest result for a submission |
| `(category, review_decision)` | Filter classification outcomes |
| `(created_at, status)` on submissions | Admin dashboards and recent status views |

For text search, Django Admin can start with `search_fields` on fields such as:

- `name`
- `place_of_living`
- `country_of_origin`
- `photo_object_key`

If full-text search becomes necessary later, PostgreSQL full-text search indexes can be added. This is not required for the first version.

## 12. Constraints

Recommended database and model-level constraints:

### User constraints

- Email should be unique if email login is used.
- Username should be unique if username login is used.
- Passwords must be stored using Django password hashing, never as plain text.

### Submission constraints

- `user_id` is required.
- `name` is required.
- `age` is required.
- `place_of_living` is required.
- `gender` is required.
- `country_of_origin` is required.
- `photo_object_key` is required.
- `photo_content_type` is required.
- `photo_size_bytes` is required.
- `status` is required.
- `created_at` and `updated_at` are required.
- `age` must have a check constraint such as `age >= 0 AND age <= 120`.
- `photo_size_bytes` must be positive and no larger than 5 MB.
- Uploaded photos must be JPEG, PNG, or WebP.
- Uploaded photo dimensions must be validated from 300x300 through 5000x5000 pixels inclusive at the application level.
- `status` should be limited to known choices.
- `description` must have a maximum length of 1,000 characters enforced at the application level.

### Classification result constraints

- `submission_id` is required.
- `category` is required.
- `review_decision` is required.
- `provider` is required.
- `classifier_version` is required.
- `schema_version` is required.
- `created_at` is required.
- `confidence_score`, if present, should be between `0` and `1`.
- `category` should be limited to known choices.
- `review_decision` should be limited to known choices.

Foreign key behavior:

- If a user is deleted, submissions should usually be deleted or anonymized depending on the retention policy.
- If a submission is deleted, related classification results should be deleted with it.
- `latest_classification_result_id` should be nullable to avoid circular deletion issues.

## 13. Data Retention and Privacy Notes

The database stores personal metadata, so the design should minimize unnecessary data and avoid storing sensitive inferred attributes.

Important privacy rules:

- Store photo object keys, not raw image bytes.
- Store uploaded photos in private object storage.
- Do not store permanent public photo URLs.
- Do not store inferred sensitive traits from photos.
- Do not use demographic metadata to decide whether a person is acceptable, suitable, higher priority, lower priority, safe, unsafe, or likely to pass review.
- Restrict regular users to their own submissions.
- Restrict admin views to staff/admin users.
- Avoid logging raw personal metadata unnecessarily.
- Avoid logging object storage credentials or signed URLs.

Data retention should be documented clearly.

For an assessment implementation, a simple policy is acceptable:

- Keep submissions and classification results until deleted by an admin or by a future retention job.
- Preserve classification history for auditability and debugging.
- Delete or anonymize user-related records if a deletion workflow is added later.
- Delete the object storage photo when the related submission is permanently deleted.

If production compliance requirements are introduced later, retention periods, deletion workflows, and audit logs should be made explicit.

## 14. Trade-offs

### Benefits

- PostgreSQL gives strong relational integrity, constraints, migrations, and admin-filter-friendly indexing.
- Keeping photo bytes in object storage prevents the database from becoming a binary file store.
- Separating submissions from classification results preserves classification history.
- The latest-result pointer makes the admin panel easier and faster to use.
- Django migrations keep schema changes repeatable across local, CI, and deployment environments.

### Costs

- A separate `classification_results` table means some admin queries need joins.
- The optional `latest_classification_result_id` pointer must be updated carefully when new results are created.
- UUID primary keys are slightly larger than integer IDs, although they are useful for distributed systems and safer external references.
- Historical results increase storage over time, so retention or archiving may be needed later.

These trade-offs are acceptable for the assessment because they support auditability, reclassification, admin filtering, and a defensible cloud-deployable design without adding unnecessary services.

## 15. Future Schema Evolution

The schema is intentionally simple but leaves room for future improvements.

Possible future changes include:

- Add a dedicated audit log table for admin actions.
- Add a manual review table with reviewer, decision, notes, and timestamps.
- Add a reclassification job table for tracking retries and batch reprocessing.
- Add soft deletion fields such as `deleted_at`.
- Add signed URL access tracking for photo previews.
- Add virus scanning or content safety result tables.
- Add full-text search indexes for richer admin search.
- Add country normalization using ISO country codes.
- Add enum types or stricter database-level choice constraints.
- Add partitioning or archiving if submission volume becomes large.

The first version should stay focused on the assessment requirements: users, submissions, classification results, admin filtering, Docker deployment, and a clear path to Kubernetes.
