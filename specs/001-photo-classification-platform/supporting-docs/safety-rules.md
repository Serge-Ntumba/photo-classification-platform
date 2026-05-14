# Safety Rules

## 1. Purpose

This document defines the safety and security rules for the Photo Classification Platform.

The assessment explicitly asks for safety rules and an explanation of **what was implemented, where it was implemented, and why it was implemented**. This document answers that requirement in a practical way for the planned architecture.

The system uses:

- Django + Django REST Framework as the main application service.
- FastAPI as the separate classification service.
- Celery and RabbitMQ for asynchronous classification jobs.
- PostgreSQL for relational metadata and classification results.
- MinIO locally, or S3-compatible object storage in production, for uploaded photos.
- Nginx as the public reverse proxy.

This document defines **38 practical safety rules** for the assessment implementation and its production evolution.

The most important classification rule is:

> The system classifies the **submission review state**, not the person in the photo.

The classifier must not infer sensitive traits such as ethnicity, race, attractiveness, identity, nationality, gender, age, health, religion, political affiliation, social background, economic background, or personal background from the photo.

## 2. Assumptions

The assessment leaves some implementation details open. This safety design uses the following assumptions:

- The first implementation is a take-home assessment, not a fully regulated production system.
- The default classifier is rule-based.
- The classifier reviews submission validity and processing state, not the person in the photo.
- Django/DRF owns authentication, authorization, metadata validation, upload orchestration, admin access, and database writes.
- The FastAPI classifier is an internal-only service.
- The classifier does not receive PostgreSQL credentials.
- The classifier does not receive MinIO/S3 credentials.
- The Celery worker fetches image bytes from object storage and sends them to the classifier.
- MinIO is used for local development.
- Production can use S3 or another S3-compatible object storage provider.
- Django Admin is acceptable as the first admin panel because it provides authentication, permissions, filtering, searching, and detail views.

## 3. Safety and Security Goals

The platform has the following safety and security goals:

- Accept submissions only from authenticated users.
- Prevent users from accessing submissions they do not own.
- Restrict admin review functionality to admin users.
- Validate uploaded files before processing.
- Store uploaded photos privately in object storage.
- Store metadata and classification results in PostgreSQL.
- Keep internal infrastructure services private.
- Keep classification limited to submission review state.
- Avoid identity inference, biometric analysis, person scoring, or sensitive trait inference.
- Avoid leaking secrets, tokens, signed URLs, raw image bytes, or unnecessary personal data in logs.
- Keep the assessment implementation simple enough to build and defend in an interview.
- Clearly separate what is included in the assessment version from what would be added in production.

## 4. Safety Rules Table

| # | Safety rule | Where implemented | Why it exists | Current implementation | Production improvement |
|---:|---|---|---|---|---|
| 1 | Require authentication before submission creation | Django/DRF permission classes on submission endpoints | Prevent anonymous users from uploading photos or creating records | `POST /api/submissions/` requires an authenticated user | Add rate limiting, account verification, and suspicious activity monitoring |
| 2 | Restrict users to their own submissions | Django/DRF queryset filtering and object permissions | Prevent users from viewing or enumerating other users' records | Regular users only list and retrieve submissions where `submission.user == request.user` | Add audit logs for denied access attempts |
| 3 | Restrict admin APIs to staff/admin users | Django/DRF admin endpoints and Django Admin permissions | Protect global search, filtering, and review access | Admin endpoints require staff/admin permission | Add role-based permissions for reviewer, auditor, and super-admin roles |
| 4 | Prevent public admin creation | Registration serializer and user creation logic | Stop public users from granting themselves admin privileges | Public registration ignores or rejects `is_staff` and `is_superuser` fields | Use controlled admin provisioning through an identity provider or operations process |
| 5 | Validate required metadata | Django/DRF serializers and model constraints | Ensure accepted submissions contain the fields required by the assessment | `name`, `age`, `place_of_living`, `gender`, `country_of_origin`, and `photo` are required | Add stricter normalization for countries and locations |
| 6 | Validate age range | Django/DRF serializer and database check constraint | Prevent invalid or unrealistic metadata values | Age is required and limited to a configured range such as `0` to `120` | Adjust the range according to product, legal, or business requirements |
| 7 | Limit optional description length | Django/DRF serializer and model field length | Prevent oversized text input and reduce abuse risk | Description is optional and length-limited | Add moderation workflow if free text becomes business-critical |
| 8 | Require a photo for each submission | Django/DRF serializer validation | The assessment requires each submission to include a photo | Submission creation rejects missing photo files | Add resumable uploads if large files are supported later |
| 9 | Restrict allowed image types | Django upload validation and classifier validation | Prevent arbitrary files from being accepted as photos | Allow only configured image types such as JPEG, PNG, and WebP | Add antivirus scanning and deeper content inspection |
| 10 | Enforce maximum file size | Nginx request limits and Django upload validation | Prevent resource exhaustion and oversized uploads | Files above a configured maximum, for example 5 MB, are rejected | Use direct-to-object-storage upload with signed upload policies if larger files are needed |
| 11 | Check file signature, not only MIME type | Django validation and/or FastAPI classifier validation | Client-provided MIME types can be spoofed | File signature and image parsing are checked before trusting the upload | Add dedicated malware scanning and quarantine flow |
| 12 | Reject unreadable or corrupted images | FastAPI classifier and Django validation where practical | Prevent broken files from being treated as valid submissions | Classifier can return `invalid_file` or `unsupported_image_type` | Add a separate validation service or quarantine stage if needed |
| 13 | Store photos outside PostgreSQL | Django storage layer using MinIO locally or S3-compatible storage in production | Avoid turning the relational database into a binary file store | PostgreSQL stores object keys and metadata only | Add lifecycle policies, retention rules, and storage encryption policies |
| 14 | Store object keys, not permanent public URLs | Django model and storage service | Prevent permanent public access to private photos | Submission records store private object keys | Generate short-lived signed URLs for controlled photo preview |
| 15 | Keep object storage private | MinIO/S3 bucket configuration and application access rules | Uploaded photos contain personal data and should not be public | Photos are accessed internally by Django/Celery using credentials | Add bucket policies, encryption, access logs, retention policies, and least-privilege IAM |
| 16 | Do not expose object storage credentials to clients | Django settings, environment variables, and Kubernetes Secrets | Prevent users from accessing storage directly | Only backend services receive storage credentials | Use cloud IAM roles or workload identity instead of static keys |
| 17 | Keep the classifier internal | Docker Compose network and Kubernetes Service design | The classifier is not a public API | Only the Celery worker calls FastAPI `/classify` | Enforce Kubernetes NetworkPolicies and service-to-service authentication |
| 18 | Classifier does not access PostgreSQL | FastAPI service boundary | Keep classification stateless and limit blast radius | Classifier receives image bytes and returns normalized JSON only | Add runtime secret policy to ensure classifier cannot receive database credentials |
| 19 | Classifier does not access MinIO/S3 | FastAPI service boundary | Prevent unnecessary storage permissions in the classifier | Celery fetches image bytes and sends them to the classifier | Use network policies and IAM to enforce the separation |
| 20 | Classify submission review state only | FastAPI classification logic and response schema | Avoid unsafe person classification and sensitive trait inference | Output categories describe file/submission review state, such as `valid_profile_candidate`, `invalid_file`, or `low_quality_image` | Add automated tests that fail if sensitive trait fields are introduced |
| 21 | Do not infer ethnicity, attractiveness, identity, nationality, gender, age, or background from the photo | FastAPI classifier rules and documentation | These are sensitive or inappropriate inferences for this platform | The classifier does not perform face recognition, biometric analysis, or demographic inference | Require model safety review before integrating any external model provider |
| 22 | Do not use demographic metadata to judge a person | Django validation, classifier input design, and review policy | Required metadata should support filtering, not discrimination | Demographic fields are stored as user-submitted metadata and are not sent to the classifier by default | Add policy checks, reviewer training, and audit logs for production review workflows |
| 23 | Send minimal data to the classifier | Celery worker request to FastAPI `/classify` | Reduce privacy risk and prevent unnecessary data processing | Worker sends image bytes and technical metadata such as content type, size, submission ID, and metadata completeness | Add data classification labels and internal request auditing |
| 24 | Validate classifier response before saving | Celery worker and Django application layer | Prevent malformed or unsafe classifier output from becoming trusted data | Worker validates category, review decision, score, schema version, and required fields | Add JSON schema validation and contract tests in CI |
| 25 | Store classification history separately | PostgreSQL schema through `classification_results` table | Preserve auditability and support future reclassification | Each result is linked to a submission, with the latest result shown by default | Add admin audit trail and reclassification job records |
| 26 | Avoid logging raw photo bytes | Django, Celery, FastAPI, and Nginx logging configuration | Prevent sensitive data leakage in logs | Logs include request IDs, status, and errors, not raw image data | Add centralized log redaction and DLP checks |
| 27 | Avoid logging secrets or signed URLs | Application logging and error handling | Prevent credential leakage | Environment values, credentials, and signed URLs are not logged | Use secret scanning in CI and centralized secret management |
| 28 | Keep error messages safe | Django/DRF exception handling and FastAPI error responses | Avoid leaking internal implementation details | API returns consistent error codes and generic messages where appropriate | Add structured error tracking with sensitive-field redaction |
| 29 | Use environment variables for configuration | Docker Compose `.env` and Django/FastAPI settings | Keep configuration separate from code | `.env.example` documents required values; real `.env` is not committed | Use Kubernetes Secrets or an external secret manager |
| 30 | Do not commit real secrets | Git ignore rules, documentation, and CI checks | Prevent accidental credential exposure | Repository includes example values only, not real credentials | Add automated secret scanning in CI |
| 31 | Protect RabbitMQ, PostgreSQL, MinIO, and classifier from public access | Docker Compose networking and Kubernetes deployment design | Internal infrastructure should not be reachable by users | Nginx is the public entry point; internal services stay private | Add private subnets, firewall rules, NetworkPolicies, and managed private services |
| 32 | Separate public and internal services in deployment | Docker Compose networks and Kubernetes Services/Ingress | Prevent direct public access to the database, broker, storage, worker, and classifier | Only Nginx/Django public routes are exposed locally | Use Ingress, private services, NetworkPolicies, and managed private infrastructure |
| 33 | Use HTTPS in production | Ingress or load balancer configuration | Protect credentials, tokens, and personal data in transit | Local development may use HTTP; production should terminate HTTPS at ingress | Add HSTS and automated certificate management |
| 34 | Use Django password hashing | Django authentication system | Prevent plaintext password storage | Passwords are hashed by Django | Add password policy, MFA for admins, and breached-password checks |
| 35 | Protect admin panel | Django Admin authentication and permissions | Admins can view all submitted records, so access must be controlled | Django Admin requires staff login | Add MFA, admin audit logs, IP allowlisting, and separate admin roles |
| 36 | Avoid exposing raw external provider output | Django model and admin/API serializers | External provider responses may contain unnecessary or unsafe data | Optional `raw_response` is sanitized before storage, or omitted | Add strict provider response filtering and retention policy |
| 37 | Provide safe failure states | Celery retry handling and submission status field | Classification failure should not lose the submission or create unsafe assumptions | Failed jobs can mark a submission as `classification_failed` or `needs_manual_review` | Add dead-letter queues, retry dashboards, and alerting |
| 38 | Run safety checks in CI | GitHub Actions or chosen CI pipeline | Catch unsafe changes before images are built or deployed | Run linting, tests, and basic validation checks before Docker image build | Add secret scanning, dependency scanning, container image scanning, and policy checks |

## 5. File Upload Safety Rules

File upload is one of the highest-risk parts of the platform because users can send arbitrary files.

The assessment implementation should include these safeguards:

- A photo is required for every submission.
- Empty files are rejected.
- File size is limited.
- Only configured image types are accepted, such as JPEG, PNG, and WebP.
- The system checks the file signature and image parseability instead of trusting only the client-provided MIME type.
- Invalid, unsupported, or unreadable images are rejected or classified into a safe failure category.
- Uploaded photos are stored in private object storage.
- PostgreSQL stores metadata and object references, not raw image bytes.

These rules are enforced mainly in the Django/DRF submission endpoint and storage layer. The FastAPI classifier can repeat image validation as a second line of defense.

## 6. Authentication and Authorization Rules

Django owns authentication and authorization.

The access model is:

- Anonymous users can register and log in.
- Authenticated users can create submissions.
- Authenticated users can view only their own submissions.
- Admin users can search, filter, and view all submissions.
- Public registration cannot create admin accounts.

The classifier does not perform user authorization because it is an internal service. It is called by the Celery worker, not by browsers or public API clients.

This keeps authorization in one place and avoids duplicating permission logic across services.

## 7. Personal Data and Logging Rules

The platform stores personal metadata because the assessment requires fields such as name, age, place of living, gender, and country of origin.

The safety goal is to store only what is needed and avoid unnecessary exposure.

Rules:

- Do not log raw image bytes.
- Do not log passwords, access tokens, refresh tokens, object storage credentials, or signed URLs.
- Avoid logging full personal metadata unless needed for debugging.
- Use request IDs for traceability.
- Return safe error messages that do not expose internal credentials or infrastructure details.
- Store only the user-submitted fields required by the assessment.

For the assessment, basic structured logging is enough. In production, logs should be centralized, redacted, access-controlled, monitored, and retained according to policy.

## 8. Classification Safety Rules

The classifier must classify the submission review state, not the person.

Acceptable classification categories include:

- `valid_profile_candidate`
- `invalid_file`
- `unsupported_image_type`
- `suspicious_file`
- `low_quality_image`
- `incomplete_metadata`
- `non_profile_image`
- `unsafe_content`

Acceptable review decisions include:

- `passes_automated_checks`
- `fails_automated_checks`
- `needs_manual_review`

The classifier must not return inferred traits such as:

- Ethnicity
- Race
- Attractiveness
- Identity
- Nationality
- Gender
- Age
- Health status
- Religion
- Political affiliation
- Social background
- Economic background
- Personal desirability
- Trustworthiness
- Competence

The default rule-based classifier checks whether the submission and image are processable and safe to review. It does not identify the person, evaluate the person, or score the person.

## 9. Demographic Metadata Guardrails

The assessment requires the submitted metadata to include age, gender, place of living, and country of origin.

These fields are handled as **user-submitted metadata only**.

Rules:

- Gender is not inferred from the photo.
- Age is not inferred from the photo.
- Nationality or country of origin is not inferred from the photo.
- Demographic metadata is not used to decide whether a person is acceptable, desirable, trustworthy, safe, attractive, competent, or high quality.
- Demographic metadata is used for required admin filtering and record review only.
- The classifier should not receive demographic metadata unless a specific non-sensitive validation need is documented.

This keeps the implementation aligned with the assessment while avoiding unsafe person classification.

## 10. External Model-Provider Privacy Rules

The assessment implementation uses a rule-based classifier by default. It does not require an external model provider.

If a model-provider classifier is added later, it must follow the same safety boundary:

- It must use the same `/classify` interface.
- It must return the same normalized response schema.
- It must classify submission review state only.
- It must not identify the person in the photo.
- It must not infer sensitive traits.
- It must receive only the minimum data required.
- It must not receive unnecessary demographic metadata.
- Provider responses must be validated before storage.
- Raw provider output must be sanitized before being stored.
- If the provider is unavailable or unsafe, the system should fall back to rule-based classification or mark the submission for manual review.

External model integration is a future enhancement, not a requirement for the first assessment implementation.

## 11. Storage and Object Access Rules

Photos are stored in object storage, such as MinIO locally or S3-compatible storage in production.

Rules:

- Store raw photo bytes in object storage, not PostgreSQL.
- Store private object keys in PostgreSQL.
- Do not store permanent public URLs.
- Do not expose storage credentials to users.
- Do not expose storage credentials to the classifier.
- The Celery worker may fetch objects because it needs to send image bytes to the classifier.
- Photo preview, if implemented, should use short-lived signed URLs generated by the main Django service.

In production, object storage should use encryption, access logging, lifecycle policies, retention policies, and least-privilege IAM permissions.

## 12. Secrets and Configuration Rules

Configuration is environment-specific.

Rules:

- Use `.env` files for local development.
- Commit `.env.example`, not real `.env` files.
- Store production secrets in Kubernetes Secrets or an external secret manager.
- Do not log environment variables.
- Do not commit database passwords, RabbitMQ credentials, object storage keys, Django secret keys, or model-provider API keys.
- Give each service only the secrets it needs.

The classifier should not receive PostgreSQL or object storage credentials because it does not need them.

## 13. Admin Access Rules

Admins can access all submissions because the assessment requires an admin panel for filtering and search.

Admin safeguards:

- Admin access requires staff/admin authentication.
- Admin endpoints are separate from regular user endpoints.
- Non-admin users cannot access admin search or filtering.
- Admins can view metadata, photo references, classification results, and timestamps.
- Admins should not see raw secrets, storage credentials, or unnecessary provider output.
- Admin access should be auditable in production.

For the assessment, Django Admin is acceptable because it provides authentication, permissions, filtering, searching, and detail views with minimal custom code.

## 14. Assessment Implementation vs Production Additions

### Included in the assessment implementation

The assessment version should include:

- Django authentication and password hashing.
- User registration and login.
- Authenticated submission creation.
- User-only access to own submissions.
- Admin-only access to global submission review.
- File size and type validation.
- Private object storage using MinIO locally.
- PostgreSQL metadata and classification result storage.
- Rule-based classification.
- Internal-only FastAPI classifier.
- Celery worker calling the classifier.
- Classifier response validation before storing results.
- Environment-based configuration.
- `.env.example` without real secrets.
- Docker Compose networking that keeps infrastructure services internal.
- Basic health checks.
- Basic structured logs.
- CI pipeline with linting, tests, and Docker image build.

### Would be added in production

A production deployment should add:

- HTTPS enforcement.
- Stronger rate limiting.
- MFA for admins.
- Admin audit logs.
- Secret scanning in CI.
- Dependency scanning.
- Container image scanning.
- Centralized secret management.
- Antivirus or malware scanning for uploads.
- Short-lived signed URLs for photo previews.
- Object storage encryption and access logs.
- Kubernetes NetworkPolicies.
- Private cloud networking.
- Dead-letter queue for failed classification jobs.
- Centralized logging and monitoring.
- Alerting on classification failures and queue backlog.
- Data retention and deletion workflows.
- External model-provider safety review, if model integration is added.
- Formal privacy and compliance review.

## 15. Trade-offs

The safety design intentionally favors simple, enforceable controls over complex security infrastructure.

- Django owns authorization because splitting authorization across multiple services would add unnecessary complexity for this assessment.
- The classifier is internal-only and stateless, which limits its permissions but requires the Celery worker to fetch image bytes.
- Rule-based classification is less advanced than machine-learning classification, but it is deterministic, testable, CI-friendly, and avoids unsafe person classification.
- Django Admin is not a custom review UI, but it is secure, fast to implement, and sufficient for filtering and searching submitted records.
- MinIO is appropriate for local development, while production should use managed S3-compatible storage where possible.
- Production features such as malware scanning, MFA, audit logging, centralized monitoring, and Kubernetes NetworkPolicies are documented but not required for the first assessment version.

These trade-offs are acceptable because the goal is to deliver a cloud-deployable, defensible assessment project without over-engineering the first implementation.

## 16. Summary

The safety design is intentionally practical.

The platform accepts user-submitted metadata and photos, stores photos privately, stores metadata and classification results in PostgreSQL, and produces a classification result.

The classification result describes the review state of the submission, not the person in the photo.

This keeps the project aligned with the assessment requirements while avoiding unsafe biometric, identity, demographic, or sensitive-trait classification.
