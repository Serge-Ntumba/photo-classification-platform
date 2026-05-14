# Product Specification: Photo Classification Platform

## 1. Product Goal

The goal of the Photo Classification Platform is to provide a cloud-deployable web platform where registered users can submit a photo with required metadata and receive a classification result for the submitted record.

Administrators must be able to securely review, search, and filter submitted records.

The platform is designed as a take-home assessment project, so the scope prioritizes clear product behavior, defensible engineering decisions, security awareness, and maintainable documentation over unnecessary feature depth.

## 2. User Roles

### Anonymous User

An anonymous user is a visitor who has not authenticated.

Anonymous users can:

- Register for an account.
- Log in with valid credentials.
- Access public documentation or health/status pages if exposed.

Anonymous users cannot:

- Upload photos.
- Submit metadata.
- View classification results.
- Access submitted records.
- Access admin functionality.

### Registered User

A registered user is an authenticated non-admin user.

Registered users can:

- Create a profile submission.
- Upload one photo per submission.
- Provide required metadata.
- Add an optional description.
- Receive the submission review classification result.
- View their own submission result, where supported.

Registered users cannot:

- View other users’ submissions.
- Search or filter all platform submissions.
- Access admin-only views.
- Modify classification rules.
- Override safety decisions.

### Admin

An admin is an authenticated user with elevated permissions.

Admins can:

- View submitted records.
- Search and filter submissions.
- Filter by age, gender, place of living, and country of origin.
- View metadata, photo reference, classification result, and timestamps.
- Review submissions for operational or moderation purposes.

Admins cannot:

- Use the system to infer protected or sensitive personal traits from photos.
- Bypass security controls without authorization.
- Access raw secrets or infrastructure credentials through the application.

## 3. Core User Journeys

### Journey 1: Account Registration

1. An anonymous user opens the platform.
2. The user registers with required account information.
3. The platform validates the registration data.
4. The account is created.
5. The user can log in and access submission features.

### Journey 2: Login

1. An anonymous user provides valid credentials.
2. The platform authenticates the user.
3. The user receives an authenticated session or token.
4. The user can access registered-user functionality.

### Journey 3: Photo and Metadata Submission

1. A registered user starts a new submission.
2. The user uploads a photo.
3. The user provides the required metadata:
   - Name
   - Age
   - Place of living
   - Gender
   - Country of origin
4. The user may provide an optional description.
5. The platform validates the submitted data.
6. The platform stores the photo in the storage layer.
7. The platform stores the metadata and photo reference.
8. The platform requests a submission review classification.
9. The user receives the classification result.

### Journey 4: Submission Review Classification

1. A submitted record is evaluated by the classification capability.
2. The classification result describes the review state of the submission.
3. The classification must not describe or infer sensitive traits about the person in the photo.
4. The result is stored with the submission.
5. The result is available to the submitting user and admins, according to access rules.

### Journey 5: Admin Review

1. An admin logs in.
2. The admin opens the submission review area.
3. The admin views submitted records.
4. The admin searches or filters records by supported metadata fields.
5. The admin opens a record to inspect metadata, photo reference, classification result, and timestamps.

## 4. Functional Requirements

### Account and Authentication

- The platform must support user registration.
- The platform must support user login.
- The platform must distinguish between regular users and admins.
- Admin functionality must be protected by admin-only authorization.
- Unauthenticated users must not be able to submit photos or view submission data.

### Submission Creation

- Registered users must be able to create a submission.
- Each submission must include:
  - Name
  - Age
  - Place of living
  - Gender
  - Country of origin
  - Photo
- Each submission may include:
  - Optional description
- The platform must validate required fields before accepting a submission.
- Invalid submissions must return clear validation errors.
- The platform must store metadata separately from the uploaded photo.
- The platform must store a reference to the uploaded photo with the submission record.

### Submission Review Classification

- Each accepted submission must receive a classification result.
- The classification result must be defined as a **submission review classification**.
- The classification must describe the review state or processing outcome of the submitted record.
- The classification must not classify the person in the photo.
- The platform must not infer or return sensitive traits from the photo, including:
  - Ethnicity
  - Race
  - Attractiveness
  - Gender
  - Nationality
  - Identity
  - Background
  - Health status
  - Religion
  - Political affiliation
- Classification results should be simple, explainable, and suitable for an assessment project.

Example acceptable classification categories:

- `accepted`
- `needs_review`
- `rejected`

Example acceptable reasons:

- Photo missing or unreadable.
- Unsupported file type.
- Metadata incomplete.
- Submission passed basic validation.
- Submission requires manual review.

### Admin Review and Filtering

- Admins must be able to view a list of submitted records.
- Admins must be able to search submissions.
- Admins must be able to filter submissions by:
  - Age
  - Gender
  - Place of living
  - Country of origin
- Admins must be able to view:
  - Submission metadata
  - Photo reference
  - Classification result
  - Creation timestamp
  - Update timestamp, where applicable
- Non-admin users must not be able to access admin submission lists or filters.

### Safety Rules

The platform must include safety rules to prevent misuse and unsafe classification behavior.

Safety rules must ensure that:

- The classifier does not identify people.
- The classifier does not infer protected or sensitive attributes from photos.
- The classifier result is limited to the submission review state.
- Uploaded files are validated before processing.
- Invalid, missing, or unsupported photos are handled safely.
- Users cannot access submissions they do not own.
- Admin-only features are protected by authorization checks.

### Documentation

The repository must include product and technical documentation that explains:

- Product scope.
- API behavior.
- Data model.
- Security and safety rules.
- Local development setup.
- Deployment approach.
- CI/CD approach.
- Operational considerations.

## 5. Non-Functional Requirements

### Security

- Authentication must be required for user submissions.
- Authorization must be enforced for admin-only functionality.
- Users must not be able to access other users’ submissions.
- Uploaded files must be validated by type and size.
- Secrets must not be committed to the repository.
- Environment-specific configuration must be handled through environment variables or secret management.
- Error messages must avoid exposing sensitive internal details.

### Privacy and Safety

- The platform must avoid person classification.
- The platform must avoid sensitive attribute inference.
- Photo access must be controlled.
- Stored photo references must not expose unnecessary internal storage details.
- The system should collect only the fields required by the assessment.

### Reliability

- The platform should handle invalid input gracefully.
- Failed classification requests should produce a safe error state or review state.
- A submission should not be lost if classification fails after metadata and photo storage.
- Basic health checks should exist for deployable services.

### Maintainability

- Product behavior must be documented clearly.
- Validation rules must be explicit.
- Classification categories must be easy to understand.
- The system should be structured so that API, architecture, and database documentation can derive from this specification.

### Deployability

- The platform must be suitable for local development and cloud deployment.
- Required services must be containerized.
- The platform must support environment-specific configuration.
- The delivery should include guidance for running locally and deploying to a Kubernetes environment.

### Observability

- The platform should expose enough logs to debug submissions, classification requests, and admin actions.
- Logs must not include raw secrets.
- Logs should avoid storing unnecessary sensitive photo or personal data.
- Basic service health and readiness checks should be available.

## 6. Explicit Assumptions

The assessment leaves some product details open. The following assumptions are used for this implementation:

1. A registered user can create submissions after logging in.
2. Anonymous users can only register or log in.
3. Admins are created through a controlled administrative process, not open public registration.
4. A submission belongs to the user who created it.
5. Regular users can only access their own submissions.
6. Admins can access all submissions for review purposes.
7. The classification result is a submission review classification, not a person classification.
8. The classifier may use metadata and file validation signals to determine review status.
9. The classifier must not infer sensitive attributes from the image.
10. The photo itself is stored in a storage layer, while the database stores metadata and a photo reference.
11. The product supports one uploaded photo per submission.
12. The optional description is user-provided free text and should be validated for length.
13. Search and filtering are required for admins only.
14. The platform is an assessment project, so advanced production features are documented where relevant but not all need to be fully implemented.

## 7. Out-of-Scope Items

The following items are intentionally out of scope for the initial assessment implementation:

- Real facial recognition.
- Person identification.
- Biometric analysis.
- Inferring gender, ethnicity, nationality, attractiveness, or other sensitive traits from photos.
- Advanced machine learning model training.
- Manual moderation workflows with multiple reviewer states.
- User profile management beyond what is needed for authentication and submissions.
- Password reset and email verification, unless added as optional enhancements.
- Payment, billing, or subscription functionality.
- Multi-photo submissions.
- Public galleries or sharing features.
- Real-time notifications.
- Complex audit dashboards.
- Advanced analytics or reporting.
- Mobile applications.
- Multi-language support.
- Production-grade content moderation beyond the documented safety rules.

## 8. Acceptance Criteria

### Account Access

- Anonymous users can register.
- Anonymous users can log in.
- Invalid login attempts fail safely.
- Registered users can access submission functionality.
- Non-admin users cannot access admin-only pages or endpoints.

### Submission Flow

- A registered user can upload a photo and submit required metadata.
- The platform rejects submissions with missing required fields.
- The platform rejects unsupported or invalid photo uploads.
- The platform stores accepted metadata.
- The platform stores the photo in the configured storage layer.
- The platform stores a photo reference with the submission.
- The platform returns a submission review classification result.

### Classification Behavior

- Every accepted submission receives a classification result.
- The classification result represents the review state of the submission.
- The result does not classify the person in the photo.
- The result does not infer sensitive traits.
- Unsafe or invalid inputs are classified into a safe review or rejection state.

### Admin Functionality

- Admins can view submitted records.
- Admins can search submissions.
- Admins can filter submissions by age.
- Admins can filter submissions by gender.
- Admins can filter submissions by place of living.
- Admins can filter submissions by country of origin.
- Admins can view metadata, photo reference, classification result, and timestamps.
- Non-admin users cannot access admin submission lists.

### Documentation and Delivery

- The repository includes this product specification.
- The repository includes API documentation.
- The repository includes architecture documentation.
- The repository includes database design documentation.
- The repository includes local development instructions.
- The repository includes deployment notes.
- The repository includes CI/CD notes or configuration.
- The repository includes a screen recording demonstrating setup, usage, and architecture.

## 9. Open Questions and Take-Home Resolutions

### Question 1: What exactly should the system classify?

**Resolution:**  
The system classifies the submission review state, not the person in the photo.

This keeps the feature useful for the assessment while avoiding unsafe or sensitive photo-based person classification.

### Question 2: Is a real machine learning model required?

**Resolution:**  
A real ML model is not assumed to be required. The assessment asks for a classification result, but it does not require model training or biometric analysis.

For the take-home, a simple explainable classifier is acceptable as long as the classification boundary is documented clearly and the service interface could later support a more advanced model.

### Question 3: Can the classifier use the photo?

**Resolution:**  
The classifier may use safe file-level or submission-level checks, such as whether the photo exists, whether the file type is supported, or whether the submission is processable.

The classifier must not infer who the person is or sensitive traits about the person.

### Question 4: Should admins see all submissions?

**Resolution:**  
Yes. Admins need access to submitted records in order to search, filter, and review them.

This access is restricted to admin users only.

### Question 5: Can registered users see other users’ submissions?

**Resolution:**  
No. Registered users can only create and access their own submissions unless explicitly granted admin privileges.

### Question 6: What does “location” mean?

**Resolution:**  
The assessment refers to “place of living” and filtering by location. In this product spec, “location” is treated as the user-provided place of living.

Country of origin remains a separate field.

### Question 7: How should gender be handled?

**Resolution:**  
Gender is treated only as user-submitted metadata because the assessment requires it as a submission field and admin filter.

The platform must not infer gender from the uploaded photo.

### Question 8: What happens if classification fails?

**Resolution:**  
The submission should remain traceable, and the classification result should move into a safe state such as `needs_review` or an error state documented by the API.

The system should avoid losing accepted submissions because of a downstream classification failure.

### Question 9: How much production functionality is expected?

**Resolution:**  
The project should be cloud-deployable and demonstrate production awareness, but it remains a take-home assessment.

The implementation should favor clear boundaries, working flows, documented tradeoffs, and maintainable structure over enterprise-level complexity.