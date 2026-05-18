# Implementation Plan: Frontend Application

**Branch**: `002-frontend-application` | **Date**: 2026-05-18 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/002-frontend-application/spec.md`

## Summary

Build a browser-based frontend for the implemented Photo Classification Platform backend. The frontend will be a React + TypeScript single-page application using shadcn/ui and Tailwind CSS for accessible operational UI, consume the existing Django/DRF API through the public application entry point, and expose only the user workflows already supported by the backend: registration, login, current-user profile, user-owned submission creation, paginated user-owned submission list/detail, safe asynchronous classification status display, and a staff-only link to the existing Django Admin review area.

The frontend intentionally does not create a custom admin panel, photo retrieval feature, token refresh flow, logout endpoint, reclassification action, edit/delete workflow, or direct integration with MinIO, RabbitMQ, Celery, PostgreSQL, or the FastAPI classifier.

## Technical Context

**Language/Version**: TypeScript with React; supported Node.js LTS compatible with the selected frontend tooling; exact package versions pinned during frontend implementation.

**Primary Dependencies**: React, Vite, shadcn/ui, Tailwind CSS, browser Fetch API. Additional routing, form, server-state, validation, icon, or test libraries may be selected during implementation only when they directly support the specified user workflows.

**Storage**: No frontend-owned durable application data. Access token and safe account summary are stored for the active browser session only; selected photo previews remain local browser object URLs and are revoked on clear, submit completion, or sign-out. Same-browser frontend tabs must converge on sign-out, session expiry, and permission changes by the next protected navigation, refresh, or backend action without introducing durable frontend-owned application storage. Backend remains source of truth for users, submissions, photos, and classification results.

**Testing**: Verify API response transformation, safe display behavior, protected routes, form validation, session expiry, responsive workflow completion, keyboard access, status/error accessibility, TypeScript build correctness, and frontend lint/format cleanliness with the smallest practical toolset selected during implementation.

**Target Platform**: Modern desktop and mobile browsers served through the platform public entry point. Local development may run Vite with proxying to the existing backend/Nginx entry point.

**Project Type**: Frontend web application inside the existing backend platform repository.

**Performance Goals**: Successful submission creation shows the created pending state within 3 seconds of the backend response, and users can find the latest status of any visible submission in no more than two navigation actions from the authenticated workspace.

**Constraints**: Must not expose private photo object keys, original uploaded filenames, signed URLs, raw image bytes, raw classifier responses, provider metadata, provider identifiers, classifier versions, scores, confidence values, internal error codes, internal infrastructure links, or those values embedded inside otherwise allowlisted display strings. Must preserve submission-review-only language and label demographic fields as user-submitted metadata. Must not rely on backend capabilities that are not implemented.

**Scale/Scope**: First frontend version for the implemented v1 backend: public auth views, authenticated workspace, create submission, submissions list/detail, safe result display, and staff Django Admin entry point.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Safety-Bounded Classification**: PASS. The frontend displays classification as submission-review outcome only and maps unknown/unsafe values to generic unavailable review copy.
- **II. Demographic Metadata Separation**: PASS. Age, gender, country, and place are rendered only as user-submitted metadata and are not mixed into classification verdict language.
- **III. Single Application Data Owner**: PASS. Django/DRF remains the only public API/data owner; frontend performs no persistence outside browser session state.
- **IV. Stateless Classifier Boundary**: PASS. The frontend never calls the FastAPI classifier, worker, broker, or internal services.
- **V. Private Binary Storage**: PASS. The frontend uploads the selected file to Django/DRF only and does not request or render private object storage paths after creation.
- **VI. Async Classification**: PASS. The frontend treats classification as asynchronous and uses list/detail refresh against Django/DRF rather than synchronous classifier calls.

No constitution violations are introduced.

## Project Structure

### Documentation (this feature)

```text
specs/002-frontend-application/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── backend-api-consumption.md
│   ├── safe-display-contract.md
│   └── ui-routes.md
└── tasks.md              # Phase 2 output from /speckit-tasks; not created here
```

### Source Code (repository root)

```text
frontend/
├── package.json
├── vite.config.ts
├── tsconfig.json
├── components.json
├── index.html
├── public/
└── src/
    ├── app/
    │   ├── router.tsx
    │   └── providers.tsx
    ├── components/
    │   ├── layout/
    │   └── ui/
    ├── features/
    │   ├── auth/
    │   └── submissions/
    ├── lib/
    │   ├── api-client.ts
    │   ├── auth-session.ts
    │   ├── safe-display.ts
    │   └── validation.ts
    ├── routes/
    └── test/
```

Existing backend/platform directories remain owned by the backend feature:

```text
services/main/        # Django/DRF API, Django Admin, Celery app/tasks
services/classifier/  # Internal FastAPI classifier
infra/docker/         # Nginx and platform runtime config
tests/                # Existing backend contract/safety tests
```

**Structure Decision**: Add a top-level `frontend/` Vite React TypeScript application. Keep frontend tests inside the frontend project so backend pytest configuration remains isolated. Use `frontend/src/features/auth` and `frontend/src/features/submissions` for workflow-specific API calls, schemas, and view components; keep shared API/session/safe-display helpers under `frontend/src/lib`.

## Phase 0 Research

Completed in [research.md](research.md). All technical-context unknowns are resolved and no gate failures remain.

## Phase 1 Design

Completed artifacts:

- [data-model.md](data-model.md)
- [contracts/backend-api-consumption.md](contracts/backend-api-consumption.md)
- [contracts/safe-display-contract.md](contracts/safe-display-contract.md)
- [contracts/ui-routes.md](contracts/ui-routes.md)
- [quickstart.md](quickstart.md)

## Constitution Check - Post-Design

- **I. Safety-Bounded Classification**: PASS. Safe display contract defines an allowlist, value-level suppression, and fallback copy for classifications.
- **II. Demographic Metadata Separation**: PASS. Data model separates `UserSubmittedMetadata` from `ClassificationSummary`.
- **III. Single Application Data Owner**: PASS. Contracts consume only Django/DRF endpoints and Django Admin link.
- **IV. Stateless Classifier Boundary**: PASS. No frontend route or contract calls the classifier.
- **V. Private Binary Storage**: PASS. Safe display contract blocks photo object keys/original filenames and post-submit photo preview.
- **VI. Async Classification**: PASS. UI route contract covers pending/classifying states and manual refresh through GET submission endpoints.

No complexity exceptions are required.

## Complexity Tracking

No constitution or architecture violations require justification.
