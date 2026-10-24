/**
 * Shared harness for the access-control integration tests.
 *
 * What is REAL here: the whole application module (every controller, every global guard in the
 * order app.module registers them, every service), TypeORM against a real PostgreSQL database
 * built by running the repository's own 40 migrations, and Clerk's token verification path.
 *
 * What is STUBBED (and why):
 *  - Clerk's *network* calls. verifyToken() is replaced by a function that verifies the token's
 *    HMAC signature against TEST_CLERK_SIGNING_SECRET and rejects everything else, which is the
 *    contract the real verifyToken has with Clerk's keys; users.getUser() reads an in-memory
 *    directory instead of calling Clerk's API.
 *  - tRPC (module + controller). Its superjson dependency is ESM-only and cannot load under
 *    ts-jest; tRPC is not used by the shipped UI. The stub is a decorated empty controller.
 *
 * These tests need a database. Set DB_HOST/DB_PORT/DB_USERNAME/DB_PASSWORD/DB_DATABASE (CI does)
 * and run migrations first (`npm run migration:run`). Never point them at a real database: the
 * suite creates and deletes synthetic users.
 */
import { Test } from '@nestjs/testing';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import * as jwt from 'jsonwebtoken';
import { DataSource } from 'typeorm';

export const TEST_CLERK_SIGNING_SECRET =
  'test-only-signing-secret-not-a-real-key';

export interface FakeClerkUser {
  id: string;
  banned: boolean;
  emailAddresses: { id: string; emailAddress: string }[];
  primaryEmailAddressId: string;
  firstName: string;
  lastName: string;
}

/** In-memory stand-in for Clerk's user directory (shared with the jest.mock factory below). */
export const clerkDirectory = new Map<string, FakeClerkUser>();

export function addClerkUser(id: string, email: string): FakeClerkUser {
  const u: FakeClerkUser = {
    id,
    banned: false,
    emailAddresses: [{ id: `${id}_e`, emailAddress: email }],
    primaryEmailAddressId: `${id}_e`,
    firstName: 'Test',
    lastName: id,
  };
  clerkDirectory.set(id, u);
  return u;
}

/** A token the stand-in verifyToken accepts (signed with the test signing secret). */
export function signedToken(
  sub: string,
  opts: { expiresInSec?: number } = {},
): string {
  return jwt.sign(
    { sub, exp: Math.floor(Date.now() / 1000) + (opts.expiresInSec ?? 600) },
    TEST_CLERK_SIGNING_SECRET,
  );
}

/** A token with a valid-looking payload but signed by someone who does not hold the key. */
export function forgedToken(sub: string): string {
  return jwt.sign(
    { sub, exp: Math.floor(Date.now() / 1000) + 600 },
    'attacker-controlled-secret',
  );
}

/** Run a read query and return typed rows (the single place raw `any` from the driver is narrowed). */
export async function rows<T extends Record<string, unknown>>(
  h: Harness,
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  return (await h.ds.query(sql, params)) as T[];
}

/** Supertest bodies are JSON of unknown shape; tests read them through this narrow view. */
export type Body = Record<string, any> & { id?: string };

export interface Harness {
  app: INestApplication;
  ds: DataSource;
  http: () => ReturnType<typeof request>;
  close: () => Promise<void>;
}

export async function bootHarness(): Promise<Harness> {
  // require() (not import()) so the spec-side type-check does not demand an ESM '.js' specifier.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { AppModule } =
    require('../../src/app.module') as typeof import('../../src/app.module');
  // PuppeteerService pre-warms a headless Chrome in onModuleInit. CI has no Chrome, so the launch fails
  // and its debug logger then imports a file after Jest has torn down, crashing the process after
  // every test has passed. PDF rendering is not under test, so a browser-free stand-in is used.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PuppeteerService } =
    require('../../src/common/services/puppeteer.service') as typeof import('../../src/common/services/puppeteer.service');
  const mod = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PuppeteerService)
    .useValue({
      onModuleInit: () => undefined,
      onModuleDestroy: () => undefined,
      generatePdfFromHtml: () => {
        throw new Error(
          'PDF rendering is disabled in the access-control tests',
        );
      },
    })
    .compile();
  const app = mod.createNestApplication();
  // Same validation settings as src/main.ts, so request-body behaviour matches production
  // (a plain whitelist-only pipe silently strips unknown fields, which hides mass-assignment bugs).
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  await app.init();
  const ds = app.get(DataSource);
  return {
    app,
    ds,
    http: () => request(app.getHttpServer()),
    close: async () => {
      await app.close();
    },
  };
}

/**
 * Create a user the way the product does (first authenticated request creates the row), give them an
 * active subscription like a paying customer, and return their database id.
 */
export async function provisionSubscribedUser(
  h: Harness,
  clerkId: string,
  email: string,
): Promise<{ clerkId: string; token: string; userId: string }> {
  addClerkUser(clerkId, email);
  const token = signedToken(clerkId);
  // /health is public; use an authenticated, subscription-exempt endpoint to trigger provisioning.
  await h
    .http()
    .get('/subscriptions/current')
    .set('Authorization', `Bearer ${token}`);
  const rows = await h.ds.query(
    'select id from users where "clerkUserId" = $1',
    [clerkId],
  );
  const userId = rows[0].id as string;
  const plan = (
    await h.ds.query(`select id from plans where name = 'Pro' limit 1`)
  )[0].id;
  await h.ds.query(
    `insert into subscriptions ("userId","planId",status,"currentPeriodStart","currentPeriodEnd","createdAt","updatedAt")
     values ($1,$2,'active', now(), now() + interval '30 days', now(), now())
     on conflict ("userId") do update set status='active'`,
    [userId, plan],
  );
  return { clerkId, token, userId };
}

/** Remove everything the suite created (synthetic rows only: matched by the test email domain). */
export async function cleanupSynthetic(h: Harness): Promise<void> {
  const ids: string[] = (
    await h.ds.query(
      `select id from users where email like '%@access-test.invalid'`,
    )
  ).map((r: { id: string }) => r.id);
  if (!ids.length) return;
  for (const t of [
    'invoice_items',
    'invoices',
    'store_alerts',
    'store_item_settings',
    'stock_movements',
    'inventory_items',
    'stores',
    'clients',
    'api_keys',
    'invoice_templates',
    'user_settings',
    'subscriptions',
    'usage',
  ]) {
    try {
      if (t === 'invoice_items') {
        await h.ds.query(
          `delete from invoice_items where "invoiceId" in (select id from invoices where "userId" = any($1))`,
          [ids],
        );
      } else {
        await h.ds.query(`delete from ${t} where "userId" = any($1)`, [ids]);
      }
    } catch {
      /* table/column absent in this schema version: nothing to clean */
    }
  }
  await h.ds
    .query(`delete from user_organizations where "userId" = any($1)`, [ids])
    .catch(() => undefined);
  await h.ds.query(`delete from users where id = any($1)`, [ids]);
}
