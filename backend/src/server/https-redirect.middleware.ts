// Copyright (c) 2025 Asset Vault. All rights reserved.
//
// Production HTTPS enforcement.
//
// "Is this request HTTPS?" is `req.secure`, which Express derives from the TLS socket or, ONLY
// when the TCP peer is a trusted proxy (TRUST_PROXY), from X-Forwarded-Proto. A client talking to
// the API directly cannot opt out of the redirect by sending X-Forwarded-Proto: https.
//
// The redirect target is the configured public origin (API_PUBLIC_URL, else FRONTEND_URL) plus the
// request path. It is never built from Host or X-Forwarded-Host, so a forged header cannot turn
// the API into an open redirect.

import type { NextFunction, Request, RequestHandler, Response } from 'express';

export function createHttpsRedirectMiddleware(
  httpsOrigin: string,
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.secure) {
      next();
      return;
    }
    res.redirect(301, `${httpsOrigin}${req.originalUrl}`);
  };
}
