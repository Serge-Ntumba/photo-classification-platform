# Feature Specification: Frontend Application

**Feature Branch**: `002-frontend-application`

**Created**: 2026-05-18

**Status**: Draft

**Input**: User description: "Build the frontend part for this application. The backend is ready; read the implemented backend and architecture documents including research.md, plan.md, spec.md, tasks.md, data-model.md, api-design.md, architecture.md, and database-design.md. Update the frontend specification to resolve the product critique while staying focused on user behavior and the accepted backend plan/API/current implementation."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Register, Log In, and Start Work (Priority: P1)

As a visitor, I can register a normal account, log in, and reach an authenticated workspace so that I can use the platform without a separate API client.

**Why this priority**: The frontend has no user value until account access works end to end.

**Independent Test**: A first-time visitor can create a non-staff account, proceed to login, authenticate successfully, see their account identity and workspace navigation, sign out, and receive safe generic feedback for invalid credentials.

**Acceptance Scenarios**:

1. **Given** a visitor with valid registration details, **When** they submit the registration form, **Then** the platform creates a normal non-staff account, confirms registration, routes them to login, and never displays staff/admin permission controls.
2. **Given** a visitor with valid login credentials, **When** they log in, **Then** they reach the authenticated workspace and see their account identity, create-submission navigation, submissions navigation, and sign-out action.
3. **Given** a visitor attempts to open a protected submission route before login, **When** they authenticate successfully, **Then** they return to the originally requested route if they are allowed to view it, otherwise they land in the authenticated workspace with a neutral access message.
4. **Given** invalid login credentials, **When** the visitor attempts login, **Then** the frontend displays a generic authentication failure without confirming whether the email, username, or password was wrong.
5. **Given** an authenticated user whose session is expired or rejected by the backend, **When** they attempt a protected action, **Then** the frontend prompts them to log in again, avoids exposing protected data, and preserves safe unsent draft metadata where possible.
6. **Given** an authenticated user, **When** they sign out, **Then** the frontend clears the active browser session and non-submitted sensitive local state in the current tab, causes other open frontend tabs in the same browser profile to stop showing protected data no later than their next protected navigation, refresh, or backend action, then returns them to the public access flow.

---

### User Story 2 - Create a Photo Submission (Priority: P2)

As a registered user, I can complete a guided photo submission form with required metadata so that my record is accepted for asynchronous classification review.

**Why this priority**: Photo and metadata submission is the core workflow the frontend must make usable.

**Independent Test**: An authenticated user can select a valid photo, enter required metadata, submit once, receive validation feedback for mistakes, and see the created submission in a pending review state.

**Acceptance Scenarios**:

1. **Given** an authenticated user and a valid JPEG, PNG, or WebP image within the accepted size and dimension limits, **When** they provide name, age, place of living, gender, country of origin, and optional description, **Then** the frontend creates the submission and shows it in a pending classification state.
2. **Given** missing, whitespace-only, out-of-range, or too-long metadata, **When** the user submits the form, **Then** the frontend highlights the affected fields, explains the correction needed, and preserves the other entered values.
3. **Given** a photo that is missing, empty, unsupported, too large, unreadable, or outside accepted image boundaries, **When** the user attempts submission, **Then** the frontend gives actionable validation feedback and does not imply that classification has started.
4. **Given** the browser can read the selected image before upload, **When** the user selects it, **Then** the frontend may show a local pre-submit preview that disappears when the file is cleared, cancelled, or the user signs out.
5. **Given** submission is in progress, **When** the user clicks submit repeatedly or attempts to navigate away, **Then** the frontend prevents duplicate submission attempts and makes the current processing state clear.
6. **Given** a network interruption or timeout after submission is sent, **When** the final creation result is uncertain, **Then** the frontend guides the user to check their submissions before retrying so duplicates are not encouraged.

---

### User Story 3 - Track Submission Status and Classification Results (Priority: P3)

As a registered user, I can view my submissions and their latest review outcome so that I understand whether each submission is waiting, running, accepted by automated checks, rejected, needs manual review, or failed operationally.

**Why this priority**: Classification is asynchronous, so delayed results must be understandable and safe.

**Independent Test**: After creating a submission, a user can list their submissions, open a detail view, observe pending progress, refresh the state, and read a safe latest classification summary once available.

**Acceptance Scenarios**:

1. **Given** a user with no submissions, **When** they open their submissions area, **Then** they see an empty state with a clear path to create a submission.
2. **Given** a user with one or more submissions, **When** they open their submissions area, **Then** they see only their own submissions, ordered newest first by default, with status, creation time, and a safe latest review summary when available.
3. **Given** the backend returns multiple pages of submissions, **When** the user reaches the list view, **Then** they can move through available pages without losing the current authenticated context.
4. **Given** a newly created submission is pending or classifying, **When** the user views the list or detail page, **Then** the frontend shows a non-final state, a last-checked time when available, and a clear way to refresh the status.
5. **Given** classification completes successfully, **When** the user opens the submission detail, **Then** the frontend shows the review decision, category, safe reasons, and classified time in plain language.
6. **Given** classification is rejected, needs manual review, or fails operationally, **When** the user views the submission, **Then** the frontend explains the state without exposing internal errors, provider details, secrets, or unsupported retry/reclassification actions.
7. **Given** a user attempts to open a submission they do not own or that no longer exists, **When** access is denied or the record is not found, **Then** the frontend presents a neutral not-found or access message without revealing another user's data.

---

### User Story 4 - Keep Results and Metadata Safe to Display (Priority: P4)

As a user, I can read submission and classification information without seeing internal secrets, private photo references, unsafe inference language, or broken layouts caused by user-entered text.

**Why this priority**: The backend intentionally protects photos, credentials, raw classifier data, and person-trait safety boundaries; the frontend must not weaken those protections.

**Independent Test**: A submission whose backend response includes private photo references, original filenames, internal classifier fields, long user text, and safe classification output renders only approved user-facing information.

**Acceptance Scenarios**:

1. **Given** the backend response includes private photo object keys or original uploaded filenames, **When** the frontend renders user-facing list or detail views, **Then** those fields are not displayed, copied into links, exposed in page titles, or shown in error messages.
2. **Given** the backend response includes internal classifier fields such as provider identifiers, classifier versions, schema versions, fallback details, error codes, durations, raw responses, provider metadata, scores, or confidence values, **When** the frontend renders classification results, **Then** the user-facing result shows the submission status beside a classification summary limited to review decision, category, safe reasons, and relevant timestamps.
3. **Given** classification language is shown, **When** the user reads the result, **Then** the text describes the submission review state only and never suggests identity, demographic, attractiveness, trustworthiness, competence, desirability, health, religion, politics, background, or other person-trait inference.
4. **Given** an otherwise allowlisted classification reason contains a token, signed URL, raw prompt, raw image reference, private object key, credential, internal endpoint, or forbidden person-trait wording, **When** the frontend renders the result, **Then** that reason is suppressed or replaced with generic safe review copy rather than shown verbatim.
5. **Given** user-entered metadata includes long words, markup-like text, offensive text, or words that are forbidden in classification copy, **When** the frontend displays that metadata, **Then** it is treated as user-submitted text, cannot alter the page behavior, and does not cause layout overlap.
6. **Given** the user is viewing submitted metadata such as gender, place of living, or country of origin, **When** the frontend displays it, **Then** it is clearly presented as user-provided metadata rather than a classifier finding.

---

### User Story 5 - Use the Frontend on Common Devices (Priority: P5)

As a registered user, I can complete the main workflow on common desktop and mobile-sized screens with accessible controls and recoverable errors.

**Why this priority**: The frontend must turn the backend into a usable product experience beyond a developer demo.

**Independent Test**: The registration, login, submission, list, and detail views can be completed using keyboard navigation and common mobile and desktop viewport sizes without overlapping text, hidden controls, or blocked actions.

**Acceptance Scenarios**:

1. **Given** a small-screen device, **When** the user registers, logs in, creates a submission, lists submissions, or views results, **Then** all required controls remain reachable and readable without horizontal scrolling for core content.
2. **Given** a keyboard-only user, **When** they move through the primary workflow, **Then** focus order, labels, and action states allow completion without a mouse.
3. **Given** a screen-reader user, **When** validation errors, upload progress, status refreshes, or session expiry occur, **Then** the change is available without relying only on color or visual position.
4. **Given** a backend validation error, session timeout, unavailable service, or network interruption, **When** the user is affected, **Then** the frontend shows recoverable guidance and preserves safe local state where appropriate.

---

### User Story 6 - Reach the Existing Staff Review Area (Priority: P6)

As a staff user, I can discover and navigate to the existing protected admin review area from the frontend so that operational review remains available without building a second admin system.

**Why this priority**: The accepted backend implementation provides review through the existing admin area; the frontend should expose a clean staff entry point without expanding scope into a custom admin panel.

**Independent Test**: A staff user sees a review/admin entry point after login, a regular user does not see it, and direct access by a non-staff user remains denied by the existing platform authorization.

**Acceptance Scenarios**:

1. **Given** an authenticated staff user, **When** they open frontend navigation, **Then** they can reach the existing protected admin review area.
2. **Given** the existing admin review area requires its own authenticated admin session, **When** a staff user follows the review entry point, **Then** the frontend does not imply that the normal frontend login has already authenticated the admin area and the admin area may prompt for login.
3. **Given** an authenticated non-staff user, **When** they open frontend navigation, **Then** they do not see staff-only review navigation.
4. **Given** any user without staff authorization, **When** they attempt to access the protected admin review area directly, **Then** access remains denied by the existing platform.

### Edge Cases

- A visitor registers successfully but must still log in because registration does not create a frontend session.
- A visitor attempts to register with a duplicate email, duplicate username, weak password, malformed email, or missing field.
- A user refreshes the page after login, while editing a draft, or while viewing a submission detail.
- A user has multiple tabs open and signs out or loses the session in one tab.
- A user submits with an expired, invalid, or missing session.
- A user opens a protected deep link before login, after logout, or after their permissions change.
- A user cancels file selection, replaces the selected file, or the browser cannot generate a local preview.
- A photo is exactly at the accepted size or dimension boundaries.
- A selected file has a misleading extension or MIME type and is rejected by backend validation.
- The backend receives a submission but the browser times out before the frontend receives the created response.
- The classification result is not available immediately after submission creation.
- A status changes while the user is on the list or detail view.
- The backend returns no submissions, one submission, many submissions, an out-of-range page, or a page with no next/previous link.
- The backend reports pending classification, classifying, classified, rejected, needs manual review, or classification failed.
- A user opens a stale submission link after the submission has been deleted by authorized operations.
- The frontend receives a validation error, authorization error, not-found response, service-unavailable response, malformed response, or unexpected enum value.
- User-entered metadata contains very long words, markup-like text, control characters, offensive text, or words that must not appear in system-generated classification copy.
- A staff user's staff status changes after they have already loaded the frontend.
- The existing admin review area prompts staff users to authenticate separately from the normal frontend workflow.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The frontend MUST provide a public entry point that presents registration and login to visitors and the authenticated workspace to signed-in users.
- **FR-002**: Public registration MUST collect only normal account fields needed by the current backend account flow and MUST NOT expose staff, superuser, admin, permission, or role controls.
- **FR-003**: After successful registration, the frontend MUST route the user to login unless the backend explicitly returns an authenticated session.
- **FR-004**: Registration and login errors MUST be shown in a way users can correct, while login failures MUST remain generic and MUST NOT reveal whether the account identifier or password was incorrect.
- **FR-005**: The authenticated workspace MUST show the user's safe account identity, create-submission navigation, submissions navigation, and sign-out action.
- **FR-006**: The frontend MUST prevent unauthenticated users from accessing submission creation, submission list, and submission detail views.
- **FR-007**: Protected deep links MUST return users to the requested allowed destination after login, or to the workspace with a neutral message when the destination is unavailable or unauthorized.
- **FR-008**: When the backend reports an expired, invalid, or missing session, the frontend MUST stop showing protected data, prompt for login, and preserve only safe unsent draft metadata where appropriate.
- **FR-009**: Sign-out MUST clear the active browser session and non-submitted sensitive local state, including selected local photo previews.
- **FR-010**: Session changes caused by sign-out, session expiry, or permission changes in another open frontend tab in the same browser profile MUST be reflected no later than the next protected navigation, refresh, or backend action; the backend's rejection of stale credentials remains the final authority.
- **FR-011**: Authenticated users MUST be able to create one photo submission with name, age, place of living, gender, country of origin, and optional description.
- **FR-012**: The submission form MUST communicate that name, age, place of living, gender, country of origin, and photo are required.
- **FR-013**: Required text fields MUST reject blank or whitespace-only values before or during submission.
- **FR-014**: The submission form MUST communicate and honor the current backend metadata limits: name up to 255 characters, place of living up to 255 characters, gender up to 100 characters, country of origin up to 255 characters, optional description up to 1,000 characters, and age from 0 through 120 inclusive.
- **FR-015**: The submission form MUST communicate the current backend photo constraints before upload: JPEG, PNG, or WebP; maximum 5 MB; width and height from 300 through 5000 pixels inclusive.
- **FR-016**: The frontend MUST show field-level validation feedback for user-correctable mistakes and backend-returned validation errors.
- **FR-017**: The frontend MUST preserve user-entered metadata when validation fails, except for browser-restricted file inputs where reselection may be required.
- **FR-018**: The frontend MAY provide a local pre-submit image preview when the browser can safely read the selected file without uploading it early.
- **FR-019**: The frontend MUST clearly handle selected-file replacement, selected-file cancellation, preview failure, and file reselection after validation errors.
- **FR-020**: During submission creation, the frontend MUST show an in-progress state and prevent accidental duplicate submissions.
- **FR-021**: If a submission request has an uncertain outcome because of timeout or network interruption, the frontend MUST guide the user to check existing submissions before retrying.
- **FR-022**: After successful creation, the frontend MUST show the new submission with an initial pending classification state.
- **FR-023**: Authenticated users MUST be able to list only their own submissions.
- **FR-024**: The submissions list MUST default to newest submissions first and MUST support backend pagination with clear empty, previous-page, next-page, and out-of-range-page states.
- **FR-025**: The submissions list MUST expose backend-supported status filtering without inventing unsupported filters.
- **FR-026**: Authenticated users MUST be able to open a detail view for a submission they own.
- **FR-027**: Submission detail MUST show user-submitted metadata, submission status, created and updated timestamps, and the latest safe classification summary when available.
- **FR-028**: User-facing views MUST NOT display private photo object keys or original uploaded filenames.
- **FR-029**: User-facing views MAY display non-sensitive file facts such as content type and file size when helpful, but they MUST NOT expose private storage paths, signed URLs, raw image bytes, or direct object-storage links.
- **FR-030**: The frontend MUST represent the known submission states in plain language: pending classification, classifying, classified, rejected, needs manual review, and classification failed.
- **FR-031**: For pending or classifying submissions, the frontend MUST provide a clear manual refresh path and SHOULD show when the status was last checked.
- **FR-032**: The latest classification summary MUST be displayed alongside the submission status and MUST otherwise be limited to review decision, category, safe reasons, and relevant timestamps.
- **FR-033**: The frontend MUST NOT display classifier provider identifiers, classifier versions, schema versions, fallback details, internal error codes, classification durations, numeric scores, confidence values, raw responses, provider metadata, raw prompts, tokens, credentials, signed URLs, raw image bytes, private object keys, internal endpoints, or those values embedded inside otherwise allowlisted classification strings.
- **FR-034**: The frontend MUST present classification as submission-review outcome only and MUST NOT present it as identity, demographic, attractiveness, trustworthiness, competence, desirability, health, religion, politics, background, or other person-trait inference.
- **FR-035**: Age, gender, place of living, and country of origin MUST be displayed only as user-submitted metadata, never as inferred or evaluated traits.
- **FR-036**: User-submitted text MUST be displayed as text, must not alter page behavior, and must not cause layout overlap or hide critical controls.
- **FR-037**: Rejected, needs-manual-review, and classification-failed states MUST explain what happened at a user-facing level and MUST NOT offer edit, retry, delete, reclassify, or manual-approval actions unless the backend supports those actions for the current user.
- **FR-038**: Unauthorized and not-found states MUST avoid revealing whether another user's submission exists.
- **FR-039**: Dates and times in user-facing views MUST be unambiguous and understandable to the user, including date, time, and either timezone or clear local-time context.
- **FR-040**: Unexpected backend status, category, or decision values MUST be displayed as a generic unavailable review state without exposing raw internal values.
- **FR-041**: The frontend MUST NOT direct users to internal infrastructure services, the internal classifier, private object storage, message broker consoles, database services, worker endpoints, or internal health endpoints.
- **FR-042**: Uploaded-photo preview after submission MUST remain unavailable unless the existing platform provides a permission-checked photo access capability.
- **FR-043**: Any API documentation or support link exposed by the frontend MUST point only to public platform documentation and MUST NOT expose private internals or unsafe operational details.
- **FR-044**: The frontend MUST provide empty, loading, success, validation-error, authorization-error, not-found, session-expired, service-unavailable, and unexpected-response states for the primary user workflow.
- **FR-045**: Backend field errors and whole-request errors MUST be distinguishable enough for users to know whether to correct a field, log in again, retry later, or navigate elsewhere.
- **FR-046**: The frontend MUST keep the primary registration, login, submission, list, and detail flows usable on common desktop and mobile viewport sizes.
- **FR-047**: Primary workflow controls MUST have accessible names, visible focus states, keyboard-operable behavior, and status/error communication that does not rely only on color.
- **FR-048**: The frontend MUST meet WCAG 2.2 AA expectations for the primary workflow unless a specific backend-owned admin page is out of scope for this frontend, including keyboard operation, visible focus, accessible names, status/error announcements, contrast, resize/reflow, and non-color-only communication.
- **FR-049**: Text, enum labels, user-entered values, buttons, and status messages MUST fit without incoherent overlap on the supported viewports.
- **FR-050**: Staff users SHOULD see a navigation path to the existing protected admin review area after login.
- **FR-051**: The staff review entry point MUST make clear that the existing admin review area may require its own authenticated admin session.
- **FR-052**: Non-staff users MUST NOT see staff-only review navigation.
- **FR-053**: The frontend MUST NOT replace, duplicate, or rebuild the existing protected admin review area in this feature.

### Key Entities *(include if feature involves data)*

- **Visitor**: A person who has not authenticated and can register or log in.
- **Registered Account**: A normal non-staff account created through public registration.
- **Authenticated User**: A signed-in user who can create and view only their own submissions.
- **Staff User**: A signed-in user whose account indicates access to the existing protected admin review area.
- **User Session**: The frontend's active authenticated state, including safe account summary information, protected-route behavior, expiry handling, and sign-out behavior.
- **Protected Route**: A frontend view that requires authentication, such as submission creation, submission list, or submission detail.
- **Submission Draft**: In-progress user-entered metadata and selected photo before creation.
- **Photo Selection**: The local file chosen before submission, including validation state and optional local preview.
- **Submission Summary**: A compact representation of a user's created submission, including status, creation time, and safe latest review summary when available.
- **Submission Detail**: The full user-facing view of one owned submission, including user-submitted metadata, lifecycle state, timestamps, and safe latest review summary.
- **Classification Summary**: The frontend-approved presentation of review decision, category, safe reasons, and relevant timestamps, displayed beside the separate submission status.
- **Validation Error**: User-correctable feedback tied to a field, file, authentication action, or whole-request failure.
- **Review Entry Point**: A staff-only navigation path to the existing protected admin review capability.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In acceptance testing with at least 10 first-time users, at least 90% can register, log in, and reach the authenticated workspace without assistance.
- **SC-002**: In acceptance testing with at least 10 authenticated users, at least 90% can create a valid photo submission with required metadata in under 5 minutes.
- **SC-003**: After a successful creation response from a healthy platform, the user sees the created submission's pending classification state within 3 seconds.
- **SC-004**: Users can find the latest status of any visible submission in no more than 2 navigation actions from the authenticated workspace.
- **SC-005**: Boundary validation testing covers age 0, age 120, age outside range, description length 1,000, overlong metadata, unsupported file type, file over 5 MB, image below 300x300, and image above 5000x5000 with clear user-facing feedback.
- **SC-006**: The primary registration, login, submission, list, and detail flows complete without text overlap, hidden required controls, or horizontal scrolling for core content at 360px mobile width and 1366px desktop width.
- **SC-007**: Keyboard-only testing can complete registration, login, submission creation, list navigation, status refresh, and result viewing without blocked controls.
- **SC-008**: Frontend-generated classification copy contains 0 instances of forbidden person-trait inference language in acceptance testing; user-submitted metadata is excluded from this count only when clearly labeled as user-submitted text.
- **SC-009**: User-facing pages, links, titles, copied text, and error messages contain 0 instances of passwords, access tokens, refresh tokens, raw provider responses, provider metadata, raw prompts, signed URLs, raw image bytes, private object keys, original uploaded filenames, or internal infrastructure credentials.
- **SC-010**: Regular users see 0 submissions owned by other users during permission testing.
- **SC-011**: Non-staff users see 0 staff-only review navigation controls during permission testing.
- **SC-012**: Staff users can reach the existing protected admin review entry point from authenticated frontend navigation, and any separate admin login prompt is not presented as a frontend failure.

## Assumptions

- The existing backend provides public registration, login, current-user profile, user-owned submission creation, user-owned submission list, user-owned submission detail, public API documentation, health checks, and Django Admin review capabilities.
- The current registration behavior creates a normal account but does not itself establish the frontend authenticated session unless the backend later changes to return one.
- The current backend authentication surface does not include a dedicated browser logout or token-refresh endpoint; the frontend handles sign-out and expired sessions as browser-session behavior and prompts users to log in again when needed.
- The backend remains the final authority for validation, authorization, storage, classification state, and deletion/retention behavior.
- The current user-facing submission backend supports create, list, and detail operations only; editing, deleting, retrying, reclassifying, and manual approval are not available to regular users in this frontend feature.
- The existing operational review surface is Django Admin, and it may require a separate admin-authenticated session from the normal frontend workflow.
- Custom admin API views are not assumed to exist for this frontend feature.
- Backend responses may include fields that are useful for backend/admin operations but are not safe or useful for normal user-facing display; the frontend display model is intentionally narrower than the raw response.
- Uploaded-photo preview after creation is out of scope until the platform provides a permission-checked image access path.
- The first frontend version is a browser-based web application for modern desktop and mobile browsers, not a native mobile app.
- English is the default user-interface language for the first version.
- The frontend is served through the platform's public application entry point and does not expose internal services.
- Acceptance testing for SC-001 and SC-002 is product/UAT evidence and may be recorded separately from automated implementation checks.

## Out of Scope

- Replacing the existing protected admin review area with a custom admin frontend.
- Building a custom admin search/filter/review dashboard in the frontend.
- Editing, deleting, reclassifying, retrying classification, or manually approving submissions from the user-facing frontend.
- Adding new backend auth capabilities such as token refresh, server-side logout, password reset, email verification, account deletion, or profile editing.
- Direct browser access to private object storage, message broker, database, worker, internal health endpoints, or classifier services.
- Displaying submitted photos after creation without a permission-checked backend photo access capability.
- Public photo galleries, social sharing, payments, subscriptions, analytics dashboards, or marketing landing pages.
- Real-time push notifications, live queue dashboards, model-provider configuration screens, or infrastructure monitoring consoles.
- Native mobile applications.
- Inferring identity, demographics, attractiveness, trustworthiness, suitability, competence, desirability, health, religion, politics, background, or other person traits from photos.
