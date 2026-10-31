# NestJS 11 (@nestjs/core, @nestjs/cli) and @clerk/backend 3 require Node >=20 / >=20.9
# (see the `engines` fields in package-lock.json); node:18 is unsupported.
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:22-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev

# Copy built application from builder
COPY --from=builder /app/dist ./dist

# Expose port
EXPOSE 3000

# Start the application. It checks the schema first and exits 1, naming the pending
# migrations, if the database is behind this build; it never applies them itself.
# Apply them explicitly (after a backup) with the same image:
#   docker run --rm --env-file <api env file> <image> node dist/database/migration-runner.js
# Procedure: docs/operations/MIGRATIONS.md
CMD ["node", "dist/main"]

