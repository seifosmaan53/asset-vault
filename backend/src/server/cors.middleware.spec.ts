import express from 'express';
import request from 'supertest';
import { corsAllowedOrigins, createCorsMiddleware } from './cors.middleware';

const silent = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };

function appWith(
  isProduction: boolean,
  frontendUrl = 'https://app.example.com',
) {
  const app = express();
  app.use(
    createCorsMiddleware(corsAllowedOrigins(isProduction, frontendUrl), silent),
  );
  app.all('/thing', (_req, res) => {
    res.json({ handled: true });
  });
  return app;
}

describe('createCorsMiddleware (production allowlist)', () => {
  const app = appWith(true);
  const allowed = 'https://app.example.com';
  const evil = 'https://evil.example';

  it('allowed origin, simple request: echoes the exact origin with credentials', async () => {
    const res = await request(app).get('/thing').set('Origin', allowed);
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe(allowed);
    expect(res.headers['access-control-allow-credentials']).toBe('true');
    expect(res.headers['access-control-expose-headers']).toBe(
      'Content-Range,X-Content-Range',
    );
    expect(res.headers['vary']).toMatch(/Origin/);
    expect(res.body).toEqual({ handled: true });
  });

  it('allowed origin, preflight: 204 with methods, headers, max-age', async () => {
    const res = await request(app)
      .options('/thing')
      .set('Origin', allowed)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type,x-organization-id');
    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe(allowed);
    expect(res.headers['access-control-allow-credentials']).toBe('true');
    expect(res.headers['access-control-allow-methods']).toBe(
      'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    );
    expect(res.headers['access-control-allow-headers']).toContain(
      'X-Organization-Id',
    );
    expect(res.headers['access-control-max-age']).toBe('86400');
    expect(res.headers['vary']).toMatch(/Origin/);
  });

  it.each(['GET', 'POST', 'DELETE'] as const)(
    'disallowed origin, simple %s: 403 JSON, no CORS headers, handler not run',
    async (method) => {
      const res = await request(app)
        [
          method === 'GET' ? 'get' : method === 'POST' ? 'post' : 'delete'
        ]('/thing')
        .set('Origin', evil);
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
    const res = await request(app)
      .options('/thing')
      .set('Origin', evil)
      .set('Access-Control-Request-Method', 'POST');
    expect(res.status).toBe(403);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
    expect(res.headers['access-control-allow-credentials']).toBeUndefined();
    expect(res.headers['access-control-allow-methods']).toBeUndefined();
  });

  it.each([
    'https://app.example.com.evil.example',
    'https://app.example.com:8443',
    'http://app.example.com',
    'https://APP.example.com',
    'null',
    'http://localhost:5173', // development-only origin
  ])('matches exactly: %p is refused in production', async (origin) => {
    const res = await request(app).get('/thing').set('Origin', origin);
    expect(res.status).toBe(403);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('no Origin (server-to-server): handled, no CORS headers at all', async () => {
    const res = await request(app).post('/thing');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ handled: true });
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
    expect(res.headers['access-control-allow-credentials']).toBeUndefined();
  });
});

describe('createCorsMiddleware (development allowlist)', () => {
  const app = appWith(false, 'http://localhost:5173');
  it.each([
    'http://localhost:5173',
    'http://127.0.0.1:3000',
    'http://192.168.1.20:5173',
  ])('allows %p', async (origin) => {
    const res = await request(app).get('/thing').set('Origin', origin);
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe(origin);
  });
  it.each([
    'http://192.168.1.20',
    'https://localhost:5173',
    'http://8.8.8.8:80',
  ])('refuses %p', async (origin) => {
    const res = await request(app).get('/thing').set('Origin', origin);
    expect(res.status).toBe(403);
  });
});
