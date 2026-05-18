# Frontend

React + TypeScript frontend for the Photo Classification Platform.

## Prerequisites

- Node.js and npm
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
npm run build
```

Local development is served at `http://localhost:5173`; `/api/` requests proxy
to the backend public entry point.
