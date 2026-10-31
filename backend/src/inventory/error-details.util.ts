/**
 * Read details from a caught value without trusting its type.
 *
 * Anything can be thrown, so a catch variable is really `unknown`. These helpers
 * return the field only when it is present with the expected type.
 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** The `message` of a thrown value, or undefined when it has none. */
export function errorMessage(error: unknown): string | undefined {
  if (error instanceof Error) {
    return error.message;
  }
  if (isRecord(error) && typeof error.message === 'string') {
    return error.message;
  }
  return undefined;
}

/**
 * A string field of a PostgreSQL driver error, such as `code` ('23505') or
 * `constraint`. TypeORM's QueryFailedError copies the driver error's fields onto
 * itself, so this works on both.
 */
export function driverErrorField(
  error: unknown,
  field: 'code' | 'constraint' | 'detail',
): string | undefined {
  if (!isRecord(error)) {
    return undefined;
  }
  const value = error[field];
  return typeof value === 'string' ? value : undefined;
}
