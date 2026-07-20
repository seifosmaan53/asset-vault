# Asset Vault

<!--portfolio-note-->
> **Portfolio note —** one of three invoicing builds exploring the same problem across stacks. **This is the modern, fully type-safe take: React 19 + NestJS 11 + tRPC** (with Stripe + Clerk). Siblings: [pizza-box-system](https://github.com/seifosmaan53/pizza-box-system) (React + Express + Prisma) and [invoiceme](https://github.com/seifosmaan53/invoiceme) (Flutter mobile, offline-first).

> Invoice, inventory, and multi-store management for small businesses, built self-hostable.

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![NestJS](https://img.shields.io/badge/NestJS-11-E0234E?logo=nestjs&logoColor=white)](https://nestjs.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://typescriptlang.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-336791?logo=postgresql&logoColor=white)](https://postgresql.org)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&logoColor=white)](https://docker.com)

---

## Why this exists

I work in retail/pharmacy operations supporting a network of 890 stores, and the recurring pain there is the same one small multi-location businesses hit everywhere: invoicing, stock levels, and per-store reporting live in separate spreadsheets or disconnected tools. Asset Vault is my take on collapsing that into one self-hosted app — invoices, inventory (with reorder alerts and inter-store transfers), clients, and Stripe-metered subscription plans, scoped per organization.

It's also the "type-safety-first" entry in a set of three invoicing rebuilds I've done to compare approaches: this one leans on tRPC + TypeORM + Clerk; [pizza-box-system](https://github.com/seifosmaan53/pizza-box-system) does the same domain with Express + REST + Prisma; [invoiceme](https://github.com/seifosmaan53/invoiceme) does it offline-first on Flutter. See [Key engineering decisions](#key-engineering-decisions) below for why this one is built the way it is.

---

## Features

Each item below maps to code in `backend/src/` and `frontend/src/` — no unverified claims.

- **Invoices** — CRUD, status transitions, PDF export (`invoices/invoice-pdf.service.ts`, Puppeteer-rendered), email delivery (`POST /:id/send` via `MailService`, SendGrid/SMTP)
- **Inventory** — SKU/barcode items, stock movements, reorder-level alerts (`inventory/store-alerts.service.ts`), bulk CSV import with per-row error reporting
- **Multi-store** — stores scoped per user/org, store-to-store stock transfers (`inventory/store-transfer.service.ts`), per-store item settings and alert thresholds
- **Multi-tenant organizations** — `organizations/` module with an `OrganizationContextGuard` and an owner/admin/manager/staff role enum enforced on the backend, not just hidden in the UI
- **Clients** — contact database tied to invoice history
- **Analytics & reports** — revenue/payment-method breakdowns and PDF store reports (`analytics/store-report-pdf.service.ts`)
- **Subscription billing** — Stripe customer/subscription sync, webhook-driven plan updates, per-plan usage quotas enforced by a `QuotaGuard`
- **API keys** — programmatic access tokens for integrations
- **Invoice templates** — saved, reusable invoice layouts
- **Offline caching** — Dexie/IndexedDB layer on the frontend for read caching
- **Dark/light mode, keyboard shortcuts, draggable sidebar** — frontend UX conveniences in `frontend/src/components`

---

## Architecture

```
┌─────────────────────────────┐
│           Browser            │
│  React 19 + Vite + MUI       │
│  ┌─────────────┬───────────┐ │
│  │ tRPC client │ REST/axios │ │   invoices, clients,
│  │ (typed RPC) │ (apiClient)│ │   inventory, analytics
│  └──────┬──────┴─────┬─────┘ │   go over tRPC; everything
└─────────┼────────────┼───────┘   else (auth, orgs, billing,
          │            │           storage, reports…) is REST
          ▼            ▼
┌──────────────────────────────────────┐
│              NestJS 11 API            │
│  /trpc  (TrpcRouter: 4 routers)       │
│  /api/v1/*  (per-module controllers)  │
│  /api/docs  (Swagger, REST side only) │
│                                        │
│  Guards: ClerkAuthGuard → JwtAuthGuard│
│  → RolesGuard → OrganizationContext  │
│  → SubscriptionGuard / QuotaGuard    │
└───────┬─────────────────┬─────────────┘
        │                 │
        ▼                 ▼
┌───────────────┐  ┌─────────────────────┐
│  PostgreSQL 15  │  │  External services   │
│  via TypeORM    │  │  Clerk (auth, webhook)│
│  (40 migrations,│  │  Stripe (billing,     │
│  QueryRunner-   │  │    webhook)            │
│  based)         │  │  SendGrid/SMTP (mail) │
└───────────────┘  │  S3/R2 (file storage) │
                    └─────────────────────┘
```

**Auth flow (Clerk):** the frontend uses `@clerk/clerk-react` to obtain a session token; `ClerkAuthGuard` (`backend/src/auth/clerk-auth.guard.ts`) decodes it, checks expiry locally, then re-verifies the user against Clerk's API on *every* request (no caching — see the `Issue #169` comments in that file) so a revoked/deleted Clerk user is rejected immediately. User lifecycle events (create/update/delete) arrive at `POST /api/v1/auth/webhooks/clerk`, verified with `svix` signature headers before being applied.

**Billing flow (Stripe):** `subscriptions/stripe.service.ts` drives customer/subscription creation; `stripe-webhook.controller.ts` consumes Stripe webhook events to keep the local `Subscription`/`Plan`/`Usage` entities in sync; `QuotaGuard` and `SubscriptionGuard` enforce plan limits on protected routes; `usage-reset.scheduler.ts` resets usage counters on a cron schedule.

**Why tRPC only covers part of the API:** the four tRPC routers (`invoices`, `clients`, `inventory`, `analytics` — see `backend/src/trpc/trpc.router.ts`) handle the data-heavy CRUD/read surface where end-to-end typed calls pay off most. Auth, Clerk/Stripe webhooks, file uploads (Multer), organizations, and PDF/report generation stay on plain NestJS REST controllers with Swagger docs, because webhooks need raw-body signature verification and file uploads need multipart handling — neither maps cleanly onto tRPC procedures.

---

## Key engineering decisions

**tRPC end-to-end types vs. the Express/REST sibling.** The [pizza-box-system](https://github.com/seifosmaan53/pizza-box-system) sibling uses Express + a hand-written REST layer with Prisma. Here, the four highest-traffic domains (invoices, clients, inventory, analytics) are exposed as tRPC routers so the frontend imports the backend's `AppRouter` type directly (`frontend/src/utils/trpc.ts`) instead of hand-maintaining request/response types on both sides. The tradeoff, visible in the architecture above, is that tRPC doesn't fit everything — webhooks and file uploads still need plain HTTP, so the API is intentionally a hybrid rather than "pure tRPC."

**Clerk vs. hand-rolled JWT.** This isn't a hypothetical comparison — the codebase used to *be* the hand-rolled version. The `CHANGELOG.md` describes a JWT + bcrypt + password-reset-token + account-lockout auth system with rate-limited login/reset endpoints, and migration `1755000000000-MigrateToClerkAuth.ts` shows the actual cutover: it adds a `clerkUserId` column and drops `password`, `passwordResetToken`, `failedLoginAttempts`, `lockedUntil`, etc. from the `users` table. The `AUTH_SECURITY_IMPROVEMENTS.md` notes in `backend/` are essentially a checklist from that older system. Moving to Clerk traded self-hosted control over the auth flow for not having to maintain password hashing, reset-token expiry, and lockout logic by hand — the remaining `JwtAuthGuard`/`passport-jwt` pieces stay in the dependency tree for the API-key auth path, not for interactive login.

**TypeORM vs. Prisma.** The pizza-box-system sibling uses Prisma; this one uses TypeORM with hand-written, `QueryRunner`-based migrations (40 of them in `backend/src/migrations/`, including the Clerk cutover above, plus `CreateOrganizations`/`AddOrganizationIdToEntities` for multi-tenancy). That gives direct control over migration SQL for schema changes that also need to reshape existing data — e.g. `backend/src/database/migrate-to-organizations.ts` backfills an `organizationId` onto pre-existing rows once the column exists, which is easier to hand-write against TypeORM's `QueryRunner`/repositories than to express as a declarative schema diff.

---

## Tech stack

### Frontend
| Technology | Version | Purpose |
|---|---|---|
| React | 19 | UI framework |
| Vite | 7 | Build tool + dev server |
| Material UI | 7 | Component library |
| TypeScript | 5.9 | Type safety |
| TanStack Query | 5 | Server state + caching |
| tRPC | 11 | Type-safe API layer (invoices/clients/inventory/analytics) |
| Zustand | 5 | Global state |
| React Hook Form + Zod | latest | Forms + validation |
| Recharts | 3 | Data visualization |
| dnd-kit | 6 | Drag & drop |
| Clerk (`@clerk/clerk-react`) | 5 | Authentication |
| Dexie / IndexedDB | 4 | Read caching |

### Backend
| Technology | Version | Purpose |
|---|---|---|
| NestJS | 11 | Server framework |
| Node.js | 18+ | Runtime |
| PostgreSQL | 15 | Database |
| TypeORM | 0.3 | ORM + hand-written migrations |
| Stripe | 17 | Subscription billing |
| Puppeteer | 24 | PDF generation |
| SendGrid / Nodemailer | latest | Email delivery |
| AWS S3 / Cloudflare R2 | latest | File storage |
| Helmet + Throttler | latest | Security headers + rate limiting |
| Clerk (`@clerk/backend`) + svix | latest | Auth + webhook signature verification |
| Joi | latest | Environment variable validation |

### Infrastructure
- Docker Compose (Postgres + backend + frontend, with a `frontend-dev` hot-reload profile)
- Nginx for production frontend serving
- 40 TypeORM migrations applied via a custom migration-runner script

---

## Testing

The test story is real but partial: services and utilities are covered, end-to-end HTTP flows less so.

**Backend (Jest, 12 unit spec files + 2 integration specs in `backend/`):**
- `auth/auth.service.spec.ts`
- `clients/clients.controller.spec.ts`, `clients/clients.service.spec.ts`
- `inventory/inventory.service.spec.ts`, `inventory/store-item-settings.service.spec.ts`, `inventory/store-stock-validator.service.spec.ts`
- `invoices/invoices.controller.spec.ts`, `invoices/invoices.service.spec.ts`, `invoices/utils/invoice-status.util.spec.ts`, `invoices/utils/invoice-totals.util.spec.ts`
- `users/users.service.spec.ts`, `app.controller.spec.ts`
- `test/invoices-store.integration.spec.ts`, `test/store-stock-validation.integration.spec.ts` (integration specs present under `test/`, run ad-hoc — the current `jest-e2e.json` `testRegex` matches only `*.e2e-spec.ts`, so `test:e2e` does not pick them up)
- `test/app.e2e-spec.ts` (e2e smoke test)

```bash
cd backend
npm test          # unit specs (co-located *.spec.ts under src/)
npm run test:cov  # unit specs with coverage
npm run test:e2e  # test/app.e2e-spec.ts via jest-e2e.json (matches *.e2e-spec.ts only)
```

**Frontend (Vitest, 6 spec files in `frontend/src/`):**
- `utils/formatters.test.ts`, `utils/dates.test.ts`
- `components/dashboard/RevenueChart.test.tsx`, `components/inventory/InventorySelect.test.tsx`
- `pages/Invoices/InvoiceForm.test.tsx`, `pages/Invoices/InvoicesList.test.tsx`

```bash
cd frontend
npm test          # vitest
npm run test:coverage
```

There is no CI workflow file in this repo (removed — see git history), so these currently run locally/on-demand rather than as a required gate.

---

## Quick Start

### Option 1 — Docker (recommended)
```bash
git clone https://github.com/seifosmaan53/asset-vault.git
cd asset-vault
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
# Add DB, Clerk, and (optional) Stripe/email/storage credentials — see Environment Variables below
docker compose up -d
```
Open [http://localhost](http://localhost)

### Option 2 — Local Development
```bash
# Backend
cd backend
npm install
cp .env.example .env
# Edit .env with your database + Clerk credentials
npm run migration:run
npm run start:dev

# Frontend (new terminal)
cd frontend
npm install
cp .env.example .env
# Add VITE_CLERK_PUBLISHABLE_KEY to .env
npm run dev
```

---

## Environment Variables

`backend/.env.example` and `frontend/.env.example` cover the base database/JWT/SMTP variables. Clerk and Stripe keys aren't in the checked-in example files but are required by the code (`ClerkAuthGuard` throws on startup without `CLERK_SECRET_KEY`; `stripe.service.ts` needs `STRIPE_SECRET_KEY` for billing routes) — add them yourself:

### Backend (`backend/.env`)
```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=yourpassword
DB_DATABASE=asset_vault

# Auth
JWT_SECRET=your-jwt-secret
CLERK_SECRET_KEY=sk_...
CLERK_WEBHOOK_SECRET=whsec_...

# Optional: Email
SENDGRID_API_KEY=SG....
SMTP_HOST=smtp.example.com

# Optional: Stripe
STRIPE_SECRET_KEY=sk_...
STRIPE_PUBLISHABLE_KEY=pk_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Optional: Storage
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_BUCKET=asset-vault-files
```

### Frontend (`frontend/.env`)
```env
VITE_API_BASE_URL=http://localhost:3000/api/v1
VITE_CLERK_PUBLISHABLE_KEY=pk_...
```

---

## Development

```bash
# Backend hot-reload
cd backend && npm run start:dev

# Frontend dev server
cd frontend && npm run dev

# Run migrations
cd backend && npm run migration:run

# Generate new migration
cd backend && npm run migration:generate -- src/migrations/MigrationName

# Seed demo data
cd backend && npm run seed

# Reset database
cd backend && npm run db:reset
```

---

## API Documentation

The REST half of the API (everything outside the four tRPC routers) is documented with Swagger when the backend is running:
```
http://localhost:3000/api/docs
```

---

## Production Build

```bash
# Build frontend
cd frontend && npm run build

# Build backend
cd backend && npm run build

# Start production
cd backend && npm run start:prod
```

Or with Docker:
```bash
docker compose up -d
```

---

## Project structure

```
asset-vault/
├── backend/
│   └── src/
│       ├── auth/            # Clerk + JWT guards, webhook handler
│       ├── organizations/   # multi-tenant orgs, role enum, context guard
│       ├── inventory/       # items, stores, transfers, alerts
│       ├── invoices/        # CRUD, PDF, totals/status utils
│       ├── clients/
│       ├── subscriptions/   # Stripe billing, quota/usage guards
│       ├── analytics/       # revenue charts, store report PDFs
│       ├── reports/
│       ├── trpc/            # TrpcRouter + 4 routers (invoices/clients/inventory/analytics)
│       ├── storage/         # S3/R2 file storage
│       ├── mail/
│       └── migrations/      # 40 TypeORM migrations
└── frontend/
    └── src/
        ├── api/              # REST clients (axios) for non-tRPC modules
        ├── utils/trpc.ts     # tRPC client, typed against backend AppRouter
        ├── pages/
        ├── components/
        ├── store/            # Zustand
        └── contexts/
```

---

## License

MIT — see [LICENSE](./LICENSE) for details.

---

*Asset Vault — Built with care by [Seif Osman](https://github.com/seifosmaan53)*
