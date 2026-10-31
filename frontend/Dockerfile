# Vite 7 and @vitejs/plugin-react 5 require Node ^20.19 or >=22.12 (see the `engines`
# fields in frontend/package-lock.json); node:18 cannot run this build.
FROM node:22-alpine AS builder

# Build context: the repository root (see docker-compose.yml and /.dockerignore),
# so the invoice-money module shared with the API can be included.
WORKDIR /app

# Vite inlines VITE_* variables at BUILD time, so they are build arguments, not runtime
# environment. Without a Clerk publishable key the bundle is only a configuration-error
# screen, so the build refuses to run without one (see the check below).
#   docker build -f frontend/Dockerfile --build-arg VITE_CLERK_PUBLISHABLE_KEY=pk_test_... .
# The publishable key is public by design (it ships in the bundle); never pass the
# Clerk SECRET key here. VITE_API_BASE_URL is optional (default http://localhost:3000/api/v1).
# A frontend/.env.production that defines them still works; a non-empty build arg wins.
ARG VITE_CLERK_PUBLISHABLE_KEY
ARG VITE_API_BASE_URL

# Copy package files
COPY frontend/package*.json ./

# Install dependencies
RUN npm ci

# Copy source code, and the shared module where the `@invoice-money` alias expects it (../backend/...)
COPY frontend/ ./
COPY backend/src/common/money/invoice-money.ts /backend/src/common/money/invoice-money.ts

# Build the application. An empty build arg (e.g. an unset variable passed through
# docker compose) is dropped rather than exported, so it cannot blank out a value
# from frontend/.env.production.
RUN [ -n "$VITE_CLERK_PUBLISHABLE_KEY" ] || unset VITE_CLERK_PUBLISHABLE_KEY; \
    [ -n "$VITE_API_BASE_URL" ] || unset VITE_API_BASE_URL; \
    if [ -z "${VITE_CLERK_PUBLISHABLE_KEY:-}" ] && \
       ! grep -qs '^VITE_CLERK_PUBLISHABLE_KEY=..*' .env.production; then \
      echo 'ERROR: VITE_CLERK_PUBLISHABLE_KEY is not set. Pass --build-arg VITE_CLERK_PUBLISHABLE_KEY=pk_... (docker compose reads it from the environment or the root .env).' >&2; \
      exit 1; \
    fi; \
    npm run build

# Production stage with nginx
FROM nginx:alpine

# Copy built files to nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
