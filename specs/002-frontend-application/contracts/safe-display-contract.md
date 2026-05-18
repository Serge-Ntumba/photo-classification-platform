# Contract: Safe Frontend Display

The frontend must transform backend responses into display models before rendering. Rendering raw API objects is not allowed for user-facing submission or classification views.

## Submission Display Allowlist

User-facing list and detail views may render:

| Field | Source | Conditions |
|---|---|---|
| Submission id | `id` | Detail route/reference only; not used as a public sharing feature |
| Name | `name` | Label as user-submitted metadata |
| Age | `age` | Label as user-submitted metadata |
| Place of living | `place_of_living` | Label as user-submitted metadata |
| Gender | `gender` | Label as user-submitted metadata |
| Country of origin | `country_of_origin` | Label as user-submitted metadata |
| Description | `description` | Label as user-submitted metadata; escaped text; long text wraps safely |
| Content type | `photo.content_type` | Optional safe file fact |
| File size | `photo.size_bytes` | Optional safe file fact |
| Submission status | `status` | Map known values to labels; unknown values become generic unavailable state |
| Created time | `created_at` | Localized with clear local-time context |
| Updated time | `updated_at` | Localized with clear local-time context |
| Last checked time | frontend state | Shows latest successful status refresh |

## Submission Display Blocklist

User-facing views, page titles, copied text, links, and errors must not include:

```text
photo.object_key
photo.original_filename
storage bucket names
storage paths
signed URLs
raw image bytes
direct object-storage links
access tokens
refresh tokens
passwords
internal service hostnames
worker endpoints
classifier endpoints
broker/database/storage console links
```

## Status Mapping

| Backend value | User-facing label | User-facing guidance |
|---|---|---|
| `pending_classification` | Pending classification | The submission was received and is waiting for automated review. |
| `classifying` | Classification in progress | Automated review is currently running. |
| `classified` | Automated checks completed | Review completed. Show safe classification summary if available. |
| `rejected` | Automated checks did not pass | Explain at a high level without internal errors or unsupported actions. |
| `needs_manual_review` | Needs manual review | Explain that the submission needs staff review. |
| `classification_failed` | Classification could not be completed | Explain that review is temporarily unavailable or failed operationally. |
| unknown value | Review unavailable | Do not render the raw backend value. |

Pending and classifying states must provide manual refresh and may show a last-checked timestamp.

## Classification Display Allowlist

Classification display may render only:

| Display field | Backend source | Conditions |
|---|---|---|
| Review decision label | `classification.review_decision` | Known enum only |
| Category label | `classification.category` | Known enum only |
| Safe reasons | `classification.reasons` | Render as review-state reasons only after value-level safety checks; no forbidden person-trait wording |
| Classified time | `classification.classified_at` | Optional localized timestamp |

Allowed review decisions:

```text
passes_automated_checks
fails_automated_checks
needs_manual_review
```

Allowed categories:

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

Unknown category or review decision values must produce a generic unavailable review state and must not be displayed raw.

## Allowlisted Value Safety

Allowlisted fields are not automatically safe to display. Any allowlisted string, including `classification.reasons`, must be suppressed or replaced with generic safe review copy when it contains:

```text
api keys
bearer tokens
credentials
passwords
signed URLs
raw prompts
raw image bytes or image references
private object keys
provider payloads
tracebacks
internal hostnames or endpoints
forbidden person-trait wording
```

If one reason fails the safety check, suppress that reason without rendering the unsafe value. If all reasons fail, show generic review-state fallback copy instead of the raw backend strings.

## Classification Display Blocklist

User-facing views must not render these backend classification fields:

```text
classification.classification_type
classification.score
classification.confidence_score
classification.provider
classification.classifier_version
classification.schema_version
classification.photo_type
classification.image_quality
classification.technical_status
classification.content_safety_status
classification.profile_suitability
classification.is_fallback
classification.fallback_reason
classification.error_code
classification.classification_duration_ms
classification.raw_response
classification.provider_metadata
```

Because classification display is allowlisted, the frontend suppresses all nested/raw values outside the approved display fields, including values that look like:

```text
api keys
bearer tokens
credentials
passwords
signed URLs
raw prompts
raw image bytes
private object keys
provider payloads
tracebacks
internal hostnames
```

## Forbidden Classification Copy

Frontend-generated classification language must not claim or imply:

```text
identity
demographic inference
attractiveness
trustworthiness
competence
desirability
suitability of a person
health
religion
politics
ethnicity
race
nationality inference
economic background
social background
```

Allowed framing:

- "Submission review"
- "Automated checks"
- "Image file could not be read"
- "Required metadata was incomplete"
- "Image type is unsupported"
- "Needs manual review"

Disallowed framing:

- "The person is..."
- "This user looks..."
- "The photo proves..."
- "The model inferred..."
- Any claim that age, gender, place, or country was inferred from the photo.

## User-Submitted Text Rules

User-entered metadata may contain arbitrary words, markup-like text, long strings, or offensive text. The frontend must:

- render it as text, not HTML
- label it as user-submitted metadata
- wrap or truncate long words without overlapping controls
- avoid using user text in system-generated classification copy
- avoid putting user text in route titles or error messages where it could expose filenames, secrets, or unsupported claims

User-submitted metadata is excluded from forbidden-copy checks only when clearly labeled as user-submitted text.

## Date and Time Display

User-facing datetimes must include date, time, and clear local-time context. ISO strings from the backend remain the data source; the frontend can format them for readability.

Fallback for invalid/missing datetime:

```text
Time unavailable
```

Do not display raw invalid date strings.

## Error Display Rules

Safe error copy must tell the user what to do next:

| Condition | Safe action |
|---|---|
| Validation error | Correct highlighted fields |
| Invalid login | Try again with the provided credentials |
| Session expired | Log in again |
| Not found/unauthorized detail | Return to submissions |
| Network timeout after submission send | Check submissions before retrying |
| Service unavailable | Retry later |
| Unexpected response | Review unavailable |

Errors must not expose raw backend response bodies, stack traces, tokens, object keys, original filenames, provider details, or internal infrastructure URLs.
