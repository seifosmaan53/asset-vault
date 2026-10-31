// Copyright (c) 2025 Asset Vault. All rights reserved.

import type { Request } from 'express';

/**
 * main.ts stores the correlation id on the request as `req.requestId` (taken from the
 * X-Request-ID header, which Express types as string | string[], or a fresh uuid).
 */
export interface RequestWithId extends Request {
  requestId?: string | string[];
}

/** One string for a header-or-id value; an array reads as it would in a template literal. */
function asIdString(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value.join(',');
  return value;
}

/** The request id main.ts attached, or `undefined` when there is none. */
export function attachedRequestId(request: RequestWithId): string | undefined {
  return asIdString(request.requestId) || undefined;
}
