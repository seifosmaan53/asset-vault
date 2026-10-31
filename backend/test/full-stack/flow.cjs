#!/usr/bin/env node
// Copyright (c) 2025 Asset Vault. All rights reserved.
//
// Full-stack check, step 3 of 3: drives the RUNNING API over HTTP the way the web app does.
//
//   API_URL=http://localhost:3000/api/v1 FRONTEND_ORIGIN=http://localhost:8080 \
//   DB_HOST=... DB_PORT=... DB_USERNAME=... DB_PASSWORD=... DB_DATABASE=... \
//   node test/full-stack/flow.cjs <dir written by prepare.cjs>
//
// Real: the API process (production build, NODE_ENV=production), PostgreSQL migrated by the
// repository's migrations, every guard, and @clerk/backend verifyToken() checking RS256 tokens
// against CLERK_JWT_KEY. Stand-in: Clerk's users.getUser() (clerk-users-stub.cjs).
// Database access is used only to give the synthetic users an active subscription (there is no
// payment provider here) and to delete them afterwards. NEVER point this at a real database.

'use strict';

const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const jwt = require('jsonwebtoken');
const { Client } = require('pg');

const dir = process.argv[2];
const API = (process.env.API_URL || 'http://localhost:3000/api/v1').replace(/\/$/, '');
const ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:8080';
const EMAIL_DOMAIN = '@full-stack.invalid';
if (!dir) {
  console.error('usage: flow.cjs <dir>');
  process.exit(2);
}
if (/asset_vault_demo|invoiceme$/.test(process.env.DB_DATABASE || '')) {
  console.error(`refusing to run against ${process.env.DB_DATABASE}`);
  process.exit(2);
}

const privateKey = readFileSync(join(dir, 'jwt-private.pem'), 'utf8');
const attackerKey = readFileSync(join(dir, 'attacker-private.pem'), 'utf8');

let failures = 0;
let checks = 0;
function check(name, ok, detail) {
  checks++;
  if (ok) console.log(`  ok   ${name}`);
  else {
    failures++;
    console.log(`  FAIL ${name}${detail === undefined ? '' : ` -> ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`}`);
  }
}

const now = () => Math.floor(Date.now() / 1000);
// Claims of a Clerk session token, signed RS256 like Clerk's (kid is not needed with CLERK_JWT_KEY).
function token(sub, { key = privateKey, exp = now() + 600 } = {}) {
  return jwt.sign(
    { sub, sid: `sess_${sub}`, iss: 'https://full-stack.clerk.invalid', iat: now() - 5, nbf: now() - 5, exp },
    key,
    { algorithm: 'RS256', keyid: 'ins_full_stack' },
  );
}

async function call(method, path, { auth, body, headers = {} } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    redirect: 'manual',
    headers: {
      // The API runs with NODE_ENV=production, which redirects plain HTTP to HTTPS unless a
      // TLS-terminating proxy says the original request was HTTPS. That is what this header is.
      'X-Forwarded-Proto': 'https',
      Origin: ORIGIN,
      ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : undefined;
  } catch {
    json = text;
  }
  return { status: res.status, headers: res.headers, body: json };
}
const data = (r) => (r.body && typeof r.body === 'object' && 'data' in r.body && r.body.data ? r.body.data : r.body);
const money = (v) => Number(v).toFixed(2);

async function main() {
  const db = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
  });
  await db.connect();
  try {
    await cleanup(db);
    await run(db);
  } finally {
    await cleanup(db);
    await db.end();
  }
  console.log(`${checks} checks, ${failures} failure(s)`);
  process.exit(failures ? 1 : 0);
}

async function provision(db, clerkId) {
  const t = token(clerkId);
  // The first authenticated request creates the user row (guard: find-or-create from Clerk's user).
  const first = await call('GET', '/subscriptions/current', { auth: t });
  check(`${clerkId}: first authenticated request is accepted`, first.status === 200, first);
  const { rows } = await db.query('select id from users where "clerkUserId" = $1', [clerkId]);
  check(`${clerkId}: user row created from the Clerk user`, rows.length === 1, rows);
  const plan = (await db.query(`select id from plans where name = 'Pro' limit 1`)).rows[0];
  await db.query(
    `insert into subscriptions ("userId","planId",status,"currentPeriodStart","currentPeriodEnd","createdAt","updatedAt")
     values ($1,$2,'active', now(), now() + interval '30 days', now(), now())
     on conflict ("userId") do update set status = 'active'`,
    [rows[0].id, plan.id],
  );
  return t;
}

async function run(db) {
  console.log(`API ${API}, browser origin ${ORIGIN}`);

  console.log('-- service and transport');
  const health = await call('GET', '/health');
  check('GET /health answers 200 (public)', health.status === 200, health);
  const plain = await fetch(`${API}/health`, { redirect: 'manual' });
  check('plain HTTP is redirected to HTTPS in production', plain.status === 301, plain.status);
  const preflight = await fetch(`${API}/invoices`, {
    method: 'OPTIONS',
    headers: {
      Origin: ORIGIN,
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'authorization,content-type',
      'X-Forwarded-Proto': 'https',
    },
  });
  check(
    'CORS preflight from the frontend origin is allowed',
    preflight.status === 204 && preflight.headers.get('access-control-allow-origin') === ORIGIN,
    { status: preflight.status, allow: preflight.headers.get('access-control-allow-origin') },
  );
  const foreign = await fetch(`${API}/invoices`, {
    method: 'OPTIONS',
    headers: { Origin: 'https://evil.example', 'Access-Control-Request-Method': 'GET', 'X-Forwarded-Proto': 'https' },
  });
  check(
    'CORS preflight from another origin gets no allow-origin',
    foreign.headers.get('access-control-allow-origin') === null,
    { status: foreign.status, allow: foreign.headers.get('access-control-allow-origin') },
  );

  console.log('-- authentication (real @clerk/backend verifyToken, RS256 via CLERK_JWT_KEY)');
  const owner = await provision(db, 'user_fullstack_owner');
  const other = await provision(db, 'user_fullstack_other');
  const r401 = (r) => r.status === 401;
  check('no token -> 401', r401(await call('GET', '/invoices')));
  check('token signed with another key -> 401', r401(await call('GET', '/invoices', { auth: token('user_fullstack_owner', { key: attackerKey }) })));
  check('expired token -> 401', r401(await call('GET', '/invoices', { auth: token('user_fullstack_owner', { exp: now() - 120 }) })));
  check('HS256 token with the public key as secret (alg confusion) -> 401', r401(await call('GET', '/invoices', {
    auth: jwt.sign({ sub: 'user_fullstack_owner', exp: now() + 600 }, 'not-the-key', { algorithm: 'HS256' }),
  })));
  check('valid signature, user unknown to Clerk -> 401', r401(await call('GET', '/invoices', { auth: token('user_fullstack_ghost') })));
  check('valid signature, user banned in Clerk -> 401', r401(await call('GET', '/invoices', { auth: token('user_fullstack_banned') })));

  console.log('-- invoice create / read / edit with totals');
  const client = await call('POST', '/clients', {
    auth: owner,
    body: { name: 'Full Stack Client', email: `client${EMAIL_DOMAIN}` },
  });
  check('create client -> 201', client.status === 201, client);
  const clientId = data(client).id;

  // 3 x 19.99 at 8.875% tax = 59.97 + 5.32 (5.322375 rounds to the cent);
  // 1 x 100.00 less 10% = 90.00, no tax. Subtotal 159.97, discount 10.00, tax 5.32, total 155.29.
  const created = await call('POST', '/invoices', {
    auth: owner,
    body: {
      clientId,
      type: 'invoice',
      issueDate: '2026-10-30',
      currency: 'USD',
      items: [
        { description: 'Widget', quantity: 3, unitPrice: 19.99, taxRate: 8.875, discountRate: 0 },
        { description: 'Service', quantity: 1, unitPrice: 100, taxRate: 0, discountRate: 10 },
      ],
    },
  });
  check('create invoice -> 201', created.status === 201, created);
  const id = data(created).id;

  const read1 = data(await call('GET', `/invoices/${id}`, { auth: owner }));
  const totals = (inv) => inv && [inv.subtotal, inv.discountTotal, inv.taxTotal, inv.total].map(money).join(' ');
  check('read back: subtotal discount tax total = 159.97 10.00 5.32 155.29', totals(read1) === '159.97 10.00 5.32 155.29', totals(read1));
  check('read back: two lines, client attached', read1?.items?.length === 2 && (read1.clientId ?? read1.client?.id) === clientId, read1?.items?.length);
  check('read back: four-decimal tax rate kept', read1?.items?.some((i) => String(i.taxRate) === '8.8750'), read1?.items?.map((i) => i.taxRate));

  // Edit: 4 widgets instead of 3. 79.96 + 7.10 (7.09645); subtotal 179.96, total 177.06.
  const edited = await call('PATCH', `/invoices/${id}`, {
    auth: owner,
    body: {
      items: [
        { description: 'Widget', quantity: 4, unitPrice: 19.99, taxRate: 8.875, discountRate: 0 },
        { description: 'Service', quantity: 1, unitPrice: 100, taxRate: 0, discountRate: 10 },
      ],
    },
  });
  check('edit invoice -> 200', edited.status === 200, edited);
  const read2 = data(await call('GET', `/invoices/${id}`, { auth: owner }));
  check('after edit: 179.96 10.00 7.10 177.06', totals(read2) === '179.96 10.00 7.10 177.06', totals(read2));
  const stored = (await db.query('select subtotal, "discountTotal", "taxTotal", total from invoices where id = $1', [id])).rows[0];
  check('database row holds the same totals', stored && [stored.subtotal, stored.discountTotal, stored.taxTotal, stored.total].map(money).join(' ') === '179.96 10.00 7.10 177.06', stored);

  const rejected = await call('POST', '/invoices', {
    auth: owner,
    body: { clientId, type: 'invoice', issueDate: '2026-10-30', currency: 'USD', items: [{ description: 'Bad', quantity: 2.5, unitPrice: 10, taxRate: 0, discountRate: 0 }] },
  });
  check('a fractional quantity is rejected with 400', rejected.status === 400, rejected);

  console.log('-- ownership (a second synthetic user)');
  const peek = await call('GET', `/invoices/${id}`, { auth: other });
  check("other user cannot read the owner's invoice (403/404)", [403, 404].includes(peek.status), peek.status);
  const tamper = await call('PATCH', `/invoices/${id}`, {
    auth: other,
    body: { items: [{ description: 'Hijack', quantity: 1, unitPrice: 1, taxRate: 0, discountRate: 0 }] },
  });
  check("other user cannot edit the owner's invoice (403/404)", [403, 404].includes(tamper.status), tamper.status);
  const list = data(await call('GET', '/invoices', { auth: other }));
  const items = Array.isArray(list) ? list : list?.items ?? list?.invoices ?? [];
  check("other user's invoice list does not contain it", Array.isArray(items) && !items.some((i) => i.id === id), list);
  const borrow = await call('POST', '/invoices', {
    auth: other,
    body: { clientId, type: 'invoice', issueDate: '2026-10-30', currency: 'USD', items: [{ description: 'X', quantity: 1, unitPrice: 1, taxRate: 0, discountRate: 0 }] },
  });
  check("other user cannot invoice the owner's client", borrow.status >= 400 && borrow.status < 500, borrow.status);
  const unchanged = data(await call('GET', `/invoices/${id}`, { auth: owner }));
  check('owner invoice unchanged after the attempts', totals(unchanged) === '179.96 10.00 7.10 177.06', totals(unchanged));
}

async function cleanup(db) {
  const ids = (await db.query(`select id from users where email like $1`, [`%${EMAIL_DOMAIN}`])).rows.map((r) => r.id);
  if (!ids.length) return;
  await db.query(`delete from invoice_items where "invoiceId" in (select id from invoices where "userId" = any($1))`, [ids]);
  for (const t of ['invoices', 'clients', 'user_settings', 'subscriptions', 'usage', 'user_organizations']) {
    await db.query(`delete from ${t} where "userId" = any($1)`, [ids]).catch(() => undefined);
  }
  await db.query(`delete from users where id = any($1)`, [ids]);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
