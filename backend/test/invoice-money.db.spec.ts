/**
 * Invoice money end to end: REAL application, REAL PostgreSQL (the same harness as
 * access-control.db.spec.ts). Each worked example of src/common/money/invoice-money.cases.ts
 * is created through POST /invoices and read back through GET /invoices/:id, so the totals
 * the API stores and returns are compared with the values the web app computes for the same
 * input (frontend/src/utils/invoice-totals.util.test.ts checks those against the same cases).
 */
import {
  bootHarness,
  cleanupSynthetic,
  clerkDirectory,
  Harness,
  provisionSubscribedUser,
} from './support/access-control-harness';
import { INVOICE_MONEY_CASES } from '../src/common/money/invoice-money.cases';

// Same stubs as access-control.db.spec.ts (tRPC is ESM-only; Clerk is not called over the network).
jest.mock('../src/trpc/trpc.module', () => ({
  TrpcModule: class TrpcModule {},
}));
jest.mock('../src/trpc/trpc.controller', () => {
  const { Controller } = jest.requireActual('@nestjs/common');
  class TrpcController {}
  Controller('trpc-stub')(TrpcController);
  return { TrpcController };
});
jest.mock('@clerk/backend', () => {
  const actual = jest.requireActual('@clerk/backend');
  const jsonwebtoken = jest.requireActual('jsonwebtoken');
  const harness = jest.requireActual('./support/access-control-harness');
  return {
    ...actual,
    verifyToken: jest.fn(async (token: string) =>
      jsonwebtoken.verify(token, harness.TEST_CLERK_SIGNING_SECRET),
    ),
    createClerkClient: () => ({
      users: {
        getUser: async (id: string) => {
          const u = harness.clerkDirectory.get(id);
          if (!u) throw new Error('user not found');
          return u;
        },
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
    const c = await h
      .http()
      .post('/clients')
      .set(auth())
      .send({
        name: 'Money Client',
        email: 'money-client@access-test.invalid',
      });
    clientId = c.body.id;
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
      const id = created.body.id ?? created.body.data?.id;

      const read = await h.http().get(`/invoices/${id}`).set(auth());
      expect(read.status).toBe(200);
      const invoice = read.body.data ?? read.body;
      expect({
        subtotal: String(invoice.subtotal),
        discountTotal: String(invoice.discountTotal),
        taxTotal: String(invoice.taxTotal),
        total: String(invoice.total),
      }).toEqual(c.stored);

      const lineTotals = [...invoice.items]
        .sort((a: { description: string }, b: { description: string }) =>
          a.description.localeCompare(b.description),
        )
        .map((item: { lineTotal: string | number }) => Number(item.lineTotal));
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
});
