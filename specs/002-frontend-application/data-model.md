# Data Model: Frontend Application

This data model describes frontend-owned display/session state and typed API-facing models. The backend remains the source of truth for persisted users, submissions, photo storage, and classification results.

## Entity Relationship Summary

```text
Visitor -> AuthenticatedUser through UserSession
AuthenticatedUser 1 -> many SubmissionSummary
SubmissionSummary 1 -> 0..1 ClassificationSummary
SubmissionDetail 1 -> 0..1 ClassificationSummary
SubmissionDraft 1 -> 0..1 PhotoSelection
ProtectedRoute -> UserSession
StaffReviewEntryPoint -> AuthenticatedUser(is_staff=true)
```

## Visitor

Unauthenticated browser user who can access public registration and login views.

| Field | Type | Notes |
|---|---|---|
| intended_route | string nullable | Protected route attempted before login; must be same-origin frontend route |
| auth_message | string nullable | Generic access/session message only |

## AuthenticatedUser

Safe account summary returned by the backend.

| Field | Type | Notes |
|---|---|---|
| id | string | Backend user UUID/string |
| email | string | Displayed as account identity |
| username | string | Displayed as account identity |
| is_staff | boolean | Controls frontend admin entry visibility only |

Validation rules:

- Must not include password, access token, refresh token, permissions list, or admin controls from registration.
- `is_staff` controls only whether the review entry point is shown; backend/Django Admin remains the authorization authority.

## UserSession

Browser-session authentication state.

| Field | Type | Notes |
|---|---|---|
| access_token | string nullable | Stored only for active browser session |
| user | AuthenticatedUser nullable | Safe account summary |
| status | enum | `anonymous`, `authenticating`, `authenticated`, `expired` |
| last_verified_at | datetime nullable | Last successful `/api/auth/me/` or login |

State transitions:

```text
anonymous -> authenticating -> authenticated
authenticated -> expired        # backend returns 401/invalid token
authenticated -> anonymous      # sign-out
expired -> authenticating       # user logs in again
```

Rules:

- Sign-out clears `access_token`, `user`, selected local photo previews, and non-submitted sensitive state.
- Refresh token is not persisted because the implemented backend has no refresh endpoint.
- A 401 on protected API calls moves the session to `expired` and hides protected data.
- Other open frontend tabs in the same browser profile must stop showing protected data no later than their next protected navigation, refresh, or backend action after sign-out, session expiry, or permission changes.
- Backend rejection of stale credentials remains the final authority when another tab still has outdated active-session state.

## ProtectedRoute

Frontend route that requires an authenticated session.

| Field | Type | Notes |
|---|---|---|
| path | string | Frontend route pattern |
| required_state | enum | `authenticated` |
| return_after_login | boolean | Whether a denied visitor can return after login |
| fallback_route | string | Workspace or login route |

Rules:

- Deep-link return targets must be same-origin frontend paths.
- Unauthorized or unavailable detail routes return a neutral access/not-found message.

## RegistrationForm

Public account creation form.

| Field | Type | Notes |
|---|---|---|
| email | string | Required; backend validates format/uniqueness |
| username | string | Required; backend validates uniqueness |
| password | string | Required; backend validates password rules |

Rules:

- Must not expose `is_staff`, `is_superuser`, role, permission, or admin fields.
- Successful registration routes to login unless the backend later returns an authenticated session.

## LoginForm

Public authentication form.

| Field | Type | Notes |
|---|---|---|
| email | string | Required |
| password | string | Required |

Rules:

- Invalid credentials must produce generic failure copy.
- Successful login stores only active browser-session auth state.

## SubmissionDraft

Unsaved user-entered submission metadata and selected photo.

| Field | Type | Required | Validation |
|---|---:|---:|---|
| name | string | yes | Non-blank, max 255 characters |
| age | number/string | yes | Integer 0 through 120 inclusive |
| place_of_living | string | yes | Non-blank, max 255 characters |
| gender | string | yes | Non-blank, max 100 characters; user-provided metadata only |
| country_of_origin | string | yes | Non-blank, max 255 characters |
| description | string | no | Max 1,000 characters |
| photo | PhotoSelection nullable | yes | JPEG, PNG, or WebP; >0 bytes; <=5 MB; dimensions 300x300 through 5000x5000 inclusive when browser can inspect |

Rules:

- Preserve safe metadata after validation errors.
- Browser-restricted file inputs may require reselection after validation failure.
- Do not send duplicate create requests while a submission mutation is in progress.

## PhotoSelection

Local file selected before submission.

| Field | Type | Notes |
|---|---|---|
| file | File | Browser `File` object |
| local_preview_url | string nullable | Object URL created before upload only |
| detected_width | number nullable | Available only if browser can decode image |
| detected_height | number nullable | Available only if browser can decode image |
| validation_state | enum | `unchecked`, `valid`, `invalid`, `preview_failed` |
| validation_errors | string[] | User-correctable messages |

Rules:

- Revoke `local_preview_url` when file is cleared, replaced, submit completes, session expires, or user signs out.
- Never persist file bytes, local preview URL, object key, original filename, or signed URL in frontend durable storage.
- After successful creation, the uploaded photo remains unavailable unless a future permission-checked backend photo access path exists.

## SubmissionSummary

Compact safe representation for list rows/cards.

| Field | Type | Notes |
|---|---|---|
| id | string | Backend submission id |
| name | string nullable | Optional user-submitted label when useful for identifying the row |
| status | SubmissionStatus | Processing state |
| classification | ClassificationSummary nullable | Safe latest summary only |
| created_at | string | ISO datetime |
| updated_at | string nullable | ISO datetime when provided |

Dropped backend fields:

- `photo.object_key`
- `photo.original_filename`
- raw/internal classification fields

## SubmissionDetail

Safe detail view for one owned submission.

| Field | Type | Notes |
|---|---|---|
| id | string | Backend submission id |
| metadata | UserSubmittedMetadata | Name, age, place, gender, country, description |
| file_facts | FileFacts nullable | Safe content type and size only |
| status | SubmissionStatus | Processing state |
| classification | ClassificationSummary nullable | Safe latest summary only |
| created_at | string | ISO datetime |
| updated_at | string | ISO datetime |
| last_checked_at | string nullable | Frontend timestamp of latest successful fetch |

Rules:

- `file_facts` may include content type and size bytes; it must not include object key, original filename, storage path, or link.
- User-submitted metadata must be labeled as such and rendered as text.

## UserSubmittedMetadata

Metadata supplied by the user, not inferred by the classifier.

| Field | Type | Notes |
|---|---|---|
| name | string | User-submitted |
| age | number | User-submitted |
| place_of_living | string | User-submitted |
| gender | string | User-submitted |
| country_of_origin | string | User-submitted |
| description | string | Optional user-submitted text |

Rules:

- Render as escaped text.
- Long words and markup-like content must not break layout or alter behavior.
- Never describe these values as classifier findings.

## FileFacts

Safe, optional facts about the uploaded file.

| Field | Type | Notes |
|---|---|---|
| content_type | string nullable | Example `image/jpeg`; safe to display if useful |
| size_bytes | number nullable | Display as human-readable size |

Forbidden fields:

- object key
- original filename
- storage bucket
- signed URL
- raw image bytes
- direct object-storage link

## SubmissionStatus

Known backend submission states mapped to user-facing labels.

| Value | User-facing meaning | Final? |
|---|---|---:|
| `pending_classification` | Pending classification | no |
| `classifying` | Classification in progress | no |
| `classified` | Automated checks completed | yes |
| `rejected` | Automated checks did not pass | yes |
| `needs_manual_review` | Needs manual review | yes |
| `classification_failed` | Classification could not be completed | yes |
| unknown value | Review unavailable | unknown |

Rules:

- Unknown values must not be rendered raw or treated as completed.
- Pending/classifying states expose manual refresh and last-checked time.

## ClassificationSummary

Frontend-approved latest classification display model.

| Field | Type | Notes |
|---|---|---|
| category | ClassificationCategory nullable | Known category or generic unavailable |
| review_decision | ReviewDecision nullable | Known decision or generic unavailable |
| reasons | string[] | Safe reason strings only |
| classified_at | string nullable | ISO datetime |

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

Allowed review decisions:

```text
passes_automated_checks
fails_automated_checks
needs_manual_review
```

Dropped backend classification fields:

- `classification_type`
- `score`
- `confidence_score`
- `provider`
- `classifier_version`
- `schema_version`
- `photo_type`
- `image_quality`
- `technical_status`
- `content_safety_status`
- `profile_suitability`
- `is_fallback`
- `fallback_reason`
- `error_code`
- `classification_duration_ms`
- `raw_response`
- `provider_metadata`

Rules:

- Render only allowlisted category/decision labels and safe reason text.
- `SubmissionStatus` is displayed beside this summary; the summary does not expose a separate raw classifier status field.
- Unknown enum values produce generic unavailable copy and are not displayed raw.
- Copy must describe submission review state only.
- Allowlisted reason strings must still be suppressed or replaced with safe fallback copy when they contain tokens, signed URLs, raw prompts, raw image references, credentials, private object keys, internal endpoints, or forbidden person-trait wording.

## PaginatedSubmissionList

DRF page-number pagination state for `/api/submissions/`.

| Field | Type | Notes |
|---|---|---|
| count | number | Total matching records |
| next | string nullable | Backend next page URL, not displayed as link |
| previous | string nullable | Backend previous page URL, not displayed as link |
| results | SubmissionSummary[] | Current page |
| page | number | Current frontend page query |
| status_filter | SubmissionStatus nullable | Optional backend-supported filter |

Rules:

- Support empty, loading, previous, next, and out-of-range page states.
- Do not invent unsupported filters.
- Default to newest-first ordering through backend behavior or one documented default request value; do not expose user-facing ordering controls.

## ValidationError

User-correctable error normalized from client validation, backend validation, auth failure, or network state.

| Field | Type | Notes |
|---|---|---|
| scope | enum | `field`, `file`, `form`, `auth`, `session`, `not_found`, `network`, `service_unavailable`, `unknown` |
| field | string nullable | Form field when applicable |
| message | string | Safe user-facing copy |
| recoverability | enum | `correct_field`, `login_again`, `retry_later`, `check_submissions`, `navigate_elsewhere` |

Rules:

- Login failure messages remain generic.
- Backend raw error details are mapped to safe copy before display.

## StaffReviewEntryPoint

Navigation target for staff users to reach the existing Django Admin review area.

| Field | Type | Notes |
|---|---|---|
| visible | boolean | `true` only when `AuthenticatedUser.is_staff` is true |
| href | string | Resolved public Django Admin URL; `/admin/` when same-origin, otherwise the backend public origin plus `/admin/` |
| message | string | Explains admin may require separate login |

Rules:

- Non-staff users must not see this entry.
- The frontend does not grant access; Django Admin enforces authorization.
