/**
 * Typed reads of untyped JSON (supertest `res.body`, raw `DataSource.query` rows).
 *
 * Each helper keeps plain JavaScript semantics so a test asserts exactly what it would with
 * `any`: `at()` throws where `a.b` would throw (reading from null/undefined), `maybe()` is
 * `a?.b`, and `list()` / `text()` throw where `.map()` / `.localeCompare()` on the wrong type
 * would. Nothing is cast: values stay `unknown` until a runtime check narrows them.
 */

type Key = string | number;

function read(value: unknown, key: Key): unknown {
  if (value === null || value === undefined) {
    throw new TypeError(
      `Cannot read properties of ${String(value)} (reading '${String(key)}')`,
    );
  }
  // Object() boxes primitives, so `'abc'.length` and `(1).x` behave as in JavaScript.
  const property: unknown = Reflect.get(Object(value), key);
  return property;
}

/** `value.k1.k2…` — throws on reading from null/undefined, like JavaScript. */
export function at(value: unknown, ...path: Key[]): unknown {
  return path.reduce<unknown>((current, key) => read(current, key), value);
}

/** `value?.k1?.k2…` */
export function maybe(value: unknown, ...path: Key[]): unknown {
  let current = value;
  for (const key of path) {
    if (current === null || current === undefined) return undefined;
    current = read(current, key);
  }
  return current;
}

/** The value as an array; throws (as `.map`/spread would) when it is not one. */
export function list(value: unknown): unknown[] {
  if (!Array.isArray(value)) {
    throw new TypeError(`expected an array, got ${JSON.stringify(value)}`);
  }
  const items: unknown[] = value;
  return items;
}

/** The value as a string; throws when it is not one. */
export function text(value: unknown, label = 'value'): string {
  if (typeof value !== 'string') {
    throw new TypeError(
      `expected ${label} to be a string, got ${JSON.stringify(value)}`,
    );
  }
  return value;
}

/**
 * The id of a created record. Controllers return either the entity (`{ id }`) or an envelope
 * (`{ data: { id } }`), so this is `body.id ?? body.data?.id`, required to be a string.
 */
export function idOf(body: unknown): string {
  return text(at(body, 'id') ?? maybe(at(body, 'data'), 'id'), 'response id');
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
