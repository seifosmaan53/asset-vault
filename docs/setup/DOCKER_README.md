# Docker Setup Guide

`docker-compose.yml` is a production-like stack: **Caddy terminates TLS** in front of the API
and the web app. The one browser-usable entry point is **https://localhost**.

| Service | Image | Host ports | Role |
|---|---|---|---|
| `proxy` | `caddy:2.8.4-alpine` | **80, 443** | TLS; `/api/*` → `backend:3000`, everything else → `frontend:80`; HTTP → HTTPS (308) |
| `backend` | `backend/Dockerfile` | none | The API, `NODE_ENV=production` |
| `frontend` | `frontend/Dockerfile` | none | nginx serving the built web app |
| `postgres` | `postgres:15-alpine` | `127.0.0.1:5432` | Database (loopback only, for psql / backups) |
| `frontend-dev` | `frontend/Dockerfile.dev` | 5173 | Vite dev server, `dev` profile only |

**Why a proxy is required.** In production mode the API redirects every plain-HTTP request to
HTTPS, and it believes "this was HTTPS" (`X-Forwarded-Proto`) only from a proxy it trusts. A
browser talking to the API or to nginx directly over `http://` therefore cannot use the app;
that is why neither publishes a port. Do not "fix" this by publishing `3000` or by switching
`NODE_ENV` — keep HTTPS enforcement and go through the proxy.

What CI verifies (`.github/workflows/ci.yml`): job **compose-proxy** runs the commands below with
dummy Clerk keys and checks that the API refuses to start before the migrations, that
https://localhost serves the web app and `/api/v1/health` with the certificate verified against
Caddy's CA, that HTTP is redirected, that the API and nginx have no host port, that forged
`X-Forwarded-*` headers are replaced by Caddy, CORS through the proxy, and a clean
`docker compose stop backend`. Job **api-shutdown** checks graceful shutdown in the API image.
Signing in through Clerk in the browser is not tested (it needs a real Clerk instance).

## Requirements

- Docker with the Compose v2 plugin (`docker compose`, not the old `docker-compose`).
- A Clerk application (https://dashboard.clerk.com): its **secret** key for the API and
  its **publishable** key for the web app.
- Ports 80 and 443 free on the host.

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
# SITE_ADDRESS=localhost             # host name Caddy serves and gets a certificate for
# CADDY_TLS=internal                 # internal = Caddy's local CA; an e-mail = ACME (see TLS)
# FRONTEND_URL=https://localhost     # the one origin CORS allows; must match SITE_ADDRESS
# API_PUBLIC_URL=                    # target of the API's HTTP->HTTPS redirect (default FRONTEND_URL)
# TRUST_PROXY=1                      # see "Server settings"
# SHUTDOWN_TIMEOUT_MS=8000           # see "Server settings"
# VITE_API_BASE_URL=/api/v1          # same origin, through the proxy
# POSTGRES_HOST_PORT=5432            # loopback port for psql
```

Because the `VITE_*` values are compiled into the bundle, rebuild after changing them:
`docker compose build frontend`.

## Start (the browser-usable stack)

```bash
docker compose up -d --build                                              # 1. build, start
docker compose run --rm backend node dist/database/migration-runner.js   # 2. migrate
docker compose up -d --wait                                               # 3. start the API
# 4. open https://localhost
```

1. On a new database the `backend` container **exits 1** at step 1, logging
   `Startup aborted: database schema is not current.` and the pending migrations. That is the
   startup schema check, which runs before the API connects or listens, behind the proxy as
   anywhere else; meanwhile `https://localhost/api/...` answers 502.
2. Applies the migrations with the image's own runner (in one transaction).
3. Starts the API again; `--wait` returns once its health check (`node dist/server/healthcheck.js`,
   which queries PostgreSQL) passes.

Then: web app https://localhost, API https://localhost/api/v1, API docs https://localhost/api/docs.

```bash
docker compose ps
docker compose logs -f backend
docker compose down              # add -v to delete the database and Caddy's CA
```

Backup, rerun, failure and recovery steps for migrations:
[`docs/operations/MIGRATIONS.md`](../operations/MIGRATIONS.md).

## TLS

**Development / CI (default, `CADDY_TLS=internal`).** Caddy creates its own local certificate
authority in the `caddy_data` volume and issues a certificate for `SITE_ADDRESS` (`localhost`).
Browsers warn until you trust that CA. Export it and add it to your trust store:

```bash
docker compose cp proxy:/data/caddy/pki/authorities/local/root.crt ./caddy-local-root.crt
# macOS: sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain caddy-local-root.crt
# Debian/Ubuntu: sudo cp caddy-local-root.crt /usr/local/share/ca-certificates/ && sudo update-ca-certificates
curl --cacert caddy-local-root.crt https://localhost/api/v1/health
```

The CA persists across restarts; `docker compose down -v` deletes it (trust the new one).
Never use the internal CA for a real deployment.

**Real deployment.** Point a DNS name at the host, open ports 80 and 443, and set:

```env
SITE_ADDRESS=app.example.com
CADDY_TLS=you@example.com          # ACME account e-mail: Caddy obtains and renews a public certificate
FRONTEND_URL=https://app.example.com
```

Caddy then gets a Let's Encrypt (or ZeroSSL) certificate automatically. To use your own
certificate files instead, mount them into the `proxy` service and set
`CADDY_TLS="/certs/fullchain.pem /certs/privkey.pem"`. Any other TLS proxy or load balancer works
too, as long as it overwrites `X-Forwarded-Proto` / `-For` / `-Host` and the API's
`TRUST_PROXY` names it (below).

## Server settings

Read once at startup by `backend/src/server/server-settings.ts`; an invalid value stops the API
with a message.

| Variable | Default | Meaning |
|---|---|---|
| `TRUST_PROXY` | none (empty) | Which peers may set `X-Forwarded-For` / `-Proto` / `-Host`. Empty, `false` or `0`: none, the TCP peer is the client and forwarded headers are ignored. A number *n*: the *n* hops in front of the API. A comma list of IPs, CIDR ranges and/or `loopback`, `linklocal`, `uniquelocal`: peers with those addresses. `true` / `*` are refused. Compose sets `1`: the API's only peer is the proxy, because the API port is not published. If you publish the API port, use the proxy's address instead of a hop count. Decides `req.secure` (HTTPS enforcement), `req.ip` (rate limiting is per client IP, so with no trusted proxy every client behind a proxy shares one limit) and `req.hostname`. |
| `API_PUBLIC_URL` | `FRONTEND_URL` | The production HTTP→HTTPS redirect goes to `https://<this host>` + the request path. It is never built from `Host` or `X-Forwarded-Host`. Set it when the API has its own host name. |
| `FRONTEND_URL` | `https://localhost` in Compose | The **only** origin CORS allows in production (exact match: scheme, host and port; browsers omit default ports, so `https://localhost`, not `https://localhost:443`). |
| `SHUTDOWN_TIMEOUT_MS` | `8000` | Graceful-shutdown bound, 1000–120000. |

**HTTPS enforcement** (production only): a request is HTTPS if it arrived over TLS, or if a
trusted proxy says `X-Forwarded-Proto: https`. Anything else gets `301` to the configured origin.
A client that talks to the API directly cannot skip the redirect by sending the header itself.

**CORS.** No `Origin` header (server-to-server, health checks, same-origin GET): untouched, no
CORS headers. Allowed origin: `Access-Control-Allow-Origin` echoes it exactly, with
`Access-Control-Allow-Credentials: true`; preflights answer `204`. **Any other origin: `403`
`{"statusCode":403,"error":"Forbidden","message":"Origin not allowed"}` for every method,
preflight or not, with no CORS headers** (it used to be a 500). Refusing the request itself,
not only the preflight, means a cross-site form post or `no-cors` fetch never reaches a route.
`Vary: Origin` is on every response. Outside production the allowlist also contains
`http://localhost:5173`, `http://localhost:3000`, the `127.0.0.1` equivalents and private-network
`http://` origins with a port.

**Graceful shutdown.** On SIGTERM (`docker stop`, `docker compose stop`, Kubernetes) or SIGINT
the API stops accepting connections at once, lets in-flight requests finish, then closes the
cron jobs, the Puppeteer browser and the PostgreSQL pool and exits **0**. If that has not
finished within `SHUTDOWN_TIMEOUT_MS` of the signal, it drops the remaining connections and
exits **1**. The image's exec-form `CMD ["node", "dist/main"]` keeps node as PID 1 so it
receives the signal directly. The default 8 s stays under Docker's default 10 s stop timeout;
Compose sets `stop_grace_period: 15s`. Whatever runs the container must allow longer than
`SHUTDOWN_TIMEOUT_MS`, or it will SIGKILL (exit 137) mid-drain. Logs:
`Shutdown: SIGTERM received; ...`, `Shutdown: HTTP server drained after N ms; ...`,
`Shutdown: complete in N ms; exiting 0.` (or `... forcing exit 1.`).

## SMTP connection-test limits

`POST /user-settings/test-email` connects to a server the user names, so it is limited separately.
Read by `MailService` and the endpoint's guards; set them in the root `.env` (Compose forwards
them to the backend) or in the backend's environment. An invalid value stops the API at startup.

| Variable | Default | Meaning |
|---|---|---|
| `SMTP_TEST_LIMIT_PER_MINUTE` / `SMTP_TEST_LIMIT_PER_HOUR` | 5 / 20 | `POST /user-settings/test-email` (SMTP connection test) per verified user. **Per process**: the throttler keeps counts in memory, so N replicas allow up to N× these numbers; a shared store would need a shared `ThrottlerModule` storage. |
| `SMTP_TEST_IP_LIMIT_PER_MINUTE` | 20 | The same endpoint per client address, as `TRUST_PROXY` sees it (forwarded headers from untrusted peers are ignored). Per process. |
| `SMTP_TEST_MAX_CONCURRENT` / `SMTP_TEST_TIMEOUT_MS` | 8 / 10000 | Connection tests in flight at once in this process (one per user; excess is 429 without a connection) and the whole-test deadline (1000–120000 ms) after which the socket is destroyed. |

## Hot-reload frontend (dev profile)

`frontend-dev` runs the Vite dev server on http://localhost:5173 with the source mounted. It
talks to the API **through the proxy**, so trust Caddy's CA first (see TLS): the browser
refuses API calls to an untrusted certificate.

```bash
cp frontend/.env.example frontend/.env
# frontend/.env: VITE_CLERK_PUBLISHABLE_KEY=pk_test_...  and  VITE_API_BASE_URL=https://localhost/api/v1
# root .env:     FRONTEND_URL=http://localhost:5173  and  API_PUBLIC_URL=https://localhost
docker compose --profile dev up -d
```

`FRONTEND_URL` must be the dev server's origin because it is the only origin CORS allows;
switch it back to `https://localhost` (and `docker compose up -d backend`) for the built app.

## Building an image by hand

Both frontend images build from the **repository root**, so they can include
`backend/src/common/money/invoice-money.ts`, the invoice-money module shared with the API
(the `@invoice-money` Vite alias):

```bash
docker build -f frontend/Dockerfile \
  --build-arg VITE_CLERK_PUBLISHABLE_KEY=pk_test_... --build-arg VITE_API_BASE_URL=/api/v1 \
  -t asset-vault-frontend .
docker build -f frontend/Dockerfile.dev -t asset-vault-frontend-dev .
docker build -t asset-vault-backend backend
```

A `frontend/.env.production` that defines `VITE_CLERK_PUBLISHABLE_KEY` also works (the
root `.dockerignore` keeps it); a non-empty build arg takes precedence.

Running the API image outside Compose: put it behind your TLS proxy, set `TRUST_PROXY` to that
proxy, `FRONTEND_URL` to the browser origin, and run the migrations first
(`docs/operations/release.sh` does backup → migrate → start → health check).

## Files

| File | Role |
|---|---|
| `docker-compose.yml` | `proxy`, `backend`, `frontend`, `postgres`; `frontend-dev` in the `dev` profile |
| `deploy/caddy/Caddyfile` | The proxy: site `SITE_ADDRESS`, `tls CADDY_TLS`, routes `/api/*` and the rest |
| `backend/Dockerfile` | `node:22-alpine`, multi-stage; context `backend/`, filtered by `backend/.dockerignore`; `STOPSIGNAL SIGTERM`, node as PID 1 |
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
- **`backend` exited (1)**: `docker compose logs backend`. `database schema is not current` →
  run the migration command; `TRUST_PROXY=true would trust ...` → set a hop count or addresses.
- **`https://localhost/api/...` answers 502**: the API is not running (see above).
- **Browser certificate warning**: trust Caddy's local CA (TLS section), or use a real domain.
- **API calls fail with 403 `Origin not allowed`**: `FRONTEND_URL` is not exactly the origin
  in the address bar (the backend log shows `CORS: refused ... from origin ...`).
- **`backend` unhealthy, healthcheck says `TRUST_PROXY does not trust loopback`**: the probe
  stands in for the proxy over loopback; keep `TRUST_PROXY=1` or include `loopback`.
- **Port 80/443 already in use**: stop the other web server. Remapping the proxy's ports is not
  supported as shipped: Caddy's HTTP→HTTPS redirect and `FRONTEND_URL` assume 443.
