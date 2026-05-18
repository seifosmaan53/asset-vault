# Changelog

All notable changes to InvoiceMe will be documented in this file.

## [1.1.0] - 2024-12-20

### Added
- **Role-Based Access Control (RBAC)** - Three-tier permission system:
  - **OWNER**: Full system control, can manage users and all settings
  - **ADMIN**: Can manage settings, API keys, and perform dangerous operations (deletes)
  - **STAFF**: Day-to-day operations only, restricted from admin features
- User role management endpoint (`/users/*`) - Owner-only access
- Role-based UI hiding - Admin-only menu items and delete buttons hidden from staff
- `@Roles()` decorator for endpoint protection
- `RolesGuard` for automatic permission enforcement
- Global JWT and Roles guards applied to all endpoints
- First registered user automatically becomes OWNER
- Migration to add `role` column to users table

### Security
- Backend-enforced permissions (frontend hiding is UX only)
- Role validation on every authenticated request
- Owner protection (last owner cannot be deleted)
- Self-protection (users cannot delete themselves)
- Role included in JWT payload for validation

### Changed
- All existing users default to ADMIN role (first user becomes OWNER)
- API Keys endpoint now requires ADMIN/OWNER role
- User Settings endpoint now requires ADMIN/OWNER role
- Delete operations (invoices, inventory) now require ADMIN/OWNER role
- User management restricted to OWNER only

### Documentation
- Added `ROLES_DESIGN_v1.1.md` with complete permissions matrix and implementation details

## [1.0.1] - 2024-12-20

### Added
- Recurring invoice scheduler with automatic generation (cron job every 5 minutes)
- Manual trigger endpoint for recurring invoice generation (`POST /api/v1/recurring-invoices/trigger-generation`)
- Health check endpoint (`GET /api/v1/health`) with uptime monitoring
- Rate limiting on authentication endpoints (login: 5/min, password reset: 3/min)
- Environment variable validation with Joi schema (fails fast on invalid config)
- Enhanced scheduler logging with generation counts and error tracking

### Fixed
- TypeScript compilation errors in backend (71 errors resolved)
- TypeScript compilation errors in frontend (155+ errors resolved)
- Grid component compatibility with MUI v7 (using GridLegacy)
- Type-only imports for verbatimModuleSyntax compliance
- Invoice form lineTotal calculation
- Various type inference issues in seed script and services

### Security
- Rate limiting protection against brute-force attacks
- Production-safe error handling (no stack traces leaked)
- Environment validation prevents misconfiguration

### Changed
- Migrated from `synchronize: true` to TypeORM migrations for production safety
- Enhanced error logging with structured output
- Improved scheduler reliability with better error handling

## [1.0.0] - 2024-12-20

### Added
- Complete invoice management system with draft, sent, paid, overdue, and cancelled statuses
- Inventory management with stock tracking, movements, and low stock alerts
- Client management with address and contact information
- Dashboard with revenue charts, status distribution, and low stock widgets
- Inventory-Invoice integration with automatic stock deduction
- Stock movement history and audit trail
- Invoice PDF generation and email sending
- Estimate to invoice conversion
- Recurring invoices support
- API keys management
- User settings (profile, company, invoice settings)
- Feedback submission
- JWT authentication with access and refresh tokens
- Comprehensive form validation with Zod schemas
- Global toast notification system
- Error boundary for graceful error handling
- Request logging and event logging
- Database seeding script with demo data
- Docker Compose setup for easy deployment
- Backup and restore scripts for PostgreSQL
- Comprehensive test suite (unit tests for backend, component tests for frontend)
- Test checklist for manual testing

### Security
- JWT secrets stored only in environment variables
- All protected routes secured with auth guards
- DTO validation on all endpoints
- Error message sanitization in production
- Password hashing with bcrypt

### Documentation
- Comprehensive README with setup instructions
- Runbook section for operations
- API endpoint documentation
- Usage guide for new users

## Future Versions

See [ROADMAP.md](ROADMAP.md) for planned features.

