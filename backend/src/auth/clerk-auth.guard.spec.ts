/**
 * ClerkAuthGuard against the REAL @clerk/backend verifyToken().
 *
 * Why this file exists: the database suite (test/access-control.db.spec.ts) replaces verifyToken with
 * an HMAC stand-in so it can run thousands of requests without a Clerk account. That suite therefore
 * proves the application's authorization rules, but NOT that the production SDK, configured the way
 * the guard configures it, rejects forged tokens. This spec covers that gap.
 *
 * Nothing here touches Clerk: tokens are signed with an RSA key pair generated in the test, the
 * public key is supplied through CLERK_JWT_KEY (the SDK's documented networkless mode), and the one
 * test of the JWKS (no CLERK_JWT_KEY) path intercepts the HTTP request, so no paid or production
 * call is possible. The Clerk user lookup (users.getUser) is replaced by a spy, because it IS a
 * network call; every test asserts whether it was reached.
 *
 * Mocked: Clerk's users.getUser, the users/organizations services. Real: verifyToken, the guard.
 */
import { createHmac, createPublicKey, generateKeyPairSync } from 'crypto';
import { type ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import * as jwt from 'jsonwebtoken';
import { ClerkAuthGuard } from './clerk-auth.guard';

const SECRET_KEY = 'sk_test_unit_not_a_real_key';
const KID = 'ins_unit_test_kid';

const pair = () =>
  generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
const good = pair();
const attacker = pair();

const b64u = (v: string | Buffer) => Buffer.from(v).toString('base64url');
const now = () => Math.floor(Date.now() / 1000);
const claims = (over: Record<string, unknown> = {}) => ({
  sub: 'user_real',
  sid: 'sess_1',
  iss: 'https://clerk.unit.test',
  iat: now() - 5,
  nbf: now() - 5,
  exp: now() + 600,
  ...over,
});
const rs256 = (key: string, over: Record<string, unknown> = {}) =>
  jwt.sign(claims(over), key, { algorithm: 'RS256', keyid: KID });

function makeGuard(env: Record<string, string | undefined>) {
  const getUser = jest.fn().mockResolvedValue({
    id: 'user_real',
    banned: false,
    emailAddresses: [{ id: 'e1', emailAddress: 'real@unit.test' }],
    primaryEmailAddressId: 'e1',
    firstName: 'Real',
    lastName: 'User',
  });
  const users = {
    findByClerkId: jest.fn().mockResolvedValue({
      id: 'db-user-1',
      email: 'real@unit.test',
      role: 'owner',
    }),
  };
  const orgs = {
    findAll: jest.fn().mockResolvedValue([{ id: 'org-1' }]),
    create: jest.fn(),
  };
  const config = { get: (k: string) => env[k] };
  const guard = new ClerkAuthGuard(
    new Reflector(),
    users as never,
    orgs as never,
    config as never,
  );
  (guard as unknown as { clerkClient: unknown }).clerkClient = {
    users: { getUser },
  };
  return { guard, getUser };
}

function ctx(token?: string) {
  const req: Record<string, unknown> = {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  };
  const context = {
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
  return { context, req };
}

describe('ClerkAuthGuard with the real Clerk SDK (networkless, CLERK_JWT_KEY)', () => {
  const env = { CLERK_SECRET_KEY: SECRET_KEY, CLERK_JWT_KEY: good.publicKey };

  it('accepts a token signed by the configured key and attaches the database user', async () => {
    const { guard, getUser } = makeGuard(env);
    const { context, req } = ctx(rs256(good.privateKey));
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(getUser).toHaveBeenCalledWith('user_real');
    expect(req.user).toMatchObject({ userId: 'db-user-1' });
  });

  const forged: Array<[string, () => string]> = [
    [
      'a token signed by a different RSA key (same kid, same subject)',
      () => rs256(attacker.privateKey),
    ],
    [
      'an HS256 token using the PUBLIC key as the HMAC secret (algorithm confusion)',
      () => {
        const head = b64u(
          JSON.stringify({ alg: 'HS256', typ: 'JWT', kid: KID }),
        );
        const body = b64u(JSON.stringify(claims()));
        const sig = createHmac('sha256', good.publicKey)
          .update(`${head}.${body}`)
          .digest('base64url');
        return `${head}.${body}.${sig}`;
      },
    ],
    [
      'an unsigned token with alg "none"',
      () =>
        `${b64u(JSON.stringify({ alg: 'none', typ: 'JWT' }))}.${b64u(JSON.stringify(claims()))}.`,
    ],
    [
      'an expired token with a valid signature',
      () => rs256(good.privateKey, { exp: now() - 60 }),
    ],
    [
      'a token that is not valid yet (nbf in the future)',
      () => rs256(good.privateKey, { nbf: now() + 3600 }),
    ],
    [
      'a valid token whose payload was swapped for another subject',
      () => {
        const [head, , sig] = rs256(good.privateKey).split('.');
        return `${head}.${b64u(JSON.stringify(claims({ sub: 'user_victim' })))}.${sig}`;
      },
    ],
    [
      'a correctly signed token with no subject',
      () => rs256(good.privateKey, { sub: undefined }),
    ],
    ['garbage', () => 'not.a.jwt'],
  ];

  it.each(forged)(
    'rejects %s and never reaches the Clerk user lookup',
    async (_name, make) => {
      const { guard, getUser } = makeGuard(env);
      const { context, req } = ctx(make());
      await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(getUser).not.toHaveBeenCalled();
      expect(req.user).toBeUndefined();
    },
  );

  it('rejects a request with no Authorization header', async () => {
    const { guard, getUser } = makeGuard(env);
    await expect(guard.canActivate(ctx().context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(getUser).not.toHaveBeenCalled();
  });
});

describe('ClerkAuthGuard with the real Clerk SDK (default production path: JWKS lookup, no CLERK_JWT_KEY)', () => {
  const jwk = {
    ...(good.publicKey &&
      (createPublicKey(good.publicKey).export({ format: 'jwk' }) as object)),
    kid: KID,
    alg: 'RS256',
    use: 'sig',
  };
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    fetchSpy = jest.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ keys: [jwk] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );
  });
  afterEach(() => fetchSpy.mockRestore());

  /** The SDK captures fetch when it is first imported, so load a fresh copy AFTER installing the spy. */
  function freshGuard() {
    let Guard!: typeof ClerkAuthGuard;
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- isolateModules needs a fresh require of the guard
      const mod = require('./clerk-auth.guard') as {
        ClerkAuthGuard: typeof ClerkAuthGuard;
      };
      Guard = mod.ClerkAuthGuard;
    });
    const getUser = jest.fn().mockResolvedValue({
      id: 'user_real',
      banned: false,
      emailAddresses: [{ id: 'e1', emailAddress: 'real@unit.test' }],
      primaryEmailAddressId: 'e1',
    });
    const users = {
      findByClerkId: jest.fn().mockResolvedValue({
        id: 'db-user-1',
        email: 'real@unit.test',
        role: 'owner',
      }),
    };
    const orgs = {
      findAll: jest.fn().mockResolvedValue([{ id: 'org-1' }]),
      create: jest.fn(),
    };
    const config = {
      get: (k: string) => ({ CLERK_SECRET_KEY: SECRET_KEY })[k],
    };
    const guard = new Guard(
      new Reflector(),
      users as never,
      orgs as never,
      config as never,
    );
    (guard as unknown as { clerkClient: unknown }).clerkClient = {
      users: { getUser },
    };
    return { guard, getUser };
  }

  it('asks Clerk for the JWKS with the secret key, then accepts a correctly signed token', async () => {
    const { guard } = freshGuard();
    await expect(
      guard.canActivate(ctx(rs256(good.privateKey)).context),
    ).resolves.toBe(true);
    expect(fetchSpy).toHaveBeenCalled();
    const [url, init] = fetchSpy.mock.calls[0] as [
      string | URL,
      RequestInit | undefined,
    ];
    expect(new URL(String(url)).host).toBe('api.clerk.com');
    expect(String(url)).toContain('/jwks');
    expect(new Headers(init?.headers).get('authorization')).toBe(
      `Bearer ${SECRET_KEY}`,
    );
  });

  it('rejects a token with the right kid but a signature from another key', async () => {
    const { guard, getUser } = freshGuard();
    await expect(
      guard.canActivate(ctx(rs256(attacker.privateKey)).context),
    ).rejects.toMatchObject({
      status: 401, // not instanceof: isolateModules loads a second copy of @nestjs/common
    });
    expect(getUser).not.toHaveBeenCalled();
  });

  it('fails closed when the JWKS cannot be fetched', async () => {
    fetchSpy.mockImplementation(() =>
      Promise.reject(new Error('network down')),
    );
    const { guard, getUser } = freshGuard();
    await expect(
      guard.canActivate(ctx(rs256(good.privateKey)).context),
    ).rejects.toMatchObject({
      status: 401, // not instanceof: isolateModules loads a second copy of @nestjs/common
    });
    expect(getUser).not.toHaveBeenCalled();
  });
});
