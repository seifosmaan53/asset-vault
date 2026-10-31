// Copyright (c) 2025 Asset Vault. All rights reserved.

/**
 * Typed reads of the fields the tRPC layer inspects on a caught error. A caught value
 * is `unknown`: it is usually an Error / Nest HttpException / TRPCError, but anything
 * can be thrown, so each field is read only when the value is an object that has it.
 */
export function errorField(error: unknown, key: string): unknown {
  return readProperty(error, key);
}

/**
 * `value[key]` for any object or function, `undefined` for primitives. Uses a plain
 * property read (no `in` check), so it behaves like `obj[key]` on proxies too — the
 * tRPC caller is a Proxy whose routers exist only through its `get` trap.
 */
export function readProperty(value: unknown, key: string): unknown {
  if (
    (typeof value === 'object' && value !== null) ||
    typeof value === 'function'
  ) {
    const property: unknown = Reflect.get(value, key);
    return property;
  }
  return undefined;
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
