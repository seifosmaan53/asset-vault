/**
 * Inventory valuation per store — REAL application, REAL PostgreSQL (shared harness in
 * test/support/access-control-harness.ts). Store-level quantities live in store_item_settings;
 * they are set directly in the database so the expected totals below are exact.
 */
import {
  bootHarness,
  cleanupSynthetic,
  clerkDirectory,
  type Harness,
  provisionSubscribedUser,
} from '../support/access-control-harness';
import type * as HarnessModule from '../support/access-control-harness';
import type * as NestCommon from '@nestjs/common';
import type * as ClerkBackend from '@clerk/backend';
import type * as JsonWebToken from 'jsonwebtoken';

// Same stubs as access-control.db.spec.ts (tRPC is ESM-only; Clerk is not called over the network),
// typed so the factories stay lint-clean. Type-only imports are erased, so jest's hoisting is unaffected.
jest.mock('../../src/trpc/trpc.module', () => ({
  TrpcModule: class TrpcModule {},
}));
jest.mock('../../src/trpc/trpc.controller', () => {
  const { Controller } =
    jest.requireActual<typeof NestCommon>('@nestjs/common');
  class TrpcController {}
  Controller('trpc-stub')(TrpcController);
  return { TrpcController };
});
jest.mock('@clerk/backend', () => {
  const actual = jest.requireActual<typeof ClerkBackend>('@clerk/backend');
  const jsonwebtoken = jest.requireActual<typeof JsonWebToken>('jsonwebtoken');
  const harness = jest.requireActual<typeof HarnessModule>(
    '../support/access-control-harness',
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

interface ValuationBody {
  items: {
    itemId: string;
    itemName: string;
    sku: string;
    unitPrice: number;
    currentStock: number;
    totalValue: number;
    store: string;
  }[];
  summary: { totalItems: number; totalValuation: number; averageValue: number };
}

/*
 * Fixture (prices are exact binary fractions so the expected totals are exact):
 *
 *   item        price   overall stock   store A qty   store B qty
 *   VAL-HAM     12.50        10              4             1
 *   VAL-NAIL     2.75        20             10             -
 *   VAL-TAPE     0.25         8              -             3
 *
 *   global : 12.50*10 + 2.75*20 + 0.25*8 = 125 + 55 + 2   = 182
 *   store A: 12.50*4  + 2.75*10          =  50 + 27.5     = 77.5
 *   store B: 12.50*1  + 0.25*3           = 12.5 + 0.75    = 13.25
 */
describe('GET /reports/inventory-valuation?storeId (real app + real PostgreSQL)', () => {
  let h: Harness;
  let owner: { token: string; userId: string };
  let other: { token: string; userId: string };
  let storeA: string;
  let storeB: string;
  let otherStore: string;
  const ids: Record<string, string> = {};
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  const valuation = (token: string, query = '') =>
    h.http().get(`/reports/inventory-valuation${query}`).set(auth(token));

  const createItem = async (
    token: string,
    sku: string,
    price: number,
    stock: number,
  ) => {
    const r = await h
      .http()
      .post('/inventory/items')
      .set(auth(token))
      .send({
        sku,
        name: `Item ${sku}`,
        unit: 'pcs',
        defaultUnitPrice: price,
        currentStock: stock,
        reorderLevel: 0,
        status: 'active',
      });
    expect(r.status).toBe(201);
    return (r.body as { id: string }).id;
  };

  const createStore = async (token: string, name: string, code: string) => {
    const c = await h
      .http()
      .post('/clients')
      .set(auth(token))
      .send({
        name: `${name} Client`,
        email: `${code.toLowerCase()}@access-test.invalid`,
      });
    const r = await h
      .http()
      .post('/inventory/stores')
      .set(auth(token))
      .send({
        clientId: (c.body as { id: string }).id,
        name,
        code,
      });
    expect(r.status).toBe(201);
    return (r.body as { id: string }).id;
  };

  const stock = (store: string, item: string, qty: number) =>
    h.ds.query(
      'insert into store_item_settings ("storeId","inventoryItemId","currentStock") values ($1,$2,$3)',
      [store, item, qty],
    );

  beforeAll(async () => {
    h = await bootHarness();
    await cleanupSynthetic(h);
    owner = await provisionSubscribedUser(
      h,
      'user_val_owner_t',
      'val-owner@access-test.invalid',
    );
    other = await provisionSubscribedUser(
      h,
      'user_val_other_t',
      'val-other@access-test.invalid',
    );
    ids.ham = await createItem(owner.token, 'VAL-HAM', 12.5, 10);
    ids.nail = await createItem(owner.token, 'VAL-NAIL', 2.75, 20);
    ids.tape = await createItem(owner.token, 'VAL-TAPE', 0.25, 8);
    storeA = await createStore(owner.token, 'Val Store A', 'VAL-A');
    storeB = await createStore(owner.token, 'Val Store B', 'VAL-B');
    await stock(storeA, ids.ham, 4);
    await stock(storeA, ids.nail, 10);
    await stock(storeB, ids.ham, 1);
    await stock(storeB, ids.tape, 3);

    ids.otherItem = await createItem(other.token, 'VAL-SECRET', 1000, 7);
    otherStore = await createStore(other.token, 'Other Val Store', 'VAL-OTHER');
    await stock(otherStore, ids.otherItem, 7);
    // A stock row in the owner's store pointing at another user's item cannot be made through the
    // API; it is made here to prove the per-store report never values someone else's item.
    await stock(storeA, ids.otherItem, 5);
  }, 120000);

  afterAll(async () => {
    await cleanupSynthetic(h);
    await h.close();
    clerkDirectory.clear();
  });

  it('without storeId: unchanged global valuation at overall stock', async () => {
    const r = await valuation(owner.token);
    expect(r.status).toBe(200);
    const body = r.body as ValuationBody;
    expect(body.summary).toEqual({
      totalItems: 3,
      totalValuation: 182,
      averageValue: 182 / 3,
    });
    expect(
      body.items.map((i) => [
        i.sku,
        i.unitPrice,
        i.currentStock,
        i.totalValue,
        i.store,
      ]),
    ).toEqual([
      ['VAL-HAM', 12.5, 10, 125, 'N/A'],
      ['VAL-NAIL', 2.75, 20, 55, 'N/A'],
      ['VAL-TAPE', 0.25, 8, 2, 'N/A'],
    ]);
  });

  it('store A: only its stock, at store-level quantities', async () => {
    const r = await valuation(owner.token, `?storeId=${storeA}`);
    expect(r.status).toBe(200);
    const body = r.body as ValuationBody;
    expect(body.summary).toEqual({
      totalItems: 2,
      totalValuation: 77.5,
      averageValue: 38.75,
    });
    expect(
      body.items.map((i) => [
        i.sku,
        i.unitPrice,
        i.currentStock,
        i.totalValue,
        i.store,
      ]),
    ).toEqual([
      ['VAL-HAM', 12.5, 4, 50, 'Val Store A'],
      ['VAL-NAIL', 2.75, 10, 27.5, 'Val Store A'],
    ]);
  });

  it('store B: different quantities give a different total', async () => {
    const r = await valuation(owner.token, `?storeId=${storeB}`);
    expect(r.status).toBe(200);
    const body = r.body as ValuationBody;
    expect(body.summary).toEqual({
      totalItems: 2,
      totalValuation: 13.25,
      averageValue: 6.625,
    });
    expect(
      body.items.map((i) => [i.sku, i.currentStock, i.totalValue]),
    ).toEqual([
      ['VAL-HAM', 1, 12.5],
      ['VAL-TAPE', 3, 0.75],
    ]);
  });

  it("another user's store is 404 and leaks nothing", async () => {
    const r = await valuation(owner.token, `?storeId=${otherStore}`);
    expect(r.status).toBe(404);
    expect(JSON.stringify(r.body)).not.toMatch(
      /VAL-SECRET|Other Val Store|1000/,
    );
  });

  it("never values another user's item, even through a stock row in the caller's store", async () => {
    const r = await valuation(owner.token, `?storeId=${storeA}`);
    expect(JSON.stringify(r.body)).not.toContain('VAL-SECRET');
  });

  it('the other user still sees their own store normally', async () => {
    const r = await valuation(other.token, `?storeId=${otherStore}`);
    expect(r.status).toBe(200);
    expect((r.body as ValuationBody).summary.totalValuation).toBe(7000);
  });

  it('a deleted store is 404', async () => {
    const deleted = await createStore(owner.token, 'Val Deleted', 'VAL-DEL');
    await h.ds.query('update stores set "deletedAt" = now() where id = $1', [
      deleted,
    ]);
    expect((await valuation(owner.token, `?storeId=${deleted}`)).status).toBe(
      404,
    );
  });

  it('an unknown store id is 404 and a malformed one is 400', async () => {
    expect(
      (
        await valuation(
          owner.token,
          '?storeId=00000000-0000-4000-8000-000000000000',
        )
      ).status,
    ).toBe(404);
    expect((await valuation(owner.token, '?storeId=not-a-uuid')).status).toBe(
      400,
    );
  });
});
