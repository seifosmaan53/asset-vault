import express from 'express';
import request from 'supertest';
import { createHttpsRedirectMiddleware } from './https-redirect.middleware';
import { parseTrustProxy } from './server-settings';

function appWith(trustProxy: string) {
  const app = express();
  app.set('trust proxy', parseTrustProxy(trustProxy));
  app.use(createHttpsRedirectMiddleware('https://app.example.com'));
  app.get('/api/v1/thing', (req, res) => {
    res.json({ secure: req.secure, ip: req.ip, hostname: req.hostname });
  });
  return app;
}

// supertest connects over loopback, so "trusted" below means TRUST_PROXY includes loopback.
describe('HTTPS enforcement with no trusted proxy (default)', () => {
  const app = appWith('');

  it('plain HTTP is redirected to the configured origin', async () => {
    const res = await request(app).get('/api/v1/thing?a=1');
    expect(res.status).toBe(301);
    expect(res.headers.location).toBe(
      'https://app.example.com/api/v1/thing?a=1',
    );
  });

  it('a spoofed X-Forwarded-Proto: https does not bypass the redirect', async () => {
    const res = await request(app)
      .get('/api/v1/thing')
      .set('X-Forwarded-Proto', 'https');
    expect(res.status).toBe(301);
    expect(res.headers.location).toBe('https://app.example.com/api/v1/thing');
  });

  it('a spoofed Host / X-Forwarded-Host does not change the redirect target', async () => {
    const res = await request(app)
      .get('/api/v1/thing')
      .set('Host', 'evil.example')
      .set('X-Forwarded-Host', 'evil2.example')
      .set('X-Forwarded-Proto', 'https');
    expect(res.status).toBe(301);
    expect(res.headers.location).toBe('https://app.example.com/api/v1/thing');
  });
});

describe('HTTPS enforcement behind a trusted proxy (TRUST_PROXY=loopback)', () => {
  const app = appWith('loopback');

  it('X-Forwarded-Proto: https from the trusted proxy is believed', async () => {
    const res = await request(app)
      .get('/api/v1/thing')
      .set('X-Forwarded-Proto', 'https')
      .set('X-Forwarded-For', '203.0.113.7');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ secure: true, ip: '203.0.113.7' });
  });

  it('the proxy forwarding plain HTTP is still redirected to the configured origin', async () => {
    const res = await request(app)
      .get('/api/v1/thing')
      .set('X-Forwarded-Proto', 'http')
      .set('X-Forwarded-Host', 'evil.example');
    expect(res.status).toBe(301);
    expect(res.headers.location).toBe('https://app.example.com/api/v1/thing');
  });
});

describe('a proxy that is not on the trust list', () => {
  const app = appWith('10.0.0.5');
  it('its X-Forwarded-* headers are ignored', async () => {
    const res = await request(app)
      .get('/api/v1/thing')
      .set('X-Forwarded-Proto', 'https');
    expect(res.status).toBe(301);
  });
});
