/**
 * Security utility functions for input sanitization and validation
 * Protects against XSS, SQL injection, and other injection attacks
 */

/**
 * Escape HTML special characters to prevent XSS attacks
 * @param text - The text to escape
 * @returns Escaped text safe for HTML display
 */
export function escapeHtml(text: string | null | undefined): string {
  if (!text) return '';
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
    '/': '&#x2F;',
  };
  return text.replace(/[&<>"'/]/g, (m) => map[m]);
}

/**
 * Sanitize a string by removing HTML tags and escaping special characters
 * @param text - The text to sanitize
 * @param maxLength - Optional maximum length (default: 10000)
 * @returns Sanitized text
 */
export function sanitizeString(
  text: string | null | undefined,
  maxLength: number = 10000,
): string {
  if (!text) return '';

  // Remove null bytes and control characters
  // eslint-disable-next-line no-control-regex -- stripping control characters is the point
  let sanitized = text.replace(/[\x00-\x1F\x7F]/g, '');

  // Remove HTML tags
  sanitized = sanitized.replace(/<[^>]*>/g, '');

  // Escape HTML entities
  sanitized = escapeHtml(sanitized);

  // Limit length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  return sanitized.trim();
}

/**
 * Sanitize an object's string properties
 * @param obj - The object to sanitize
 * @param fields - Array of field names to sanitize (if not provided, sanitizes all string fields)
 * @returns Sanitized object
 */
/** Any non-null object (arrays included), viewed as string-keyed for recursion. */
function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function sanitizeObject<T extends Record<string, any>>(
  obj: T,
  fields?: string[],
): T {
  if (!obj || typeof obj !== 'object') return obj;

  const sanitized: Record<string, unknown> = { ...obj };

  // If fields specified, only sanitize those
  if (fields && Array.isArray(fields)) {
    fields.forEach((field) => {
      const value = sanitized[field];
      if (value && typeof value === 'string') {
        sanitized[field] = sanitizeString(value);
      }
    });
  } else {
    // Sanitize all string fields
    Object.keys(sanitized).forEach((key) => {
      const value = sanitized[key];
      if (typeof value === 'string') {
        sanitized[key] = sanitizeString(value);
      } else if (Array.isArray(value)) {
        // Recursively sanitize array items
        sanitized[key] = value.map((item: unknown) => {
          if (typeof item === 'string') {
            return sanitizeString(item);
          } else if (isPlainRecord(item)) {
            return sanitizeObject(item);
          }
          return item;
        });
      } else if (isPlainRecord(value)) {
        // Recursively sanitize nested objects
        sanitized[key] = sanitizeObject(value);
      }
    });
  }

  return sanitized as T;
}

/**
 * Validate and sanitize email address
 * @param email - Email to validate
 * @returns Sanitized email or null if invalid
 */
export function sanitizeEmail(email: string | null | undefined): string | null {
  if (!email) return null;

  const sanitized = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(sanitized)) {
    return null;
  }

  // Additional length check
  if (sanitized.length > 255) {
    return null;
  }

  return sanitized;
}

/**
 * Sanitize URL to prevent XSS and open redirect attacks
 * @param url - URL to sanitize
 * @returns Sanitized URL or null if invalid
 */
export function sanitizeUrl(url: string | null | undefined): string | null {
  if (!url) return null;

  const sanitized = url.trim();

  // Only allow http, https, and relative URLs
  if (!sanitized.match(/^(https?:\/\/|\/)/i)) {
    return null;
  }

  // Check for javascript: or data: protocols (XSS vectors)
  if (sanitized.match(/^(javascript|data|vbscript):/i)) {
    return null;
  }

  // Limit length
  if (sanitized.length > 2048) {
    return null;
  }

  return sanitizeString(sanitized, 2048);
}

/**
 * Sanitize numeric input to prevent injection
 * @param value - Value to sanitize
 * @returns Sanitized number or null
 */
export function sanitizeNumber(value: any): number | null {
  if (value === null || value === undefined) return null;

  const num = typeof value === 'string' ? parseFloat(value) : Number(value);

  if (isNaN(num) || !isFinite(num)) {
    return null;
  }

  return num;
}

/**
 * Sanitize array of strings
 * @param arr - Array to sanitize
 * @returns Sanitized array
 */
export function sanitizeStringArray(arr: any[] | null | undefined): string[] {
  if (!Array.isArray(arr)) return [];

  return arr
    .filter((item) => typeof item === 'string')
    .map((item) => sanitizeString(item))
    .filter((item) => item.length > 0);
}
