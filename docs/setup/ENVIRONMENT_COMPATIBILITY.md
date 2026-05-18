# Environment Compatibility Guide

This document ensures InvoiceMe works consistently across all environments (development, staging, production, Docker, etc.).

## Environment-Agnostic Features

### ✅ All Environments Supported

1. **Database Connection**
   - Uses environment variables with sensible defaults
   - Works with local PostgreSQL, Docker, cloud databases
   - Graceful error handling for connection failures

2. **CORS Configuration**
   - Automatically adapts to production vs development
   - Supports localhost, private networks, and custom domains
   - Works with same-origin requests (no origin header)

3. **API Client**
   - Handles network errors gracefully
   - Works in browser and SSR environments
   - Timeout protection (30s default)
   - Automatic token refresh with error handling

4. **Error Handling**
   - Production-safe error messages
   - Detailed errors in development
   - Consistent error format across environments

5. **Optional Services**
   - SMTP: App works without email configuration
   - Email sending gracefully disabled if not configured
   - No hard dependencies on optional services

## Environment Variables

### Required Variables

These must be set in all environments:

```env
DB_HOST=localhost          # Database host
DB_USERNAME=postgres        # Database username
DB_PASSWORD=postgres        # Database password
DB_DATABASE=invoiceme       # Database name
JWT_SECRET=<random-secret>  # JWT signing secret
JWT_REFRESH_SECRET=<random> # JWT refresh secret
```

### Optional Variables (with defaults)

```env
NODE_ENV=development        # development | production | test
PORT=3000                   # Server port
DB_PORT=5432                # Database port
JWT_EXPIRES_IN=15m          # Access token expiration
JWT_REFRESH_EXPIRES_IN=7d   # Refresh token expiration
FRONTEND_URL=http://localhost:5173  # Frontend URL for CORS
FRONTEND_BASE_URL=http://localhost:5173  # Frontend base URL
```

### Optional Services

```env
SMTP_HOST=                  # Leave empty to disable email
SMTP_PORT=587               # SMTP port
SMTP_USER=                  # SMTP username
SMTP_PASS=                  # SMTP password
SMTP_FROM=                  # From address
```

## Environment-Specific Behavior

### Development Mode (`NODE_ENV=development`)

- **CORS**: Allows localhost and private network IPs
- **Error Messages**: Detailed stack traces
- **CSP**: Disabled for easier debugging
- **Logging**: Verbose database query logging
- **Swagger**: Available at `/api/docs`

### Production Mode (`NODE_ENV=production`)

- **CORS**: Strict origin validation (only FRONTEND_URL)
- **Error Messages**: Generic messages (no stack traces)
- **CSP**: Enabled with strict security headers
- **Logging**: Minimal logging (errors only)
- **Swagger**: Available but should be disabled in public deployments

## Cross-Platform Compatibility

### Operating Systems

- ✅ **macOS**: Fully supported
- ✅ **Linux**: Fully supported
- ✅ **Windows**: Fully supported (npm commands work in CMD/PowerShell)

### Database Hosts

- ✅ **Local PostgreSQL**: Works out of the box
- ✅ **Docker PostgreSQL**: Works with docker-compose
- ✅ **Cloud Databases**: Works with any PostgreSQL (AWS RDS, Google Cloud SQL, etc.)
- ✅ **Remote Databases**: Works with proper network access

### Deployment Methods

- ✅ **Local Development**: npm run start:dev
- ✅ **Production Build**: npm run build && npm run start:prod
- ✅ **Docker**: docker-compose up
- ✅ **Cloud Platforms**: Works on Heroku, AWS, Google Cloud, Azure, etc.

## Network Compatibility

### Local Development

- Backend: `http://localhost:3000`
- Frontend: `http://localhost:5173` (dev) or served by backend (prod)
- Database: `localhost:5432`

### Local Network Access

- Backend listens on `0.0.0.0` (all interfaces)
- Accessible from other devices on same network
- CORS allows private network IPs in development

### Production Deployment

- Backend: Configured via `FRONTEND_URL` environment variable
- CORS: Only allows configured `FRONTEND_URL`
- HTTPS: Should be configured via reverse proxy (Nginx, etc.)

## Error Handling

### Startup Errors

- **Missing Required Variables**: Application fails to start with clear error
- **Database Connection Failure**: Application fails to start with clear error
- **Port Already in Use**: Clear error message with port number

### Runtime Errors

- **Network Errors**: Handled gracefully with user-friendly messages
- **Database Errors**: Logged and returned as generic errors in production
- **Authentication Errors**: Clear error messages for users
- **Validation Errors**: Detailed field-level error messages

## Browser Compatibility

### Supported Browsers

- ✅ Chrome/Edge (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)

### Browser Features Used

- **localStorage**: Used for token storage (gracefully handles if disabled)
- **fetch/axios**: For API calls (with timeout protection)
- **Modern JavaScript**: ES6+ features (TypeScript compiles to compatible JS)

## Testing Across Environments

### Quick Test Checklist

1. **Development Environment**
   ```bash
   npm run start:dev  # Backend
   npm run dev        # Frontend
   ```
   - Should work on localhost
   - Should allow network access from other devices

2. **Production Build**
   ```bash
   npm run build      # Both
   npm run start:prod # Backend (serves frontend)
   ```
   - Should work on configured port
   - Should enforce CORS restrictions

3. **Docker**
   ```bash
   docker-compose up
   ```
   - Should work with container networking
   - Database should be accessible

## Common Issues & Solutions

### Issue: CORS errors in production

**Solution**: Set `FRONTEND_URL` environment variable to your production frontend URL

### Issue: Database connection fails

**Solution**: 
- Check `DB_HOST`, `DB_USERNAME`, `DB_PASSWORD` in `.env`
- Ensure database is running and accessible
- Check firewall rules for remote databases

### Issue: Port already in use

**Solution**: 
- Change `PORT` in `.env` file
- Or stop the process using the port
- See `PORT_MANAGEMENT.md` for details

### Issue: Frontend can't connect to backend

**Solution**:
- Check `VITE_API_BASE_URL` in `frontend/.env`
- Ensure backend is running
- Check CORS configuration matches frontend URL

## Environment Validation

The application validates all required environment variables at startup using Joi schema validation. If any required variable is missing, the application will:

1. Log a clear error message
2. Indicate which variable is missing
3. Exit with error code 1

This ensures the application fails fast with clear error messages rather than failing mysteriously later.

## Best Practices

1. **Always use environment variables** - Never hardcode values
2. **Set NODE_ENV correctly** - Use `production` in production
3. **Use strong secrets** - Generate random JWT secrets
4. **Configure CORS properly** - Set `FRONTEND_URL` in production
5. **Test in target environment** - Test production builds before deploying

## Compatibility Guarantee

InvoiceMe is designed to work the same way in:
- ✅ Development (local machine)
- ✅ Staging (test server)
- ✅ Production (live server)
- ✅ Docker containers
- ✅ Cloud platforms
- ✅ Different operating systems
- ✅ Different network configurations

The application adapts its behavior based on `NODE_ENV` and environment variables, but core functionality remains consistent across all environments.

