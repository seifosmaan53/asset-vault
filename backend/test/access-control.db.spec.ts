/**
 * Access-control integration tests — REAL application, REAL PostgreSQL (migrated with the repo's own
 * migrations). Only Clerk's network calls and the ESM-only tRPC module are stubbed; see
 * test/support/access-control-harness.ts for exactly what is real and what is not.
 *
 * Every test asserts the SECURE behaviour. They were first run against the unfixed code, where the
 * ones marked "regression" failed, and pass after the fix.
 */
import { Readable } from 'node:stream';
import type * as ClerkBackend from '@clerk/backend';
import type * as NestCommon from '@nestjs/common';
import type * as Jwt from 'jsonwebtoken';
import {
  addClerkUser,
  bootHarness,
  cleanupSynthetic,
  clerkDirectory,
  forgedToken,
  type Harness,
  provisionSubscribedUser,
  rows,
  signedToken,
  TEST_CLERK_SIGNING_SECRET,
} from './support/access-control-harness';
import { at, idOf, list, maybe, text } from './support/json';
import { StorageService } from '../src/storage/storage.service';

/** The parts of the harness the @clerk/backend mock factory reads. */
interface HarnessForMock {
  TEST_CLERK_SIGNING_SECRET: typeof TEST_CLERK_SIGNING_SECRET;
  clerkDirectory: typeof clerkDirectory;
}

// superjson (via tRPC) is ESM-only and cannot load under ts-jest; tRPC is not part of this surface.
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

// Stand-in for Clerk: verifyToken checks the HMAC signature (like the real one checks Clerk's keys);
// users.getUser reads the in-memory directory.
jest.mock('@clerk/backend', () => {
  const actual = jest.requireActual<typeof ClerkBackend>('@clerk/backend');
  const jsonwebtoken = jest.requireActual<typeof Jwt>('jsonwebtoken');
  const harness = jest.requireActual<HarnessForMock>(
    './support/access-control-harness',
  );
  return {
    ...actual,
    // Mirrors the installed @clerk/backend (3.x): resolves the verified claims and THROWS on any failure.
    // (The real function is exercised separately in src/auth/clerk-auth.guard.spec.ts.)
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

describe('access control (real app + real PostgreSQL)', () => {
  let h: Harness;
  let alice: { clerkId: string; token: string; userId: string };
  let bob: { clerkId: string; token: string; userId: string };
  let aliceClientId: string;
  let aliceStoreId: string;
  let aliceItemId: string;

  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  beforeAll(async () => {
    h = await bootHarness();
    await cleanupSynthetic(h);
    alice = await provisionSubscribedUser(
      h,
      'user_alice_t',
      'alice@access-test.invalid',
    );
    bob = await provisionSubscribedUser(
      h,
      'user_bob_t',
      'bob@access-test.invalid',
    );

    // Alice's records (created through the real API as Alice).
    const c = await h
      .http()
      .post('/clients')
      .set(auth(alice.token))
      .send({ name: 'Alice Client', email: 'client@access-test.invalid' });
    aliceClientId = idOf(c.body);
    const s = await h
      .http()
      .post('/inventory/stores')
      .set(auth(alice.token))
      .send({
        clientId: aliceClientId,
        name: 'Alice Store',
        code: 'ALICE-ST',
        address: '1 Test St',
      });
    aliceStoreId = idOf(s.body);
    const i = await h
      .http()
      .post('/inventory/items')
      .set(auth(alice.token))
      .send({
        sku: 'ALICE-1',
        name: 'Alice Item',
        unit: 'pcs',
        defaultUnitPrice: 10,
        currentStock: 5,
        reorderLevel: 1,
        status: 'active',
      });
    aliceItemId = idOf(i.body);
  }, 120000);

  afterAll(async () => {
    await cleanupSynthetic(h);
    await h.close();
    clerkDirectory.clear();
  });

  describe('setup sanity', () => {
    it('created the synthetic records through the real API', () => {
      if (!aliceStoreId || !aliceItemId) {
        throw new Error(
          'setup failed: ownership tests below would be meaningless without these records',
        );
      }
      expect(alice.userId).toBeTruthy();
      expect(bob.userId).not.toEqual(alice.userId);
      expect(aliceClientId).toBeTruthy();
      expect(aliceStoreId).toBeTruthy();
      expect(aliceItemId).toBeTruthy();
    });
  });

  describe('authentication', () => {
    it('rejects a request with no token', async () => {
      const r = await h.http().get('/clients');
      expect(r.status).toBe(401);
    });

    it('rejects a garbage token', async () => {
      const r = await h.http().get('/clients').set(auth('not-a-jwt'));
      expect(r.status).toBe(401);
    });

    it('accepts a correctly signed token for a real user', async () => {
      const r = await h.http().get('/clients').set(auth(alice.token));
      expect(r.status).toBe(200);
    });

    it('regression: rejects a token for a REAL user id that was signed with the wrong key', async () => {
      const r = await h
        .http()
        .get('/clients')
        .set(auth(forgedToken(alice.clerkId)));
      expect(r.status).toBe(401);
    });

    it('regression: a forged token does not provision a database user either', async () => {
      addClerkUser('user_ghost_t', 'ghost@access-test.invalid');
      await h
        .http()
        .get('/clients')
        .set(auth(forgedToken('user_ghost_t')));
      const found = await rows(
        h,
        `select 1 from users where "clerkUserId" = 'user_ghost_t'`,
      );
      expect(found.length).toBe(0);
    });

    it('rejects an expired but correctly signed token', async () => {
      const r = await h
        .http()
        .get('/clients')
        .set(auth(signedToken(alice.clerkId, { expiresInSec: -60 })));
      expect(r.status).toBe(401);
    });
  });

  describe('record ownership (clients, stores, inventory)', () => {
    it('owner can read their own client', async () => {
      const r = await h
        .http()
        .get(`/clients/${aliceClientId}`)
        .set(auth(alice.token));
      expect(r.status).toBe(200);
      expect(at(r.body, 'id')).toBe(aliceClientId);
    });

    it("another user cannot read Alice's client by id", async () => {
      const r = await h
        .http()
        .get(`/clients/${aliceClientId}`)
        .set(auth(bob.token));
      expect([403, 404]).toContain(r.status);
      expect(JSON.stringify(r.body)).not.toContain('Alice Client');
    });

    it("another user cannot update Alice's client", async () => {
      const r = await h
        .http()
        .patch(`/clients/${aliceClientId}`)
        .set(auth(bob.token))
        .send({ name: 'Hijacked' });
      expect([403, 404]).toContain(r.status);
      const row = await rows(h, 'select name from clients where id = $1', [
        aliceClientId,
      ]);
      expect(row[0].name).toBe('Alice Client');
    });

    it("another user cannot delete Alice's client", async () => {
      const r = await h
        .http()
        .delete(`/clients/${aliceClientId}`)
        .set(auth(bob.token));
      expect([403, 404]).toContain(r.status);
      const row = await rows(
        h,
        'select "deletedAt" from clients where id = $1',
        [aliceClientId],
      );
      expect(row[0].deletedAt).toBeNull();
    });

    it("another user's lists never contain Alice's records (positive control: Alice sees them)", async () => {
      for (const [path, needle] of [
        ['/clients', 'Alice Client'],
        ['/inventory/stores', 'Alice Store'],
        ['/inventory/items', 'Alice Item'],
      ] as const) {
        const own = await h.http().get(path).set(auth(alice.token));
        expect(own.status).toBe(200);
        expect(JSON.stringify(own.body)).toContain(needle);
        const other = await h.http().get(path).set(auth(bob.token));
        expect(other.status).toBe(200);
        expect(JSON.stringify(other.body)).not.toContain(needle);
      }
    });

    it("another user cannot read Alice's store or inventory item by id (positive control: Alice can)", async () => {
      expect(
        (
          await h
            .http()
            .get(`/inventory/stores/${aliceStoreId}`)
            .set(auth(alice.token))
        ).status,
      ).toBe(200);
      expect(
        (
          await h
            .http()
            .get(`/inventory/items/${aliceItemId}`)
            .set(auth(alice.token))
        ).status,
      ).toBe(200);
      const s = await h
        .http()
        .get(`/inventory/stores/${aliceStoreId}`)
        .set(auth(bob.token));
      expect([403, 404]).toContain(s.status);
      const i = await h
        .http()
        .get(`/inventory/items/${aliceItemId}`)
        .set(auth(bob.token));
      expect([403, 404]).toContain(i.status);
    });

    it("another user cannot delete Alice's store or item", async () => {
      const s = await h
        .http()
        .delete(`/inventory/stores/${aliceStoreId}`)
        .set(auth(bob.token));
      expect(s.status).toBe(404); // a denied delete must be a clean 404, not a server error
      const i = await h
        .http()
        .delete(`/inventory/items/${aliceItemId}`)
        .set(auth(bob.token));
      expect([403, 404]).toContain(i.status);
      expect(
        (
          await rows(
            h,
            'select 1 from stores where id=$1 and "deletedAt" is null',
            [aliceStoreId],
          )
        ).length,
      ).toBe(1);
      expect(
        (
          await rows(h, 'select 1 from inventory_items where id=$1', [
            aliceItemId,
          ])
        ).length,
      ).toBe(1);
    });

    it('a forged userId in the body is rejected or ignored, never honoured (ownership comes from the token)', async () => {
      const aliceClientsBefore = (
        await rows(
          h,
          'select count(*)::int n from clients where "userId" = $1',
          [alice.userId],
        )
      )[0].n;
      const created = await h
        .http()
        .post('/clients')
        .set(auth(bob.token))
        .send({
          name: 'Bob Client',
          email: 'b@access-test.invalid',
          userId: alice.userId,
        });
      // Production's ValidationPipe uses forbidNonWhitelisted, so the safe outcome is a 400. If that
      // setting ever changes to silently strip, the record must still belong to the caller.
      if (created.status === 400) {
        expect(JSON.stringify(created.body)).toMatch(/userId/);
      } else {
        expect([200, 201]).toContain(created.status);
        const row = await rows(
          h,
          'select "userId" from clients where id = $1',
          [at(created.body, 'id')],
        );
        expect(row[0].userId).toBe(bob.userId);
      }
      const aliceClientsAfter = (
        await rows(
          h,
          'select count(*)::int n from clients where "userId" = $1',
          [alice.userId],
        )
      )[0].n;
      expect(aliceClientsAfter).toBe(aliceClientsBefore);
    });

    it('a forged userId in the query string does not widen the result set', async () => {
      const q = await h
        .http()
        .get(`/clients?userId=${alice.userId}`)
        .set(auth(bob.token));
      expect(JSON.stringify(q.body)).not.toContain('Alice');
    });

    it("another user cannot attach Alice's store to their invoice (cross-reference by body id)", async () => {
      const r = await h
        .http()
        .post('/invoices')
        .set(auth(bob.token))
        .send({
          type: 'invoice',
          invoiceNumber: 'X-1',
          storeId: aliceStoreId,
          clientId: aliceClientId,
          items: [],
          dueDate: new Date(Date.now() + 86400000).toISOString(),
        });
      expect(r.status).toBeGreaterThanOrEqual(400);
      const found = await rows(
        h,
        `select 1 from invoices where "userId" = $1 and ("storeId" = $2 or "clientId" = $3)`,
        [bob.userId, aliceStoreId, aliceClientId],
      );
      expect(found.length).toBe(0);
    });

    // The test above sends a store too, and the store check alone rejects it. Found by the
    // full-stack CI job: with only a client id, POST /invoices accepted another user's client.
    const oneLine = [
      {
        description: 'X',
        quantity: 1,
        unitPrice: 1,
        taxRate: 0,
        discountRate: 0,
      },
    ];
    const invoiceFor = (clientId: string) => ({
      clientId,
      type: 'invoice',
      issueDate: '2026-10-30',
      currency: 'USD',
      items: oneLine,
    });

    it("another user cannot attach Alice's client to their invoice (client id alone)", async () => {
      // Positive control: the same body is accepted for the client's owner.
      const own = await h
        .http()
        .post('/invoices')
        .set(auth(alice.token))
        .send(invoiceFor(aliceClientId));
      expect(own.status).toBe(201);

      const r = await h
        .http()
        .post('/invoices')
        .set(auth(bob.token))
        .send(invoiceFor(aliceClientId));
      expect(r.status).toBeGreaterThanOrEqual(400);
      expect(r.status).toBeLessThan(500);
      const leaked = await rows(
        h,
        `select 1 from invoices where "userId" = $1 and "clientId" = $2`,
        [bob.userId, aliceClientId],
      );
      expect(leaked).toHaveLength(0);
    });

    // Found in the final review: a draft skips the stock deduction (the only ownership check on
    // line items at create), and GET /invoices/:id joins the item, returning the owner's row.
    it("another user cannot put Alice's inventory item on their draft invoice", async () => {
      const withItem = (clientId: string) => ({
        ...invoiceFor(clientId),
        items: [{ ...oneLine[0], inventoryItemId: aliceItemId }],
      });
      // Positive control: Alice can reference her own item on a draft.
      const own = await h
        .http()
        .post('/invoices')
        .set(auth(alice.token))
        .send(withItem(aliceClientId));
      expect(own.status).toBe(201);

      const bobClient = await h
        .http()
        .post('/clients')
        .set(auth(bob.token))
        .send({ name: 'Bob Own Client', email: 'bob-own@access-test.invalid' });
      expect(bobClient.status).toBe(201);
      const r = await h
        .http()
        .post('/invoices')
        .set(auth(bob.token))
        .send(withItem(idOf(bobClient.body)));
      expect(r.status).toBe(400);
      expect(JSON.stringify(r.body)).not.toMatch(/Alice Item/);
      const leaked = await rows(
        h,
        `select 1 from invoice_items ii join invoices i on i.id = ii."invoiceId"
          where i."userId" = $1 and ii."inventoryItemId" = $2`,
        [bob.userId, aliceItemId],
      );
      expect(leaked).toHaveLength(0);
    });

    it("editing another user's invoice is a 404, not a server error, and changes nothing", async () => {
      const created = await h
        .http()
        .post('/invoices')
        .set(auth(alice.token))
        .send(invoiceFor(aliceClientId));
      expect(created.status).toBe(201);
      const id = idOf(created.body);

      const r = await h
        .http()
        .patch(`/invoices/${id}`)
        .set(auth(bob.token))
        .send({
          items: [{ ...oneLine[0], description: 'Hijack', unitPrice: 999 }],
        });
      expect(r.status).toBe(404);

      const after = await rows(h, `select total from invoices where id = $1`, [
        id,
      ]);
      expect(Number(after[0].total)).toBe(1);
    });
  });

  describe('users routes (per-user model: an account only ever sees and edits itself)', () => {
    it('GET /users returns only the caller (positive control) and no other account', async () => {
      const r = await h.http().get('/users').set(auth(bob.token));
      expect(r.status).toBe(200);
      expect(r.body).toHaveLength(1);
      expect(at(r.body, 0, 'id')).toBe(bob.userId);
      expect(JSON.stringify(r.body)).not.toContain('alice@access-test.invalid');
    });

    it('GET /users/:id works for your own id and is 404 for anyone elses (indistinguishable from missing)', async () => {
      expect(
        (await h.http().get(`/users/${bob.userId}`).set(auth(bob.token)))
          .status,
      ).toBe(200);
      const other = await h
        .http()
        .get(`/users/${alice.userId}`)
        .set(auth(bob.token));
      const missing = await h
        .http()
        .get(`/users/00000000-0000-4000-8000-000000000000`)
        .set(auth(bob.token));
      expect(other.status).toBe(404);
      expect(other.status).toBe(missing.status);
      expect(JSON.stringify(other.body)).not.toContain(
        'alice@access-test.invalid',
      );
    });

    it('cannot modify another account and the row is untouched', async () => {
      const r = await h
        .http()
        .patch(`/users/${alice.userId}`)
        .set(auth(bob.token))
        .send({ name: 'Hijacked' });
      expect(r.status).toBe(404);
      const row = await rows(h, 'select name from users where id = $1', [
        alice.userId,
      ]);
      expect(row[0].name).not.toBe('Hijacked');
    });

    it('can update own display name (positive control)', async () => {
      const r = await h
        .http()
        .patch(`/users/${bob.userId}`)
        .set(auth(bob.token))
        .send({ name: 'Bob Renamed' });
      expect(r.status).toBe(200);
      expect(at(r.body, 'name')).toBe('Bob Renamed');
    });

    it('cannot escalate privilege or change identity fields on their own account', async () => {
      const before = (
        await rows(
          h,
          'select email, role, "clerkUserId" from users where id = $1',
          [bob.userId],
        )
      )[0];
      for (const body of [
        { role: 'admin' },
        { email: 'evil@access-test.invalid' },
        { clerkUserId: 'user_alice_t' },
        { name: 'Bob', role: 'admin' },
      ]) {
        const r = await h
          .http()
          .patch(`/users/${bob.userId}`)
          .set(auth(bob.token))
          .send(body);
        expect(r.status).toBe(400); // unknown / privileged fields are rejected outright, not silently dropped
      }
      const after = (
        await rows(
          h,
          'select email, role, "clerkUserId" from users where id = $1',
          [bob.userId],
        )
      )[0];
      expect(after).toEqual(before);
    });

    it('cannot delete another account, and the endpoint no longer deletes own account either', async () => {
      const other = await h
        .http()
        .delete(`/users/${alice.userId}`)
        .set(auth(bob.token));
      expect(other.status).toBe(404);
      expect(
        (await rows(h, 'select 1 from users where id = $1', [alice.userId]))
          .length,
      ).toBe(1);
      const own = await h
        .http()
        .delete(`/users/${bob.userId}`)
        .set(auth(bob.token));
      expect(own.status).toBe(403);
      expect(
        (await rows(h, 'select 1 from users where id = $1', [bob.userId]))
          .length,
      ).toBe(1);
    });

    it('/auth/profile returns the caller (positive control)', async () => {
      const me = await h.http().get('/auth/profile').set(auth(bob.token));
      expect(me.status).toBe(200);
      expect(JSON.stringify(me.body)).toContain('bob@access-test.invalid');
    });
  });

  describe('store alerts and data export (the related read paths)', () => {
    it("another user's store id returns 404 for alerts, the same as a store that does not exist", async () => {
      const other = await h
        .http()
        .get(`/inventory/store-alerts/store/${aliceStoreId}`)
        .set(auth(bob.token));
      const missing = await h
        .http()
        .get(
          '/inventory/store-alerts/store/00000000-0000-4000-8000-000000000000',
        )
        .set(auth(bob.token));
      expect(other.status).toBe(404);
      expect(missing.status).toBe(404);
      const own = await h
        .http()
        .get(`/inventory/store-alerts/store/${aliceStoreId}`)
        .set(auth(alice.token));
      expect(own.status).toBe(200); // positive control
    });

    it("a data export contains only the requesting user's records", async () => {
      const own = await h
        .http()
        .post('/user-settings/backup/export')
        .set(auth(alice.token))
        .send({});
      expect(own.status).toBeLessThan(400);
      expect(JSON.stringify(own.body) + (own.text ?? '')).toContain(
        'Alice Client',
      ); // positive control
      const other = await h
        .http()
        .post('/user-settings/backup/export')
        .set(auth(bob.token))
        .send({});
      expect(other.status).toBeLessThan(400);
      const blob = JSON.stringify(other.body) + (other.text ?? '');
      expect(blob).not.toContain('Alice Client');
      expect(blob).not.toContain('Alice Store');
      expect(blob).not.toContain('Alice Item');
      expect(blob).not.toContain('alice@access-test.invalid');
    });
  });

  describe('organizations and memberships (a working membership system, authorised server-side)', () => {
    let aliceOrgId: string;
    let carol: { clerkId: string; token: string; userId: string };
    beforeAll(async () => {
      const orgs = await h.http().get('/organizations').set(auth(alice.token));
      aliceOrgId = text(
        at(at(orgs.body, 0) ?? maybe(at(orgs.body, 'data'), 0), 'id'),
        'organization id',
      );
      carol = await provisionSubscribedUser(
        h,
        'user_carol_t',
        'carol@access-test.invalid',
      );
      // Alice adds Carol, then removes her: Carol's membership row is now inactive.
      await h
        .http()
        .post(`/organizations/${aliceOrgId}/users`)
        .set(auth(alice.token))
        .send({ userId: carol.userId, role: 'staff' });
      await h
        .http()
        .delete(`/organizations/${aliceOrgId}/users/${carol.userId}`)
        .set(auth(alice.token));
    });
    beforeEach(async () => {
      // Reset Carol to "removed" so an earlier test (or a regression) cannot leak state into the next.
      await h.ds.query(
        'update user_organizations set "isActive"=false, role=$3 where "organizationId"=$1 and "userId"=$2',
        [aliceOrgId, carol.userId, 'staff'],
      );
      await h.ds.query(
        'delete from user_organizations where "organizationId"=$1 and "userId"=$2',
        [aliceOrgId, bob.userId],
      );
    });
    const membership = async (
      orgId: string,
      userId: string,
    ): Promise<Record<string, unknown> | undefined> =>
      (
        await rows(
          h,
          'select role, "isActive" from user_organizations where "organizationId"=$1 and "userId"=$2',
          [orgId, userId],
        )
      )[0];

    it("precondition: Carol was removed from Alice's organization and is inactive", async () => {
      expect(await membership(aliceOrgId, carol.userId)).toMatchObject({
        isActive: false,
      });
    });

    it('a non-member cannot list, read or modify the organization', async () => {
      expect([403, 404]).toContain(
        (
          await h
            .http()
            .get(`/organizations/${aliceOrgId}`)
            .set(auth(bob.token))
        ).status,
      );
      expect([403, 404]).toContain(
        (
          await h
            .http()
            .get(`/organizations/${aliceOrgId}/users`)
            .set(auth(bob.token))
        ).status,
      );
      expect([403, 404]).toContain(
        (
          await h
            .http()
            .patch(`/organizations/${aliceOrgId}`)
            .set(auth(bob.token))
            .send({ name: 'Hijacked' })
        ).status,
      );
      const del = await h
        .http()
        .delete(`/organizations/${aliceOrgId}`)
        .set(auth(bob.token));
      expect(del.status).toBeGreaterThanOrEqual(400);
      expect(del.status).toBeLessThan(500);
      expect(
        (await rows(h, 'select 1 from organizations where id=$1', [aliceOrgId]))
          .length,
      ).toBe(1);
      const orgs = await h.http().get('/organizations').set(auth(bob.token));
      expect(JSON.stringify(orgs.body)).not.toContain(aliceOrgId);
    });

    it('regression: a non-member cannot reactivate a removed member into someone elses organization', async () => {
      const r = await h
        .http()
        .post(`/organizations/${aliceOrgId}/users`)
        .set(auth(bob.token))
        .send({ userId: carol.userId, role: 'owner' });
      expect(r.status).toBeGreaterThanOrEqual(400);
      expect(await membership(aliceOrgId, carol.userId)).toMatchObject({
        isActive: false,
      });
    });

    it('a non-member cannot add anyone, including themselves, to the organization', async () => {
      const r = await h
        .http()
        .post(`/organizations/${aliceOrgId}/users`)
        .set(auth(bob.token))
        .send({ userId: bob.userId, role: 'owner' });
      expect(r.status).toBeGreaterThanOrEqual(400);
      expect(await membership(aliceOrgId, bob.userId)).toBeUndefined();
    });

    it('an ADMIN cannot grant the owner role or demote an owner (only an owner can)', async () => {
      const ownerId = alice.userId;
      // make Carol an active ADMIN of Alice's organization
      await h
        .http()
        .post(`/organizations/${aliceOrgId}/users`)
        .set(auth(alice.token))
        .send({ userId: carol.userId, role: 'admin' });
      expect(await membership(aliceOrgId, carol.userId)).toMatchObject({
        isActive: true,
        role: 'admin',
      });
      const self = await h
        .http()
        .patch(`/organizations/${aliceOrgId}/users/${carol.userId}/role`)
        .set(auth(carol.token))
        .send({ role: 'owner' });
      expect(self.status).toBe(403);
      const demote = await h
        .http()
        .patch(`/organizations/${aliceOrgId}/users/${ownerId}/role`)
        .set(auth(carol.token))
        .send({ role: 'staff' });
      expect(demote.status).toBe(403);
      const grant = await h
        .http()
        .post(`/organizations/${aliceOrgId}/users`)
        .set(auth(carol.token))
        .send({ userId: bob.userId, role: 'owner' });
      expect(grant.status).toBe(403);
      expect(await membership(aliceOrgId, carol.userId)).toMatchObject({
        role: 'admin',
      });
      expect(await membership(aliceOrgId, ownerId)).toMatchObject({
        role: 'owner',
      });
      expect(await membership(aliceOrgId, bob.userId)).toBeUndefined();
    });

    it('an ADMIN cannot remove an owner, including the sole owner (only an owner can)', async () => {
      await h
        .http()
        .post(`/organizations/${aliceOrgId}/users`)
        .set(auth(alice.token))
        .send({ userId: carol.userId, role: 'admin' });
      expect(await membership(aliceOrgId, carol.userId)).toMatchObject({
        isActive: true,
        role: 'admin',
      });
      const r = await h
        .http()
        .delete(`/organizations/${aliceOrgId}/users/${alice.userId}`)
        .set(auth(carol.token));
      expect(r.status).toBe(403);
      expect(await membership(aliceOrgId, alice.userId)).toMatchObject({
        isActive: true,
        role: 'owner',
      });
      // positive control: the owner can remove the admin
      const ok = await h
        .http()
        .delete(`/organizations/${aliceOrgId}/users/${carol.userId}`)
        .set(auth(alice.token));
      expect(ok.status).toBeLessThan(300);
      expect(await membership(aliceOrgId, carol.userId)).toMatchObject({
        isActive: false,
      });
    });

    it('the sole owner cannot be removed, not even by themselves', async () => {
      const r = await h
        .http()
        .delete(`/organizations/${aliceOrgId}/users/${alice.userId}`)
        .set(auth(alice.token));
      expect(r.status).toBe(400);
      expect(await membership(aliceOrgId, alice.userId)).toMatchObject({
        isActive: true,
      });
    });

    it('the member list shows each member only as id, name and email', async () => {
      await h.ds.query(
        `update users set phone = '555-0100', bio = 'private bio text' where id = $1`,
        [alice.userId],
      );
      const r = await h
        .http()
        .get(`/organizations/${aliceOrgId}/users`)
        .set(auth(alice.token));
      expect(r.status).toBe(200);
      const body = JSON.stringify(r.body);
      expect(body).toContain('alice@access-test.invalid'); // positive control: the member is listed
      for (const forbidden of ['555-0100', 'private bio text', 'clerkUserId']) {
        expect(body).not.toContain(forbidden);
      }
      for (const m of list(r.body)) {
        expect(Object.keys(at(m, 'user') ?? {}).sort()).toEqual([
          'email',
          'id',
          'name',
        ]);
      }
    });

    it('a non-member cannot change a member role or remove a member', async () => {
      const r1 = await h
        .http()
        .patch(`/organizations/${aliceOrgId}/users/${alice.userId}/role`)
        .set(auth(bob.token))
        .send({ role: 'staff' });
      expect(r1.status).toBeGreaterThanOrEqual(400);
      const r2 = await h
        .http()
        .delete(`/organizations/${aliceOrgId}/users/${alice.userId}`)
        .set(auth(bob.token));
      expect(r2.status).toBeGreaterThanOrEqual(400);
      expect(await membership(aliceOrgId, alice.userId)).toMatchObject({
        role: 'owner',
        isActive: true,
      });
    });

    it('the legitimate owner can still reactivate a removed member (positive control)', async () => {
      const r = await h
        .http()
        .post(`/organizations/${aliceOrgId}/users`)
        .set(auth(alice.token))
        .send({ userId: carol.userId, role: 'staff' });
      expect([200, 201]).toContain(r.status);
      expect(await membership(aliceOrgId, carol.userId)).toMatchObject({
        isActive: true,
        role: 'staff',
      });
    });
  });

  describe('file storage keys', () => {
    // The real S3 client is replaced by an in-memory one so these tests exercise the ownership
    // decision instead of passing because storage is unconfigured (which a first draft did).
    let storage: StorageService;
    const objects = new Map<string, Buffer>();
    // bucketName and s3Client are private; the test replaces them on the live instance.
    const setPrivate = (key: 'bucketName' | 's3Client', value: unknown) =>
      Reflect.set(storage, key, value);
    // An upload as multer hands it over; uploadFile reads originalname, buffer, mimetype, size.
    const upload = (originalname: string): Express.Multer.File => ({
      fieldname: 'file',
      originalname,
      encoding: '7bit',
      mimetype: 'image/png',
      size: 1,
      buffer: Buffer.from('x'),
      stream: Readable.from([]),
      destination: '',
      filename: '',
      path: '',
    });
    beforeAll(() => {
      storage = h.app.get(StorageService);
      setPrivate('bucketName', 'test-bucket');
      setPrivate('s3Client', { send: jest.fn(() => Promise.resolve({})) });
      jest
        .spyOn(storage, 'getSignedUrl')
        .mockImplementation((k: string) =>
          Promise.resolve(`https://signed.test/${k}`),
        );
      jest
        .spyOn(storage, 'deleteFile')
        .mockImplementation((k: string) =>
          Promise.resolve(void objects.delete(k)),
        );
      jest.spyOn(storage, 'getFileMetadata').mockImplementation((k: string) =>
        Promise.resolve({
          key: k,
          url: 'u',
          size: 1,
          contentType: 'x',
          uploadedAt: new Date(0),
        }),
      );
      objects.set(`uploads/${alice.userId}/a.png`, Buffer.from('a'));
    });
    const enc = (k: string) => encodeURIComponent(k);
    it('owner can fetch a signed URL, metadata and delete under their own prefix (positive control)', async () => {
      const k = `uploads/${bob.userId}/mine.png`;
      expect(
        (
          await h
            .http()
            .get(`/storage/url/${enc(k)}`)
            .set(auth(bob.token))
        ).status,
      ).toBe(200);
      expect(
        (
          await h
            .http()
            .get(`/storage/metadata/${enc(k)}`)
            .set(auth(bob.token))
        ).status,
      ).toBe(200);
      expect(
        (
          await h
            .http()
            .delete(`/storage/${enc(k)}`)
            .set(auth(bob.token))
        ).status,
      ).toBe(200);
    });
    it('rejects traversal and malformed keys even under the caller prefix', async () => {
      for (const k of [
        `uploads/${bob.userId}/../${alice.userId}/a.png`,
        `uploads/${bob.userId}/x/y.png`,
        `${bob.userId}`,
        `uploads//a.png`,
      ]) {
        const r = await h
          .http()
          .get(`/storage/url/${enc(k)}`)
          .set(auth(bob.token));
        expect(r.status).toBe(404);
      }
    });
    it('a caller-supplied folder cannot write into another user prefix (service-level)', async () => {
      // NOTE: multipart upload through HTTP is currently rejected by ContentNegotiationInterceptor
      // ("Content-Type must be application/json"), so the decision is exercised on the service,
      // which is where the key is built.
      const sent: unknown[] = [];
      setPrivate('s3Client', {
        send: jest.fn((c: { input: unknown }) => {
          sent.push(c.input);
          return Promise.resolve({});
        }),
      });
      for (const folder of [
        `uploads/${alice.userId}/x`,
        '../../etc',
        'a/b',
        '',
        undefined,
        '%2e%2e',
      ]) {
        const meta = await storage.uploadFile({
          file: upload('evil.PnG'),
          folder,
          userId: bob.userId,
        });
        const parts = meta.key.split('/');
        expect(parts).toHaveLength(3);
        expect(parts[1]).toBe(bob.userId);
        expect(meta.key).not.toContain(alice.userId);
        expect(meta.key).not.toContain('..');
        expect(parts[2]).toMatch(/^[0-9a-f-]{36}\.png$/);
      }
      expect(sent.length).toBe(6);
    });

    it('refuses an upload with no authenticated owner', async () => {
      await expect(
        storage.uploadFile({
          file: upload('a.png'),
          folder: 'uploads',
          userId: undefined,
        }),
      ).rejects.toThrow(/Authenticated user required/);
    });

    it("regression: a user cannot request a signed URL for a key under another user's prefix", async () => {
      const r = await h
        .http()
        .get(`/storage/url/${enc(`uploads/${alice.userId}/a.png`)}`)
        .set(auth(bob.token));
      expect(r.status).toBe(404);
      expect(JSON.stringify(r.body)).not.toContain('signed.test');
    });

    it("regression: a user cannot delete a key under another user's prefix", async () => {
      const r = await h
        .http()
        .delete(`/storage/${enc(`uploads/${alice.userId}/a.png`)}`)
        .set(auth(bob.token));
      expect(r.status).toBe(404);
      expect(objects.has(`uploads/${alice.userId}/a.png`)).toBe(true);
    });

    it("regression: a user cannot read metadata for a key under another user's prefix", async () => {
      const r = await h
        .http()
        .get(`/storage/metadata/${enc(`uploads/${alice.userId}/a.png`)}`)
        .set(auth(bob.token));
      expect(r.status).toBe(404);
    });
  });

  describe('subscriptions', () => {
    it('a user without an active subscription is denied business routes', async () => {
      addClerkUser('user_nosub_t', 'nosub@access-test.invalid');
      const t = signedToken('user_nosub_t');
      const r = await h.http().get('/clients').set(auth(t));
      expect(r.status).toBe(403);
    });
  });

  it('uses a signing secret that only the test harness knows', () => {
    expect(TEST_CLERK_SIGNING_SECRET).toContain('test-only');
  });
});
