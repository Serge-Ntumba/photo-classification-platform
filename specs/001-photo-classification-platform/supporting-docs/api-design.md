# API Design: Photo Classification Platform

## 1. Purpose

This document defines the API design for the Photo Classification Platform.

It is a design document for implementation and interview discussion. It is not a generated OpenAPI reference.

The platform has two API surfaces:

1. **Main Django/DRF service**
   - Public authentication APIs
   - User submission APIs
   - Admin review APIs
   - API documentation
   - Main service health check

2. **Internal FastAPI classification service**
   - Internal classification API used by the Celery worker
   - Classifier health check

The main service owns authentication, authorization, submission records, database writes, object storage orchestration, admin access, and API documentation.

The classification service owns only classification logic. It does not own authentication, database writes, PostgreSQL credentials, object storage credentials, or admin behavior.

## 2. API Design Principles

### Clear service ownership

The Django/DRF service owns all public and admin-facing APIs. External clients should never call PostgreSQL, RabbitMQ, MinIO/S3, Celery, or the classifier directly.

The FastAPI classifier is an internal service. It receives image bytes from the Celery worker and returns a normalized classification response.

### Least privilege

API access follows least privilege:

- Anonymous users can register and log in.
- Authenticated users can create and view only their own submissions.
- Admin users can search, filter, and view all submissions.
- The classifier receives only the data required to classify the submission review state.

### Submission-review classification only

The classifier classifies the **submission review state**, not the person in the photo.

The classifier must not infer sensitive traits such as ethnicity, race, attractiveness, gender, nationality, identity, health status, religion, political affiliation, social background, or economic background.

### Asynchronous classification

Submission creation stores metadata and photo references first, then publishes a classification job to RabbitMQ.

The Celery worker consumes the job, fetches the photo from object storage, calls the FastAPI classifier, and saves the classification result through the Django application layer.

Because classification is asynchronous, `POST /api/submissions/` returns a created submission with an initial status such as `pending_classification`. The user can retrieve the final classification result through `GET /api/submissions/{id}/`.

### Consistent JSON responses

All JSON responses should use predictable field names and stable enum values.

Errors should use a consistent response shape so frontend code and API clients can handle validation, authorization, and server errors reliably.

## 3. Base URLs

Local Docker Compose examples:

```text
Main service through Nginx:      http://localhost
Django/DRF API base path:        http://localhost/api/
Django Admin:                    http://localhost/admin/
Classifier internal service:     http://classifier:8000
```

Production examples:

```text
Public API:                      https://example.com/api/
Admin panel:                     https://example.com/admin/
Classifier internal service:     http://classifier.default.svc.cluster.local:8000
```

The classifier should not be exposed through the public ingress.

## 4. Authentication Endpoints

### POST `/api/auth/register/`

Registers a new user account.

**Access:** Anonymous

**Request**

```json
{
  "email": "user@example.com",
  "username": "user1",
  "password": "StrongPassword123!"
}
```

**Response: `201 Created`**

```json
{
  "id": "2d6a63d7-2a65-4e60-972b-2bb2f05f3f41",
  "email": "user@example.com",
  "username": "user1",
  "is_staff": false,
  "created_at": "2026-05-14T10:15:30Z"
}
```

**Notes**

- Passwords must be hashed using Django's password hashing system.
- Public registration must not create admin users.
- Email and/or username uniqueness should be enforced depending on the chosen login method.

---

### POST `/api/auth/login/`

Authenticates a user and returns API credentials.

**Access:** Anonymous

The recommended API authentication approach is JWT using Django REST Framework Simple JWT. Django Admin can continue using Django's session authentication.

**Request**

```json
{
  "email": "user@example.com",
  "password": "StrongPassword123!"
}
```

**Response: `200 OK`**

```json
{
  "access": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "2d6a63d7-2a65-4e60-972b-2bb2f05f3f41",
    "email": "user@example.com",
    "username": "user1",
    "is_staff": false
  }
}
```

**Notes**

- Invalid login attempts should return a generic authentication error.
- Error messages must not reveal whether the email or password was incorrect.

---

### GET `/api/auth/me/`

Returns the currently authenticated user.

**Access:** Authenticated user

**Request headers**

```http
Authorization: Bearer <access_token>
```

**Response: `200 OK`**

```json
{
  "id": "2d6a63d7-2a65-4e60-972b-2bb2f05f3f41",
  "email": "user@example.com",
  "username": "user1",
  "is_staff": false,
  "date_joined": "2026-05-14T10:15:30Z"
}
```

## 5. User Submission Endpoints

### POST `/api/submissions/`

Creates a new photo/profile submission.

**Access:** Authenticated user

**Content type:** `multipart/form-data`

**Request fields**

| Field | Type | Required | Notes |
|---|---:|---:|---|
| `photo` | file | yes | JPEG, PNG, or WebP image |
| `name` | string | yes | User-provided name |
| `age` | integer | yes | Must be within configured range |
| `place_of_living` | string | yes | User-provided location |
| `gender` | string | yes | User-provided metadata only; never inferred from photo |
| `country_of_origin` | string | yes | User-provided country |
| `description` | string | no | Optional free text, length-limited |

**Example multipart fields**

```text
photo=@profile.jpg
name=Alex Morgan
age=29
place_of_living=Berlin
gender=non_binary
country_of_origin=Germany
description=Optional user-provided description.
```

**Response: `201 Created`**

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
    "object_key": "uploads/submissions/45f36c63-05e9-4e1d-893f-5061f2c83c10/profile.jpg",
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

**Behavior**

1. Django authenticates the user.
2. Django validates metadata and the uploaded file.
3. Django uploads the photo to private object storage.
4. Django creates a submission record in PostgreSQL.
5. Django publishes a classification job to RabbitMQ.
6. The Celery worker later saves the classification result.

If the classification worker completes quickly, a later `GET /api/submissions/{id}/` will show the classification result.

---

### GET `/api/submissions/`

Lists submissions owned by the authenticated user.

**Access:** Authenticated user

Regular users must only see their own submissions.

**Query parameters**

| Parameter | Type | Notes |
|---|---:|---|
| `page` | integer | Page number |
| `page_size` | integer | Page size, capped by server config |
| `status` | string | Optional status filter |
| `ordering` | string | Example: `created_at` or `-created_at` |

**Request**

```http
GET /api/submissions/?page=1&page_size=20&status=classified&ordering=-created_at
Authorization: Bearer <access_token>
```

**Response: `200 OK`**

```json
{
  "count": 2,
  "next": null,
  "previous": null,
  "results": [
    {
      "id": "45f36c63-05e9-4e1d-893f-5061f2c83c10",
      "name": "Alex Morgan",
      "age": 29,
      "place_of_living": "Berlin",
      "gender": "non_binary",
      "country_of_origin": "Germany",
      "status": "classified",
      "classification": {
        "category": "valid_profile_candidate",
        "review_decision": "passes_automated_checks",
        "score": 1.0,
        "reason": "Submission passed required metadata and image validation checks.",
        "provider": "rule_based",
        "classified_at": "2026-05-14T10:20:04Z"
      },
      "created_at": "2026-05-14T10:20:00Z"
    }
  ]
}
```

---

### GET `/api/submissions/{id}/`

Retrieves one submission owned by the authenticated user.

**Access:** Authenticated user

Regular users must only access submissions they created.

**Request**

```http
GET /api/submissions/45f36c63-05e9-4e1d-893f-5061f2c83c10/
Authorization: Bearer <access_token>
```

**Response: `200 OK`**

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
    "object_key": "uploads/submissions/45f36c63-05e9-4e1d-893f-5061f2c83c10/profile.jpg",
    "original_filename": "profile.jpg",
    "content_type": "image/jpeg",
    "size_bytes": 348221
  },
  "status": "classified",
  "classification": {
    "id": "e971761a-c2ce-4c11-8c34-07d505db9f9a",
    "category": "valid_profile_candidate",
    "review_decision": "passes_automated_checks",
    "score": 1.0,
    "reason": "Submission passed required metadata and image validation checks.",
    "provider": "rule_based",
    "classifier_version": "rules-v1",
    "schema_version": "classification-result-v1",
    "classified_at": "2026-05-14T10:20:04Z"
  },
  "created_at": "2026-05-14T10:20:00Z",
  "updated_at": "2026-05-14T10:20:04Z"
}
```

**Authorization behavior**

If an authenticated user requests another user's submission, the API should return `404 Not Found` or `403 Forbidden`. For privacy, `404 Not Found` is preferred because it avoids confirming the existence of another user's record.

## 6. Admin Endpoints

Admin APIs are separate from normal user submission APIs.

Admin endpoints must require authenticated staff/admin access, for example `is_staff=true` or an equivalent permission.

### GET `/api/admin/submissions/`

Lists all submissions for admin review.

**Access:** Admin only

**Query parameters**

| Parameter | Type | Notes |
|---|---:|---|
| `page` | integer | Page number |
| `page_size` | integer | Page size, capped by server config |
| `search` | string | Search by name, place, country, or photo reference |
| `age` | integer | Exact age filter |
| `age_min` | integer | Minimum age filter |
| `age_max` | integer | Maximum age filter |
| `gender` | string | User-submitted gender metadata |
| `place_of_living` | string | Location filter |
| `country_of_origin` | string | Country filter |
| `status` | string | Submission processing status |
| `category` | string | Latest classification category |
| `review_decision` | string | Latest classification review decision |
| `created_after` | datetime | ISO 8601 timestamp |
| `created_before` | datetime | ISO 8601 timestamp |
| `ordering` | string | Example: `created_at`, `-created_at`, `age`, `-age` |

**Request**

```http
GET /api/admin/submissions/?country_of_origin=Germany&age_min=18&age_max=40&review_decision=needs_manual_review&page=1
Authorization: Bearer <admin_access_token>
```

**Response: `200 OK`**

```json
{
  "count": 1,
  "next": null,
  "previous": null,
  "results": [
    {
      "id": "45f36c63-05e9-4e1d-893f-5061f2c83c10",
      "user": {
        "id": "2d6a63d7-2a65-4e60-972b-2bb2f05f3f41",
        "email": "user@example.com",
        "username": "user1"
      },
      "name": "Alex Morgan",
      "age": 29,
      "place_of_living": "Berlin",
      "gender": "non_binary",
      "country_of_origin": "Germany",
      "photo": {
        "object_key": "uploads/submissions/45f36c63-05e9-4e1d-893f-5061f2c83c10/profile.jpg",
        "content_type": "image/jpeg",
        "size_bytes": 348221
      },
      "status": "needs_manual_review",
      "classification": {
        "category": "low_quality_image",
        "review_decision": "needs_manual_review",
        "score": 0.45,
        "reason": "Image dimensions are below the recommended threshold.",
        "provider": "rule_based",
        "classified_at": "2026-05-14T10:20:04Z"
      },
      "created_at": "2026-05-14T10:20:00Z",
      "updated_at": "2026-05-14T10:20:04Z"
    }
  ]
}
```

---

### GET `/api/admin/submissions/{id}/`

Retrieves one submission for admin review.

**Access:** Admin only

**Request**

```http
GET /api/admin/submissions/45f36c63-05e9-4e1d-893f-5061f2c83c10/
Authorization: Bearer <admin_access_token>
```

**Response: `200 OK`**

```json
{
  "id": "45f36c63-05e9-4e1d-893f-5061f2c83c10",
  "user": {
    "id": "2d6a63d7-2a65-4e60-972b-2bb2f05f3f41",
    "email": "user@example.com",
    "username": "user1"
  },
  "name": "Alex Morgan",
  "age": 29,
  "place_of_living": "Berlin",
  "gender": "non_binary",
  "country_of_origin": "Germany",
  "description": "Optional user-provided description.",
  "photo": {
    "object_key": "uploads/submissions/45f36c63-05e9-4e1d-893f-5061f2c83c10/profile.jpg",
    "original_filename": "profile.jpg",
    "content_type": "image/jpeg",
    "size_bytes": 348221
  },
  "status": "classified",
  "latest_classification": {
    "id": "e971761a-c2ce-4c11-8c34-07d505db9f9a",
    "category": "valid_profile_candidate",
    "review_decision": "passes_automated_checks",
    "score": 1.0,
    "reason": "Submission passed required metadata and image validation checks.",
    "provider": "rule_based",
    "classifier_version": "rules-v1",
    "schema_version": "classification-result-v1",
    "classified_at": "2026-05-14T10:20:04Z"
  },
  "classification_history": [
    {
      "id": "e971761a-c2ce-4c11-8c34-07d505db9f9a",
      "category": "valid_profile_candidate",
      "review_decision": "passes_automated_checks",
      "provider": "rule_based",
      "classifier_version": "rules-v1",
      "created_at": "2026-05-14T10:20:04Z"
    }
  ],
  "created_at": "2026-05-14T10:20:00Z",
  "updated_at": "2026-05-14T10:20:04Z"
}
```

**Notes**

- Admin APIs should expose enough detail for review and debugging.
- Raw secrets, signed URLs, and unnecessary provider output must not be exposed.
- Photo previews, if implemented, should use short-lived signed URLs generated by the main service, not permanent public URLs.

## 7. Internal Classification Endpoint

### POST `/classify`

Classifies a submission review state.

**Service:** FastAPI classification service

**Access:** Internal only

Only the Celery worker should call this endpoint. It should be reachable only on the internal Docker or Kubernetes network.

The classifier should receive image bytes and minimal technical metadata. It should not receive unnecessary demographic fields such as name, gender, country of origin, or place of living.

**Content type:** `multipart/form-data`

**Request fields**

| Field | Type | Required | Notes |
|---|---:|---:|---|
| `file` | file | yes | Image bytes fetched from object storage by the worker |
| `submission_id` | string | yes | Internal correlation identifier |
| `content_type` | string | yes | Detected or declared MIME type |
| `size_bytes` | integer | yes | File size |
| `metadata_complete` | boolean | yes | Whether required metadata passed validation in Django |

**Example multipart fields**

```text
file=@profile.jpg
submission_id=45f36c63-05e9-4e1d-893f-5061f2c83c10
content_type=image/jpeg
size_bytes=348221
metadata_complete=true
```

**Response: `200 OK`**

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

**Example response for invalid image**

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

**Allowed categories**

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

**Allowed review decisions**

```text
passes_automated_checks
fails_automated_checks
needs_manual_review
```

**Notes**

- The classifier must not write to PostgreSQL.
- The classifier must not fetch from MinIO/S3.
- The classifier must not receive object storage credentials.
- The classifier must not return sensitive inferred traits.
- The Celery worker validates and stores the normalized response through the Django application layer.

## 8. Health Check Endpoints

### GET `/health` on the Django/DRF service

**Access:** Public or infrastructure-only, depending on deployment choice

**Response: `200 OK`**

```json
{
  "service": "main-api",
  "status": "ok",
  "version": "1.0.0"
}
```

Optional deeper readiness checks may include database, object storage, and broker connectivity, but the first version can keep liveness and readiness separate:

- Liveness: process is running.
- Readiness: service can reach required dependencies.

---

### GET `/health` on the FastAPI classification service

**Access:** Internal only

**Response: `200 OK`**

```json
{
  "service": "classification-api",
  "status": "ok",
  "provider": "rule_based",
  "version": "rules-v1"
}
```

## 9. Error Response Format

All API errors should use a consistent JSON format.

### Generic error shape

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

### Common error codes

| HTTP status | Code | Meaning |
|---:|---|---|
| `400` | `BAD_REQUEST` | Malformed request |
| `400` | `VALIDATION_ERROR` | One or more fields are invalid |
| `401` | `AUTHENTICATION_REQUIRED` | Missing or invalid credentials |
| `403` | `PERMISSION_DENIED` | Authenticated user lacks permission |
| `404` | `NOT_FOUND` | Record does not exist or is not visible to the user |
| `409` | `CONFLICT` | Duplicate or conflicting state |
| `413` | `FILE_TOO_LARGE` | Uploaded file exceeds size limit |
| `415` | `UNSUPPORTED_MEDIA_TYPE` | Uploaded file type is not supported |
| `429` | `RATE_LIMITED` | Too many requests, if rate limiting is enabled |
| `500` | `INTERNAL_ERROR` | Unexpected server error |
| `503` | `DEPENDENCY_UNAVAILABLE` | Required dependency is unavailable |

### Authentication error example

```json
{
  "error": {
    "code": "AUTHENTICATION_REQUIRED",
    "message": "Authentication credentials were not provided.",
    "field_errors": {},
    "request_id": "req_01HXW4Q5J2M7K9Z2S3A1B4C6D8"
  }
}
```

### Permission error example

```json
{
  "error": {
    "code": "PERMISSION_DENIED",
    "message": "You do not have permission to access this resource.",
    "field_errors": {},
    "request_id": "req_01HXW4Q5J2M7K9Z2S3A1B4C6D8"
  }
}
```

## 10. Validation Rules

### Account validation

- Email must be valid and unique if email login is used.
- Username must be unique if username login is used.
- Password must meet configured password-strength rules.
- Public registration must not allow users to set `is_staff` or `is_superuser`.

### Submission metadata validation

| Field | Rule |
|---|---|
| `name` | Required, trimmed, max length configured by model |
| `age` | Required integer from `0` through `120` inclusive |
| `place_of_living` | Required, trimmed, max length configured by model |
| `gender` | Required user-submitted value; never inferred from photo |
| `country_of_origin` | Required, trimmed, max length configured by model |
| `description` | Optional, max length 1,000 characters |

Gender is stored because the assessment requires it as metadata and admin filter criteria. The platform must not infer gender from the photo and must not use gender to score whether a submission should pass review.

### Photo validation

Required first-version validation:

- File is required.
- File size must be greater than zero.
- File size must be no larger than 5 MB.
- Allowed MIME types: `image/jpeg`, `image/png`, `image/webp`.
- File signature should match the declared MIME type.
- Image should be parseable by the configured image library.
- Image dimensions must be from 300x300 through 5000x5000 pixels inclusive.
- The system should reject files that are clearly not images.

### Classification response validation

The Celery worker or Django application layer should validate classifier responses before saving them.

Required fields:

- `classification_type`
- `category`
- `review_decision`
- `provider`
- `classifier_version`
- `schema_version`
- `classified_at`

Validation rules:

- `classification_type` must be `submission_review`.
- `category` must be one of the allowed category values.
- `review_decision` must be one of the allowed decision values.
- `score`, if present, must be between `0` and `1`.
- Responses must not contain sensitive inferred traits.
- Unexpected classifier responses should not be stored as trusted results.

## 11. Pagination and Filtering Strategy

### Pagination

List endpoints should use DRF page-number pagination.

Recommended parameters:

```text
page=1
page_size=20
```

Recommended defaults:

```text
default page_size = 20
max page_size = 100
```

Response shape:

```json
{
  "count": 125,
  "next": "https://example.com/api/admin/submissions/?page=2&page_size=20",
  "previous": null,
  "results": []
}
```

### User filtering

`GET /api/submissions/` should stay intentionally limited.

Regular users can filter their own submissions by:

- `status`
- `ordering`
- pagination fields

This keeps the user API simple and prevents broad data exploration.

### Admin filtering

`GET /api/admin/submissions/` supports richer filtering because admin review requires search and retrieval across submitted records.

Admin filters should be backed by database indexes where practical:

- `age`
- `gender`
- `place_of_living`
- `country_of_origin`
- `status`
- latest classification `category`
- latest classification `review_decision`
- `created_at`

Search can start with basic Django filtering or DRF search over:

- `name`
- `place_of_living`
- `country_of_origin`
- `photo_object_key`

Full-text search is not required for the first version.

## 12. OpenAPI/Swagger Documentation Approach

The main Django/DRF service should expose generated API documentation using DRF Spectacular or an equivalent OpenAPI tool.

Recommended endpoints:

```text
/api/schema/
/api/docs/
```

The generated documentation should cover:

- Authentication endpoints
- User submission endpoints
- Admin submission endpoints
- Request and response schemas
- Error schemas where practical
- Authentication requirements

The FastAPI classification service automatically supports OpenAPI generation, but its documentation should remain internal because the classifier is not a public API.

Recommended internal classifier docs:

```text
/openapi.json
/docs
```

In production, classifier documentation should not be publicly exposed unless protected by network policy, authentication, or internal access controls.

This Markdown document remains the human-readable API design. Generated OpenAPI docs provide exact schema details once implementation begins.

## 13. Security Notes for API Access

### Public API security

- Use HTTPS in production.
- Require authentication for all submission endpoints.
- Use strong password hashing through Django.
- Do not expose admin creation through public registration.
- Keep error messages generic for authentication failures.
- Apply request size limits at Nginx and application level.
- Validate uploaded files before processing.
- Avoid logging raw image bytes or sensitive metadata unnecessarily.

### Authorization rules

- Anonymous users can only register, log in, and access explicitly public health/docs endpoints.
- Regular users can only create and view their own submissions.
- Admin endpoints require staff/admin permissions.
- Admin access should be auditable through logs where practical.

### Photo access

- Store photos in private object storage.
- Store object keys in PostgreSQL, not permanent public URLs.
- Do not expose object storage credentials to clients.
- If photo preview is needed, generate short-lived signed URLs through the main service.
- The classifier should receive image bytes from the worker, not public URLs.

### Internal service security

- RabbitMQ, PostgreSQL, MinIO/S3, Celery, and the classifier should not be publicly exposed.
- The classifier should be reachable only from trusted internal services.
- In Kubernetes, use Services, NetworkPolicies, Secrets, and internal DNS to restrict access.
- The classifier should not have PostgreSQL or MinIO/S3 credentials.
- The worker should have only the credentials required to fetch photos and save results.

### Classification safety

- The classifier must classify submission review state only.
- The classifier must not infer identity or sensitive traits from the photo.
- Demographic metadata must not be sent to the classifier unless a specific non-sensitive validation need is documented.
- Demographic metadata must not be used to judge whether a person is acceptable, safe, desirable, or likely to pass review.
- Model-provider classification, if added later, must follow the same response schema and safety boundaries.

## 14. Endpoint Summary

| Endpoint | Service | Access | Purpose |
|---|---|---|---|
| `POST /api/auth/register/` | Django/DRF | Anonymous | Register user |
| `POST /api/auth/login/` | Django/DRF | Anonymous | Log in and receive credentials |
| `GET /api/auth/me/` | Django/DRF | Authenticated | Current user profile |
| `POST /api/submissions/` | Django/DRF | Authenticated | Create submission and queue classification |
| `GET /api/submissions/` | Django/DRF | Authenticated | List own submissions |
| `GET /api/submissions/{id}/` | Django/DRF | Authenticated owner | Retrieve own submission |
| `GET /api/admin/submissions/` | Django/DRF | Admin only | Search/filter all submissions |
| `GET /api/admin/submissions/{id}/` | Django/DRF | Admin only | Retrieve one submission for review |
| `GET /health` | Django/DRF | Public or infrastructure-only | Main service health |
| `POST /classify` | FastAPI | Internal only | Classify submission review state |
| `GET /health` | FastAPI | Internal only | Classifier health |
