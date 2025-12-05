# Changelog

All notable changes to InvoiceMe will be documented in this file.

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

