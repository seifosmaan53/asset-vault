# InvoiceMe - Invoice and Inventory Management System

**Version 1.0.0**

A full-stack invoice and inventory management application built with React (frontend) and NestJS (backend).

## Features

- **Invoice Management**: Create, edit, and manage invoices and estimates
- **Inventory Management**: Track inventory items with stock levels, movements, and low stock alerts
- **Client Management**: Manage client information with addresses and contact details
- **Dashboard**: View key metrics including unpaid invoices, overdue amounts, and monthly totals
- **Inventory-Invoice Integration**: Link invoice line items to inventory items with automatic stock tracking
- **Stock Movement Tracking**: Audit trail of all stock movements linked to invoices
- **Low Stock Alerts**: Automatic alerts for items below reorder level

## Tech Stack

### Frontend
- React 18 + TypeScript
- Vite
- Material-UI (MUI)
- React Router v6
- React Query (TanStack Query)
- Zustand
- React Hook Form + Zod
- Recharts
- Axios

### Backend
- NestJS + TypeScript
- PostgreSQL with TypeORM
- JWT Authentication (access + refresh tokens)
- REST API

## Project Structure

```
.
├── frontend/          # React frontend application
│   ├── src/
│   │   ├── api/      # API client and service functions
│   │   ├── components/ # React components
│   │   ├── hooks/     # React Query hooks
│   │   ├── pages/     # Page components
│   │   ├── store/     # Zustand stores
│   │   ├── types/     # TypeScript interfaces
│   │   └── utils/     # Utility functions
│   └── package.json
│
└── backend/           # NestJS backend application
    ├── src/
    │   ├── auth/      # Authentication module
    │   ├── clients/   # Client management
    │   ├── invoices/  # Invoice management
    │   ├── inventory/ # Inventory management
    │   └── users/     # User management
    └── package.json
```

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL 12+ database
- Git (for cloning the repository)

### Database Setup

1. Create a PostgreSQL database:
```bash
createdb invoiceme
```

Or using psql:
```sql
CREATE DATABASE invoiceme;
```

### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the backend directory (copy from `.env.example` if available):
```env
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=invoiceme

JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=your-refresh-secret-key-change-in-production
JWT_REFRESH_EXPIRES_IN=7d

PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

**Important**: Change the JWT secrets in production!

4. The database will be automatically synchronized in development mode. For production, use migrations.

5. (Optional) Seed the database with demo data:
```bash
npm run seed
```

This creates:
- Demo user: `demo@example.com` / `password123`
- 7 demo clients
- 14 inventory items (mix of normal, low stock, out of stock)
- 23 invoices with various statuses

6. Start the backend server:
```bash
npm run start:dev
```

The backend API will be available at `http://localhost:3000/api/v1`

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the frontend directory:
```env
VITE_API_BASE_URL=http://localhost:3000/api/v1
```

4. Start the development server:
```bash
npm run dev
```

The frontend will be available at `http://localhost:5173`

### Default Demo Login

After seeding the database, you can log in with:
- **Email**: `demo@example.com`
- **Password**: `password123`

This account includes pre-populated data for testing and demonstration.

## How to Use

### Initial Setup

1. **Login or Register**: 
   - Use the demo account above, or create a new account
   - Complete your profile information

2. **Configure Company Settings**:
   - Go to Settings → Company
   - Enter your company name, address, and contact information
   - Set default currency and tax rates

3. **Add Inventory Items**:
   - Navigate to Inventory → Add Item
   - Enter SKU, name, description, pricing, and stock levels
   - Set reorder levels for low stock alerts

4. **Add Clients**:
   - Navigate to Clients → Add Client
   - Enter client name, email, phone, and address
   - Add notes if needed

5. **Create Your First Invoice**:
   - Navigate to Invoices → Create Invoice
   - Select a client
   - Add line items by selecting from inventory or entering manually
   - Review stock availability warnings
   - Set issue date, due date, and currency
   - Save as draft or send immediately

### Key Workflows

**Creating an Invoice with Inventory**:
1. Select a client
2. For each line item, use the inventory dropdown to select a product
3. The system auto-fills description, price, and tax rate
4. Enter quantity (warnings appear if stock is insufficient)
5. Stock is automatically deducted when invoice is created

**Managing Stock**:
- View stock levels on the inventory list
- Low stock items are highlighted
- Adjust stock manually via the detail page
- View complete stock movement history

**Invoice Lifecycle**:
- Create as draft → Edit as needed → Send to client → Mark as paid
- Convert estimates to invoices
- Download PDF or send via email

## API Endpoints

### Authentication
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login
- `POST /api/v1/auth/refresh` - Refresh access token
- `GET /api/v1/auth/profile` - Get user profile
- `PATCH /api/v1/auth/profile` - Update user profile

### Clients
- `GET /api/v1/clients` - Get all clients
- `POST /api/v1/clients` - Create client
- `GET /api/v1/clients/:id` - Get client by ID
- `PATCH /api/v1/clients/:id` - Update client
- `DELETE /api/v1/clients/:id` - Delete client

### Invoices
- `GET /api/v1/invoices` - Get all invoices (with filters)
- `POST /api/v1/invoices` - Create invoice
- `GET /api/v1/invoices/:id` - Get invoice by ID
- `PATCH /api/v1/invoices/:id` - Update invoice
- `DELETE /api/v1/invoices/:id` - Delete invoice
- `GET /api/v1/invoices/stats` - Get invoice statistics
- `POST /api/v1/invoices/:id/pdf` - Generate PDF
- `POST /api/v1/invoices/:id/send` - Send invoice by email

### Inventory
- `GET /api/v1/inventory/items` - Get all inventory items (with filters)
- `POST /api/v1/inventory/items` - Create inventory item
- `GET /api/v1/inventory/items/:id` - Get item by ID
- `PATCH /api/v1/inventory/items/:id` - Update item
- `DELETE /api/v1/inventory/items/:id` - Delete item
- `GET /api/v1/inventory/items/:id/movements` - Get stock movements
- `POST /api/v1/inventory/items/:id/movements` - Create stock movement
- `GET /api/v1/inventory/stats` - Get inventory statistics
- `GET /api/v1/inventory/low-stock` - Get low stock items

## Key Features

### Inventory-Invoice Integration

When creating an invoice:
1. Select inventory items from a searchable dropdown
2. Stock availability is displayed in real-time
3. Warnings are shown if quantity exceeds available stock
4. Stock is automatically deducted when invoice is created
5. Stock movements are tracked and linked to invoices

### Stock Management

- Track current stock, reserved stock, and available stock
- Set reorder levels for automatic low stock alerts
- View complete stock movement history
- Manual stock adjustments
- Automatic stock deduction on invoice creation

## Development

### Backend
```bash
cd backend
npm install          # Install dependencies
npm run start:dev    # Development mode with hot reload
npm run build        # Build for production
npm run start:prod   # Run production build
npm run seed         # Seed database with demo data
npm test             # Run unit tests
npm run test:cov     # Run tests with coverage
```

### Frontend
```bash
cd frontend
npm install          # Install dependencies
npm run dev          # Development server
npm run build        # Build for production
npm run preview      # Preview production build
npm test             # Run tests
```

## Production Deployment

### Backend Production Build

1. Build the application:
```bash
cd backend
npm run build
```

2. Set production environment variables in `.env`:
```env
NODE_ENV=production
DB_HOST=your-production-db-host
DB_PASSWORD=your-secure-password
JWT_SECRET=your-production-secret
JWT_REFRESH_SECRET=your-production-refresh-secret
```

3. Run the production server:
```bash
npm run start:prod
```

### Frontend Production Build

1. Build the application:
```bash
cd frontend
npm run build
```

2. The `dist/` folder contains the production build. Serve it using:
   - Nginx
   - Apache
   - Any static file server
   - CDN

3. Configure your web server to:
   - Serve `index.html` for all routes (SPA routing)
   - Set proper CORS headers if needed
   - Enable gzip compression

## Runbook

### How to Start/Stop

**Local Development**:
- Start backend: `cd backend && npm run start:dev`
- Start frontend: `cd frontend && npm run dev`
- Stop: Press `Ctrl+C` in each terminal

**Docker** (see Docker Compose section below):
- Start: `docker compose up -d`
- Stop: `docker compose down`
- View logs: `docker compose logs -f`

### How to Reset Password if Locked Out

1. Access the database directly:
```bash
psql -U postgres -d invoiceme
```

2. Update the user's password:
```sql
UPDATE users SET password = '$2a$10$hashed_password_here' WHERE email = 'user@example.com';
```

3. Generate a new hash using Node.js:
```javascript
const bcrypt = require('bcryptjs');
const hash = bcrypt.hashSync('newpassword', 10);
console.log(hash);
```

### How to Reset Database

From the `backend` directory (or `docker exec invoiceme-backend`):
```bash
npm run db:reset
```
This will drop, create, migrate, and seed the database.

**Note**: The `db:reset` command requires PostgreSQL command-line tools (`dropdb` and `createdb`) to be installed and accessible in your PATH. If these are not available, you can manually reset the database:

```bash
# Drop and recreate database (requires PostgreSQL CLI tools)
dropdb invoiceme
createdb invoiceme

# Run seed script
npm run seed
```

### How to Back Up the Database

**Manual Backup**:
```bash
pg_dump -U postgres invoiceme > backup_$(date +%Y%m%d_%H%M%S).sql
```

**Automated Backup Script**:
```bash
cd backend
./scripts/backup.sh
```

Backups are stored in `backend/backups/` directory.

### How to Restore from Backup

```bash
psql -U postgres invoiceme < backup_20240101_120000.sql
```

Or use the restore script:
```bash
cd backend
./scripts/restore.sh backup_20240101_120000.sql
```

## Docker Deployment

See `docker-compose.yml` for complete Docker setup. Run:
```bash
docker compose up -d
```

This starts PostgreSQL, backend, and frontend services.

## Versioning

This project follows [Semantic Versioning](https://semver.org/). The current version is **1.0.0**.

### Git Tagging

To tag this release:
```bash
git tag v1.0.0
git push origin v1.0.0
```

See `CHANGELOG.md` for detailed version history and `ROADMAP.md` for planned features.

## License

Copyright (c) 2024 InvoiceMe. All rights reserved.

