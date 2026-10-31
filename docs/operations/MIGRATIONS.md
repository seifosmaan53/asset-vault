# Database migrations: release and recovery

The schema changes **only** through the migration runner, run explicitly by an operator.
The API never changes the schema: `synchronize` and `migrationsRun` are hard-coded `false`
(no environment variable can turn them on), and there is no `DB_SYNCHRONIZE` setting.

Instead, before it connects or listens, the API compares the migrations compiled into its
build with the database's `migrations` table (read-only) and refuses to start when:

| Situation | Log line | Exit |
|---|---|---|
| Migrations pending | `Startup aborted: database schema is not current.`, then each pending migration and the commands below | 1 |
| Database unreachable or credentials wrong | `Startup aborted: database unreachable.` / `Cannot connect to the database at host:port/db as user: <reason>` | 1 |
| Build contains no migrations (broken image) | `No compiled migrations found at …` | 1 |
| Schema current | `Database schema is current (N migrations applied).` | starts |

A database that records migrations this build does not know (an older build pointed at a
newer schema) logs a warning and starts.

There is no escape hatch to skip the check. The unit tests do not boot the API, and the
integration tests boot the Nest module directly after `npm run migration:run`, so neither
needs one.

## The migration command

In the production image (compiled JavaScript, production dependencies only):

```bash
docker run --rm --env-file api.env <backend image> node dist/database/migration-runner.js
```

`api.env` is the API's own runtime env file (`DB_HOST`, `DB_PORT`, `DB_USERNAME`,
`DB_PASSWORD`, `DB_DATABASE`, …); `DB_HOST` must be reachable from the container (add
`--network <network>` when the database is another container). Equivalents:

```bash
docker compose run --rm backend node dist/database/migration-runner.js   # Compose stack
npm run migration:run:prod     # inside the image or any compiled build (same file)
cd backend && npm run migration:run   # source checkout, ts-node (dev dependencies)
```

What it does:

- Prints the target (`host:port/db as user`, never the password), how many migrations the
  build has and which are pending, then each migration it applied, or
  `No pending migrations. Nothing was changed.`
- Runs all pending migrations in **one transaction**. If any fails, it prints
  `Migration FAILED; the transaction was rolled back and no migration from this run was kept`
  with the failing statement, and nothing from that run remains.
- Exit code `0` = schema current; anything else = failure. Scripts must stop on non-zero.
- Rerunning it on a current schema changes nothing.

## Release order

`docs/operations/release.sh <image> <env file>` performs steps 1–4 and stops at the first
failure (CI runs it on every pull request; see the `migration-release` job). By hand:

### 1. Back up

Take a backup immediately before migrating, and check that it is readable. The `pg_dump`
major version must be at least the server's.

```bash
docker run --rm --env-file api.env -v "$PWD/backups:/backup" postgres:16-alpine sh -ec '
  export PGPASSWORD="$DB_PASSWORD"
  pg_dump -h "$DB_HOST" -p "${DB_PORT:-5432}" -U "$DB_USERNAME" -d "$DB_DATABASE" \
    --format=custom --file=/backup/pre-release.dump
  pg_restore --list /backup/pre-release.dump > /dev/null && echo backup OK'
```

Stop the old API before migrating if it must not write during the window (anything written
after the backup is not in it).

### 2. Migrate

```bash
docker run --rm --env-file api.env <backend image> node dist/database/migration-runner.js
```

If this exits non-zero, **stop**. The database is as it was before this run; leave the old
release serving (or keep the API down), read the error, then fix forward (below).

### 3. Start the API

Start the new image as usual (`docker compose up -d backend`, or your orchestrator). If it
exits 1 with `schema is not current`, step 2 was skipped or ran against a different database.

### 4. Verify

```bash
curl -fsS -H 'X-Forwarded-Proto: https' http://<api host>:3000/api/v1/health   # {"status":"ok",…}
psql … -c 'select name from migrations order by id desc limit 3'
psql … -c "select column_name, numeric_precision, numeric_scale from information_schema.columns
           where table_name = 'invoice_items' and column_name in ('taxRate', 'discountRate')"
```

(In production the API redirects plain HTTP to HTTPS; the header stands in for the TLS proxy.)
For `1761000000000` the last query shows `7, 4` for both columns.

## Recovery

Recovery means **restoring the pre-migration backup** or **fixing forward**. Reverting a
migration (`npm run migration:revert`) is a development tool, not a recovery procedure.

### Why not downgrade `1761000000000`

`1761000000000-WidenInvoiceItemRatePrecision` widens `invoice_items.taxRate` and
`discountRate` from `numeric(5,2)` to `numeric(7,4)`. Its `up` keeps every value exactly
(8.88 becomes 8.8800) and recalculates nothing. Its `down` narrows back to two decimals
with `round(…, 2)`: any rate stored with more than two decimals after the upgrade (8.875%
becomes 8.88%) **loses that precision permanently**, and the stored line and invoice totals,
which were computed from the precise rate, no longer match their rates. So downgrade is not
a safe default. Use it only on a database that has had no writes since the upgrade (and then
restoring the backup is equivalent and simpler).

### Restore the backup

Stop every API instance first. Restoring into a new database and switching `DB_DATABASE` is
the safest, because the current database stays available for comparison:

```bash
docker run --rm --env-file api.env -v "$PWD/backups:/backup" postgres:16-alpine sh -ec '
  export PGPASSWORD="$DB_PASSWORD"
  createdb -h "$DB_HOST" -p "${DB_PORT:-5432}" -U "$DB_USERNAME" "${DB_DATABASE}_restored"
  pg_restore -h "$DB_HOST" -p "${DB_PORT:-5432}" -U "$DB_USERNAME" -d "${DB_DATABASE}_restored" \
    --no-owner --exit-on-error /backup/pre-release.dump'
```

Then set `DB_DATABASE=<name>_restored` and start the **previous** image (the one matching the
restored schema). To restore in place instead, use
`pg_restore --clean --if-exists --no-owner --exit-on-error -d "$DB_DATABASE" …` on the same
dump. Anything written after the backup is lost either way.

Never serve a build older than the token-verification fix (see "Deployment and recovery" in
the README).

### Fix forward

When the migration failed (nothing was kept) or the new release misbehaves on the new
schema: fix the code or add a **new** migration that corrects the schema, build a new image,
and repeat steps 1–4. Never edit a migration that has already been applied anywhere.

## Writing migrations

- `cd backend && npm run migration:create` (or `migration:generate`), in `backend/src/migrations`.
  They compile to `dist/migrations` and ship in the image.
- `down()` must say what it loses, as `1761000000000` does.
- The CI `backend` job applies every migration to an empty database; `migration-release`
  upgrades a database holding data with the real image.
