import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import {
  compareMigrations,
  compiledMigrationNames,
  pendingMigrationsMessage,
} from './schema-check';
import {
  MIGRATIONS_GLOB,
  connectionSettingsFromEnv,
  describeConnection,
} from './database-options';

describe('startup schema check', () => {
  it('orders migrations the way TypeORM does (by the 13-digit timestamp, name or class name)', () => {
    class Second1700000000002 {
      up = jest.fn();
      down = jest.fn();
    }
    const names = compiledMigrationNames([
      { name: 'Third1761000000000', up: jest.fn(), down: jest.fn() },
      new Second1700000000002(),
      { name: 'First1700000000000', up: jest.fn(), down: jest.fn() },
    ]);
    expect(names).toEqual([
      'First1700000000000',
      'Second1700000000002',
      'Third1761000000000',
    ]);
  });

  it('reports pending and unknown migrations', () => {
    expect(compareMigrations(['A1', 'B2', 'C3'], ['A1', 'B2'])).toEqual({
      pending: ['C3'],
      unknownApplied: [],
      known: 3,
    });
    expect(compareMigrations(['A1'], [])).toEqual({
      pending: ['A1'],
      unknownApplied: [],
      known: 1,
    });
    expect(compareMigrations(['A1'], ['A1', 'Z9'])).toEqual({
      pending: [],
      unknownApplied: ['Z9'],
      known: 1,
    });
  });

  it('names every pending migration and the exact commands, never the password', () => {
    const target = describeConnection(
      connectionSettingsFromEnv({
        DB_HOST: 'db',
        DB_DATABASE: 'av',
        DB_PASSWORD: 's3cret',
      }),
    );
    const msg = pendingMigrationsMessage(
      {
        pending: ['WidenInvoiceItemRatePrecision1761000000000'],
        unknownApplied: [],
        known: 41,
      },
      target,
    );
    expect(msg).toContain('db:5432/av as postgres');
    expect(msg).toContain('  - WidenInvoiceItemRatePrecision1761000000000');
    expect(msg).toContain('node dist/database/migration-runner.js');
    expect(msg).toContain('npm run migration:run');
    expect(msg).toContain('docs/operations/MIGRATIONS.md');
    expect(msg).not.toContain('s3cret');
  });

  it('the shared migrations glob points at <src|dist>/migrations, next to this directory', () => {
    expect(join(MIGRATIONS_GLOB, '..')).toBe(
      join(__dirname, '..', 'migrations'),
    );
    expect(MIGRATIONS_GLOB.endsWith('/*{.ts,.js}')).toBe(true);
    expect(
      readdirSync(join(__dirname, '..', 'migrations')).length,
    ).toBeGreaterThan(0);
  });

  it('nothing in src can turn on synchronize or migrationsRun', () => {
    const appModule = readFileSync(
      join(__dirname, '..', 'app.module.ts'),
      'utf8',
    );
    expect(appModule).toMatch(/migrations: \[MIGRATIONS_GLOB\]/);
    expect(appModule).toMatch(/synchronize: false,/);
    expect(appModule).toMatch(/migrationsRun: false,/);

    const src = join(__dirname, '..');
    const offenders = (readdirSync(src, { recursive: true }) as string[])
      .filter((f) => f.endsWith('.ts') && !f.endsWith('.spec.ts'))
      .map((f) => join(src, f))
      .filter((f) =>
        /synchronize:\s*(true|[^f\s])|migrationsRun:\s*(true|[^f\s])|DB_SYNCHRONIZE/.test(
          readFileSync(f, 'utf8'),
        ),
      );
    expect(offenders).toEqual([]);
  });
});
