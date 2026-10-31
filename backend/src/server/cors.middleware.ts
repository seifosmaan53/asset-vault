// Copyright (c) 2025 Asset Vault. All rights reserved.
//
// CORS, handled deliberately instead of through the `cors` package's error callback (which
// turned every request from a disallowed origin into a 500).
//
//  - No Origin header (server-to-server, curl, health checks, same-origin GET): untouched, no CORS
//    headers, request proceeds.
//  - Allowed Origin: Access-Control-Allow-Origin echoes that exact origin, with
//    Access-Control-Allow-Credentials: true. A preflight (OPTIONS) is answered 204 here.
//  - Disallowed Origin: 403 JSON for EVERY method, not only the preflight, and no CORS headers.
//    Such requests were already refused before (as a 500), so no legitimate client changes; and
//    refusing them before any route runs means a cross-site "simple" request (form POST, image,
//    fetch with mode no-cors) never reaches a handler, rather than running and merely having its
//    response hidden from the attacker's page.
//
// `Vary: Origin` is set on every response, since the CORS headers depend on it.

import type { LoggerService } from '@nestjs/common';
import type { NextFunction, Request, RequestHandler, Response } from 'express';

/** An origin the allowlist accepts: an exact string, or a pattern (development only). */
export type AllowedOrigin = string | RegExp;

/** Origins accepted outside production, in addition to FRONTEND_URL (unchanged from v2.0.0). */
const DEVELOPMENT_ORIGINS: readonly AllowedOrigin[] = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
  /^http:\/\/192\.168\.\d+\.\d+:\d+$/, // Local network IPs
  /^http:\/\/10\.\d+\.\d+\.\d+:\d+$/, // Private network IPs
  /^http:\/\/172\.(1[6-9]|2\d|3[01])\.\d+\.\d+:\d+$/, // Private network IPs
];

/**
 * The allowlist: in production exactly FRONTEND_URL; otherwise FRONTEND_URL plus local
 * development origins. Matching is exact string equality (or a full-match pattern).
 */
export function corsAllowedOrigins(
  isProduction: boolean,
  frontendUrl: string,
): AllowedOrigin[] {
  return isProduction ? [frontendUrl] : [frontendUrl, ...DEVELOPMENT_ORIGINS];
}

export const CORS_ALLOWED_METHODS = [
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'OPTIONS',
];
// The custom tenant header for multi-organization context, and x-duplicate for invoice duplication.
export const CORS_ALLOWED_HEADERS = [
  'Content-Type',
  'Authorization',
  'X-Organization-Id',
  'x-organization-id',
  'x-duplicate',
  'X-Duplicate',
];
export const CORS_EXPOSED_HEADERS = ['Content-Range', 'X-Content-Range'];
export const CORS_MAX_AGE_SECONDS = 86400;

export function isOriginAllowed(
  origin: string,
  allowed: readonly AllowedOrigin[],
): boolean {
  return allowed.some((entry) =>
    typeof entry === 'string' ? origin === entry : entry.test(origin),
  );
}

export function createCorsMiddleware(
  allowedOrigins: readonly AllowedOrigin[],
  logger: LoggerService,
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    res.vary('Origin');
    const origin = req.headers.origin;

    if (origin === undefined) {
      // Not a CORS request. Like the `cors` package before, a bare OPTIONS is answered here.
      if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
      }
      next();
      return;
    }

    if (!isOriginAllowed(origin, allowedOrigins)) {
      logger.warn(
        `CORS: refused ${req.method} ${req.originalUrl} from origin ${origin}`,
      );
      res.status(403).json({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Origin not allowed',
      });
      return;
    }

    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') {
      res.setHeader(
        'Access-Control-Allow-Methods',
        CORS_ALLOWED_METHODS.join(','),
      );
      res.setHeader(
        'Access-Control-Allow-Headers',
        CORS_ALLOWED_HEADERS.join(','),
      );
      res.setHeader('Access-Control-Max-Age', String(CORS_MAX_AGE_SECONDS));
      res.setHeader('Content-Length', '0');
      res.status(204).end();
      return;
    }

    res.setHeader(
      'Access-Control-Expose-Headers',
      CORS_EXPOSED_HEADERS.join(','),
    );
    next();
  };
}
