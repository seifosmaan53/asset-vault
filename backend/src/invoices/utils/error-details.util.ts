// Copyright (c) 2025 Asset Vault. All rights reserved.

/**
 * Read the message and stack of a caught value without assuming it is an Error.
 *
 * `catch (error)` binds `unknown` in practice: libraries and our own code can throw strings,
 * plain objects or `null`. These helpers give the same text as `error.message` / `error.stack`
 * for anything carrying those properties, and a readable fallback for anything else.
 */
export function errorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String(error.message);
  }
  return String(error);
}

export function errorStack(error: unknown): string | undefined {
  if (
    typeof error === 'object' &&
    error !== null &&
    'stack' in error &&
    typeof error.stack === 'string'
  ) {
    return error.stack;
  }
  return undefined;
}
