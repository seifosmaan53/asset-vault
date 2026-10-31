# Docker Setup Guide

What is verified, and how: CI (`.github/workflows/ci.yml`, job **Docker images**) builds
`frontend/Dockerfile`, `frontend/Dockerfile.dev` and `backend/Dockerfile` from a clean
checkout, runs the frontend image and checks what it serves, validates
`docker-compose.yml`, and starts the `postgres` service. The full stack (backend talking to
a database and to Clerk) is **not** run in CI.

## Requirements

- Docker with the Compose v2 plugin (`docker compose`, not the old `docker-compose`).
- A Clerk application (https://dashboard.clerk.com): its **secret** key for the API and
  its **publishable** key for the web app.

## Configuration: a root `.env`

`docker compose` reads variables from the shell or from a `.env` file in the repository
root. It does **not** read `backend/.env` or `frontend/.env`.

```env
# Required. The API refuses to start without it.
CLERK_SECRET_KEY=sk_test_...
# Required. Baked into the web bundle at BUILD time; without it the image only shows a
# configuration-error screen, so the frontend build fails instead. Public by design.
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...

# Optional (defaults shown).
# DB_USERNAME=postgres
# DB_PASSWORD=postgres
# DB_DATABASE=invoiceme
# CLERK_WEBHOOK_SECRET=
# CLERK_JWT_KEY=
# FRONTEND_URL=http://localhost       # the one origin the API's CORS allows in production
# VITE_API_BASE_URL=http://localhost:3000/api/v1
```

Because the `VITE_*` values are compiled into the bundle, rebuild after changing them:
`docker compose build frontend`.

## Start

```bash
docker compose up -d --build     # postgres, backend, frontend (nginx)
docker compose ps
docker compose logs -f backend
docker compose down              # add -v to delete the database volume
```

- Frontend: http://localhost (port 80)
- API: http://localhost:3000/api/v1, docs at http://localhost:3000/api/docs

### Database schema

Nothing creates the schema automatically: the API does not run migrations at startup, and
it refuses to start while any migration is pending. The backend image includes the compiled
migration runner, so run it as a one-off container once the `postgres` service is healthy,
then start the API:

```bash
docker compose run --rm backend node dist/database/migration-runner.js
docker compose up -d backend
```

Backup, rerun, failure and recovery steps are in
[`docs/operations/MIGRATIONS.md`](../operations/MIGRATIONS.md).

## Hot-reload frontend (dev profile)

`frontend-dev` runs the Vite dev server with the source mounted. It is behind the `dev`
profile, so `docker compose up` does not start it:

```bash
cp frontend/.env.example frontend/.env   # set VITE_CLERK_PUBLISHABLE_KEY
docker compose --profile dev up -d frontend-dev
```

It serves http://localhost:5173 and reads `VITE_*` from the mounted `frontend/.env`.
Compose still needs `CLERK_SECRET_KEY` (for the backend it depends on). The API allows a
single CORS origin in production, so set `FRONTEND_URL=http://localhost:5173` in the root
`.env` while using the dev server, then `docker compose up -d backend` to apply it.

## Building an image by hand

Both frontend images build from the **repository root**, so they can include
`backend/src/common/money/invoice-money.ts`, the invoice-money module shared with the API
(the `@invoice-money` Vite alias):

```bash
docker build -f frontend/Dockerfile \
  --build-arg VITE_CLERK_PUBLISHABLE_KEY=pk_test_... \
  -t asset-vault-frontend .
docker build -f frontend/Dockerfile.dev -t asset-vault-frontend-dev .
docker build -t asset-vault-backend backend
```

A `frontend/.env.production` that defines `VITE_CLERK_PUBLISHABLE_KEY` also works (the
root `.dockerignore` keeps it); a non-empty build arg takes precedence.

## Files

| File | Role |
|---|---|
| `docker-compose.yml` | `postgres` (15-alpine), `backend`, `frontend`; `frontend-dev` in the `dev` profile |
| `backend/Dockerfile` | `node:22-alpine`, multi-stage; context `backend/`, filtered by `backend/.dockerignore` |
| `frontend/Dockerfile` | `node:22-alpine` build, then `nginx:alpine` serving `dist` |
| `frontend/Dockerfile.dev` | `node:22-alpine` with dependencies installed; source is mounted |
| `frontend/nginx.conf` | SPA fallback to `index.html`, gzip, long-lived caching for fingerprinted assets, security headers |
| `.dockerignore` (root) | Build context of the frontend images: `frontend/` plus the one shared money file; excludes `node_modules`, `dist`, `.env`, `.env.local`, `.env.*.local` and tests |

Node 22 because Vite 7 needs Node ^20.19 or >=22.12, and NestJS 11 and `@clerk/backend`
need Node >=20 (the `engines` fields in the lockfiles); Node 18 cannot build either half.

## Troubleshooting

- **`required variable CLERK_SECRET_KEY is missing`**: compose refuses to parse the file
  without it; set it in the root `.env`.
- **Frontend build fails with `VITE_CLERK_PUBLISHABLE_KEY is not set`**: set it in the root
  `.env` and run `docker compose build frontend`.
- **The web app loads but API calls fail**: check `docker compose logs backend`, that the
  migrations have been applied, and that `FRONTEND_URL` is exactly the origin you open the
  app at (`http://localhost`, no `:80`); a mismatch shows as `CORS blocked request from origin`
  in the backend log.
- **Port already in use**: change the left-hand side of a `ports` entry, e.g. `"8080:80"`.
