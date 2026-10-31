// Copyright (c) 2025 Asset Vault. All rights reserved.

import type { RequestUser } from '../auth/interfaces/request-user.interface';

/**
 * `request.user` is set by ClerkAuthGuard, but the guards in this module may run where it is
 * absent. Read the one field they need after checking its type, instead of asserting the shape.
 */
export function readRequestUserId(
  value: unknown,
): Pick<RequestUser, 'userId'> | undefined {
  if (
    typeof value === 'object' &&
    value !== null &&
    'userId' in value &&
    typeof value.userId === 'string'
  ) {
    return { userId: value.userId };
  }
  return undefined;
}

/** Read one field of a parsed request body without assuming the body is an object. */
export function readBodyField(body: unknown, field: string): unknown {
  if (typeof body === 'object' && body !== null && field in body) {
    return (body as Record<string, unknown>)[field];
  }
  return undefined;
}
