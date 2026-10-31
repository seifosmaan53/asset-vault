// Copyright (c) 2025 Asset Vault. All rights reserved.

import { DataSource, type MigrationInterface } from 'typeorm';
import {
  MIGRATIONS_GLOB,
  MIGRATIONS_TABLE,
  MIGRATION_COMMANDS,
  connectionSettingsFromEnv,
  describeConnection,
  describeError,
} from './database-options';

/**
 * Startup schema check. The API never applies migrations itself (they are an explicit,
 * backed-up operator step, see docs/operations/MIGRATIONS.md); instead it refuses to
 * start while the database is behind the code it is about to serve.
 *
 * Read-only: it lists the compiled migrations, reads the `migrations` table and compares.
 * (TypeORM's own pending-migration helpers create the table when it is missing.)
 */

export interface MigrationStatus {
  /** Compiled migrations that the database has not recorded, in run order. */
  pending: string[];
  /** Recorded in the database but absent from this build (the code is older than the schema). */
  unknownApplied: string[];
  /** Number of migrations in this build. */
  known: number;
}

export type SchemaCheckResult =
  | { ok: true; status: MigrationStatus }
  | {
      ok: false;
      reason: 'unreachable' | 'pending' | 'no-migrations';
      message: string;
      status?: MigrationStatus;
    };

/** Same identity and order TypeORM uses: `name` (or the class name), sorted by its 13-digit timestamp. */
export function compiledMigrationNames(
  migrations: MigrationInterface[],
): string[] {
  return migrations
    .map((m) => m.name || m.constructor.name)
    .map((name) => ({ name, timestamp: parseInt(name.slice(-13), 10) }))
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((m) => m.name);
}

export function compareMigrations(
  known: string[],
  applied: string[],
): MigrationStatus {
  const appliedSet = new Set(applied);
  const knownSet = new Set(known);
  return {
    pending: known.filter((name) => !appliedSet.has(name)),
    unknownApplied: applied.filter((name) => !knownSet.has(name)),
    known: known.length,
  };
}

export async function readAppliedMigrations(ds: DataSource): Promise<string[]> {
  const [{ table }]: { table: string | null }[] = await ds.query(
    `SELECT to_regclass($1)::text AS "table"`,
    [MIGRATIONS_TABLE],
  );
  if (!table) return [];
  const rows: { name: string }[] = await ds.query(
    `SELECT "name" FROM "${MIGRATIONS_TABLE}" ORDER BY "id"`,
  );
  return rows.map((r) => r.name);
}

export function pendingMigrationsMessage(
  status: MigrationStatus,
  target: string,
): string {
  return [
    `Database schema is out of date: ${target} is missing ${status.pending.length} migration(s) this build requires:`,
    ...status.pending.map((name) => `  - ${name}`),
    'The API does not apply migrations itself and will not start until they are applied.',
    'Back up the database first, then run ONE of:',
    `  production image:  ${MIGRATION_COMMANDS.image}`,
    `  docker compose:    ${MIGRATION_COMMANDS.compose}`,
    `  source checkout:   ${MIGRATION_COMMANDS.checkout}`,
    'Then start the API again. Full procedure: docs/operations/MIGRATIONS.md',
  ].join('\n');
}

export async function checkDatabaseSchema(
  env: NodeJS.ProcessEnv = process.env,
): Promise<SchemaCheckResult> {
  const settings = connectionSettingsFromEnv(env);
  const target = describeConnection(settings);
  const ds = new DataSource({
    type: 'postgres',
    ...settings,
    migrations: [MIGRATIONS_GLOB],
    synchronize: false,
    migrationsRun: false,
    logging: false,
    connectTimeoutMS: 10000,
    extra: { max: 1 },
  });

  try {
    await ds.initialize();
  } catch (error) {
    return {
      ok: false,
      reason: 'unreachable',
      message:
        `Cannot connect to the database at ${target}: ${describeError(error)}\n` +
        'Check DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD and DB_DATABASE, and that PostgreSQL is running and reachable from here.',
    };
  }

  try {
    const known = compiledMigrationNames(ds.migrations);
    if (known.length === 0) {
      return {
        ok: false,
        reason: 'no-migrations',
        message: `No compiled migrations found at ${MIGRATIONS_GLOB}. The build is incomplete; refusing to start.`,
      };
    }
    const status = compareMigrations(known, await readAppliedMigrations(ds));
    if (status.pending.length > 0) {
      return {
        ok: false,
        reason: 'pending',
        message: pendingMigrationsMessage(status, target),
        status,
      };
    }
    return { ok: true, status };
  } catch (error) {
    return {
      ok: false,
      reason: 'unreachable',
      message: `Could not read migration state from ${target}: ${describeError(error)}`,
    };
  } finally {
    await ds.destroy().catch(() => undefined);
  }
}
