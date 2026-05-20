# Frontend

React + TypeScript frontend for the Photo Classification Platform.

## Prerequisites

- Node.js 22 LTS-compatible runtime and npm
- Backend platform running from the repository root:

```bash
docker compose up -d
docker compose exec web python manage.py migrate
```

## Environment

Use a relative API path for same-origin production and local Vite proxying:

```text
VITE_API_BASE_URL=/api
VITE_BACKEND_PUBLIC_ORIGIN=http://localhost
```

`VITE_API_BASE_URL` may be empty or `/api` for same-origin serving. During
local Vite development, `VITE_BACKEND_PUBLIC_ORIGIN` points the `/api` proxy and
staff Django Admin link at the public backend origin.

The frontend calls only the public Django/DRF API and links staff users to the
existing Django Admin area. It does not call MinIO, RabbitMQ, PostgreSQL, Celery,
worker endpoints, or the classifier service.

## Commands

```bash
npm ci
npm run dev
npm run typecheck
npm run lint
npm run format:check
npm run test
npm run test -- --run
npm run build
npm run e2e
```

Local development is served at `http://localhost:5173`; `/api/` requests proxy
to the backend public entry point.

## Public Entry Deployment

The production build is static. `frontend/Dockerfile` builds the Vite assets and
packages them in an Nginx image for the platform public entry point.

Nginx serves the frontend assets and proxies backend-owned paths to Django:

```text
/api/
/api/docs/
/admin/
/health
```

The production deployment must not expose Vite as the public server. Django
Admin remains the existing staff review area and may require a separate admin
login session.
