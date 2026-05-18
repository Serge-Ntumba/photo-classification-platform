# Tasks: Frontend Application

**Input**: Design documents from `/specs/002-frontend-application/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included because the feature specification and quickstart explicitly require verification of API transformation, safe display, protected routes, validation, session expiry, responsive workflows, keyboard access, accessibility, and build/lint/format correctness.

**Organization**: Tasks are grouped by user story so each story can be implemented and tested as an independent increment after the shared foundation.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel after its declared dependency because it touches different files and does not depend on incomplete tasks in the same phase
- **[Story]**: User story label for traceability
- Every task line includes exact target file paths, an explicit `Depends:` relationship, and an explicit `Validate:` method

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the React + TypeScript frontend project and baseline tooling.

- [X] T001 Create the Vite React TypeScript application shell in `frontend/package.json`, `frontend/index.html`, `frontend/src/main.tsx`, and `frontend/src/app/App.tsx`; Depends: none; Validate: `test -f frontend/package.json && test -f frontend/src/main.tsx`
- [X] T002 Configure TypeScript, Vite path aliases, local `/api/` proxying, and Vite env typing in `frontend/tsconfig.json`, `frontend/tsconfig.app.json`, `frontend/vite.config.ts`, and `frontend/src/vite-env.d.ts`; Depends: T001; Validate: `cd frontend && npm run typecheck` after T010
- [X] T003 [P] Configure Tailwind CSS and shadcn/ui base settings in `frontend/tailwind.config.ts`, `frontend/postcss.config.js`, `frontend/components.json`, and `frontend/src/index.css`; Depends: T001; Validate: `cd frontend && npm run build` after T010
- [X] T004 [P] Add shadcn/ui form primitives in `frontend/src/components/ui/button.tsx`, `frontend/src/components/ui/input.tsx`, `frontend/src/components/ui/label.tsx`, `frontend/src/components/ui/form.tsx`, `frontend/src/components/ui/select.tsx`, and `frontend/src/components/ui/textarea.tsx`; Depends: T003; Validate: `cd frontend && npm run typecheck` after T010
- [X] T005 [P] Add shadcn/ui feedback and navigation primitives in `frontend/src/components/ui/alert.tsx`, `frontend/src/components/ui/badge.tsx`, `frontend/src/components/ui/pagination.tsx`, and `frontend/src/components/ui/separator.tsx`; Depends: T003; Validate: `cd frontend && npm run typecheck` after T010
- [X] T006 Configure the unit/component/browser test harness in `frontend/vitest.config.ts`, `frontend/playwright.config.ts`, `frontend/src/test/setup.ts`, and `frontend/src/test/server.ts`; Depends: T001; Validate: `cd frontend && npm run test -- --run` after T010
- [X] T007 [P] Configure frontend linting and formatting in `frontend/eslint.config.js`, `frontend/.prettierrc.json`, and `frontend/.prettierignore`; Depends: T001; Validate: `cd frontend && npm run lint && npm run format:check` after T010
- [X] T008 [P] Add frontend dependency, build, and browser-test artifacts to `.gitignore`; Depends: T001; Validate: `git check-ignore frontend/node_modules frontend/dist frontend/test-results`
- [X] T009 [P] Document frontend commands and backend prerequisites in `frontend/README.md`; Depends: T001; Validate: `rg "npm run dev|docker compose|VITE_API_BASE_URL" frontend/README.md`
- [X] T010 Install and pin frontend dependencies in `frontend/package-lock.json`; Depends: T001-T007; Validate: `cd frontend && npm ci`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Implement shared API, session, safety, routing, validation, and layout foundations that every user story depends on.

**Critical**: No user-story implementation should begin until this phase is complete.

### Tests for Foundational Behavior

- [X] T011 [P] Add safe display unit tests for status labels, category labels, decision labels, datetime fallback, and unsafe value suppression in `frontend/src/lib/safe-display.test.ts`; Depends: T001-T010; Validate: `cd frontend && npm run test -- src/lib/safe-display.test.ts`
- [X] T012 [P] Add API client tests for bearer auth, timeout handling, multipart support, 401 clearing signal, and safe error normalization in `frontend/src/lib/api-client.test.ts`; Depends: T001-T010; Validate: `cd frontend && npm run test -- src/lib/api-client.test.ts`
- [X] T013 [P] Add browser-session tests for `sessionStorage`, refresh-token non-persistence, sign-out clearing, and cross-tab messages in `frontend/src/lib/auth-session.test.ts`; Depends: T001-T010; Validate: `cd frontend && npm run test -- src/lib/auth-session.test.ts`
- [X] T014 [P] Add public API base URL and Django Admin URL resolver tests in `frontend/src/lib/config.test.ts`; Depends: T001-T010; Validate: `cd frontend && npm run test -- src/lib/config.test.ts`
- [X] T015 [P] Add shared validation helper tests for required text, length limits, integer ranges, and image constraints in `frontend/src/lib/validation.test.ts`; Depends: T001-T010; Validate: `cd frontend && npm run test -- src/lib/validation.test.ts`
- [X] T016 [P] Add reusable feedback component tests for loading, empty, safe error, status, and live-region behavior in `frontend/src/components/layout/feedback.test.tsx`; Depends: T001-T010; Validate: `cd frontend && npm run test -- src/components/layout/feedback.test.tsx`
- [X] T017 [P] Add provider and router smoke tests for app bootstrapping, protected-route blocking, and neutral not-found rendering in `frontend/src/app/app.test.tsx`; Depends: T001-T010; Validate: `cd frontend && npm run test -- src/app/app.test.tsx`

### Implementation

- [X] T018 [P] Define raw backend response types and safe frontend display models in `frontend/src/lib/models.ts`; Depends: T011-T017; Validate: `cd frontend && npm run typecheck`
- [X] T019 [P] Implement public API base URL and Django Admin URL resolution in `frontend/src/lib/config.ts`; Depends: T014; Validate: `cd frontend && npm run test -- src/lib/config.test.ts`
- [X] T020 Implement the central fetch API client with bearer auth, timeout handling, FormData support, and safe error normalization in `frontend/src/lib/api-client.ts`; Depends: T012, T018, T019; Validate: `cd frontend && npm run test -- src/lib/api-client.test.ts`
- [X] T021 Implement browser-session storage using `sessionStorage` plus `BroadcastChannel` sign-out and session messages in `frontend/src/lib/auth-session.ts`; Depends: T013, T018; Validate: `cd frontend && npm run test -- src/lib/auth-session.test.ts`
- [X] T022 Implement safe display allowlists, unsafe string detection, status labels, classification labels, safe error copy, and datetime formatting in `frontend/src/lib/safe-display.ts`; Depends: T011, T018; Validate: `cd frontend && npm run test -- src/lib/safe-display.test.ts`
- [X] T023 [P] Implement shared validation helpers for required text, length limits, integer ranges, and image constraints in `frontend/src/lib/validation.ts`; Depends: T015; Validate: `cd frontend && npm run test -- src/lib/validation.test.ts`
- [X] T024 [P] Implement reusable loading, empty, safe error, status, and live-region components in `frontend/src/components/layout/feedback.tsx`; Depends: T016, T004, T005; Validate: `cd frontend && npm run test -- src/components/layout/feedback.test.tsx`
- [X] T025 [P] Implement app shell and public layout primitives in `frontend/src/components/layout/AppShell.tsx` and `frontend/src/components/layout/PublicLayout.tsx`; Depends: T004, T005; Validate: `cd frontend && npm run typecheck`
- [X] T026 Implement app providers with session context, API client wiring, and protected-data clearing in `frontend/src/app/providers.tsx`; Depends: T020, T021, T024, T025; Validate: `cd frontend && npm run test -- src/app/app.test.tsx`
- [X] T027 Implement the router skeleton, protected route guard, and neutral not-found route in `frontend/src/app/router.tsx` and `frontend/src/routes/NotFoundPage.tsx`; Depends: T026; Validate: `cd frontend && npm run test -- src/app/app.test.tsx`
- [X] T028 Configure MSW backend API handlers for frontend tests in `frontend/src/test/handlers.ts`; Depends: T018, T020; Validate: `cd frontend && npm run test -- src/lib/api-client.test.ts src/app/app.test.tsx`

**Checkpoint**: Foundation ready. User story implementation can now begin.

---

## Phase 3: User Story 1 - Register, Log In, and Start Work (Priority: P1) MVP

**Goal**: A visitor can register a normal account, log in, reach the authenticated workspace, sign out, and receive safe auth feedback.

**Independent Test**: A first-time visitor can create a non-staff account, proceed to login, authenticate successfully, see account identity and workspace navigation, sign out, and receive generic feedback for invalid credentials.

### Tests for User Story 1

- [ ] T029 [P] [US1] Add auth API contract tests for register, login, current user response consumption, token non-display, and generic auth errors in `frontend/src/features/auth/auth-api.test.ts`; Depends: T011-T028; Validate: `cd frontend && npm run test -- src/features/auth/auth-api.test.ts`
- [ ] T030 [P] [US1] Add auth route tests for protected deep-link return, neutral unauthorized fallback, session expiry, and sign-out in `frontend/src/features/auth/auth-flow.test.tsx`; Depends: T011-T028; Validate: `cd frontend && npm run test -- src/features/auth/auth-flow.test.tsx`
- [ ] T031 [P] [US1] Add auth form accessibility tests for labels, focus movement, keyboard submit, and error announcements in `frontend/src/features/auth/auth-accessibility.test.tsx`; Depends: T011-T028; Validate: `cd frontend && npm run test -- src/features/auth/auth-accessibility.test.tsx`

### Implementation for User Story 1

- [ ] T032 [P] [US1] Implement auth API functions for register, login, and current-user profile in `frontend/src/features/auth/api.ts`; Depends: T029, T020; Validate: `cd frontend && npm run test -- src/features/auth/auth-api.test.ts`
- [ ] T033 [P] [US1] Implement auth form schemas and safe auth error mapping in `frontend/src/features/auth/validation.ts`; Depends: T029, T031, T023; Validate: `cd frontend && npm run test -- src/features/auth/auth-api.test.ts src/features/auth/auth-accessibility.test.tsx`
- [ ] T034 [P] [US1] Implement the registration page without staff, admin, role, or permission controls in `frontend/src/features/auth/pages/RegisterPage.tsx`; Depends: T032, T033; Validate: `cd frontend && npm run test -- src/features/auth/auth-flow.test.tsx src/features/auth/auth-accessibility.test.tsx`
- [ ] T035 [P] [US1] Implement the login page with generic invalid-credential copy and same-origin `returnTo` handling in `frontend/src/features/auth/pages/LoginPage.tsx`; Depends: T032, T033; Validate: `cd frontend && npm run test -- src/features/auth/auth-flow.test.tsx src/features/auth/auth-accessibility.test.tsx`
- [ ] T036 [P] [US1] Implement the workspace page with safe identity, create-submission navigation, submissions navigation, and sign-out action in `frontend/src/features/auth/pages/WorkspacePage.tsx`; Depends: T032, T021, T025; Validate: `cd frontend && npm run test -- src/features/auth/auth-flow.test.tsx`
- [ ] T037 [P] [US1] Implement session-expiry UI and protected-data clearing across auth routes in `frontend/src/features/auth/components/SessionBoundary.tsx`; Depends: T021, T026, T030; Validate: `cd frontend && npm run test -- src/features/auth/auth-flow.test.tsx`
- [ ] T038 [US1] Wire public/protected auth routes and post-login redirects in `frontend/src/app/router.tsx`; Depends: T034-T037; Validate: `cd frontend && npm run test -- src/features/auth/auth-flow.test.tsx src/app/app.test.tsx`
- [ ] T039 [US1] Ensure sign-out clears token, safe account state, selected local preview state hooks, and open-tab notifications in `frontend/src/lib/auth-session.ts`; Depends: T013, T021, T037; Validate: `cd frontend && npm run test -- src/lib/auth-session.test.ts src/features/auth/auth-flow.test.tsx`

**Checkpoint**: User Story 1 is functional and independently testable.

---

## Phase 4: User Story 2 - Create a Photo Submission (Priority: P2)

**Goal**: An authenticated user can create one valid photo submission with required metadata and see the created pending review state.

**Independent Test**: An authenticated user can select a valid photo, enter required metadata, submit once, receive validation feedback for mistakes, and see the created submission in a pending classification state.

### Tests for User Story 2

- [ ] T040 [P] [US2] Add submission validation tests for metadata boundaries, required fields, image type, image size, and image dimensions in `frontend/src/features/submissions/submission-validation.test.ts`; Depends: T011-T028; Validate: `cd frontend && npm run test -- src/features/submissions/submission-validation.test.ts`
- [ ] T041 [P] [US2] Add create-submission API contract tests for multipart fields, 201 pending response, validation errors, and uncertain network outcome in `frontend/src/features/submissions/create-submission-api.test.ts`; Depends: T011-T028; Validate: `cd frontend && npm run test -- src/features/submissions/create-submission-api.test.ts`
- [ ] T042 [P] [US2] Add create-submission page tests for field preservation, backend validation mapping, duplicate-submit prevention, and success routing in `frontend/src/features/submissions/CreateSubmissionPage.test.tsx`; Depends: T011-T028; Validate: `cd frontend && npm run test -- src/features/submissions/CreateSubmissionPage.test.tsx`
- [ ] T043 [P] [US2] Add photo selection tests for preview creation, replacement, cancellation, preview failure, and object URL revocation in `frontend/src/features/submissions/PhotoSelector.test.tsx`; Depends: T011-T028; Validate: `cd frontend && npm run test -- src/features/submissions/PhotoSelector.test.tsx`

### Implementation for User Story 2

- [ ] T044 [P] [US2] Implement create-submission API function and response transform entry point in `frontend/src/features/submissions/api.ts` and `frontend/src/features/submissions/transformers.ts`; Depends: T041, T020, T018; Validate: `cd frontend && npm run test -- src/features/submissions/create-submission-api.test.ts`
- [ ] T045 [P] [US2] Implement submission form validation schema and image dimension inspector in `frontend/src/features/submissions/validation.ts`; Depends: T040, T023; Validate: `cd frontend && npm run test -- src/features/submissions/submission-validation.test.ts`
- [ ] T046 [US2] Implement the photo selector with local pre-submit preview, replacement handling, cancellation handling, preview-failure state, and cleanup in `frontend/src/features/submissions/components/PhotoSelector.tsx`; Depends: T043, T045; Validate: `cd frontend && npm run test -- src/features/submissions/PhotoSelector.test.tsx`
- [ ] T047 [US2] Implement metadata form fields with required, length, range, and field-level error states in `frontend/src/features/submissions/components/SubmissionMetadataFields.tsx`; Depends: T040, T045; Validate: `cd frontend && npm run test -- src/features/submissions/CreateSubmissionPage.test.tsx`
- [ ] T048 [US2] Implement the create submission page with in-flight state, duplicate prevention, field preservation, and safe draft preservation in `frontend/src/features/submissions/pages/CreateSubmissionPage.tsx`; Depends: T042, T044, T046, T047; Validate: `cd frontend && npm run test -- src/features/submissions/CreateSubmissionPage.test.tsx`
- [ ] T049 [US2] Implement uncertain network outcome guidance that tells users to check submissions before retrying in `frontend/src/features/submissions/pages/CreateSubmissionPage.tsx`; Depends: T041, T048; Validate: `cd frontend && npm run test -- src/features/submissions/create-submission-api.test.ts src/features/submissions/CreateSubmissionPage.test.tsx`
- [ ] T050 [US2] Wire the create-submission route and success navigation in `frontend/src/app/router.tsx`; Depends: T048; Validate: `cd frontend && npm run test -- src/features/submissions/CreateSubmissionPage.test.tsx src/app/app.test.tsx`
- [ ] T051 [US2] Clear selected file and preview state on successful creation, session expiry, and sign-out in `frontend/src/features/submissions/components/PhotoSelector.tsx`; Depends: T039, T046, T048; Validate: `cd frontend && npm run test -- src/features/submissions/PhotoSelector.test.tsx src/features/submissions/CreateSubmissionPage.test.tsx`

**Checkpoint**: User Story 2 is functional and independently testable with a mocked authenticated session or completed User Story 1.

---

## Phase 5: User Story 3 - Track Submission Status and Classification Results (Priority: P3)

**Goal**: An authenticated user can list submissions, open a detail view, refresh asynchronous status, and read the latest safe review outcome.

**Independent Test**: After creating a submission, a user can list their submissions, open a detail view, observe pending progress, refresh the state, and read a safe latest classification summary once available.

### Tests for User Story 3

- [ ] T052 [P] [US3] Add list API contract tests for pagination, backend status filtering, newest-first assumption, and hidden raw page URLs in `frontend/src/features/submissions/list-submissions-api.test.ts`; Depends: T011-T028; Validate: `cd frontend && npm run test -- src/features/submissions/list-submissions-api.test.ts`
- [ ] T053 [P] [US3] Add detail API contract tests for 403/404 neutral handling, pending refresh, completed response transform, and unexpected enum fallback in `frontend/src/features/submissions/submission-detail-api.test.ts`; Depends: T011-T028; Validate: `cd frontend && npm run test -- src/features/submissions/submission-detail-api.test.ts`
- [ ] T054 [P] [US3] Add list page tests for empty, filtered empty, pagination, status filter, manual refresh, service unavailable, and session expiry states in `frontend/src/features/submissions/SubmissionsListPage.test.tsx`; Depends: T011-T028; Validate: `cd frontend && npm run test -- src/features/submissions/SubmissionsListPage.test.tsx`
- [ ] T055 [P] [US3] Add detail page tests for status labels, last-checked time, manual refresh, unavailable result fallback, neutral denied/not-found state, and return navigation in `frontend/src/features/submissions/SubmissionDetailPage.test.tsx`; Depends: T011-T028; Validate: `cd frontend && npm run test -- src/features/submissions/SubmissionDetailPage.test.tsx`

### Implementation for User Story 3

- [ ] T056 [P] [US3] Implement submissions list and detail API functions with page and status query support in `frontend/src/features/submissions/api.ts`; Depends: T052, T053, T044; Validate: `cd frontend && npm run test -- src/features/submissions/list-submissions-api.test.ts src/features/submissions/submission-detail-api.test.ts`
- [ ] T057 [P] [US3] Implement submission status, pagination, last-checked, and status filter helpers in `frontend/src/features/submissions/submission-state.ts`; Depends: T052-T055, T022; Validate: `cd frontend && npm run test -- src/features/submissions/SubmissionsListPage.test.tsx src/features/submissions/SubmissionDetailPage.test.tsx`
- [ ] T058 [P] [US3] Implement backend-supported status filter controls in `frontend/src/features/submissions/components/SubmissionFilters.tsx`; Depends: T052, T054, T057; Validate: `cd frontend && npm run test -- src/features/submissions/SubmissionsListPage.test.tsx`
- [ ] T059 [US3] Implement the submission list item with status, created time, user-submitted name, and safe latest review summary in `frontend/src/features/submissions/components/SubmissionListItem.tsx`; Depends: T054, T056, T057; Validate: `cd frontend && npm run test -- src/features/submissions/SubmissionsListPage.test.tsx`
- [ ] T060 [US3] Implement the submissions list page with loading, empty, filtered empty, populated, previous/next, out-of-range, refresh, and session-expired states in `frontend/src/features/submissions/pages/SubmissionsListPage.tsx`; Depends: T054, T056-T059; Validate: `cd frontend && npm run test -- src/features/submissions/SubmissionsListPage.test.tsx`
- [ ] T061 [US3] Implement the submission detail page with metadata, status, timestamps, latest safe summary, refresh, return navigation, and neutral denied/not-found state in `frontend/src/features/submissions/pages/SubmissionDetailPage.tsx`; Depends: T055-T057; Validate: `cd frontend && npm run test -- src/features/submissions/SubmissionDetailPage.test.tsx`
- [ ] T062 [US3] Implement manual refresh and last-checked behavior for list and detail routes in `frontend/src/features/submissions/hooks/useSubmissionRefresh.ts`; Depends: T054, T055, T057; Validate: `cd frontend && npm run test -- src/features/submissions/SubmissionsListPage.test.tsx src/features/submissions/SubmissionDetailPage.test.tsx`
- [ ] T063 [US3] Wire submissions list/detail routes and query-string page/status state in `frontend/src/app/router.tsx`; Depends: T060-T062; Validate: `cd frontend && npm run test -- src/features/submissions/SubmissionsListPage.test.tsx src/features/submissions/SubmissionDetailPage.test.tsx src/app/app.test.tsx`

**Checkpoint**: User Story 3 is functional and independently testable with mocked or real authenticated submission data.

---

## Phase 6: User Story 4 - Keep Results and Metadata Safe to Display (Priority: P4)

**Goal**: User-facing submission and classification views render only approved safe fields and remain robust with unsafe backend values or long user text.

**Independent Test**: A submission whose backend response includes private photo references, original filenames, internal classifier fields, long user text, and safe classification output renders only approved user-facing information.

### Tests for User Story 4

- [ ] T064 [P] [US4] Add safe display contract tests covering private photo fields, original filenames, raw classifier fields, tokens, signed URLs, private object keys, and internal endpoints in `frontend/src/features/submissions/safe-display-contract.test.ts`; Depends: T011-T028; Validate: `cd frontend && npm run test -- src/features/submissions/safe-display-contract.test.ts`
- [ ] T065 [P] [US4] Add classification copy tests for forbidden person-trait wording, unsafe allowlisted reason suppression, and generic fallback copy in `frontend/src/lib/safe-display.test.ts`; Depends: T011-T028; Validate: `cd frontend && npm run test -- src/lib/safe-display.test.ts`
- [ ] T066 [P] [US4] Add user-submitted metadata rendering tests for escaping, long words, labels, and no unsafe route-title or error reuse in `frontend/src/features/submissions/UserSubmittedMetadata.test.tsx`; Depends: T011-T028; Validate: `cd frontend && npm run test -- src/features/submissions/UserSubmittedMetadata.test.tsx`

### Implementation for User Story 4

- [ ] T067 [US4] Harden raw submission-to-display transformation so list/detail views drop unsafe backend fields before render in `frontend/src/features/submissions/transformers.ts`; Depends: T064, T044, T056; Validate: `cd frontend && npm run test -- src/features/submissions/safe-display-contract.test.ts src/features/submissions/list-submissions-api.test.ts src/features/submissions/submission-detail-api.test.ts`
- [ ] T068 [US4] Implement the classification summary component with allowlisted labels, safe reasons, fallback copy, and no score/provider/version display in `frontend/src/features/submissions/components/ClassificationSummary.tsx`; Depends: T064, T065, T022; Validate: `cd frontend && npm run test -- src/lib/safe-display.test.ts src/features/submissions/safe-display-contract.test.ts`
- [ ] T069 [US4] Implement user-submitted metadata and safe file facts components with clear labels and overflow-safe text in `frontend/src/features/submissions/components/UserSubmittedMetadata.tsx` and `frontend/src/features/submissions/components/FileFacts.tsx`; Depends: T066; Validate: `cd frontend && npm run test -- src/features/submissions/UserSubmittedMetadata.test.tsx`
- [ ] T070 [US4] Implement safe error and document-title helpers that never include filenames, object keys, raw backend values, or user secrets in `frontend/src/lib/safe-display.ts`; Depends: T064, T065; Validate: `cd frontend && npm run test -- src/lib/safe-display.test.ts src/features/submissions/safe-display-contract.test.ts`
- [ ] T071 [US4] Refactor create/list/detail submission views to render only display models from `frontend/src/features/submissions/transformers.ts`; Depends: T067-T069; Validate: `cd frontend && npm run test -- src/features/submissions/CreateSubmissionPage.test.tsx src/features/submissions/SubmissionsListPage.test.tsx src/features/submissions/SubmissionDetailPage.test.tsx src/features/submissions/safe-display-contract.test.ts`
- [ ] T072 [US4] Audit the detail page to exclude unsupported edit, delete, retry, reclassify, manual-approval, photo-view, and photo-download actions in `frontend/src/features/submissions/pages/SubmissionDetailPage.tsx`; Depends: T061, T071; Validate: `cd frontend && npm run test -- src/features/submissions/SubmissionDetailPage.test.tsx src/features/submissions/safe-display-contract.test.ts`

**Checkpoint**: User Story 4 safety behavior is functional and independently testable against hostile or overbroad backend response fixtures.

---

## Phase 7: User Story 5 - Use the Frontend on Common Devices (Priority: P5)

**Goal**: The primary registration, login, submission, list, and detail workflows are usable on common mobile and desktop viewports with keyboard and accessible status/error behavior.

**Independent Test**: The registration, login, submission, list, and detail views can be completed using keyboard navigation and common mobile and desktop viewport sizes without overlapping text, hidden controls, or blocked actions.

### Tests for User Story 5

- [ ] T073 [US5] Add Playwright API mock fixtures for authenticated workflows and representative submissions in `frontend/e2e/fixtures/platform-api.ts`; Depends: T039, T051, T063, T072; Validate: `cd frontend && npm run typecheck`
- [ ] T074 [P] [US5] Add 360px mobile and 1366px desktop workflow smoke tests for register, login, create, list, and detail in `frontend/e2e/responsive-workflow.spec.ts`; Depends: T073; Validate: `cd frontend && npm run e2e -- e2e/responsive-workflow.spec.ts`
- [ ] T075 [P] [US5] Add keyboard-only workflow tests for registration, login, submission creation, pagination/filtering, refresh, and result viewing in `frontend/e2e/keyboard-workflow.spec.ts`; Depends: T073; Validate: `cd frontend && npm run e2e -- e2e/keyboard-workflow.spec.ts`
- [ ] T076 [P] [US5] Add accessibility smoke tests for focus visibility, accessible names, status/error announcements, contrast, and non-color-only states in `frontend/e2e/accessibility-smoke.spec.ts`; Depends: T073; Validate: `cd frontend && npm run e2e -- e2e/accessibility-smoke.spec.ts`

### Implementation for User Story 5

- [ ] T077 [P] [US5] Implement responsive page layout constraints for auth, workspace, create, list, and detail views in `frontend/src/index.css`; Depends: T074; Validate: `cd frontend && npm run e2e -- e2e/responsive-workflow.spec.ts`
- [ ] T078 [P] [US5] Implement skip link, main landmark, focus management, and visible focus styling in `frontend/src/components/layout/AppShell.tsx`; Depends: T075, T076; Validate: `cd frontend && npm run e2e -- e2e/keyboard-workflow.spec.ts e2e/accessibility-smoke.spec.ts`
- [ ] T079 [P] [US5] Implement accessible live status and error announcements for validation, upload progress, refresh, and session expiry in `frontend/src/components/layout/feedback.tsx`; Depends: T075, T076; Validate: `cd frontend && npm run e2e -- e2e/keyboard-workflow.spec.ts e2e/accessibility-smoke.spec.ts`
- [ ] T080 [US5] Harden button, form, pagination, filter, and refresh controls for keyboard operation and accessible names in `frontend/src/components/ui/button.tsx` and `frontend/src/features/submissions/components/SubmissionFilters.tsx`; Depends: T075, T076, T058; Validate: `cd frontend && npm run e2e -- e2e/keyboard-workflow.spec.ts e2e/accessibility-smoke.spec.ts`
- [ ] T081 [P] [US5] Add long-text wrapping and stable dimensions for repeated submission rows/cards and compact controls in `frontend/src/features/submissions/components/SubmissionListItem.tsx`; Depends: T074, T059; Validate: `cd frontend && npm run e2e -- e2e/responsive-workflow.spec.ts`
- [ ] T082 [US5] Verify and adjust mobile/desktop layout for no horizontal core-content scrolling in `frontend/src/features/auth/pages/LoginPage.tsx`, `frontend/src/features/submissions/pages/CreateSubmissionPage.tsx`, and `frontend/src/features/submissions/pages/SubmissionDetailPage.tsx`; Depends: T074, T077-T081; Validate: `cd frontend && npm run e2e -- e2e/responsive-workflow.spec.ts e2e/keyboard-workflow.spec.ts e2e/accessibility-smoke.spec.ts`

**Checkpoint**: User Story 5 responsive and accessibility behavior is functional and independently testable with browser smoke tests.

---

## Phase 8: User Story 6 - Reach the Existing Staff Review Area (Priority: P6)

**Goal**: A staff user can navigate to the existing Django Admin review area while regular users see no staff controls and the frontend does not build a custom admin panel.

**Independent Test**: A staff user sees a review/admin entry point after login, a regular user does not see it, and direct access by a non-staff user remains denied by the existing platform authorization.

### Tests for User Story 6

- [ ] T083 [P] [US6] Add staff review entry tests for staff visibility, non-staff absence, separate-admin-login copy, and no custom admin UI in `frontend/src/features/auth/staff-review.test.tsx`; Depends: T028, T038; Validate: `cd frontend && npm run test -- src/features/auth/staff-review.test.tsx`
- [ ] T084 [P] [US6] Add admin URL resolver tests for same-origin and local Vite separate-origin cases in `frontend/src/lib/config.test.ts`; Depends: T011-T028; Validate: `cd frontend && npm run test -- src/lib/config.test.ts`

### Implementation for User Story 6

- [ ] T085 [P] [US6] Implement the staff review entry component with resolved public Django Admin URL and separate-login copy in `frontend/src/features/auth/components/StaffReviewEntry.tsx`; Depends: T083, T084, T019; Validate: `cd frontend && npm run test -- src/features/auth/staff-review.test.tsx src/lib/config.test.ts`
- [ ] T086 [US6] Integrate the staff review entry into authenticated navigation only when `user.is_staff` is true in `frontend/src/components/layout/AppShell.tsx`; Depends: T083, T085; Validate: `cd frontend && npm run test -- src/features/auth/staff-review.test.tsx`
- [ ] T087 [US6] Recheck staff status on protected navigation and update staff entry visibility after `/api/auth/me/` changes in `frontend/src/features/auth/components/SessionBoundary.tsx`; Depends: T037, T083, T085; Validate: `cd frontend && npm run test -- src/features/auth/auth-flow.test.tsx src/features/auth/staff-review.test.tsx`
- [ ] T088 [US6] Add a neutral fallback for direct `/admin` frontend route attempts without building an admin panel in `frontend/src/routes/NotFoundPage.tsx`; Depends: T083, T027; Validate: `cd frontend && npm run test -- src/features/auth/staff-review.test.tsx src/app/app.test.tsx`

**Checkpoint**: User Story 6 is functional and independently testable with mocked staff and non-staff users.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Wire the completed frontend into the existing public platform entry point, CI, and final validation without adding unsupported product scope.

- [ ] T089 [P] Add a production frontend static build stage in `frontend/Dockerfile`; Depends: T088; Validate: `docker build -f frontend/Dockerfile frontend`
- [ ] T090 Update Nginx to serve built frontend assets while proxying `/api/`, `/admin/`, `/health`, and `/api/docs/` to Django in `infra/docker/nginx.conf`; Depends: T089; Validate: `docker compose config`
- [ ] T091 Update Docker Compose to build and supply frontend static assets to Nginx without exposing Vite as the production server in `docker-compose.yml`; Depends: T089, T090; Validate: `docker compose build nginx && docker compose config`
- [ ] T092 [P] Update existing Kubernetes Nginx public-entry routing to match frontend static serving and backend proxy boundaries in `infra/k8s/configmap.yaml`; Depends: T090; Validate: `kubectl apply --dry-run=client -f infra/k8s/configmap.yaml`
- [ ] T093 [P] Update existing Kubernetes Nginx deployment asset mounts and image references for frontend static serving in `infra/k8s/deployments/nginx.yaml`; Depends: T089, T092; Validate: `kubectl apply --dry-run=client -f infra/k8s/deployments/nginx.yaml`
- [ ] T094 Update CI to run frontend install, typecheck, lint, format check, unit/component tests, and production build in `.github/workflows/ci.yml`; Depends: T010, T088; Validate: `cd frontend && npm ci && npm run typecheck && npm run lint && npm run format:check && npm run test && npm run build`
- [ ] T095 Update CI browser smoke coverage for mobile, desktop, keyboard, and accessibility workflows in `.github/workflows/ci.yml`; Depends: T073-T082, T094; Validate: `cd frontend && npm run e2e`
- [ ] T096 [P] Document frontend environment variables, local commands, testing commands, and public-entry deployment notes in `frontend/README.md`; Depends: T089-T095; Validate: `rg "VITE_API_BASE_URL|npm run e2e|public entry|Django Admin" frontend/README.md`
- [ ] T097 [P] Create a UAT evidence template for SC-001 and SC-002 in `specs/002-frontend-application/checklists/uat.md`; Depends: T039, T051; Validate: `rg "SC-001|SC-002|10 first-time users|10 authenticated users" specs/002-frontend-application/checklists/uat.md`
- [ ] T098 [P] Create a safety smoke checklist for private-field and person-trait findings in `specs/002-frontend-application/checklists/requirements.md`; Depends: T072; Validate: `rg "object_key|original_filename|signed URLs|person-trait" specs/002-frontend-application/checklists/requirements.md`
- [ ] T099 Run quickstart verification commands and record implementation-specific command deviations in `specs/002-frontend-application/quickstart.md`; Depends: T094, T095; Validate: `rg "npm run typecheck|npm run lint|npm run format:check|npm run test|npm run build|npm run e2e" specs/002-frontend-application/quickstart.md`
- [ ] T100 Run final frontend validation and record pass/fail evidence in `specs/002-frontend-application/checklists/final-validation.md`; Depends: T089-T099; Validate: `cd frontend && npm run typecheck && npm run lint && npm run format:check && npm run test && npm run build && npm run e2e`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup**: No dependencies.
- **Phase 2 Foundational**: Depends on Phase 1 and blocks all user stories.
- **Phase 3 US1**: Depends on Phase 2. This is the MVP.
- **Phase 4 US2**: Depends on Phase 2 and can use mocked auth if US1 is not complete, but full manual flow benefits from US1.
- **Phase 5 US3**: Depends on Phase 2 and can use mocked submissions if US2 is not complete, but full manual flow benefits from US2.
- **Phase 6 US4**: Depends on Phase 2 and should be completed before accepting US2/US3 as safe for production.
- **Phase 7 US5**: Depends on the primary routes from US1, US2, and US3 for browser workflow coverage.
- **Phase 8 US6**: Depends on Phase 2 and the authenticated navigation from US1.
- **Phase 9 Polish**: Depends on all desired user stories being complete.

### User Story Dependencies

- **US1 (P1)**: Independent after Phase 2.
- **US2 (P2)**: Independently testable after Phase 2 with mocked auth; integrates with US1 for real login-to-submit flow.
- **US3 (P3)**: Independently testable after Phase 2 with mocked submission data; integrates with US2 for create-to-status flow.
- **US4 (P4)**: Independently testable after Phase 2 using hostile response fixtures; cross-cuts US2 and US3 display safety.
- **US5 (P5)**: Requires implemented primary views from US1-US3 for full browser validation.
- **US6 (P6)**: Independently testable after Phase 2 with mocked current-user staff values; integrates with US1 navigation.

### Within Each User Story

- Write story tests first and confirm they fail for the missing behavior.
- Implement API/type/validation functions before page components that call them.
- Implement page components before route integration.
- Run each task's declared `Validate:` command before marking it complete.
- Complete the story checkpoint before moving to the next priority unless working in parallel with clear file ownership.

---

## Parallel Execution Examples

### User Story 1

```bash
Task: "T029 [P] [US1] Add auth API contract tests in frontend/src/features/auth/auth-api.test.ts"
Task: "T030 [P] [US1] Add auth route tests in frontend/src/features/auth/auth-flow.test.tsx"
Task: "T031 [P] [US1] Add auth form accessibility tests in frontend/src/features/auth/auth-accessibility.test.tsx"
```

### User Story 2

```bash
Task: "T040 [P] [US2] Add submission validation tests in frontend/src/features/submissions/submission-validation.test.ts"
Task: "T041 [P] [US2] Add create-submission API contract tests in frontend/src/features/submissions/create-submission-api.test.ts"
Task: "T043 [P] [US2] Add photo selection tests in frontend/src/features/submissions/PhotoSelector.test.tsx"
```

### User Story 3

```bash
Task: "T052 [P] [US3] Add list API contract tests in frontend/src/features/submissions/list-submissions-api.test.ts"
Task: "T053 [P] [US3] Add detail API contract tests in frontend/src/features/submissions/submission-detail-api.test.ts"
Task: "T055 [P] [US3] Add detail page tests in frontend/src/features/submissions/SubmissionDetailPage.test.tsx"
```

### User Story 4

```bash
Task: "T064 [P] [US4] Add safe display contract tests in frontend/src/features/submissions/safe-display-contract.test.ts"
Task: "T065 [P] [US4] Add classification copy tests in frontend/src/lib/safe-display.test.ts"
Task: "T066 [P] [US4] Add user-submitted metadata rendering tests in frontend/src/features/submissions/UserSubmittedMetadata.test.tsx"
```

### User Story 5

```bash
Task: "T074 [P] [US5] Add responsive workflow smoke tests in frontend/e2e/responsive-workflow.spec.ts"
Task: "T075 [P] [US5] Add keyboard-only workflow tests in frontend/e2e/keyboard-workflow.spec.ts"
Task: "T076 [P] [US5] Add accessibility smoke tests in frontend/e2e/accessibility-smoke.spec.ts"
```

### User Story 6

```bash
Task: "T083 [P] [US6] Add staff review entry tests in frontend/src/features/auth/staff-review.test.tsx"
Task: "T084 [P] [US6] Add admin URL resolver tests in frontend/src/lib/config.test.ts"
Task: "T085 [P] [US6] Implement staff review entry component in frontend/src/features/auth/components/StaffReviewEntry.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational.
3. Complete Phase 3: User Story 1.
4. Stop and validate registration, login, workspace access, sign-out, protected route redirects, and generic auth failures.

### Incremental Delivery

1. Add US1 for account access and authenticated workspace.
2. Add US2 for create submission.
3. Add US3 for list/detail/status tracking.
4. Add US4 before production acceptance of submission/result display safety.
5. Add US5 for device, keyboard, and accessibility confidence.
6. Add US6 for staff Django Admin entry point.
7. Complete Phase 9 for platform serving, CI, and final validation.

### Parallel Team Strategy

1. Complete Phase 1 and Phase 2 together.
2. After Phase 2, split work by feature directory ownership:
   - Auth owner: `frontend/src/features/auth/`
   - Submissions owner: `frontend/src/features/submissions/`
   - Safety/shared owner: `frontend/src/lib/safe-display.ts` and safety tests
   - E2E/accessibility owner: `frontend/e2e/`
3. Coordinate route integration through `frontend/src/app/router.tsx` to avoid conflicting edits.

---

## Format Validation

- Total tasks: 100
- All task lines use `- [ ] T###` sequential IDs.
- User-story phases include `[US1]` through `[US6]` labels.
- Setup, foundational, and polish phases do not use story labels.
- Parallelizable tasks use `[P]` only where they target separate files or independent test files after their declared dependency.
- Every task description includes one or more exact file paths.
- Every task description includes a `Depends:` relationship.
- Every task description includes a `Validate:` method.
