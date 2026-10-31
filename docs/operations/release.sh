#!/usr/bin/env bash
# Reference release sequence for the Asset Vault API image:
#   1. back up the database   2. apply migrations   3. start the API   4. verify it
# Any failing step stops the release (set -e): a failed backup never reaches the migration,
# a failed migration never reaches the API start. See docs/operations/MIGRATIONS.md.
#
# Usage:
#   docs/operations/release.sh <backend image> <api env file>
#
# The env file holds the API's runtime variables (DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD,
# DB_DATABASE, CLERK_SECRET_KEY, NODE_ENV=production, ...). DB_HOST must be reachable from a
# container on DOCKER_NETWORK.
#
# Optional environment:
#   DOCKER_NETWORK   docker network for every container           (default: bridge)
#   BACKUP_DIR       host directory for the pg_dump file          (default: ./backups)
#   PG_CLIENT_IMAGE  image providing pg_dump; its major version must be >= the server's
#                                                                 (default: postgres:16-alpine)
#   API_CONTAINER    name of the API container started in step 3  (default: asset-vault-api)
#   API_PORT         host port published for the API             (default: 3000)
#   HEALTH_TIMEOUT   seconds to wait for /api/v1/health           (default: 90)
#   SKIP_START=1     stop after the migration (steps 1-2 only)
set -euo pipefail

image=${1:?usage: release.sh <backend image> <api env file>}
env_file=${2:?usage: release.sh <backend image> <api env file>}
network=${DOCKER_NETWORK:-bridge}
backup_dir=${BACKUP_DIR:-./backups}
pg_image=${PG_CLIENT_IMAGE:-postgres:16-alpine}
api_container=${API_CONTAINER:-asset-vault-api}
api_port=${API_PORT:-3000}
health_timeout=${HEALTH_TIMEOUT:-90}

test -f "$env_file" || { echo "release: env file not found: $env_file" >&2; exit 2; }
mkdir -p "$backup_dir"
backup_dir=$(cd "$backup_dir" && pwd)
backup_file="pre-release-$(date -u +%Y%m%dT%H%M%SZ).dump"

echo "== 1/4 backup -> $backup_dir/$backup_file"
docker run --rm --network "$network" --env-file "$env_file" -v "$backup_dir:/backup" "$pg_image" \
  sh -ec 'export PGPASSWORD="$DB_PASSWORD"
          pg_dump -h "$DB_HOST" -p "${DB_PORT:-5432}" -U "$DB_USERNAME" -d "$DB_DATABASE" \
            --format=custom --file="/backup/$1"
          pg_restore --list "/backup/$1" > /dev/null' sh "$backup_file"
echo "backup written and readable: $backup_dir/$backup_file"

echo "== 2/4 migrations"
docker run --rm --network "$network" --env-file "$env_file" "$image" \
  node dist/database/migration-runner.js

if [ "${SKIP_START:-0}" = 1 ]; then
  echo "SKIP_START=1: migrations applied, API not started"
  exit 0
fi

echo "== 3/4 start the API ($api_container on port $api_port)"
docker rm -f "$api_container" > /dev/null 2>&1 || true
docker run -d --name "$api_container" --network "$network" --env-file "$env_file" \
  -p "$api_port:3000" -e PORT=3000 "$image" > /dev/null

echo "== 4/4 verify GET /api/v1/health"
# In production the API redirects plain HTTP to HTTPS unless a TLS proxy says otherwise.
for _ in $(seq 1 "$health_timeout"); do
  if ! docker ps -q --filter "name=^${api_container}$" --filter status=running | grep -q .; then
    echo "release: the API container exited" >&2
    docker logs "$api_container" 2>&1 | tail -n 40 >&2
    exit 1
  fi
  if curl -fsS -H 'X-Forwarded-Proto: https' "http://127.0.0.1:$api_port/api/v1/health"; then
    echo
    echo "release complete; pre-release backup: $backup_dir/$backup_file"
    exit 0
  fi
  sleep 1
done
echo "release: health check did not pass within ${health_timeout}s" >&2
docker logs "$api_container" 2>&1 | tail -n 40 >&2
exit 1
