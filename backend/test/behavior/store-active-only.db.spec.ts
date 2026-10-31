/**
 * GET /inventory/stores?activeOnly=true — REAL application, REAL PostgreSQL (shared harness in
 * test/support/access-control-harness.ts). The filter reads the `stores.active` column; the UI can
 * no longer set it to false, so the inactive row is made directly in the database, the way a row
 * from before the toggle was removed (or an import) would look.
 */
import {
  bootHarness,
  cleanupSynthetic,
  clerkDirectory,
  type Harness,
  provisionSubscribedUser,
  rows,
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

interface StoreBody {
  id: string;
  name: string;
  active: boolean;
}

describe('GET /inventory/stores activeOnly (real app + real PostgreSQL)', () => {
  let h: Harness;
  let owner: { token: string; userId: string };
  let other: { token: string; userId: string };
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  const createStore = async (
    token: string,
    clientId: string,
    name: string,
    code: string,
  ): Promise<string> => {
    const r = await h
      .http()
      .post('/inventory/stores')
      .set(auth(token))
      .send({ clientId, name, code });
    expect(r.status).toBe(201);
    return (r.body as StoreBody).id;
  };

  const list = async (token: string, query = ''): Promise<StoreBody[]> => {
    const r = await h.http().get(`/inventory/stores${query}`).set(auth(token));
    expect(r.status).toBe(200);
    return r.body as StoreBody[];
  };

  beforeAll(async () => {
    h = await bootHarness();
    await cleanupSynthetic(h);
    owner = await provisionSubscribedUser(
      h,
      'user_active_owner_t',
      'active-owner@access-test.invalid',
    );
    other = await provisionSubscribedUser(
      h,
      'user_active_other_t',
      'active-other@access-test.invalid',
    );
    const c = await h.http().post('/clients').set(auth(owner.token)).send({
      name: 'Active Client',
      email: 'active-client@access-test.invalid',
    });
    const clientId = (c.body as { id: string }).id;
    await createStore(owner.token, clientId, 'A Open Store', 'ACT-OPEN');
    const closedId = await createStore(
      owner.token,
      clientId,
      'B Closed Store',
      'ACT-CLOSED',
    );
    const deletedId = await createStore(
      owner.token,
      clientId,
      'C Deleted Store',
      'ACT-DEL',
    );
    await h.ds.query('update stores set active = false where id = $1', [
      closedId,
    ]);
    await h.ds.query('update stores set "deletedAt" = now() where id = $1', [
      deletedId,
    ]);

    const oc = await h.http().post('/clients').set(auth(other.token)).send({
      name: 'Other Client',
      email: 'other-client@access-test.invalid',
    });
    await createStore(
      other.token,
      (oc.body as { id: string }).id,
      'Other Store',
      'ACT-OTHER',
    );
  }, 120000);

  afterAll(async () => {
    await cleanupSynthetic(h);
    await h.close();
    clerkDirectory.clear();
  });

  it('fixture: the inactive row really is inactive in the database', async () => {
    const r = await rows(
      h,
      'select name, active from stores where "userId" = $1 and "deletedAt" is null order by name',
      [owner.userId],
    );
    expect(r).toEqual([
      { name: 'A Open Store', active: true },
      { name: 'B Closed Store', active: false },
    ]);
  });

  it('without activeOnly returns every non-deleted store of the caller', async () => {
    expect((await list(owner.token)).map((s) => s.name)).toEqual([
      'A Open Store',
      'B Closed Store',
    ]);
  });

  it('activeOnly=true returns only stores whose active flag is true', async () => {
    const stores = await list(owner.token, '?activeOnly=true');
    expect(stores.map((s) => s.name)).toEqual(['A Open Store']);
    expect(stores.every((s) => s.active)).toBe(true);
  });

  it('activeOnly=false (or any other value) does not filter', async () => {
    for (const q of ['?activeOnly=false', '?activeOnly=yes', '?activeOnly=']) {
      expect((await list(owner.token, q)).map((s) => s.name)).toEqual([
        'A Open Store',
        'B Closed Store',
      ]);
    }
  });

  it("never includes another user's stores, filtered or not", async () => {
    expect(
      (await list(other.token, '?activeOnly=true')).map((s) => s.name),
    ).toEqual(['Other Store']);
    expect(
      (await list(owner.token, '?activeOnly=true')).map((s) => s.name),
    ).not.toContain('Other Store');
  });
});
