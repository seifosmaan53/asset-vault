// Copyright (c) 2025 Asset Vault. All rights reserved.

/**
 * `value[key]` for any object or function, `undefined` for primitives, typed as
 * `unknown`. For values whose shape is not known statically: caught errors, driver
 * rows, untrusted payloads. It is a plain property read (no `in` check), so it
 * behaves exactly like `obj[key]`, including on proxies and for inherited properties.
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

/** `readProperty` narrowed to a string; any other value reads as `undefined`. */
export function readStringProperty(
  value: unknown,
  key: string,
): string | undefined {
  const property = readProperty(value, key);
  return typeof property === 'string' ? property : undefined;
}
