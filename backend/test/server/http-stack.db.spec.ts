/**
 * The production HTTP stack (src/server/configure-app.ts: HTTPS enforcement, trusted proxies,
 * CORS, then every guard and route) on the REAL application module and a REAL PostgreSQL migrated
 * with the repository's migrations. /api/v1/health queries the database, so a 200 here is the
 * full path. Requests come from supertest over loopback; "trusted proxy" below means
 * TRUST_PROXY=loopback.
 *
 * Stubbed: the ESM-only tRPC module (cannot load under ts-jest; unused by the UI) and Puppeteer
 * (no Chrome in CI). Clerk is not called: every request here is refused before authentication or
 * is to the public health route. Needs DB_* and CLERK_SECRET_KEY like the access-control suite.
 */
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import request from 'supertest';
import type * as NestCommon from '@nestjs/common';
// ts-jest hoists the jest.mock() calls below above these imports.
import { AppModule } from '../../src/app.module';
import { PuppeteerService } from '../../src/common/services/puppeteer.service';
import { configureHttpApp } from '../../src/server/configure-app';
import {
  loadServerSettings,
  type ServerSettings,
} from '../../src/server/server-settings';

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

const FRONTEND = 'https://app.example.com';
const EVIL = 'https://evil.example';

async function boot(env: Record<string, string>) {
  const mod = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PuppeteerService)
    .useValue({
      onModuleInit: () => undefined,
      onModuleDestroy: () => undefined,
    })
    .compile();
  const app = mod.createNestApplication<NestExpressApplication>({
    logger: ['error'],
  });
  const settings: ServerSettings = loadServerSettings((key) => env[key]);
  configureHttpApp(app, settings, app.get(ConfigService));
  await app.init();
  return { app, http: () => request(app.getHttpServer()) };
}

type Booted = Awaited<ReturnType<typeof boot>>;

describe('production, no trusted proxy (TRUST_PROXY unset)', () => {
  let b: Booted;
  beforeAll(async () => {
    b = await boot({ NODE_ENV: 'production', FRONTEND_URL: FRONTEND });
  });
  afterAll(() => b.app.close());

  it('plain HTTP is redirected to the configured origin', async () => {
    const res = await b.http().get('/api/v1/health?x=1');
    expect(res.status).toBe(301);
    expect(res.headers.location).toBe(`${FRONTEND}/api/v1/health?x=1`);
  });

  it('spoofed X-Forwarded-Proto / Host / X-Forwarded-Host neither bypass HTTPS nor move the redirect', async () => {
    const res = await b
      .http()
      .get('/api/v1/health')
      .set('Host', 'evil.example')
      .set('X-Forwarded-Host', 'evil2.example')
      .set('X-Forwarded-Proto', 'https');
    expect(res.status).toBe(301);
    expect(res.headers.location).toBe(`${FRONTEND}/api/v1/health`);
  });
});

describe('production behind a trusted proxy (TRUST_PROXY=loopback)', () => {
  let b: Booted;
  const viaProxy = () => ({ 'X-Forwarded-Proto': 'https' });
  beforeAll(async () => {
    b = await boot({
      NODE_ENV: 'production',
      FRONTEND_URL: FRONTEND,
      TRUST_PROXY: 'loopback',
    });
  });
  afterAll(() => b.app.close());

  it('HTTPS via the proxy reaches the API and the database (no Origin: no CORS headers)', async () => {
    const res = await b.http().get('/api/v1/health').set(viaProxy());
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok' });
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
    expect(res.headers['access-control-allow-credentials']).toBeUndefined();
  });

  it('plain HTTP forwarded by the proxy is redirected to the configured origin, not X-Forwarded-Host', async () => {
    const res = await b
      .http()
      .get('/api/v1/health')
      .set('X-Forwarded-Proto', 'http')
      .set('X-Forwarded-Host', 'evil.example');
    expect(res.status).toBe(301);
    expect(res.headers.location).toBe(`${FRONTEND}/api/v1/health`);
  });

  it('allowed origin, simple request: exact origin echoed, credentials, Vary: Origin', async () => {
    const res = await b
      .http()
      .get('/api/v1/health')
      .set(viaProxy())
      .set('Origin', FRONTEND);
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe(FRONTEND);
    expect(res.headers['access-control-allow-credentials']).toBe('true');
    expect(res.headers['vary']).toMatch(/Origin/);
  });

  it('allowed origin, preflight: 204 with the allowed methods and headers', async () => {
    const res = await b
      .http()
      .options('/api/v1/clients')
      .set(viaProxy())
      .set('Origin', FRONTEND)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'authorization,content-type');
    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe(FRONTEND);
    expect(res.headers['access-control-allow-credentials']).toBe('true');
    expect(res.headers['access-control-allow-methods']).toContain('POST');
    expect(res.headers['access-control-allow-headers']).toContain(
      'Authorization',
    );
    expect(res.headers['vary']).toMatch(/Origin/);
  });

  it.each([
    ['GET', '/api/v1/health'],
    ['POST', '/api/v1/clients'],
  ])(
    'disallowed origin, simple %s %s: 403 JSON (not 500), no CORS headers',
    async (method, path) => {
      const req =
        method === 'GET' ? b.http().get(path) : b.http().post(path).send({});
      const res = await req.set(viaProxy()).set('Origin', EVIL);
      expect(res.status).toBe(403);
      expect(res.body).toEqual({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Origin not allowed',
      });
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
      expect(res.headers['access-control-allow-credentials']).toBeUndefined();
      expect(res.headers['vary']).toMatch(/Origin/);
    },
  );

  it('disallowed origin, preflight: 403, no CORS headers', async () => {
    const res = await b
      .http()
      .options('/api/v1/clients')
      .set(viaProxy())
      .set('Origin', EVIL)
      .set('Access-Control-Request-Method', 'POST');
    expect(res.status).toBe(403);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
    expect(res.headers['access-control-allow-credentials']).toBeUndefined();
    expect(res.headers['access-control-allow-methods']).toBeUndefined();
  });

  it('a request with no Origin still reaches authentication (401, not a CORS refusal)', async () => {
    const res = await b.http().get('/api/v1/clients').set(viaProxy());
    expect(res.status).toBe(401);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('development (no HTTPS enforcement)', () => {
  let b: Booted;
  beforeAll(async () => {
    b = await boot({
      NODE_ENV: 'development',
      FRONTEND_URL: 'http://localhost:5173',
    });
  });
  afterAll(() => b.app.close());

  it('serves plain HTTP and allows the local dev origin', async () => {
    const res = await b
      .http()
      .get('/api/v1/health')
      .set('Origin', 'http://localhost:5173');
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe(
      'http://localhost:5173',
    );
  });

  it('still refuses an unknown origin with 403', async () => {
    const res = await b.http().get('/api/v1/health').set('Origin', EVIL);
    expect(res.status).toBe(403);
  });
});
