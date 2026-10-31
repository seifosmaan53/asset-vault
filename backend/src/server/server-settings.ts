// Copyright (c) 2025 Asset Vault. All rights reserved.
//
// Process-level HTTP settings, read once at startup: CORS origins, which proxies are trusted,
// where the HTTPS redirect points, and how long a graceful shutdown may take.
// Documented in docs/setup/DOCKER_README.md ("Server settings").

import { isIP } from 'node:net';
import type { ConfigService } from '@nestjs/config';
import { corsAllowedOrigins, type AllowedOrigin } from './cors.middleware';

/**
 * What Express's `trust proxy` receives. `false` = trust no proxy (the default): X-Forwarded-*
 * headers are ignored and the TCP peer is the client. A number = trust that many hops in front
 * of the API. A list = trust peers whose address matches (IPs, CIDR ranges, or the Express
 * presets `loopback`, `linklocal`, `uniquelocal`).
 */
export type TrustProxySetting = false | number | string[];

export interface ServerSettings {
  isProduction: boolean;
  /** Exact origins (and, outside production, patterns) that may make cross-origin calls. */
  allowedOrigins: AllowedOrigin[];
  trustProxy: TrustProxySetting;
  /**
   * The origin plain-HTTP requests are redirected to in production, e.g. `https://app.example.com`.
   * Never derived from the request's Host / X-Forwarded-Host headers.
   */
  httpsRedirectOrigin: string;
  /** Upper bound for a graceful shutdown before the process force-exits with status 1. */
  shutdownTimeoutMs: number;
}

export const DEFAULT_FRONTEND_URL = 'http://localhost:5173';
export const DEFAULT_SHUTDOWN_TIMEOUT_MS = 8000;

const TRUST_PROXY_PRESETS = new Set(['loopback', 'linklocal', 'uniquelocal']);

function isCidr(entry: string): boolean {
  const slash = entry.indexOf('/');
  if (slash < 0) return false;
  const ip = entry.slice(0, slash);
  const bits = entry.slice(slash + 1);
  const family = isIP(ip);
  if (family === 0 || !/^\d{1,3}$/.test(bits)) return false;
  return Number(bits) <= (family === 4 ? 32 : 128);
}

/**
 * Parse TRUST_PROXY. Empty / unset / `false` / `0` → trust nothing. `true` and `*` are refused:
 * trusting every peer would let any client forge X-Forwarded-Proto and X-Forwarded-For.
 */
export function parseTrustProxy(raw: string | undefined): TrustProxySetting {
  const value = (raw ?? '').trim();
  if (value === '' || value === 'false' || value === '0') return false;
  if (value === 'true' || value === '*') {
    throw new Error(
      'TRUST_PROXY=true would trust X-Forwarded-* headers from any client. Set the number of ' +
        'proxy hops (e.g. 1) or the proxy addresses (e.g. 10.0.0.5, 172.18.0.0/16, loopback).',
    );
  }
  if (/^\d+$/.test(value)) {
    const hops = Number(value);
    if (hops > 10) throw new Error(`TRUST_PROXY=${value}: too many proxy hops`);
    return hops;
  }
  const entries = value
    .split(',')
    .map((e) => e.trim())
    .filter((e) => e !== '');
  for (const entry of entries) {
    if (
      !TRUST_PROXY_PRESETS.has(entry) &&
      isIP(entry) === 0 &&
      !isCidr(entry)
    ) {
      throw new Error(
        `TRUST_PROXY: "${entry}" is not an IP address, a CIDR range, or one of loopback, linklocal, uniquelocal`,
      );
    }
  }
  return entries;
}

export function parseShutdownTimeout(raw: string | number | undefined): number {
  if (raw === undefined || raw === '') return DEFAULT_SHUTDOWN_TIMEOUT_MS;
  const ms = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isInteger(ms) || ms < 1000 || ms > 120000) {
    throw new Error(
      `SHUTDOWN_TIMEOUT_MS must be an integer between 1000 and 120000 (got ${String(raw)})`,
    );
  }
  return ms;
}

/** `https://<host[:port]>` of a configured URL; the scheme is forced to https. */
export function httpsOriginOf(url: string): string {
  return `https://${new URL(url).host}`;
}

export function loadServerSettings(config: ConfigService): ServerSettings {
  const isProduction = config.get<string>('NODE_ENV') === 'production';
  const frontendUrl =
    config.get<string>('FRONTEND_URL') || DEFAULT_FRONTEND_URL;
  const publicUrl = config.get<string>('API_PUBLIC_URL') || frontendUrl;
  return {
    isProduction,
    allowedOrigins: corsAllowedOrigins(isProduction, frontendUrl),
    trustProxy: parseTrustProxy(config.get<string>('TRUST_PROXY')),
    httpsRedirectOrigin: httpsOriginOf(publicUrl),
    shutdownTimeoutMs: parseShutdownTimeout(
      config.get<string | number>('SHUTDOWN_TIMEOUT_MS'),
    ),
  };
}
