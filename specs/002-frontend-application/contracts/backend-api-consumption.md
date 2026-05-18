# Contract: Frontend Consumption of Django/DRF API

The frontend consumes only the public Django/DRF API and the existing Django Admin URL through the platform public entry point. It must not call PostgreSQL, RabbitMQ, MinIO/S3, Celery worker endpoints, worker health endpoints, or the FastAPI classifier.

## Base URL

Local development:

```text
Frontend dev server: http://localhost:5173
Backend public entry point: http://localhost
API base path: /api/
Django Admin path: /admin/
```

The frontend must treat `VITE_API_BASE_URL` or equivalent configuration as a public HTTP origin only. Empty or relative configuration means same-origin `/api/`. The staff admin target resolves against the same public platform origin in production; during separate-origin local Vite development it resolves against the backend public origin, such as `http://localhost/admin/`.

## Authentication Header

Authenticated API calls include:

```http
Authorization: Bearer <access_token>
```

The frontend stores only the current access token for the active browser session. The implemented backend does not expose a token refresh route; any 401 from a protected API call clears protected client state and prompts login. Sign-out, session expiry, and permission changes in another open frontend tab must converge no later than the next protected navigation, refresh, or backend action.

## POST `/api/auth/register/`

Purpose: create a normal non-staff account.

Access: anonymous.

Request JSON:

```json
{
  "email": "user@example.com",
  "username": "user1",
  "password": "StrongPassword123!"
}
```

Expected success: `201 Created`

Consumed response fields:

| Field | Type | Frontend use |
|---|---|---|
| `id` | string | Optional success context only |
| `email` | string | Optional success context only |
| `username` | string | Optional success context only |
| `is_staff` | boolean | Must be false for public registration; do not expose controls |
| `created_at` | string | Optional |

Frontend behavior:

- Route to login after success.
- Do not create an authenticated session unless the backend response shape changes to include credentials.
- Do not display staff/admin/permission fields as configurable options.

## POST `/api/auth/login/`

Purpose: authenticate and create the frontend active browser session.

Access: anonymous.

Request JSON:

```json
{
  "email": "user@example.com",
  "password": "StrongPassword123!"
}
```

Expected success: `200 OK`

Consumed response fields:

| Field | Type | Frontend use |
|---|---|---|
| `access` | string | Active browser-session bearer token |
| `refresh` | string | Do not persist; no implemented refresh endpoint |
| `user.id` | string | Account identity |
| `user.email` | string | Account identity |
| `user.username` | string | Account identity |
| `user.is_staff` | boolean | Staff review entry visibility |

Frontend behavior:

- Generic failure copy for invalid credentials.
- On success, return to safe protected deep link when allowed; otherwise route to workspace.
- Do not show or log tokens.

## GET `/api/auth/me/`

Purpose: verify current user and refresh safe account summary.

Access: authenticated.

Expected success: `200 OK`

Consumed response fields:

| Field | Type | Frontend use |
|---|---|---|
| `id` | string | Account identity |
| `email` | string | Account identity |
| `username` | string | Account identity |
| `is_staff` | boolean | Staff review entry visibility |

Frontend behavior:

- On 401, clear protected client state and prompt login.
- If `is_staff` changes, update the staff review entry visibility no later than the next protected navigation, refresh, or backend action.

## POST `/api/submissions/`

Purpose: create one photo submission and queue asynchronous classification.

Access: authenticated.

Content type: `multipart/form-data`

Request fields:

| Field | Type | Required | Client validation |
|---|---|---:|---|
| `photo` | file | yes | JPEG, PNG, or WebP; >0 bytes; <=5 MB; dimensions 300x300 through 5000x5000 when browser can inspect |
| `name` | string | yes | Non-blank; <=255 characters |
| `age` | integer | yes | 0 through 120 inclusive |
| `place_of_living` | string | yes | Non-blank; <=255 characters |
| `gender` | string | yes | Non-blank; <=100 characters |
| `country_of_origin` | string | yes | Non-blank; <=255 characters |
| `description` | string | no | <=1,000 characters |

Expected success: `201 Created`

Consumed response fields:

| Field | Type | Frontend use |
|---|---|---|
| `id` | string | Route to detail/new pending state |
| metadata fields | strings/numbers | User-submitted metadata display |
| `photo.content_type` | string | Optional safe file fact |
| `photo.size_bytes` | number | Optional safe file fact |
| `status` | string | Submission status mapping |
| `classification` | object/null | Safe transform only |
| `created_at` | string | Display datetime |
| `updated_at` | string | Display datetime |

Response fields that must be dropped:

- `photo.object_key`
- `photo.original_filename`
- all internal/unsafe classification fields listed in [safe-display-contract.md](safe-display-contract.md)

Frontend behavior:

- Disable duplicate submit while request is in flight.
- On timeout/network uncertainty after the request is sent, guide the user to check existing submissions before retrying.
- On success, show the created submission in `pending_classification` unless the backend already returned a later status.

## GET `/api/submissions/`

Purpose: list user-owned submissions.

Access: authenticated.

Supported query parameters:

| Parameter | Type | Notes |
|---|---|---|
| `page` | integer | DRF page number |
| `status` | string | Backend-supported status filter |

The backend currently configures page-number pagination with a default page size of 20. The frontend should not depend on client-controlled `page_size` unless the backend later documents it as supported.

Expected success: `200 OK`

Consumed response shape:

```json
{
  "count": 2,
  "next": null,
  "previous": null,
  "results": []
}
```

Frontend behavior:

- Default ordering is newest first.
- Do not expose user-facing ordering controls in this feature.
- Render only current user's records returned by the backend.
- Support empty, loading, previous page, next page, and out-of-range states.
- Do not display `next` or `previous` raw URLs.

## GET `/api/submissions/{id}/`

Purpose: retrieve one user-owned submission.

Access: authenticated owner.

Expected success: `200 OK`

Consumed fields: same safe fields as `POST /api/submissions/`.

Frontend behavior:

- 403 or 404 both map to neutral not-found/access copy.
- Pending/classifying statuses expose manual refresh and last-checked time.
- Completed/rejected/manual-review/failed statuses render safe classification summary when present.

## Staff Review Entry

Frontend target:

```text
/admin/ when same-origin, otherwise {backend public origin}/admin/
```

Rules:

- Show link only when the current safe account summary has `is_staff=true`.
- Copy must explain that Django Admin may require its own login session.
- The frontend does not call or recreate admin APIs for this feature.

## API Error Normalization

The current backend wraps DRF errors as:

```json
{
  "error": {
    "code": "api_error",
    "detail": "..."
  }
}
```

The frontend must also tolerate DRF-style field error objects if returned by future backend changes. Normalize errors into:

| Normalized scope | Trigger |
|---|---|
| `field` | Correctable metadata field validation |
| `file` | Correctable selected-photo validation |
| `form` | Whole-request validation that is not tied to one field |
| `auth` | Login failure; display generic copy |
| `session` | 401 on protected route/action |
| `not_found` | 404 or privacy-preserving denial |
| `network` | timeout, offline, DNS, aborted request |
| `service_unavailable` | 5xx/503 |
| `unknown` | malformed or unexpected response |

Rules:

- Never display tokens, raw backend tracebacks, private object keys, original filenames, raw provider responses, signed URLs, raw prompts, or internal infrastructure hostnames in error copy.
- Never display unsafe values merely because they appear inside an otherwise allowlisted response string.
- Backend remains authoritative for validation and authorization even when frontend pre-validation passes.
