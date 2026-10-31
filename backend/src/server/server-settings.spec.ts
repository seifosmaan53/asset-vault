import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  DEFAULT_SHUTDOWN_TIMEOUT_MS,
  httpsOriginOf,
  loadServerSettings,
  parseShutdownTimeout,
  parseTrustProxy,
} from './server-settings';

function config(values: Record<string, string | undefined>) {
  return (key: string): string | undefined => values[key];
}

describe('parseTrustProxy', () => {
  it.each([undefined, '', ' ', 'false', '0'])('%p trusts nothing', (raw) => {
    expect(parseTrustProxy(raw)).toBe(false);
  });

  it('accepts a hop count', () => {
    expect(parseTrustProxy('1')).toBe(1);
    expect(parseTrustProxy('2')).toBe(2);
  });

  it('accepts addresses, CIDR ranges and the Express presets', () => {
    expect(
      parseTrustProxy('loopback, 10.0.0.5,172.18.0.0/16, fd00::/8, ::1'),
    ).toEqual(['loopback', '10.0.0.5', '172.18.0.0/16', 'fd00::/8', '::1']);
  });

  it.each(['true', '*'])('refuses %p (would trust every client)', (raw) => {
    expect(() => parseTrustProxy(raw)).toThrow(/any client/);
  });

  it.each(['proxy.internal', '10.0.0.0/33', '300.1.1.1', '11'])(
    'refuses %p',
    (raw) => {
      expect(() => parseTrustProxy(raw)).toThrow();
    },
  );
});

describe('parseShutdownTimeout', () => {
  it('defaults to 8000 ms', () => {
    expect(parseShutdownTimeout(undefined)).toBe(DEFAULT_SHUTDOWN_TIMEOUT_MS);
    expect(DEFAULT_SHUTDOWN_TIMEOUT_MS).toBe(8000);
  });
  it('accepts numbers and numeric strings in range', () => {
    expect(parseShutdownTimeout('3000')).toBe(3000);
    expect(parseShutdownTimeout(12000)).toBe(12000);
  });
  it.each(['999', '120001', 'abc', '1.5'])('refuses %p', (raw) => {
    expect(() => parseShutdownTimeout(raw)).toThrow(/SHUTDOWN_TIMEOUT_MS/);
  });
});

describe('loadServerSettings', () => {
  it('production: only FRONTEND_URL is allowed, no proxy trusted, redirect to FRONTEND_URL host', () => {
    const s = loadServerSettings(
      config({
        NODE_ENV: 'production',
        FRONTEND_URL: 'https://app.example.com',
      }),
    );
    expect(s.isProduction).toBe(true);
    expect(s.allowedOrigins).toEqual(['https://app.example.com']);
    expect(s.trustProxy).toBe(false);
    expect(s.httpsRedirectOrigin).toBe('https://app.example.com');
    expect(s.shutdownTimeoutMs).toBe(8000);
  });

  it('API_PUBLIC_URL wins for the redirect, and the scheme is forced to https', () => {
    const s = loadServerSettings(
      config({
        NODE_ENV: 'production',
        FRONTEND_URL: 'https://app.example.com',
        API_PUBLIC_URL: 'http://api.example.com:8443/ignored/path',
      }),
    );
    expect(s.httpsRedirectOrigin).toBe('https://api.example.com:8443');
    expect(s.allowedOrigins).toEqual(['https://app.example.com']);
  });

  it('development keeps the local origins', () => {
    const s = loadServerSettings(config({ NODE_ENV: 'development' }));
    expect(s.allowedOrigins).toContain('http://localhost:5173');
    expect(s.allowedOrigins).toContain('http://127.0.0.1:3000');
  });

  it('httpsOriginOf keeps only the host, with https', () => {
    expect(httpsOriginOf('http://localhost/x?y=1')).toBe('https://localhost');
  });
});

describe('src/main.ts startup order', () => {
  it('checks the database schema before NestFactory.create (never bypassed)', () => {
    const main = fs.readFileSync(path.join(__dirname, '..', 'main.ts'), 'utf8');
    const check = main.indexOf('await checkDatabaseSchema()');
    const create = main.indexOf('NestFactory.create');
    expect(check).toBeGreaterThan(0);
    expect(create).toBeGreaterThan(check);
    expect(main).toMatch(/if \(!schema\.ok\) \{[\s\S]*?process\.exit\(1\);/);
  });
});
