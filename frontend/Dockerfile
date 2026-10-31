FROM node:18-alpine AS builder

# Build context: the repository root (see docker-compose.yml and /.dockerignore),
# so the invoice-money module shared with the API can be included.
WORKDIR /app

# Copy package files
COPY frontend/package*.json ./

# Install dependencies
RUN npm ci

# Copy source code, and the shared module where the `@invoice-money` alias expects it (../backend/...)
COPY frontend/ ./
COPY backend/src/common/money/invoice-money.ts /backend/src/common/money/invoice-money.ts

# Build the application
RUN npm run build

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

