/**
 * Inputs the API accepted and then ignored (real app + real PostgreSQL):
 * - PATCH /invoices/:id dropped paymentMethodNote;
 * - GET /user-settings never returned 19 saved settings (invoice header/watermark, client
 *   defaults, display and backup preferences), so the settings page and invoice PDF never saw them;
 * - GET /invoices/stats returned 0 for every figure (unquoted aliases lower-cased by PostgreSQL).
 */
import type * as ClerkBackend from '@clerk/backend';
import type * as NestCommon from '@nestjs/common';
import type * as JsonWebToken from 'jsonwebtoken';
import type * as HarnessModule from './support/access-control-harness';
import { at, isRecord } from './support/json';
import {
  bootHarness,
  cleanupSynthetic,
  clerkDirectory,
  type Harness,
  provisionSubscribedUser,
  TEST_CLERK_SIGNING_SECRET,
} from './support/access-control-harness';

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

// Same Clerk stand-in as the access-control suite: HMAC-verified tokens, in-memory user directory.
jest.mock('@clerk/backend', () => {
  const actual = jest.requireActual<typeof ClerkBackend>('@clerk/backend');
  const jsonwebtoken = jest.requireActual<typeof JsonWebToken>('jsonwebtoken');
  const harness = jest.requireActual<typeof HarnessModule>(
    './support/access-control-harness',
  );
  return {
    ...actual,
    verifyToken: jest.fn((token: string) =>
      Promise.resolve(
        jsonwebtoken.verify(token, harness.TEST_CLERK_SIGNING_SECRET),
      ),
    ),
    createClerkClient: () => ({
      users: {
        getUser: (id: string) => {
          const u = harness.clerkDirectory.get(id);
          return u
            ? Promise.resolve(u)
            : Promise.reject(new Error('user not found'));
        },
      },
    }),
  };
});

function idOf(body: unknown): string {
  if (typeof body === 'object' && body !== null && 'id' in body) {
    const { id } = body;
    if (typeof id === 'string') return id;
  }
  throw new Error(`response has no id: ${JSON.stringify(body)}`);
}

/** Invoice endpoints wrap the record in `data`; other endpoints return it directly. */
function record(body: unknown): unknown {
  return isRecord(body) && isRecord(body.data) ? body.data : body;
}

describe('accepted-then-ignored inputs (real app + real PostgreSQL)', () => {
  let h: Harness;
  let token: string;
  let clientId: string;
  const auth = () => ({ Authorization: `Bearer ${token}` });

  const createInvoice = async (unitPrice: number) => {
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
            description: 'Line',
            quantity: 1,
            unitPrice,
            taxRate: 0,
            discountRate: 0,
          },
        ],
      });
    expect(r.status).toBe(201);
    return idOf(record(r.body));
  };

  beforeAll(async () => {
    expect(TEST_CLERK_SIGNING_SECRET).toBeTruthy();
    h = await bootHarness();
    await cleanupSynthetic(h);
    token = (
      await provisionSubscribedUser(
        h,
        'user_ignored_t',
        'ignored@access-test.invalid',
      )
    ).token;
    const c = await h
      .http()
      .post('/clients')
      .set(auth())
      .send({ name: 'Ignored Client', email: 'ic@access-test.invalid' });
    expect(c.status).toBe(201);
    clientId = idOf(c.body);
  }, 120000);

  afterAll(async () => {
    await cleanupSynthetic(h);
    await h.close();
    clerkDirectory.clear();
  });

  it('GET /invoices/stats counts and sums real invoices', async () => {
    await createInvoice(10);
    await createInvoice(20.15);
    const r = await h.http().get('/invoices/stats').set(auth());
    expect(r.status).toBe(200);
    expect(Number(at(record(r.body), 'totalCount'))).toBe(2);
    expect(Number(at(record(r.body), 'totalAmount'))).toBeCloseTo(30.15, 2);
  });

  it('PATCH /invoices/:id stores paymentMethodNote, and an empty value clears it', async () => {
    const id = await createInvoice(5);
    const set = await h
      .http()
      .patch(`/invoices/${id}`)
      .set(auth())
      .send({ paymentMethodNote: 'Bank transfer' });
    expect(set.status).toBe(200);
    const got = await h.http().get(`/invoices/${id}`).set(auth());
    expect(at(record(got.body), 'paymentMethodNote')).toBe('Bank transfer');

    const cleared = await h
      .http()
      .patch(`/invoices/${id}`)
      .set(auth())
      .send({ paymentMethodNote: '' });
    expect(cleared.status).toBe(200);
    const after = await h.http().get(`/invoices/${id}`).set(auth());
    expect(at(record(after.body), 'paymentMethodNote')).toBeNull();
  });

  it('GET /user-settings returns settings that PATCH saved', async () => {
    const saved = {
      invoiceHeaderText: 'Thank you for your business',
      showInvoiceWatermark: true,
      invoiceWatermarkText: 'PAID',
      defaultClientCurrency: 'EUR',
      fontSize: 'large',
      compactMode: true,
      backupRetentionDays: 14,
    };
    const p = await h.http().patch('/user-settings').set(auth()).send(saved);
    expect(p.status).toBe(200);
    const g = await h.http().get('/user-settings').set(auth());
    expect(g.status).toBe(200);
    for (const [key, value] of Object.entries(saved)) {
      expect([key, at(g.body, key)]).toEqual([key, value]);
    }
    // The removed 2FA feature's inert column stays out of the response.
    expect(g.body).not.toHaveProperty('enableTwoFactorAuth');
  });
});
