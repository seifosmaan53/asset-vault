// Copyright (c) 2025 Asset Vault. All rights reserved.

/**
 * Paths and connection settings shared by the API (app.module.ts), the migration runner
 * (data-source.ts / migration-runner.ts) and the startup schema check (schema-check.ts).
 *
 * Every glob is built from THIS file's directory, so it resolves the same way from
 * src/database (ts-node, jest) and from dist/database (the production image):
 * <src|dist>/migrations. app.module.ts used to build its own glob from its own directory
 * (`<src|dist>/../migrations`), which pointed outside the build and matched nothing.
 *
 * Schema changes are applied ONLY by the migration runner. `synchronize` and
 * `migrationsRun` are hard-coded off and read no environment variable, so no setting can
 * turn them on in production.
 */

export const MIGRATIONS_GLOB = `${__dirname}/../migrations/*{.ts,.js}`;
export const ENTITIES_GLOB = `${__dirname}/../**/*.entity{.ts,.js}`;

/** TypeORM's default migrations table; none of our DataSources overrides it. */
export const MIGRATIONS_TABLE = 'migrations';

/** The documented ways to apply pending migrations (printed by the API when it refuses to start). */
export const MIGRATION_COMMANDS = {
  image:
    'docker run --rm --env-file <api env file> <backend image> node dist/database/migration-runner.js',
  compose:
    'docker compose run --rm backend node dist/database/migration-runner.js',
  checkout: 'cd backend && npm run migration:run',
} as const;

export interface DatabaseConnectionSettings {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
}

export function connectionSettingsFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): DatabaseConnectionSettings {
  return {
    host: env.DB_HOST || 'localhost',
    port: parseInt(env.DB_PORT || '5432', 10),
    username: env.DB_USERNAME || 'postgres',
    password: env.DB_PASSWORD || 'postgres',
    // Legacy default kept on purpose: a storage identifier, not branding (see app.module.ts).
    database: env.DB_DATABASE || 'invoiceme',
  };
}

/** host:port/database as user — never the password. */
export function describeConnection(s: DatabaseConnectionSettings): string {
  return `${s.host}:${s.port}/${s.database} as ${s.username}`;
}

/**
 * Loads backend/.env when the `dotenv` package is installed. It is a devDependency, so it
 * is absent from the production image (`npm ci --omit=dev`); there the environment comes
 * from the container (`--env-file`, Compose `environment:`), which is what we want.
 * A static `import 'dotenv'` made every compiled database script crash on start.
 */
export function loadDotenvIfAvailable(): void {
  let dotenv: { config: (options?: { quiet?: boolean }) => unknown };
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    dotenv = require('dotenv') as typeof dotenv;
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'MODULE_NOT_FOUND') return;
    throw error;
  }
  dotenv.config({ quiet: true });
}

/**
 * A readable one-line reason. A refused connection to a host with several addresses
 * (localhost = ::1 + 127.0.0.1) is an AggregateError whose own message is empty.
 */
export function describeError(error: unknown): string {
  if (error instanceof AggregateError && error.errors.length > 0) {
    return [...new Set(error.errors.map(describeError))].join('; ');
  }
  if (error instanceof Error) {
    const code = (error as NodeJS.ErrnoException).code;
    const text = error.message || error.name;
    return code && !text.includes(code) ? `${code}: ${text}` : text;
  }
  return String(error);
}
