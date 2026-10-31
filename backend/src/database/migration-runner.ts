// Copyright (c) 2025 Asset Vault. All rights reserved.

/**
 * Applies pending migrations. The ONLY supported way to change the schema.
 *
 *   production image:  node dist/database/migration-runner.js   (npm run migration:run:prod)
 *   source checkout:   npm run migration:run                     (ts-node, dev dependencies)
 *
 * All pending migrations run in ONE transaction: if any of them fails, none is kept and
 * the process exits 1, so a release script that stops on a non-zero exit never starts an
 * API against a half-migrated schema. Exit 0 means the schema is current.
 * Back up the database first: docs/operations/MIGRATIONS.md.
 */
import { AppDataSource } from './data-source';
import {
  describeConnection,
  connectionSettingsFromEnv,
  describeError,
} from './database-options';
import {
  compareMigrations,
  compiledMigrationNames,
  readAppliedMigrations,
} from './schema-check';

async function runMigrations(): Promise<number> {
  const target = describeConnection(connectionSettingsFromEnv());
  // Print failing statements; keep successful queries quiet.
  AppDataSource.setOptions({ logging: ['error'] });

  try {
    await AppDataSource.initialize();
  } catch (error) {
    console.error(
      `Cannot connect to the database at ${target}: ${describeError(error)}`,
    );
    return 1;
  }

  try {
    const known = compiledMigrationNames(AppDataSource.migrations);
    if (known.length === 0) {
      console.error(
        'No compiled migrations found; the build is incomplete. Nothing was changed.',
      );
      return 1;
    }
    const before = compareMigrations(
      known,
      await readAppliedMigrations(AppDataSource),
    );
    console.log(
      `Database ${target}: ${known.length} migration(s) in this build, ${before.pending.length} pending.`,
    );
    if (before.unknownApplied.length > 0) {
      console.warn(
        `Warning: the database records ${before.unknownApplied.length} migration(s) this build does not contain ` +
          `(is this build older than the schema?): ${before.unknownApplied.join(', ')}`,
      );
    }
    if (before.pending.length === 0) {
      console.log('No pending migrations. Nothing was changed.');
      return 0;
    }
    before.pending.forEach((name) => console.log(`  pending: ${name}`));

    const applied = await AppDataSource.runMigrations({ transaction: 'all' });
    console.log(`Applied ${applied.length} migration(s):`);
    applied.forEach((m) => console.log(`  - ${m.name}`));

    const after = compareMigrations(
      known,
      await readAppliedMigrations(AppDataSource),
    );
    if (after.pending.length > 0) {
      console.error(`Still pending after the run: ${after.pending.join(', ')}`);
      return 1;
    }
    console.log('Migrations complete. The schema is current.');
    return 0;
  } catch (error) {
    console.error(
      `Migration FAILED; the transaction was rolled back and no migration from this run was kept: ${describeError(error)}`,
    );
    return 1;
  } finally {
    if (AppDataSource.isInitialized)
      await AppDataSource.destroy().catch(() => undefined);
  }
}

runMigrations().then(
  (code) => process.exit(code),
  (error) => {
    console.error('Migration runner crashed:', error);
    process.exit(1);
  },
);
