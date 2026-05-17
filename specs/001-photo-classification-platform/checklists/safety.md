# Safety Review Checklist

**Feature**: Photo Classification Platform  
**Purpose**: Hard safety gate before implementation.

## Classification Scope

- [x] Classification is limited to submission review state.
- [x] The classifier does not classify the person in the photo.
- [x] The classifier does not identify people in photos.
- [x] The classifier does not infer ethnicity, race, attractiveness, identity, gender, age, nationality, health, religion, political affiliation, social background, economic background, personality, trustworthiness, competence, desirability, or similar traits.
- [x] Classifier outputs do not include sensitive inferred trait fields.
- [x] Classifier tests fail if forbidden person-trait fields are introduced.

## Demographic Metadata

- [x] User-provided gender is stored only as user-submitted metadata and is never inferred from the photo.
- [x] User-provided age is stored only as user-submitted metadata and is never inferred from the photo.
- [x] Country of origin and place of living are stored only as user-submitted metadata and are never inferred from the photo.
- [x] Demographic metadata is not used to decide acceptability, suitability, safety, quality, priority, score, trustworthiness, competence, desirability, or likelihood to pass review.
- [x] Demographic metadata is used only for required validation, display, search, and admin filtering.
- [x] The worker does not send unnecessary demographic metadata to the classifier by default.

## Data and Access

- [x] Anonymous users cannot create submissions.
- [x] Regular users can only access their own submissions.
- [x] Admin-only views require staff/admin permissions.
- [x] Public registration cannot create admin users.
- [x] Uploaded photos are stored in private object storage, not PostgreSQL.
- [x] PostgreSQL stores object keys or references, not permanent public URLs.
- [x] Classifier does not receive PostgreSQL credentials.
- [x] Classifier does not receive MinIO/S3 credentials.
- [x] Internal services are not exposed publicly.

## Failure Safety

- [x] Invalid, unreadable, unsupported, or suspicious files are rejected or classified into safe states.
- [x] Classification failures do not lose accepted submissions.
- [x] Worker retries are bounded.
- [x] Duplicate jobs do not create duplicate latest results.
- [x] Malformed classifier responses are rejected before persistence.
- [x] Logs avoid raw image bytes, passwords, access tokens, storage credentials, signed URLs, raw provider output, and unnecessary personal metadata.

## Model Provider Guardrails

- [x] External model-provider mode is optional and not required for the first version.
- [x] Rule-based classifier is the default.
- [x] Missing provider credentials fall back safely or produce safe review/failure behavior.
- [x] Provider responses are normalized and validated before storage.
- [x] Raw provider responses are not stored unless sanitized, access-controlled, and explicitly approved.

## Enforced Implementation Gates

- Classifier responses pass `services/classifier/app/safety.py` before `/classify` returns to the worker.
- Django validates classifier responses, provider metadata, raw responses, and nested provider data in `services/main/apps/classification/validators.py` before persistence.
- Worker classifier requests are built from an explicit allowlist in `services/main/apps/classification/client.py`: image bytes plus `submission_id`, `content_type`, `size_bytes`, and `metadata_complete`.
- Django logging uses request IDs and redaction through `services/main/apps/core/logging.py`.
- Public/user and Django Admin responses omit raw provider data and image bytes.

## Safety Test Commands

```bash
python -m pytest tests/safety -q
python -m pytest services/classifier/tests/test_safety.py services/classifier/tests/test_rule_based_classifier.py services/classifier/tests/test_providers.py -q
python -m pytest services/main/apps/classification/tests/test_worker_failures.py services/main/apps/classification/tests/test_worker_idempotency.py services/main/apps/classification/tests/test_celery_config.py -q
```
