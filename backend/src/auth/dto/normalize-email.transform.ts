import type { TransformFnParams } from 'class-transformer';

/**
 * Lower-cases and trims an email field before validation. A non-string value is
 * passed through untouched so the field's own validators (@IsEmail) reject it,
 * instead of the transform throwing on `.toLowerCase` of a non-string.
 */
export function normalizeEmail({ value }: TransformFnParams): unknown {
  const raw: unknown = value;
  return typeof raw === 'string' ? raw.toLowerCase().trim() : raw;
}
