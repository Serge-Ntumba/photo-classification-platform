# Quickstart: Frontend Application

This quickstart is for the planned React + TypeScript frontend. It assumes the backend platform is already implemented and can run through Docker Compose.

## Prerequisites

- Supported Active/Maintenance Node.js LTS version compatible with the selected Vite release
- npm
- Docker Desktop or Docker Engine with Compose
- Backend stack from the repository root

## Start the Backend

From the repository root:

```bash
docker compose up -d
docker compose exec web python manage.py migrate
```

Expected public backend entry points:

```text
http://localhost/api/auth/register/
http://localhost/api/auth/login/
http://localhost/api/auth/me/
http://localhost/api/submissions/
http://localhost/admin/
http://localhost/api/docs/
```

The frontend must not link to or call internal classifier, broker, database, worker, or object-storage services.

## Install Frontend Dependencies

After implementation creates `frontend/package.json`:

```bash
cd frontend
npm install
```

## Environment

For local same-origin/proxy development, the frontend can use a relative API base:

```text
VITE_API_BASE_URL=/api
```

When running Vite on `http://localhost:5173`, configure the Vite dev server to proxy:

```text
/api/   -> http://localhost/api/
```

The staff review entry can navigate to the backend public admin URL (`http://localhost/admin/`) during local development. A same-origin `/admin/` proxy is optional and should be added only if the implementation needs it.

Do not configure browser-facing URLs for MinIO, RabbitMQ, PostgreSQL, Celery, worker health, or the FastAPI classifier.

## Run the Frontend

```bash
cd frontend
npm run dev
```

Expected local app:

```text
http://localhost:5173
```

## Build

```bash
cd frontend
npm run build
```

The production build should produce static assets that can be served by the platform public entry point while `/api/` and `/admin/` continue to route to Django.

Production static image validation:

```bash
docker build -f frontend/Dockerfile frontend
docker compose build nginx
docker compose config
```

## Planned Verification Commands

```bash
cd frontend
npm run typecheck
npm run lint
npm run format:check
npm run test -- --run
npm run build
npm run e2e
```

The implementation uses Vitest for unit/component tests and Playwright for
browser workflow smoke checks. `npm run test -- --run` is the deterministic
non-watch form used for local and CI verification.

## Implementation-Specific Command Notes

- `npm run e2e` starts the Vite dev server on `127.0.0.1:5173`; sandboxed
  command runners may need permission to bind that localhost port.
- `docker build -f frontend/Dockerfile frontend` and `docker compose build
  nginx` require Docker daemon access.
- `kubectl apply --dry-run=client -f infra/k8s/configmap.yaml` and
  `kubectl apply --dry-run=client -f infra/k8s/deployments/nginx.yaml` require
  a configured Kubernetes API for this local kubectl version. When no cluster is
  configured, run `python scripts/validate_k8s_manifests.py` for the repository
  exposure-boundary validation.

Minimum coverage expectations for task generation:

- registration success and validation failure
- generic login failure
- protected route redirect and return-after-login
- session expiry on protected API response
- create submission validation boundaries
- duplicate submit prevention
- uncertain network outcome guidance
- paginated submission list with status filter
- detail refresh for pending/classifying status
- safe classification summary rendering
- suppression of private photo fields and internal classifier fields
- staff review entry visible only for staff users
- mobile 360px and desktop 1366px workflow smoke checks
- keyboard navigation through primary workflow
- accessibility checks for focus visibility, accessible names, status/error announcements, contrast, and non-color-only communication

## Acceptance Testing Protocol

SC-001 and SC-002 require product acceptance testing evidence, not only automated checks. Before accepting the implemented frontend, record a lightweight UAT run with:

- at least 10 first-time users attempting registration, login, and authenticated workspace access without assistance
- at least 10 authenticated users attempting a valid photo submission with required metadata in under 5 minutes
- pass/fail counts, blocking issues, and any assistance required

## Manual Smoke Flow

1. Open `http://localhost:5173`.
2. Register a normal user with email, username, and password.
3. Log in with the new credentials.
4. Create a submission with a valid JPEG, PNG, or WebP image and required metadata.
5. Confirm the created submission appears as pending/classifying or completed depending on worker timing.
6. Open the submissions list and use pagination/status filtering if data exists.
7. Open the detail view and manually refresh status.
8. Sign out and confirm protected routes prompt for login.
9. Log in with an existing or admin-created staff account and confirm the `/admin/` review entry appears.
10. Log in as a non-staff user and confirm the staff review entry is absent.

## Accessibility Smoke Checks

For the primary registration, login, submission, list, and detail workflows, verify:

- every interactive control has an accessible name and visible focus state
- all required actions can be completed with keyboard only
- validation errors, upload progress, status refreshes, and session expiry are announced or exposed to assistive technology
- error and status meaning does not rely on color alone
- text remains readable and controls remain reachable at 360px mobile width and 1366px desktop width without horizontal scrolling for core content
- long user-entered values do not overlap controls or hide required information

## Safety Smoke Checks

For any list/detail response that includes backend photo references or internal classifier fields, verify user-facing UI does not display:

```text
object_key
original_filename
provider
classifier_version
schema_version
score
confidence_score
fallback_reason
error_code
classification_duration_ms
raw_response
provider_metadata
signed URLs
tokens
raw prompts
raw image bytes
private object keys
internal service URLs
```

Classification copy must describe submission review only, not person traits. Repeat the safety check with an otherwise allowlisted classification reason that contains a token-like value, signed URL, raw prompt, or private object key; the unsafe reason must be suppressed or replaced with generic safe review copy.
