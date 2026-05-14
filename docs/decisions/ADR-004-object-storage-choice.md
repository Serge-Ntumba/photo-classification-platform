# ADR-004: Object Storage Choice

## 1. Status

Accepted.

## 2. Context

The Photo Classification Platform allows authenticated users to upload photos as part of a profile submission. The assessment requires submitted metadata and classification results to be stored in a relational database, while uploaded photos must be stored in a separate storage layer.

Photos are binary objects and should not be stored as raw database blobs. The platform needs a storage approach that works locally with Docker Compose and can also map cleanly to cloud deployment.

Assumptions for this decision:

- PostgreSQL stores structured application data, not image bytes.
- The database stores photo references, such as object keys, with each submission record.
- Uploaded photo objects are private by default.
- Permanent public image URLs are not stored in the database.
- The Django/DRF service and Celery worker can access object storage using internal credentials.
- The FastAPI classification service receives image bytes from the Celery worker and does not need object storage credentials.

## 3. Decision

Store uploaded photos in object storage.

For local development, use **MinIO** as an S3-compatible object storage service. For production or cloud deployment, use **S3-compatible object storage**, such as Amazon S3 or a managed equivalent.

The database stores a photo reference, usually an object key, not the image bytes themselves. Example object keys may look like:

```text
uploads/submissions/{submission_id}/{filename}
```

Object keys are internal references. They should not be treated as public URLs. When a user or admin needs controlled access to a photo, the application can generate a short-lived signed URL or stream the file through an authorized backend endpoint.

## 4. Alternatives considered

### Alternative 1: Store images in PostgreSQL

This would store uploaded image bytes directly in the relational database, for example as `bytea` fields.

This was rejected.

PostgreSQL is a good fit for structured metadata, relational constraints, filtering, timestamps, and classification results. It is not the best default place to store uploaded photo files. Storing image bytes in the database would make backups larger, increase database load, complicate scaling, and mix two different storage concerns.

### Alternative 2: Store images on the local filesystem

This would save uploaded files to a directory on the application container or host machine.

This was rejected as the main design.

Local filesystem storage is simple, but it does not fit well with containerized and cloud-deployable architecture. Containers are often ephemeral, multiple application replicas would not automatically share the same files, and filesystem persistence would require extra volume management. It also creates a weak migration path to Kubernetes.

A local filesystem may be acceptable for very small prototypes, but it is not the chosen architecture for this assessment.

### Alternative 3: Use object storage

This stores uploaded photos as private objects in an object storage service and stores only object references in PostgreSQL.

This was accepted.

Object storage separates binary file storage from relational metadata storage. It works well with stateless application containers, supports local development through MinIO, and maps directly to production cloud storage through S3-compatible providers.

## 5. Rationale

Object storage is the right fit because uploaded photos are binary objects, while PostgreSQL should remain focused on structured application data.

This separation provides a clean boundary:

- PostgreSQL stores users, submissions, metadata, classification results, status fields, and timestamps.
- Object storage stores photo bytes.
- Submission records store object keys that point to private photo objects.
- Application authorization controls who can access those objects.

Using MinIO locally keeps the development environment close to production behavior without requiring external cloud credentials. Developers can run the full platform with Docker Compose while still using the same S3-compatible access pattern expected in deployment.

Using S3-compatible storage in production keeps web containers stateless. Django instances and Celery workers can scale horizontally without depending on shared local disks.

## 6. Consequences

Positive consequences:

- Photos are kept out of the relational database.
- The database remains smaller and easier to back up, migrate, and query.
- Application containers can remain stateless.
- Local development can use MinIO with Docker Compose.
- Production can use managed S3-compatible storage.
- Object storage can support controlled access through short-lived signed URLs.
- The same application code can work across local and cloud environments with environment-specific configuration.

Trade-offs:

- The system needs object storage configuration in addition to the database.
- Upload and classification flows must handle object storage failures.
- Access control must be implemented carefully because object keys alone are not authorization.
- Local Docker Compose needs one more service, MinIO.
- Production deployments need secrets for object storage credentials.

These trade-offs are acceptable because object storage is a better long-term fit for uploaded photos than database blobs or container-local files.

## 7. Security and privacy notes

Uploaded photos should be private by default.

The platform should store object keys rather than permanent public URLs. An object key is an internal reference used by trusted application components; it should not grant access by itself.

Controlled photo access should use one of the following patterns:

- generate short-lived signed URLs after checking user/admin permissions;
- stream the file through an authenticated backend endpoint;
- keep direct object storage access limited to trusted internal services.

Security rules:

- Do not make uploaded photo buckets public.
- Do not store permanent public URLs in PostgreSQL.
- Do not log image bytes, signed URLs, or storage secrets.
- Validate file type, file size, and image structure before accepting or processing uploads.
- Use private object keys that avoid exposing unnecessary user information.
- Provide object storage credentials through environment variables locally and secrets in Kubernetes.
- Give object storage credentials only to services that need them, such as the Django service and Celery worker.
- Do not give MinIO/S3 credentials to the FastAPI classification service in the current architecture.

This supports the privacy boundary of the system: the classifier receives image bytes from the Celery worker and returns a normalized classification result, but it does not own object storage access.

## 8. How this supports local development and cloud deployment

For local development, Docker Compose can run MinIO alongside Django, PostgreSQL, RabbitMQ, Celery, FastAPI, and Nginx. This lets the full upload and classification flow run locally without requiring cloud infrastructure.

For cloud deployment, MinIO can be replaced with a managed S3-compatible object storage service. The application should use environment variables or Kubernetes Secrets for configuration such as:

```text
OBJECT_STORAGE_ENDPOINT
OBJECT_STORAGE_BUCKET
OBJECT_STORAGE_ACCESS_KEY
OBJECT_STORAGE_SECRET_KEY
OBJECT_STORAGE_REGION
```

In Kubernetes, application services remain stateless because uploaded photos are stored outside the web containers. Django can upload photo objects during submission creation, and Celery can fetch those private objects for classification processing.

This design supports the assessment by clearly separating metadata storage from photo storage, using Docker-friendly local infrastructure, and providing a realistic path to cloud deployment.
