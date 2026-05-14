# Contract: Main Django/DRF API

**Source**: [supporting-docs/api-design.md](../supporting-docs/api-design.md)

The Django/DRF main service owns all public and admin-facing APIs. External clients must not call PostgreSQL, RabbitMQ, MinIO/S3, Celery, or the FastAPI classifier directly.

## Ownership

Django/DRF owns:

- User registration and login.
- Authentication and authorization.
- Submission creation and retrieval.
- Admin review APIs and Django Admin.
- Metadata validation.
- Object storage orchestration.
- PostgreSQL writes.
- Classification job publishing.
- API documentation.

## Base Paths

Local examples:

```text
Main service through Nginx:  http://localhost
API base path:               http://localhost/api/
Django Admin:                http://localhost/admin/
```

Production examples:

```text
Public API:                  https://example.com/api/
Admin panel:                 https://example.com/admin/
```

## Authentication Endpoints

### POST `/api/auth/register/`

Access: anonymous.

Request:

```json
{
  "email": "user@example.com",
  "username": "user1",
  "password": "StrongPassword123!"
}
```

Response: `201 Created`

```json
{
  "id": "2d6a63d7-2a65-4e60-972b-2bb2f05f3f41",
  "email": "user@example.com",
  "username": "user1",
  "is_staff": false,
  "created_at": "2026-05-14T10:15:30Z"
}
```

Rules:

- Passwords must be hashed by Django.
- Public registration must not create admin users.
- Email and/or username uniqueness must be enforced according to chosen login method.

### POST `/api/auth/login/`

Access: anonymous.

Recommended API auth: JWT through DRF Simple JWT or equivalent. Django Admin may continue using Django session auth.

Request:

```json
{
  "email": "user@example.com",
  "password": "StrongPassword123!"
}
```

Response: `200 OK`

```json
{
  "access": "<access_token>",
  "refresh": "<refresh_token>",
  "user": {
    "id": "2d6a63d7-2a65-4e60-972b-2bb2f05f3f41",
    "email": "user@example.com",
    "username": "user1",
    "is_staff": false
  }
}
```

Invalid login attempts must return a generic error and must not reveal whether the email or password was wrong.

### GET `/api/auth/me/`

Access: authenticated user.

Response: `200 OK`

```json
{
  "id": "2d6a63d7-2a65-4e60-972b-2bb2f05f3f41",
  "email": "user@example.com",
  "username": "user1",
  "is_staff": false,
  "date_joined": "2026-05-14T10:15:30Z"
}
```

## User Submission Endpoints

### POST `/api/submissions/`

Access: authenticated user.

Content type: `multipart/form-data`.

Fields:

| Field | Type | Required | Notes |
|---|---|---:|---|
| `photo` | file | yes | JPEG, PNG, or WebP |
| `name` | string | yes | User-provided |
| `age` | integer | yes | Configured range, recommended 0 to 120 |
| `place_of_living` | string | yes | User-provided location |
| `gender` | string | yes | User-provided metadata only |
| `country_of_origin` | string | yes | User-provided country |
| `description` | string | no | Length-limited |

Response: `201 Created`

```json
{
  "id": "45f36c63-05e9-4e1d-893f-5061f2c83c10",
  "name": "Alex Morgan",
  "age": 29,
  "place_of_living": "Berlin",
  "gender": "non_binary",
  "country_of_origin": "Germany",
  "description": "Optional user-provided description.",
  "photo": {
    "object_key": "submissions/45f36c63-05e9-4e1d-893f-5061f2c83c10/profile.jpg",
    "original_filename": "profile.jpg",
    "content_type": "image/jpeg",
    "size_bytes": 348221
  },
  "status": "pending_classification",
  "classification": null,
  "created_at": "2026-05-14T10:20:00Z",
  "updated_at": "2026-05-14T10:20:00Z"
}
```

Behavior:

1. Authenticate user.
2. Validate metadata and uploaded file.
3. Upload photo to private object storage.
4. Store submission in PostgreSQL.
5. Publish RabbitMQ/Celery classification job.
6. Return created submission with pending classification state.

### GET `/api/submissions/`

Access: authenticated user.

Regular users list only their own submissions.

Query parameters:

| Parameter | Type | Notes |
|---|---|---|
| `page` | integer | Page number |
| `page_size` | integer | Capped by server config |
| `status` | string | Optional status filter |
| `ordering` | string | Example: `created_at`, `-created_at` |

### GET `/api/submissions/{id}/`

Access: authenticated user.

Regular users retrieve only submissions they created. Requests for another user's submission should return `404 Not Found` or `403 Forbidden`; `404 Not Found` is preferred for privacy.

Response includes:

- Submission metadata.
- Private photo reference.
- Current status.
- Latest classification result if available.
- Created and updated timestamps.

## Admin Endpoints

Admin APIs require staff/admin access.

### GET `/api/admin/submissions/`

Access: admin only.

Query parameters:

| Parameter | Notes |
|---|---|
| `page`, `page_size` | Pagination |
| `search` | Search by name, place, country, or photo reference |
| `age`, `age_min`, `age_max` | Age filters |
| `gender` | User-submitted gender metadata |
| `place_of_living` | Location filter |
| `country_of_origin` | Country filter |
| `status` | Submission processing status |
| `category` | Latest classification category |
| `review_decision` | Latest classification review decision |
| `created_after`, `created_before` | Timestamp filters |
| `ordering` | Ordering |

### GET `/api/admin/submissions/{id}/`

Access: admin only.

Response includes:

- Submission metadata.
- Owning user summary.
- Photo object reference.
- Latest classification result.
- Classification history.
- Timestamps.

Admin responses must not expose raw secrets, storage credentials, permanent public URLs, unnecessary provider output, or unsafe inferred traits.

## Error Shape

All API errors should use a consistent JSON shape:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request contains invalid fields.",
    "field_errors": {
      "age": ["Age must be between 0 and 120."],
      "photo": ["Unsupported image type."]
    },
    "request_id": "req_01HXW4Q5J2M7K9Z2S3A1B4C6D8"
  }
}
```

Common codes:

```text
BAD_REQUEST
VALIDATION_ERROR
AUTHENTICATION_REQUIRED
PERMISSION_DENIED
NOT_FOUND
CONFLICT
FILE_TOO_LARGE
UNSUPPORTED_MEDIA_TYPE
RATE_LIMITED
INTERNAL_ERROR
DEPENDENCY_UNAVAILABLE
```

## OpenAPI Documentation

The main service should expose generated OpenAPI documentation:

```text
/api/schema/
/api/docs/
```

The generated docs should cover auth, user submissions, admin submissions, schemas, error shapes, and auth requirements.

## Safety Rules

- Regular users can only access their own submissions.
- Admin APIs require staff/admin permissions.
- User-provided demographic metadata is stored for required fields and admin filtering only.
- Gender, age, nationality/country, place of living, and similar metadata must not influence classification suitability or score.
- Permanent public photo URLs must not be stored or returned as durable references.
- If photo preview exists, use short-lived signed URLs or authenticated backend streaming after authorization.
