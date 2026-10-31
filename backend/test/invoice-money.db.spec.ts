/**
 * Invoice money end to end: REAL application, REAL PostgreSQL (the same harness as
 * access-control.db.spec.ts). Each worked example of src/common/money/invoice-money.cases.ts
 * is created through POST /invoices and read back through GET /invoices/:id, so the totals
 * the API stores and returns are compared with the values the web app computes for the same
 * input (frontend/src/utils/invoice-totals.util.test.ts checks those against the same cases).
 */
import type * as ClerkBackend from '@clerk/backend';
import type * as NestCommon from '@nestjs/common';
import type * as Jwt from 'jsonwebtoken';
import {
  bootHarness,
  cleanupSynthetic,
  clerkDirectory,
  type Harness,
  provisionSubscribedUser,
  rows,
  type TEST_CLERK_SIGNING_SECRET,
} from './support/access-control-harness';
import { at, idOf, list, text } from './support/json';
import { INVOICE_MONEY_CASES } from '../src/common/money/invoice-money.cases';
import { AppDataSource } from '../src/database/data-source';

/** The parts of the harness the @clerk/backend mock factory reads. */
interface HarnessForMock {
  TEST_CLERK_SIGNING_SECRET: typeof TEST_CLERK_SIGNING_SECRET;
  clerkDirectory: typeof clerkDirectory;
}

// Same stubs as access-control.db.spec.ts (tRPC is ESM-only; Clerk is not called over the network).
jest.mock('../src/trpc/trpc.module', () => ({
  TrpcModule: class TrpcModule {},
}));
jest.mock('../src/trpc/trpc.controller', () => {
  const { Controller } =
    jest.requireActual<typeof NestCommon>('@nestjs/common');
  class TrpcController {}
  Controller('trpc-stub')(TrpcController);
  return { TrpcController };
});
jest.mock('@clerk/backend', () => {
  const actual = jest.requireActual<typeof ClerkBackend>('@clerk/backend');
  const jsonwebtoken = jest.requireActual<typeof Jwt>('jsonwebtoken');
  const harness = jest.requireActual<HarnessForMock>(
    './support/access-control-harness',
  );
  return {
    ...actual,
    // new Promise(): a throw inside the executor becomes a rejection, exactly as in an async fn.
    verifyToken: jest.fn(
      (token: string) =>
        new Promise((resolve) =>
          resolve(
            jsonwebtoken.verify(token, harness.TEST_CLERK_SIGNING_SECRET),
          ),
        ),
    ),
    createClerkClient: () => ({
      users: {
        getUser: (id: string) =>
          new Promise((resolve) => {
            const u = harness.clerkDirectory.get(id);
            if (!u) throw new Error('user not found');
            resolve(u);
          }),
      },
    }),
  };
});

describe('invoice money through the API (real app + real PostgreSQL)', () => {
  let h: Harness;
  let user: { token: string };
  let clientId: string;
  const auth = () => ({ Authorization: `Bearer ${user.token}` });

  beforeAll(async () => {
    h = await bootHarness();
    await cleanupSynthetic(h);
    user = await provisionSubscribedUser(
      h,
      'user_money_t',
      'money@access-test.invalid',
    );
    const c = await h.http().post('/clients').set(auth()).send({
      name: 'Money Client',
      email: 'money-client@access-test.invalid',
    });
    clientId = text(at(c.body, 'id'), 'client id');
  }, 120000);

  afterAll(async () => {
    await cleanupSynthetic(h);
    await h.close();
    clerkDirectory.clear();
  });

  it.each(INVOICE_MONEY_CASES.map((c) => [c.name, c] as const))(
    'stores and returns the shared totals: %s',
    async (_name, c) => {
      const created = await h
        .http()
        .post('/invoices')
        .set(auth())
        .send({
          clientId,
          type: 'invoice',
          issueDate: '2026-10-30',
          currency: 'USD',
          // The API requires both rates on every line; the web app sends 0 for an empty one.
          items: c.items.map((item, i) => ({
            description: `Line ${i + 1}`,
            ...item,
            taxRate: item.taxRate ?? 0,
            discountRate: item.discountRate ?? 0,
          })),
        });
      expect(created.status).toBe(201);
      const id = idOf(created.body);

      const read = await h.http().get(`/invoices/${id}`).set(auth());
      expect(read.status).toBe(200);
      const body: unknown = read.body;
      const invoice = at(body, 'data') ?? body;
      expect({
        subtotal: String(at(invoice, 'subtotal')),
        discountTotal: String(at(invoice, 'discountTotal')),
        taxTotal: String(at(invoice, 'taxTotal')),
        total: String(at(invoice, 'total')),
      }).toEqual(c.stored);

      const lineTotals = [...list(at(invoice, 'items'))]
        .sort((a, b) =>
          text(at(a, 'description')).localeCompare(text(at(b, 'description'))),
        )
        .map((item) => Number(at(item, 'lineTotal')));
      expect(lineTotals).toEqual(c.lines.map((l) => l[3] / 100));
    },
  );

  it('rejects an amount the shared rules reject, with the same message', async () => {
    const r = await h
      .http()
      .post('/invoices')
      .set(auth())
      .send({
        clientId,
        type: 'invoice',
        issueDate: '2026-10-30',
        currency: 'USD',
        items: [
          {
            description: 'Line 1',
            quantity: 2.5,
            unitPrice: 10,
            taxRate: 0,
            discountRate: 0,
          },
        ],
      });
    expect(r.status).toBe(400);
    expect(JSON.stringify(r.body)).toContain(
      'items[0].quantity must be an integer',
    );
  });

  // ---- helpers for the tests below ----
  const line = (o: Record<string, unknown>) => ({
    description: 'Line',
    quantity: 1,
    unitPrice: 10,
    taxRate: 0,
    discountRate: 0,
    ...o,
  });
  const create = (items: Record<string, unknown>[]) =>
    h.http().post('/invoices').set(auth()).send({
      clientId,
      type: 'invoice',
      issueDate: '2026-10-30',
      currency: 'USD',
      items,
    });
  const read = async (id: string): Promise<unknown> => {
    const r = await h.http().get(`/invoices/${id}`).set(auth());
    expect(r.status).toBe(200);
    return at(r.body, 'data') ?? r.body;
  };
  const invoiceCount = async () =>
    Number(
      (
        await rows(
          h,
          `select count(*)::int as n from invoices where "clientId" = $1`,
          [clientId],
        )
      )[0].n,
    );

  it('keeps a four-decimal rate through save, reload and edit (numeric(7,4))', async () => {
    // 2 x 12.50 = 25.00; 8.875% = 2.21875 -> 2.22; total 27.22
    const created = await create([
      line({
        quantity: 2,
        unitPrice: 12.5,
        taxRate: 8.875,
        discountRate: 7.0625,
      }),
    ]);
    expect(created.status).toBe(201);
    const id = idOf(created.body);
    const loaded = await read(id);
    expect(String(at(loaded, 'items', 0, 'taxRate'))).toBe('8.8750');
    expect(String(at(loaded, 'items', 0, 'discountRate'))).toBe('7.0625');
    // 2500 - 7.0625% (176.5625 -> 177) = 2323; 8.875% of 2323 = 206.16 -> 206; total 2529
    expect(String(at(loaded, 'total'))).toBe('25.2900');

    // Edit with the values exactly as they were loaded: totals do not change.
    const item = at(loaded, 'items', 0);
    const patched = await h
      .http()
      .patch(`/invoices/${id}`)
      .set(auth())
      .send({
        items: [
          {
            description: at(item, 'description'),
            quantity: at(item, 'quantity'),
            unitPrice: Number(at(item, 'unitPrice')),
            taxRate: Number(at(item, 'taxRate')),
            discountRate: Number(at(item, 'discountRate')),
          },
        ],
      });
    expect(patched.status).toBe(200);
    const again = await read(id);
    expect(String(at(again, 'total'))).toBe('25.2900');
    expect(String(at(again, 'items', 0, 'taxRate'))).toBe('8.8750');
  });

  it('rejects a line without a description, like the form', async () => {
    const before = await invoiceCount();
    for (const description of ['', '   ']) {
      const r = await create([line({ description })]);
      expect(r.status).toBe(400);
      expect(JSON.stringify(r.body)).toContain('Description is required');
    }
    expect(await invoiceCount()).toBe(before);
  });

  it('rejects a rate with a fifth decimal instead of storing it rounded', async () => {
    const r = await create([line({ taxRate: 8.87512 })]);
    expect(r.status).toBe(400);
    expect(JSON.stringify(r.body)).toContain(
      'items[0].taxRate must have at most 4 decimal places',
    );
  });

  it('stores amounts at the column limit and rejects anything beyond it, writing nothing', async () => {
    const atLimit = await create([line({ unitPrice: 99999999.99 })]);
    expect(atLimit.status).toBe(201);
    const stored = await read(idOf(atLimit.body));
    expect(String(at(stored, 'total'))).toBe('99999999.9900');

    const before = await invoiceCount();
    const cases: Array<[Record<string, unknown>[], string]> = [
      [
        [line({ unitPrice: 100000000 })],
        'items[0].unitPrice must be at most 99999999.99',
      ],
      [
        [line({ quantity: 2, unitPrice: 50000000 })],
        'items[0] amounts must not exceed 99999999.99',
      ],
      [
        [line({ unitPrice: 99999999.99, taxRate: 1 })],
        'items[0] amounts must not exceed 99999999.99',
      ],
      [
        [line({ unitPrice: 60000000 }), line({ unitPrice: 60000000 })],
        'invoice totals must not exceed 99999999.99',
      ],
    ];
    for (const [items, message] of cases) {
      const r = await create(items);
      expect(r.status).toBe(400);
      expect(JSON.stringify(r.body)).toContain(message);
    }
    expect(await invoiceCount()).toBe(before);
  });

  it('an update the limits reject leaves the stored invoice unchanged', async () => {
    const created = await create([
      line({ quantity: 3, unitPrice: 10, taxRate: 10 }),
    ]);
    const id = idOf(created.body);
    const original = await read(id);
    const r = await h
      .http()
      .patch(`/invoices/${id}`)
      .set(auth())
      .send({
        items: [line({ unitPrice: 60000000 }), line({ unitPrice: 60000000 })],
      });
    expect(r.status).toBe(400);
    const after = await read(id);
    expect(at(after, 'total')).toBe(at(original, 'total'));
    expect(list(at(after, 'items')).map((i) => at(i, 'unitPrice'))).toEqual(
      list(at(original, 'items')).map((i) => at(i, 'unitPrice')),
    );
  });

  it('migration 1761000000000: down rounds four-decimal rates, up keeps two-decimal rates and stored totals exactly', async () => {
    const created = await create([
      line({ quantity: 2, unitPrice: 9.99, taxRate: 8.25, discountRate: 10 }),
    ]);
    const id = idOf(created.body);
    const fine = await create([line({ unitPrice: 10, taxRate: 8.875 })]);
    const fineId = idOf(fine.body);
    const before = await read(id);

    const last = await rows(
      h,
      `select name from migrations order by id desc limit 1`,
    );
    expect(last[0].name).toBe('WidenInvoiceItemRatePrecision1761000000000');
    // The migration CLI's own DataSource (the one `npm run migration:run` uses).
    const migrations = await AppDataSource.initialize();
    await migrations.undoLastMigration({ transaction: 'all' });
    const narrowed = await rows(
      h,
      `select "taxRate"::text as t, numeric_scale from invoice_items, information_schema.columns
        where "invoiceId" = $1 and table_name = 'invoice_items' and column_name = 'taxRate'`,
      [fineId],
    );
    expect(narrowed[0]).toEqual({ t: '8.88', numeric_scale: 2 });
    const reapplied = await migrations.runMigrations({ transaction: 'all' });
    expect(reapplied.map((m) => m.name)).toEqual([
      'WidenInvoiceItemRatePrecision1761000000000',
    ]);
    await migrations.destroy();

    const after = await read(id);
    expect(String(at(after, 'items', 0, 'taxRate'))).toBe('8.2500');
    expect(String(at(after, 'items', 0, 'discountRate'))).toBe('10.0000');
    expect(at(after, 'total')).toBe(at(before, 'total')); // nothing recalculated
    expect(at(after, 'subtotal')).toBe(at(before, 'subtotal'));
  });
});
