# Research: Frontend Application

## Decision: React + TypeScript SPA built with Vite

**Rationale**: The frontend is a browser application over an already implemented Django/DRF API, so a static SPA is enough. Vite provides a first-party `react-ts` template, fast local dev server, and production static asset build without introducing server-side rendering or a separate backend-for-frontend service. TypeScript supports explicit API/display models for the backend responses that contain fields the UI must not render.

**Alternatives considered**:

- Next.js: rejected for v1 because server rendering and route handlers add deployment and ownership complexity that the spec does not require.
- React Router framework mode: rejected for v1 because the app does not need a full React Router server/runtime; route-level SPA behavior is sufficient.
- Plain Django templates: rejected because the requested frontend stack is React + TypeScript + shadcn/ui and the workflow needs rich client-side file validation, protected routes, and async status refresh.

## Decision: shadcn/ui with Tailwind CSS for the component system

**Rationale**: shadcn/ui fits the requested stack and gives accessible component primitives that can live in the repository as source, which is useful for a task-focused operational interface. Tailwind supports responsive layout, status badges, form states, and precise overflow handling for long user-entered values.

**Alternatives considered**:

- Material UI: rejected because it introduces a larger design system and dependency surface than needed.
- Custom component library: rejected because the frontend needs reliable accessible controls quickly and should not spend scope rebuilding common primitives.
- CSS modules only: rejected because consistent component styling and shadcn/ui conventions are part of the requested frontend stack.

## Decision: SPA route behavior without committing to a specific routing library

**Rationale**: The frontend needs public auth routes, authenticated workspace routes, submission list/detail routes, and redirect-after-login behavior. Those user behaviors are required regardless of whether implementation uses a maintained routing library or a small local routing layer. The plan should not force a routing dependency before task generation selects the smallest suitable option.

**Alternatives considered**:

- React Router: viable and conventional for this route set; can be selected during implementation if it keeps protected routes and query-string state straightforward.
- TanStack Router: viable but not necessary unless the implementation benefits from its typed route model.
- Hand-rolled routing: viable only if it stays small and covers protected deep links, pagination/status query state, and not-found behavior without extra fragility.

## Decision: Server-owned state stays behind a narrow API client

**Rationale**: Submissions and current-user profile are server-owned state. The frontend needs explicit loading/error states, session-expiry handling, create-submission invalidation, and manual refresh for pending/classifying statuses, but the spec does not require a dedicated server-state library. A narrow API client and workflow-level state are sufficient unless implementation tasks show repeated request-state complexity.

**Alternatives considered**:

- TanStack Query: viable if it materially reduces duplicate request-state code and improves mutation invalidation.
- Component-local fetch state: viable for simple routes if shared session/error normalization remains centralized.
- Redux Toolkit Query or SWR: viable but likely unnecessary for the small v1 workflow set.

## Decision: Validation mirrors backend constraints without requiring a specific form stack

**Rationale**: Registration, login, and submission creation need field-level errors, backend error mapping, file validation, disabled submit states, and value preservation after validation failures. The frontend should model backend constraints clearly, but a specific form or schema library is an implementation choice, not product scope. Backend validation remains authoritative.

**Alternatives considered**:

- React Hook Form plus Zod: viable if it keeps shadcn/ui form wiring and typed validation concise.
- Browser-native validation only: viable only for simple required fields; it is not enough by itself for image-boundary checks and backend error mapping.
- Backend-only validation: rejected because the spec requires user-correctable feedback before or during submission.

## Decision: Browser-session JWT handling without token refresh

**Rationale**: The implemented backend returns `access`, `refresh`, and user summary from `POST /api/auth/login/`, but exposes only `register`, `login`, and `me` auth routes. There is no dedicated browser logout or token-refresh endpoint. The frontend will store only the access token and safe account summary for the active browser session, clear them on sign-out and 401, and prompt login again when the backend rejects credentials. Same-browser frontend tabs must converge on sign-out, session expiry, and permission changes by the next protected navigation, refresh, or backend action while keeping backend rejection as the final authority. The refresh token is not persisted because there is no implemented refresh endpoint to use.

**Alternatives considered**:

- Store refresh token and auto-refresh: rejected because the backend route does not exist.
- Require login after every page reload: rejected because the spec includes browser refresh as an expected edge case and active browser session behavior.
- Store tokens in localStorage permanently: rejected because it exceeds the required active-session scope and increases token exposure.
- Ignore other open tabs until manual reload: rejected because the spec requires session changes to be reflected by protected route/API boundaries.
- HttpOnly cookie session: rejected for this frontend plan because the implemented API auth surface is JWT bearer tokens.

## Decision: Allowlist frontend display model over raw backend responses

**Rationale**: The backend user submission response currently includes private photo references and internal classification fields. The frontend must narrow those responses into display-only models before rendering. User-facing classification display is shown beside submission status and otherwise limited to review decision, category, safe reasons, and relevant timestamps. Photo object keys, original filenames, provider identifiers, versions, fallback details, error codes, durations, scores, confidence values, raw responses, provider metadata, and unsafe values embedded inside otherwise allowlisted strings are dropped or replaced with safe fallback copy.

**Alternatives considered**:

- Render backend response fields directly: rejected because it would violate the safety/privacy requirements.
- Ask backend to create a frontend-only response before building UI: rejected for this planning phase because the backend is already implemented and the spec explicitly requires the frontend to avoid unsafe display even when fields are present.

## Decision: Local preview only before submission

**Rationale**: The backend has no permission-checked photo retrieval endpoint. The frontend may create a local object URL for selected-file preview before upload, but must revoke it when the file is cleared, replaced, submitted, or the user signs out. After creation, the UI must not show the uploaded photo or link to object storage.

**Alternatives considered**:

- Render `photo.object_key` as a link: rejected because object keys are private storage references.
- Use MinIO/S3 direct browser links: rejected because internal storage is private and must not be exposed.
- Add a backend photo stream endpoint: out of scope for this frontend feature.

## Decision: Testing outcomes focused on contracts, workflows, and safety

**Rationale**: The frontend has a high risk of display and auth/session regressions. Tests should cover API response transformation, field validation, protected routes, session expiry handling, safe display allowlists, mobile/desktop layout smoke checks, and keyboard/accessibility behavior. The plan should define those outcomes and leave the exact unit, component, mock, browser, and accessibility tools to implementation tasks.

**Alternatives considered**:

- E2E-only testing: rejected because safety display logic and validation edge cases need fast focused tests.
- Unit-only testing: rejected because protected routes, file upload behavior, and responsive workflow completion need browser-level coverage.
- Fixed test-stack mandate: rejected because it can create infrastructure beyond the spec before tasks define the needed coverage.

## Decision: Serve through the existing public platform entry point

**Rationale**: The backend architecture already uses Nginx as the public entry point and keeps internal services private. The frontend should follow that boundary: static assets through the public entry point; `/api/`, `/admin/`, and public docs links remain routed to Django/DRF as already implemented. Local Vite development can proxy API requests to the same public backend entry point.

**Alternatives considered**:

- Expose Vite as the production web server: rejected because it is a development server, not the platform entry point.
- Point frontend directly at internal service hostnames: rejected because it would expose implementation details and violate service boundaries.
- Add a new frontend backend service: rejected because no frontend-owned server behavior is required in v1.

## References Reviewed

- React TypeScript documentation: https://react.dev/learn/typescript
- Vite guide and React TypeScript template support: https://main.vite.dev/guide/
- shadcn/ui installation documentation: https://ui.shadcn.com/docs/installation
- Node.js release documentation: https://nodejs.org/en/about/previous-releases
