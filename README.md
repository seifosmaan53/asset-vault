# Asset Vault

<!--portfolio-note-->
> **Portfolio note —** one of three invoicing builds exploring the same problem across stacks. **This is the modern, fully type-safe take: React 19 + NestJS 11 + tRPC** (with Stripe + Clerk). Siblings: [pizza-box-system](https://github.com/seifosmaan53/pizza-box-system) (React + Express + Prisma) and [invoiceme](https://github.com/seifosmaan53/invoiceme) (Flutter mobile, offline-first).

> Professional invoice & inventory management for modern businesses.

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![NestJS](https://img.shields.io/badge/NestJS-11-E0234E?logo=nestjs&logoColor=white)](https://nestjs.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://typescriptlang.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-336791?logo=postgresql&logoColor=white)](https://postgresql.org)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&logoColor=white)](https://docker.com)

---

## Overview

**Asset Vault** is a full-stack business management platform combining invoice generation, inventory control, multi-store management, analytics, and subscription billing in one polished application. Built with a production-grade tech stack and designed to be self-hosted.

Built by **Seif Osman**.

---

## Tech Stack

### Frontend
| Technology | Version | Purpose |
|---|---|---|
| React | 19 | UI framework |
| Vite | 7 | Build tool + dev server |
| Material UI | 7 | Component library |
| TypeScript | 5.9 | Type safety |
| TanStack Query | 5 | Server state + caching |
| tRPC | 11 | Type-safe API layer |
| Zustand | 5 | Global state |
| React Hook Form + Zod | latest | Forms + validation |
| Recharts | 3 | Data visualization |
| dnd-kit | 6 | Drag & drop |
| Clerk | 5 | Authentication |
| Dexie / IndexedDB | 4 | Offline support |

### Backend
| Technology | Version | Purpose |
|---|---|---|
| NestJS | 11 | Server framework |
| Node.js | 18+ | Runtime |
| PostgreSQL | 15 | Database |
| TypeORM | 0.3 | ORM + migrations |
| Stripe | 17 | Subscription billing |
| Puppeteer | 24 | PDF generation |
| SendGrid / Nodemailer | latest | Email delivery |
| AWS S3 / Cloudflare R2 | latest | File storage |
| Helmet + Throttler | latest | Security |
| JWT + Clerk | latest | Auth strategy |

### Infrastructure
- Docker Compose (Postgres + backend + frontend)
- Nginx for production frontend serving
- TypeORM migrations (50+ applied)

---

## Features

- **Invoice Management** — Create, edit, send, and track invoices with PDF export and email delivery
- **Inventory Control** — Stock tracking, movements, reorder alerts, SKU management
- **Multi-Store** — Multiple stores per account, store-to-store transfers, per-store analytics
- **Client Management** — Full contact database with revenue history
- **Analytics Dashboard** — Revenue charts, payment method breakdown, top clients/items
- **Subscription Billing** — Stripe-powered plans with quota enforcement
- **Invoice Templates** — Customizable templates for branded invoicing
- **API Keys** — Programmatic access for integrations
- **Offline Support** — IndexedDB caching + background sync
- **Dark / Light Mode** — User-configurable with system-preference detection
- **Keyboard Shortcuts** — Full keyboard navigation
- **Draggable Sidebar** — Reorderable navigation with persist

---

## Quick Start

### Option 1 — Docker (recommended)
```bash
git clone https://github.com/seifosman/asset-vault.git
cd asset-vault
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
# Fill in your VITE_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY
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

When running, Swagger UI is available at:
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

## License

MIT — see [LICENSE](./LICENSE) for details.

---

*Asset Vault — Built with care by [Seif Osman](https://github.com/seifosman)*
