// Copyright (c) 2025 Asset Vault. All rights reserved.

import { readProperty } from '../common/utils/read-property.util';

/**
 * Typed reads of the fields the tRPC layer inspects on a caught error. A caught value
 * is `unknown`: it is usually an Error / Nest HttpException / TRPCError, but anything
 * can be thrown, so each field is read only when the value is an object that has it.
 */
export function errorField(error: unknown, key: string): unknown {
  return readProperty(error, key);
}

/** The HTTP status a Nest HttpException (or any error with a `status`) carries. */
export function errorStatus(error: unknown): unknown {
  return errorField(error, 'status');
}

/** The error's message when it is a non-empty string, otherwise `fallback`. */
export function errorMessage(error: unknown, fallback: string): string {
  const message = errorField(error, 'message');
  return typeof message === 'string' && message ? message : fallback;
}
