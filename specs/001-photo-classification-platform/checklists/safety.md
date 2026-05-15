# Safety Review Checklist

**Feature**: Photo Classification Platform  
**Purpose**: Hard safety gate before implementation.

## Classification Scope

- [x] Classification is limited to submission review state.
- [x] The classifier does not classify the person in the photo.
- [x] The classifier does not identify people in photos.
- [x] The classifier does not infer ethnicity, race, attractiveness, identity, gender, age, nationality, health, religion, political affiliation, social background, economic background, personality, trustworthiness, competence, desirability, or similar traits.
- [x] Classifier outputs do not include sensitive inferred trait fields.
- [ ] Classifier tests fail if forbidden person-trait fields are introduced.

## Demographic Metadata

- [x] User-provided gender is stored only as user-submitted metadata and is never inferred from the photo.
- [x] User-provided age is stored only as user-submitted metadata and is never inferred from the photo.
- [x] Country of origin and place of living are stored only as user-submitted metadata and are never inferred from the photo.
- [x] Demographic metadata is not used to decide acceptability, suitability, safety, quality, priority, score, trustworthiness, competence, desirability, or likelihood to pass review.
- [x] Demographic metadata is used only for required validation, display, search, and admin filtering.
- [ ] The worker does not send unnecessary demographic metadata to the classifier by default.

## Data and Access

- [ ] Anonymous users cannot create submissions.
- [ ] Regular users can only access their own submissions.
- [ ] Admin-only views require staff/admin permissions.
- [ ] Public registration cannot create admin users.
- [ ] Uploaded photos are stored in private object storage, not PostgreSQL.
- [ ] PostgreSQL stores object keys or references, not permanent public URLs.
- [x] Classifier does not receive PostgreSQL credentials.
- [x] Classifier does not receive MinIO/S3 credentials.
- [x] Internal services are not exposed publicly.

## Failure Safety

- [ ] Invalid, unreadable, unsupported, or suspicious files are rejected or classified into safe states.
- [ ] Classification failures do not lose accepted submissions.
- [ ] Worker retries are bounded.
- [ ] Duplicate jobs do not create duplicate latest results.
- [ ] Malformed classifier responses are rejected before persistence.
- [ ] Logs avoid raw image bytes, passwords, access tokens, storage credentials, signed URLs, raw provider output, and unnecessary personal metadata.

## Model Provider Guardrails

- [x] External model-provider mode is optional and not required for the first version.
- [x] Rule-based classifier is the default.
- [ ] Missing provider credentials fall back safely or produce safe review/failure behavior.
- [ ] Provider responses are normalized and validated before storage.
- [ ] Raw provider responses are not stored unless sanitized, access-controlled, and explicitly approved.
