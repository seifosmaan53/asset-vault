/**
 * Stock sales against a REAL PostgreSQL (same harness as access-control.db.spec.ts).
 *
 * Regression: the sale path's atomic UPDATE also required status = 'active' and read the
 * affected-row count from the driver's [rows, rowCount] tuple as its length (always 2). A sale of an
 * inactive item therefore saved the movement and reported success while currentStock never changed.
 * The documented rule is "no status restrictions — only stock availability", as for purchases and
 * adjustments.
 */
import type * as ClerkBackend from '@clerk/backend';
import type * as NestCommon from '@nestjs/common';
import type * as JsonWebToken from 'jsonwebtoken';
import type * as HarnessModule from './support/access-control-harness';
import {
  bootHarness,
  cleanupSynthetic,
  clerkDirectory,
  type Harness,
  provisionSubscribedUser,
  rows,
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

describe('inventory sales (real app + real PostgreSQL)', () => {
  let h: Harness;
  let token: string;
  let userId: string;
  const auth = () => ({ Authorization: `Bearer ${token}` });

  const createItem = async (sku: string, status: string, stock: number) => {
    const r = await h.http().post('/inventory/items').set(auth()).send({
      sku,
      name: sku,
      unit: 'pcs',
      defaultUnitPrice: 10,
      currentStock: stock,
      reorderLevel: 0,
      status,
    });
    expect(r.status).toBe(201);
    return idOf(r.body);
  };
  const sell = (itemId: string, quantity: number) =>
    h
      .http()
      .post(`/inventory/items/${itemId}/movements`)
      .set(auth())
      .send({ type: 'sale', quantity, sourceType: 'manual' });
  const stockOf = async (itemId: string) =>
    (
      await rows<{ currentStock: number }>(
        h,
        'select "currentStock" from inventory_items where id = $1',
        [itemId],
      )
    )[0].currentStock;
  const salesOf = async (itemId: string) =>
    (
      await rows<{ n: number }>(
        h,
        `select count(*)::int n from stock_movements where "inventoryItemId" = $1 and type = 'sale'`,
        [itemId],
      )
    )[0].n;

  beforeAll(async () => {
    expect(TEST_CLERK_SIGNING_SECRET).toBeTruthy();
    h = await bootHarness();
    await cleanupSynthetic(h);
    const u = await provisionSubscribedUser(
      h,
      'user_sale_t',
      'sale@access-test.invalid',
    );
    token = u.token;
    userId = u.userId;
  }, 120000);

  afterAll(async () => {
    await cleanupSynthetic(h);
    await h.close();
    clerkDirectory.clear();
  });

  it('a sale of an inactive item with enough stock reduces its stock', async () => {
    const itemId = await createItem('SALE-INACTIVE', 'inactive', 5);
    const r = await sell(itemId, 2);
    expect(r.status).toBe(201);
    expect(await stockOf(itemId)).toBe(3);
    expect(await salesOf(itemId)).toBe(1);
  });

  it('a sale beyond the available stock is refused and records nothing', async () => {
    const itemId = await createItem('SALE-SHORT', 'active', 1);
    const r = await sell(itemId, 2);
    expect(r.status).toBe(400);
    expect(await stockOf(itemId)).toBe(1);
    expect(await salesOf(itemId)).toBe(0);
  });

  it('two concurrent sales cannot both succeed against stock for one', async () => {
    const itemId = await createItem('SALE-RACE', 'active', 5);
    const results = await Promise.all([sell(itemId, 3), sell(itemId, 3)]);
    const statuses = results.map((r) => r.status).sort();
    expect(statuses).toEqual([201, 400]);
    expect(await stockOf(itemId)).toBe(2);
    expect(await salesOf(itemId)).toBe(1);
    expect(userId).toBeTruthy();
  });
});
