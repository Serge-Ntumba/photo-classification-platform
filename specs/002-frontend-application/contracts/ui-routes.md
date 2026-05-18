# Contract: Frontend UI Routes and States

This contract defines the user-facing routes, required data, and states for the React frontend. Route paths are frontend paths unless explicitly marked as Django Admin.

## Route Summary

| Route | Access | Purpose |
|---|---|---|
| `/` | public/auth-aware | Route visitors to login/register and authenticated users to workspace |
| `/register` | anonymous preferred | Public account creation |
| `/login` | anonymous preferred | Authentication and protected deep-link return |
| `/app` | authenticated | Workspace home |
| `/app/submissions/new` | authenticated | Create photo submission |
| `/app/submissions` | authenticated | Paginated user-owned submission list |
| `/app/submissions/:id` | authenticated owner | Submission detail and safe latest review result |
| resolved Django Admin URL | staff, external Django Admin | Existing protected admin review area |
| `*` | public/auth-aware | Neutral not-found route |

## `/`

Behavior:

- Visitor sees public access flow with registration and login paths.
- Authenticated user is routed to `/app`.
- Must not be a marketing landing page; the product workflow is primary.

States:

- anonymous
- authenticated
- session-expired

## `/register`

Inputs:

- email
- username
- password

Backend call:

```text
POST /api/auth/register/
```

Success:

- Show registration success.
- Route to `/login`.

Errors:

- Field-level registration validation where backend identifies fields.
- Generic recoverable message for malformed/unexpected response.

Constraints:

- No staff/admin/role controls.
- Registration does not create frontend session in current backend behavior.

## `/login`

Inputs:

- email
- password

Backend call:

```text
POST /api/auth/login/
```

Success:

- Store active browser-session access token and safe user summary.
- Route to same-origin `returnTo` path when allowed.
- Otherwise route to `/app`.

Errors:

- Invalid credentials use generic copy.
- Expired return target routes to `/app` with neutral message.

Constraints:

- Do not persist refresh token.
- Do not display token values.

## `/app`

Required data:

```text
GET /api/auth/me/
```

Visible navigation:

- create submission
- submissions
- sign out
- staff review entry only when `is_staff=true`

States:

- loading current user
- authenticated workspace
- session expired
- service unavailable

Staff review entry:

- Target is `/admin/` when the frontend is served from the platform origin, otherwise the backend public origin plus `/admin/` during separate-origin local development.
- Copy states the admin area may require a separate admin login session.
- Non-staff users must see zero staff-only controls.

## `/app/submissions/new`

Purpose: create one submission.

Inputs:

- photo
- name
- age
- place of living
- gender
- country of origin
- optional description

Backend call:

```text
POST /api/submissions/
```

Client-side validation:

- Required fields reject blank/whitespace-only values.
- Max lengths: name 255, place 255, gender 100, country 255, description 1,000.
- Age integer 0 through 120 inclusive.
- Photo: JPEG, PNG, WebP; >0 bytes; <=5 MB; dimensions 300x300 through 5000x5000 when browser can inspect.

States:

- empty draft
- local preview available
- local preview unavailable
- validation errors
- submitting
- uncertain outcome after network timeout
- success with created pending submission
- session expired
- service unavailable

Success behavior:

- Revoke local preview URL.
- Clear selected file state.
- Navigate to created submission detail or show created pending state with route to detail.

Duplicate prevention:

- Submit action is disabled while mutation is in flight.
- Repeated clicks must not create parallel requests.

Navigation away:

- If submission is in flight, communicate that the request is already being sent.
- If unsent draft exists, preserving safe metadata is allowed; selected photo preview must remain local and be cleared on sign-out.

## `/app/submissions`

Purpose: list user-owned submissions.

Backend call:

```text
GET /api/submissions/?page={page}&status={status}
```

Supported controls:

- page navigation
- status filter using backend status values only
- manual refresh

Default:

```text
newest submissions first
```

States:

- loading
- empty
- populated
- filtered empty
- next page available
- previous page available
- out-of-range page
- session expired
- service unavailable
- unexpected response

Row/card display:

- status
- created time
- user-submitted submission name when useful
- safe latest review summary when available

Forbidden display:

- original filename
- photo object key
- storage links
- internal classifier fields
- raw error/internal enum values

## `/app/submissions/:id`

Purpose: detail view for one owned submission.

Backend call:

```text
GET /api/submissions/{id}/
```

States:

- loading
- found
- neutral not-found/access denied
- pending/classifying with manual refresh
- completed/rejected/manual-review/failed
- session expired
- service unavailable
- unexpected response

Display:

- user-submitted metadata
- safe file facts only
- status
- created/updated timestamps
- last checked timestamp
- safe classification summary when available

Actions:

- manual refresh
- return to submissions

Unsupported actions:

- edit
- delete
- retry classification
- reclassify
- manual approve
- show uploaded photo
- download photo

## `/admin/`

Purpose: existing Django Admin review area.

Access:

- Existing platform authorization only.
- Frontend link visible only to staff users.

Behavior:

- Opens or navigates to the resolved public Django Admin URL.
- The admin area may prompt for a separate admin session.
- The frontend must not treat that prompt as a failure.

Out of scope:

- Custom admin dashboard.
- Admin API consumption by the React app.
- Admin search/filter UI in the frontend.

## Not Found Route

Behavior:

- Public unknown route shows neutral not-found copy.
- Protected unknown route gives a safe path back to workspace/submissions.
- Unknown submission detail must not reveal whether another user's record exists.

## Global Interaction and Accessibility Requirements

- All primary controls have accessible names.
- Keyboard users can complete registration, login, submission creation, list pagination/filtering, manual refresh, and result viewing.
- Focus moves to validation summaries or changed status messages when needed.
- Validation errors, upload progress, status refreshes, and session expiry are announced or exposed to assistive technology without relying only on visual position.
- Text and controls meet contrast, resize, and reflow expectations for the primary workflow.
- Status and errors are not communicated by color alone.
- Layout works without horizontal scrolling for core content at 360px mobile width and 1366px desktop width.
- Long user-entered words wrap or truncate without overlapping controls.
- Loading, success, validation-error, authorization-error, not-found, session-expired, service-unavailable, and unexpected-response states are present for the primary workflow.

## Global Session Behavior

- Sign-out clears the current tab's active browser session and sensitive local state immediately.
- Other open frontend tabs in the same browser profile must stop showing protected data no later than their next protected navigation, refresh, or backend action after sign-out, session expiry, or permission changes.
- Backend rejection of stale credentials remains the final authority for protected API calls.
