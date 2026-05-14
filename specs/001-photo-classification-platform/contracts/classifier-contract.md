# Contract: FastAPI Classifier

**Sources**: [supporting-docs/api-design.md](../supporting-docs/api-design.md), [supporting-docs/classification-service-design-note.md](../supporting-docs/classification-service-design-note.md), and [decisions/ADR-005-classification-scope.md](../decisions/ADR-005-classification-scope.md).

The FastAPI classifier is an internal stateless service. It classifies submission review state only.

## Ownership

The classifier owns:

- `/classify`
- `/health`
- Rule-based submission-review classification by default.
- Future optional provider implementation behind the same normalized response schema.

The classifier does not own:

- User authentication.
- User authorization.
- PostgreSQL writes.
- Object storage credentials.
- Admin review behavior.
- Persistent application state.

## POST `/classify`

Access: internal only. Only the Celery worker should call this endpoint.

Content type: `multipart/form-data`.

Request fields:

| Field | Type | Required | Notes |
|---|---|---:|---|
| `file` | file | yes | Image bytes fetched by the worker |
| `submission_id` | string | yes | Internal correlation identifier |
| `content_type` | string | yes | Detected or declared MIME type |
| `size_bytes` | integer | yes | File size |
| `metadata_complete` | boolean | yes | Whether required metadata passed Django validation |

The request should not include:

- Name.
- Gender.
- Country of origin.
- Place of living.
- Raw demographic metadata.
- JWTs or user session tokens.
- Object storage credentials.
- Public or permanent image URLs.

Example request fields:

```text
file=@profile.jpg
submission_id=45f36c63-05e9-4e1d-893f-5061f2c83c10
content_type=image/jpeg
size_bytes=348221
metadata_complete=true
```

## Response Shape

Response: `200 OK`

```json
{
  "classification_type": "submission_review",
  "category": "valid_profile_candidate",
  "review_decision": "passes_automated_checks",
  "score": 1.0,
  "reasons": [
    "Image file was readable.",
    "Image type is supported.",
    "Required metadata was complete."
  ],
  "provider": "rule_based",
  "classifier_version": "rules-v1",
  "schema_version": "classification-result-v1",
  "is_fallback": false,
  "error_code": null,
  "classified_at": "2026-05-14T10:20:04Z"
}
```

Optional future/provider fields may include:

```text
photo_type
image_quality
technical_status
content_safety_status
profile_suitability
confidence
provider_metadata
classification_duration_ms
fallback_reason
```

All optional fields must remain submission-review fields and must not contain forbidden person-trait inferences.

## Allowed Categories

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

## Allowed Review Decisions

```text
passes_automated_checks
fails_automated_checks
needs_manual_review
```

## Category Priority

Accepted priority order:

```text
1. invalid_file
2. unsupported_image_type
3. suspicious_file
4. unsafe_content
5. incomplete_metadata
6. low_quality_image
7. non_profile_image
8. valid_profile_candidate
```

If multiple issues are detected, the highest-priority category wins.

## Rule-Based Default

The rule-based classifier should evaluate deterministic technical signals:

- File exists and is not empty.
- MIME type is supported.
- File signature matches expected type.
- File can be opened and parsed as an image.
- File is non-empty and no larger than 5 MB.
- Dimensions are from 300x300 through 5000x5000 pixels inclusive.
- Required metadata completeness flag is true.
- Upload does not look corrupted or suspicious.

Required validation limits:

```text
Allowed MIME types: image/jpeg, image/png, image/webp
Max file size: 5 MB
Minimum dimensions: 300x300
Maximum dimensions: 5000x5000
```

## Example Invalid Image Response

```json
{
  "classification_type": "submission_review",
  "category": "invalid_file",
  "review_decision": "fails_automated_checks",
  "score": 0.0,
  "reasons": [
    "File could not be opened as a valid image."
  ],
  "provider": "rule_based",
  "classifier_version": "rules-v1",
  "schema_version": "classification-result-v1",
  "is_fallback": false,
  "error_code": "IMAGE_UNREADABLE",
  "classified_at": "2026-05-14T10:20:04Z"
}
```

## Safety Prohibitions

The classifier must not infer, predict, rank, identify, or score people by:

- Ethnicity.
- Race.
- Attractiveness.
- Identity.
- Gender.
- Age.
- Nationality.
- Health.
- Religion.
- Political affiliation.
- Social background.
- Economic background.
- Personality.
- Trustworthiness.
- Competence.
- Desirability.
- Similar protected, sensitive, subjective, or identity-related traits.

The classifier must not use demographic metadata to judge whether a person is acceptable, suitable, safe, unsafe, higher priority, lower priority, or likely to pass review.

## Fallback Behavior

The classifier must not fail only because a model provider is missing.

Expected behavior:

```text
CLASSIFIER_PROVIDER=rule_based -> use rule-based classifier
CLASSIFIER_PROVIDER=model with valid key -> use configured provider
CLASSIFIER_PROVIDER=model without key -> fallback to rule-based
model provider unavailable -> fallback to rule-based or return safe review/failure state
```

Fallback must be visible in normalized fields such as `is_fallback` and `fallback_reason`.

## Worker Validation Requirements

The Celery worker or Django application layer must validate classifier responses before persistence:

- `classification_type` must be `submission_review`.
- `category` must be allowed.
- `review_decision` must be allowed.
- `score`, if present, must be in range.
- Required fields must be present.
- Sensitive inferred trait fields must be rejected.
- Malformed or unexpected responses must not be stored as trusted classification results.
