// Copyright (c) 2025 Asset Vault. All rights reserved.

import { BadRequestException, InternalServerErrorException, Logger } from '@nestjs/common';

/**
 * Edge Case Protection Utility
 * 
 * Comprehensive edge case handling to prevent regressions of the 600+ issues fixed.
 * This utility provides centralized validation, sanitization, and error handling
 * to ensure all edge cases are covered.
 */

const logger = new Logger('EdgeCaseProtection');

/**
 * Maximum safe integer value for JavaScript
 */
export const MAX_SAFE_INTEGER = Number.MAX_SAFE_INTEGER;
export const MIN_SAFE_INTEGER = Number.MIN_SAFE_INTEGER;

/**
 * Maximum safe value for financial calculations (prevents overflow)
 */
export const MAX_SAFE_FINANCIAL_VALUE = 999999999999.99; // 999 billion with 2 decimal places

/**
 * Maximum safe cents value (MAX_SAFE_FINANCIAL_VALUE * 100)
 */
export const MAX_SAFE_CENTS = Math.round(MAX_SAFE_FINANCIAL_VALUE * 100);

/**
 * Assert that a cents value is a safe integer and within business limits
 * Used internally by money operation helpers
 */
function assertCentsInRange(n: number, fieldName: string): void {
  if (!Number.isSafeInteger(n)) {
    throw new BadRequestException(`${fieldName} would overflow or underflow`);
  }
  if (Math.abs(n) > MAX_SAFE_CENTS) {
    throw new BadRequestException(`${fieldName} is too large`);
  }
}

/**
 * Round cents value symmetrically (round half away from zero)
 * For positive: Math.round (rounds 0.5 up)
 * For negative: -Math.round(-x) (rounds -0.5 down, symmetric)
 * 
 * This ensures consistent rounding for credits/refunds (negative values)
 */
function roundCents(x: number): number {
  return x >= 0 ? Math.round(x) : -Math.round(-x);
}

/**
 * Validate string input (shape, length, pattern)
 * Prevents: null, undefined, empty strings, invalid formats
 * Note: Does not sanitize for XSS - use sanitizeString() for HTML output if needed.
 * Note: SQL injection is prevented by parameterized queries/ORM bindings, not string validation.
 */
export function validateString(
  value: unknown,
  fieldName: string,
  options: {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    allowEmpty?: boolean;
    trim?: boolean;
    pattern?: RegExp;
    sanitize?: boolean;
  } = {},
): string {
  const {
    required = true,
    minLength = 0,
    maxLength = 10000,
    allowEmpty = false,
    trim = true,
    pattern,
    sanitize = false,
  } = options;

  // Handle null/undefined
  if (value === null || value === undefined) {
    if (required) {
      throw new BadRequestException(`${fieldName} is required`);
    }
    return '';
  }

  // Convert to string
  let str = String(value);

  // Trim if requested
  if (trim) {
    str = str.trim();
  }

  // Check empty after trim
  if (!allowEmpty && str.length === 0) {
    if (required) {
      throw new BadRequestException(`${fieldName} cannot be empty`);
    }
    return '';
  }

  // Validate length
  if (str.length < minLength) {
    throw new BadRequestException(
      `${fieldName} must be at least ${minLength} characters long`,
    );
  }

  if (str.length > maxLength) {
    throw new BadRequestException(
      `${fieldName} must be at most ${maxLength} characters long`,
    );
  }

  // Validate pattern if provided
  if (pattern && !pattern.test(str)) {
    throw new BadRequestException(`${fieldName} has invalid format`);
  }

  // Sanitize for HTML output if requested
  // WARNING: Only use sanitize=true when outputting to HTML/rendering.
  // Do NOT sanitize values before storing in database, as this can cause
  // double-escaping when rendering. Best practice: store raw, escape on output.
  if (sanitize) {
    str = sanitizeString(str);
  }

  return str;
}

/**
 * Validate and sanitize number input
 * Prevents: null, undefined, NaN, Infinity, overflow, underflow
 */
export function validateNumber(
  value: unknown,
  fieldName: string,
  options: {
    required?: boolean;
    min?: number;
    max?: number;
    integer?: boolean;
    positive?: boolean;
    nonNegative?: boolean;
    allowZero?: boolean;
    strictString?: boolean; // If true, reject exponent notation (e.g., "1e3")
  } = {},
): number {
  const {
    required = true,
    min = MIN_SAFE_INTEGER,
    max = MAX_SAFE_INTEGER,
    integer = false,
    positive = false,
    nonNegative = false,
    allowZero = true,
    strictString = false,
  } = options;

  // Bound min/max to safe integer limits (prevents redundant overflow checks)
  // Note: These are integer bounds, but validator accepts floats too.
  // If you need extremely large magnitudes, use a decimal library;
  // JS numbers lose integer precision past 2^53-1 (Number.MAX_SAFE_INTEGER).
  const boundedMin = Math.max(min, MIN_SAFE_INTEGER);
  const boundedMax = Math.min(max, MAX_SAFE_INTEGER);

  // Guard: detect invalid range configuration
  if (boundedMin > boundedMax) {
    throw new BadRequestException(`${fieldName} has invalid range (min > max)`);
  }

  // Handle null/undefined
  if (value === null || value === undefined) {
    if (required) {
      throw new BadRequestException(`${fieldName} is required`);
    }
    return 0;
  }

  // Reject non-decimal formats if strictString is enabled (exponent, commas, spaces, etc.)
  if (strictString && typeof value === 'string') {
    const s = value.trim();
    // Require plain decimal format: optional minus, digits with optional decimal, OR leading-dot decimals
    // Allows "12", "12.", "12.34", ".5" (common user input formats)
    // Note: Allows "-0" and "00.10" which normalize to 0 and 0.1 respectively
    if (!/^-?(\d+(\.\d*)?|\.\d+)$/.test(s)) {
      throw new BadRequestException(`${fieldName} must be a decimal number (no exponent, commas, or spaces)`);
    }
  }

  // Convert to number
  const num = Number(value);

  // Check for NaN
  if (isNaN(num)) {
    throw new BadRequestException(`${fieldName} must be a valid number`);
  }

  // Check for Infinity
  if (!isFinite(num)) {
    throw new BadRequestException(`${fieldName} must be a finite number`);
  }

  // Check for integer if required
  if (integer && !Number.isInteger(num)) {
    throw new BadRequestException(`${fieldName} must be an integer`);
  }

  // Check for positive
  if (positive && num <= 0) {
    throw new BadRequestException(`${fieldName} must be positive`);
  }

  // Check for non-negative
  if (nonNegative && num < 0) {
    throw new BadRequestException(`${fieldName} must be non-negative`);
  }

  // Check for zero
  if (!allowZero && num === 0) {
    throw new BadRequestException(`${fieldName} cannot be zero`);
  }

  // Check range (using bounded values - overflow check is redundant)
  if (num < boundedMin) {
    throw new BadRequestException(`${fieldName} must be at least ${boundedMin}`);
  }

  if (num > boundedMax) {
    throw new BadRequestException(`${fieldName} must be at most ${boundedMax}`);
  }

  return num;
}

/**
 * Normalize money string by removing currency symbols and formatting
 * Strips $, commas, and whitespace from strings like "$1, 234.50" -> "1234.50"
 * 
 * Note: This is intentionally permissive - whitespace anywhere is removed.
 * Inputs like "1 2 3.45" become "123.45". Only enable allowFormatting for
 * human-entered UI strings, not API-to-API requests.
 * 
 * Rejects alphabetic characters to prevent inputs like "USD123.45" from passing.
 */
export function normalizeMoneyString(raw: string): string {
  const trimmed = raw.trim();
  
  // Reject alphabetic characters (prevents "USD123.45", "EUR100", etc.)
  if (/[a-z]/i.test(trimmed)) {
    throw new BadRequestException('Money string contains invalid characters (alphabetic characters not allowed)');
  }
  
  return trimmed
    .replace(/\$/g, '')
    .replace(/,/g, '')
    .replace(/\s+/g, ''); // remove all whitespace (handles spaces around commas)
}

/**
 * Validate money/currency amount
 * Enforces 2 decimal places max and uses MAX_SAFE_FINANCIAL_VALUE limit
 * Use this for invoice totals, line item amounts, tax, discounts, etc.
 * 
 * Note: For perfect money math, consider storing cents as integers or using a decimal library.
 * This function provides strong "guardrails" to prevent common financial calculation errors.
 */
export function validateMoney(
  value: unknown,
  fieldName: string,
  options: {
    required?: boolean;
    min?: number;
    max?: number;
    allowZero?: boolean;
    allowFormatting?: boolean; // If true, strip $ and commas from strings (e.g., "$1,234.50")
  } = {},
): number {
  const {
    required = true,
    min = 0,
    max = MAX_SAFE_FINANCIAL_VALUE,
    allowZero = true,
    allowFormatting = false,
  } = options;

  // Normalize string input if formatting is allowed
  let normalizedValue = value;
  if (allowFormatting && typeof value === 'string') {
    normalizedValue = normalizeMoneyString(value);
  }

  const num = validateNumber(normalizedValue, fieldName, {
    required,
    min,
    max,
    nonNegative: min >= 0,
    allowZero,
    strictString: true, // Always strict after normalization (if formatting was applied, it's already cleaned)
  });

  // Enforce 2 decimal places max (avoid 0.30000000004 style values)
  // Use cents conversion for consistent validation (aligns with cents-first philosophy)
  const cents = Math.round(num * 100);
  const rounded = cents / 100;

  // Check decimal places: use string format check when possible to avoid float precision issues
  if (typeof normalizedValue === 'string') {
    const s = normalizedValue.trim();
    // Allow: "12", "12.", "12.3", "12.34", ".5", "0.5" (tolerant format, max 2 decimal places)
    // Rejects: "+12.34" (explicit plus), but accepts most common formats
    // Make regex conditional based on min to be clear about negative allowance
    const allowNegative = min < 0;
    const moneyRegex = allowNegative
      ? /^-?(\d+(\.\d{0,2})?|\.\d{1,2})$/
      : /^(\d+(\.\d{0,2})?|\.\d{1,2})$/;
    
    if (!moneyRegex.test(s)) {
      throw new BadRequestException(`${fieldName} must have at most 2 decimal places`);
    }
  } else {
    // Non-string inputs: validate using cents conversion (aligns with string validation)
    // Ensure the original value can be represented exactly with 2 decimal places
    if (Math.abs(num - rounded) > 1e-8) {
      throw new BadRequestException(`${fieldName} must have at most 2 decimal places`);
    }
  }

  return rounded;
}

/**
 * Convert money amount to cents (integer) for precise calculations
 * Use this to avoid float drift when doing repeated money operations
 * 
 * Accepts unknown type for easy use with DTO fields (which may be strings)
 * 
 * Example: moneyToCents(12.34) returns 1234
 * Example: moneyToCents("12.34") returns 1234
 * Example: moneyToCents("$1,234.50", 'amount', { allowFormatting: true }) returns 123450
 */
export function moneyToCents(
  amount: unknown,
  fieldName = 'amount',
  options?: { allowFormatting?: boolean },
): number {
  const n = validateMoney(amount, fieldName, { allowFormatting: options?.allowFormatting });
  const cents = Math.round(n * 100);

  // Guard: ensure reversible within 2 decimals
  if (Math.abs(n - cents / 100) > 1e-8) {
    throw new BadRequestException(`${fieldName} cannot be represented safely in cents`);
  }

  // Guard: enforce max range to prevent business logic overflow
  // (Number.isSafeInteger protects JS overflow, but not business overflow)
  if (Math.abs(cents) > MAX_SAFE_CENTS) {
    throw new BadRequestException(`${fieldName} is too large`);
  }

  return cents;
}

/**
 * Convert cents (integer) back to money amount
 * 
 * This is always representable to 2 decimals because it's division by 100.
 * Simplified version without re-validation for better performance.
 * 
 * Explicitly allows negative cents (for credits, refunds, etc.)
 * 
 * Example: centsToMoney(1234) returns 12.34
 * Example: centsToMoney(-1234) returns -12.34
 */
export function centsToMoney(cents: number, fieldName = 'amount'): number {
  // Explicitly allow negatives (for credits, refunds, etc.)
  const c = validateNumber(cents, fieldName, {
    integer: true,
    min: -MAX_SAFE_CENTS,
    max: MAX_SAFE_CENTS,
  });
  
  // This is always representable to 2 decimals because it's /100
  return c / 100;
}

/**
 * Add two money amounts using cents-based arithmetic to avoid float drift
 * Use this for invoice totals, tax calculations, discounts, etc.
 * 
 * Accepts unknown type for easy use with DTO fields (which may be strings)
 * 
 * Example: moneyAdd(10.50, 2.30) returns 12.80 (exact, no drift)
 * Example: moneyAdd("10.50", "2.30") returns 12.80 (exact, no drift)
 * Example: moneyAdd("$1,000.50", "$234.30", 'total', { allowFormatting: true }) returns 1234.80
 */
export function moneyAdd(
  a: unknown,
  b: unknown,
  fieldName = 'result',
  options?: { allowFormatting?: boolean },
): number {
  const aCents = moneyToCents(a, 'operand A', options);
  const bCents = moneyToCents(b, 'operand B', options);

  const sum = aCents + bCents;

  // Guard against integer overflow/underflow and business limits
  assertCentsInRange(sum, fieldName);

  return centsToMoney(sum, fieldName);
}

/**
 * Subtract two money amounts using cents-based arithmetic to avoid float drift
 * Use this for discounts, refunds, partial payments, etc.
 * 
 * Accepts unknown type for easy use with DTO fields (which may be strings)
 * 
 * Example: moneySubtract(10.50, 2.30) returns 8.20 (exact, no drift)
 * Example: moneySubtract("$1,000.50", "$234.30", 'result', { allowFormatting: true }) returns 766.20
 */
export function moneySubtract(
  a: unknown,
  b: unknown,
  fieldName = 'result',
  options?: { allowFormatting?: boolean },
): number {
  const aCents = moneyToCents(a, 'operand A', options);
  const bCents = moneyToCents(b, 'operand B', options);

  const diff = aCents - bCents;

  // Guard against integer overflow/underflow and business limits
  assertCentsInRange(diff, fieldName);

  return centsToMoney(diff, fieldName);
}

/**
 * Check if money amount is zero (using cents-based comparison to avoid float issues)
 * 
 * Example: moneyIsZero(0) returns true
 * Example: moneyIsZero("0.00") returns true
 * Example: moneyIsZero("0.001") throws BadRequestException (more than 2 decimal places)
 * Example: moneyIsZero("$0.00", { allowFormatting: true }) returns true
 */
export function moneyIsZero(
  v: unknown,
  options?: { allowFormatting?: boolean },
): boolean {
  return moneyToCents(v, 'amount', options) === 0;
}

/**
 * Compare two money amounts (using cents-based comparison to avoid float issues)
 * Returns: -1 if a < b, 0 if a === b, 1 if a > b
 * 
 * Example: moneyCompare(10.50, 2.30) returns 1
 * Example: moneyCompare(2.30, 10.50) returns -1
 * Example: moneyCompare(10.50, 10.50) returns 0
 */
export function moneyCompare(
  a: unknown,
  b: unknown,
  options?: { allowFormatting?: boolean },
): -1 | 0 | 1 {
  const ac = moneyToCents(a, 'a', options);
  const bc = moneyToCents(b, 'b', options);
  return ac === bc ? 0 : ac < bc ? -1 : 1;
}

/**
 * Apply a percentage to a money amount (for tax, discounts, etc.)
 * Uses cents-based arithmetic with single rounding point for deterministic results
 * 
 * This eliminates "why does total not match line items?" issues by ensuring
 * all percentage calculations use the same rounding rule.
 * 
 * Example: moneyApplyPercent(100.00, 10) returns 10.00 (10% of $100)
 * Example: moneyApplyPercent("$1,000.50", 8.5, 'tax', { allowFormatting: true }) returns 85.04
 */
export function moneyApplyPercent(
  amount: unknown,
  percent: unknown,
  fieldName = 'result',
  options?: { allowFormatting?: boolean },
): number {
  const cents = moneyToCents(amount, 'amount', options);
  const p = validatePercentage(percent, 'percent', true); // 0..100
  const resultCents = roundCents(cents * (p / 100));
  
  // Guard against integer overflow and business limits
  assertCentsInRange(resultCents, fieldName);
  
  return centsToMoney(resultCents, fieldName);
}

/**
 * Apply a rate to a money amount (for flexible rate calculations)
 * More flexible than moneyApplyPercent - allows negative rates, rates > 100, etc.
 * 
 * Use this for:
 * - Adjustments that can be negative (credits, refunds)
 * - Multiplier-style business rules (rates > 100)
 * - Custom rate ranges
 * 
 * Example: moneyApplyRate(100.00, 0.085) returns 8.50 (8.5% rate as decimal)
 * Example: moneyApplyRate(100.00, -0.10, 'adjustment', { minRate: -1, maxRate: 1 }) returns -10.00
 * Example: moneyApplyRate("$1,000.50", 1.5, 'multiplier', { allowFormatting: true, maxRate: 10 }) returns 1500.75
 */
export function moneyApplyRate(
  amount: unknown,
  rate: unknown, // e.g. 0.085 for 8.5% OR allow negative
  fieldName = 'result',
  options?: {
    allowFormatting?: boolean;
    minRate?: number;
    maxRate?: number;
  },
): number {
  const cents = moneyToCents(amount, 'amount', options);
  const r = validateNumber(rate, 'rate', {
    required: true,
    min: options?.minRate ?? -10,
    max: options?.maxRate ?? 10,
    strictString: true, // Reject exponent notation
  });

  // Use symmetric rounding (round half away from zero) for consistent negative handling
  const resultCents = roundCents(cents * r);
  
  // Guard against integer overflow and business limits
  assertCentsInRange(resultCents, fieldName);
  
  return centsToMoney(resultCents, fieldName);
}

/**
 * Validate UUID format (v1-v5 style)
 * Prevents: invalid UUIDs, empty strings, null/undefined
 */
export function validateUUID(value: unknown, fieldName: string, required = true): string {
  if (value === null || value === undefined) {
    if (required) {
      throw new BadRequestException(`${fieldName} is required`);
    }
    return '';
  }

  const str = String(value).trim();
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!uuidRegex.test(str)) {
    throw new BadRequestException(`${fieldName} must be a valid UUID`);
  }

  return str;
}

/**
 * Validate UUID v4 format specifically
 * Prevents: invalid UUIDs, non-v4 UUIDs, empty strings, null/undefined
 */
export function validateUUIDV4(value: unknown, fieldName: string, required = true): string {
  if (value === null || value === undefined) {
    if (required) {
      throw new BadRequestException(`${fieldName} is required`);
    }
    return '';
  }

  const str = String(value).trim();
  // UUID v4: version 4 (4 in position 13), variant bits (8, 9, a, or b in position 17)
  const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (!uuidV4Regex.test(str)) {
    throw new BadRequestException(`${fieldName} must be a valid UUID v4`);
  }

  return str;
}

/**
 * Validate array input
 * Prevents: null, undefined, non-arrays, empty arrays when not allowed
 * 
 * Note: This validates array length, but does not prevent memory bombs from huge payloads.
 * Ensure you have request body size limits configured in your Nest/Express/Fastify middleware
 * (e.g., body-parser limit, JSON body size limit) to reject oversized requests before validation.
 */
export function validateArray<T>(
  value: unknown,
  fieldName: string,
  options: {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    allowEmpty?: boolean;
    itemValidator?: (item: unknown, index: number) => T;
  } = {},
): T[] {
  const {
    required = true,
    minLength = 0,
    maxLength = 10000,
    allowEmpty = false,
    itemValidator,
  } = options;

  // Handle null/undefined
  if (value === null || value === undefined) {
    if (required) {
      throw new BadRequestException(`${fieldName} is required`);
    }
    return [];
  }

  // Check if array
  if (!Array.isArray(value)) {
    throw new BadRequestException(`${fieldName} must be an array`);
  }

  // Check empty
  if (!allowEmpty && value.length === 0) {
    if (required) {
      throw new BadRequestException(`${fieldName} cannot be empty`);
    }
    return [];
  }

  // Check length
  if (value.length < minLength) {
    throw new BadRequestException(
      `${fieldName} must have at least ${minLength} items`,
    );
  }

  if (value.length > maxLength) {
    throw new BadRequestException(
      `${fieldName} must have at most ${maxLength} items`,
    );
  }

  // Validate items if validator provided
  if (itemValidator) {
    return value.map((item, index) => {
      try {
        return itemValidator(item, index);
      } catch (error) {
        throw new BadRequestException(
          `${fieldName}[${index}] is invalid: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    });
  }

  return value as T[];
}

/**
 * Validate object input
 * Prevents: null, undefined, non-objects
 */
export function validateObject<T extends Record<string, unknown>>(
  value: unknown,
  fieldName: string,
  required = true,
): T {
  if (value === null || value === undefined) {
    if (required) {
      throw new BadRequestException(`${fieldName} is required`);
    }
    return {} as T;
  }

  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new BadRequestException(`${fieldName} must be an object`);
  }

  return value as T;
}

/**
 * Safe numeric calculation with overflow protection
 */
export function safeAdd(a: number, b: number, fieldName = 'result'): number {
  const numA = validateNumber(a, 'operand A', { required: true });
  const numB = validateNumber(b, 'operand B', { required: true });

  // Check for overflow before addition
  if (numA > 0 && numB > MAX_SAFE_INTEGER - numA) {
    throw new BadRequestException(`${fieldName} would overflow`);
  }

  if (numA < 0 && numB < MIN_SAFE_INTEGER - numA) {
    throw new BadRequestException(`${fieldName} would underflow`);
  }

  const result = numA + numB;

  // Double-check result is safe
  if (!isFinite(result) || result > MAX_SAFE_INTEGER || result < MIN_SAFE_INTEGER) {
    throw new BadRequestException(`${fieldName} calculation resulted in unsafe value`);
  }

  return result;
}

/**
 * Safe numeric subtraction with underflow protection
 */
export function safeSubtract(a: number, b: number, fieldName = 'result'): number {
  const numA = validateNumber(a, 'operand A', { required: true });
  const numB = validateNumber(b, 'operand B', { required: true });

  // overflow: a - b where b is negative => a + |b|
  if (numB < 0 && numA > MAX_SAFE_INTEGER + numB) {
    throw new BadRequestException(`${fieldName} would overflow`);
  }

  // underflow: a - b where b is positive => decreases
  if (numB > 0 && numA < MIN_SAFE_INTEGER + numB) {
    throw new BadRequestException(`${fieldName} would underflow`);
  }

  const result = numA - numB;

  if (!Number.isFinite(result) || result > MAX_SAFE_INTEGER || result < MIN_SAFE_INTEGER) {
    throw new BadRequestException(`${fieldName} calculation resulted in unsafe value`);
  }

  return result;
}

/**
 * Safe numeric multiplication with overflow protection
 */
export function safeMultiply(a: number, b: number, fieldName = 'result'): number {
  const numA = validateNumber(a, 'operand A', { required: true });
  const numB = validateNumber(b, 'operand B', { required: true });

  // Check for overflow before multiplication
  if (numA !== 0 && numB !== 0) {
    const maxValue = MAX_SAFE_INTEGER / Math.abs(numA);
    if (Math.abs(numB) > maxValue) {
      throw new BadRequestException(`${fieldName} would overflow`);
    }
  }

  const result = numA * numB;

  // Double-check result is safe
  if (!isFinite(result) || result > MAX_SAFE_INTEGER || result < MIN_SAFE_INTEGER) {
    throw new BadRequestException(`${fieldName} calculation resulted in unsafe value`);
  }

  return result;
}

/**
 * Safe numeric division with division by zero protection
 */
export function safeDivide(a: number, b: number, fieldName = 'result'): number {
  const numA = validateNumber(a, 'operand A', { required: true });
  const numB = validateNumber(b, 'operand B', { required: true, allowZero: false });

  const result = numA / numB;

  // Double-check result is safe
  if (!isFinite(result) || result > MAX_SAFE_INTEGER || result < MIN_SAFE_INTEGER) {
    throw new BadRequestException(`${fieldName} calculation resulted in unsafe value`);
  }

  return result;
}

/**
 * Validate date input
 * Prevents: invalid dates, null, undefined
 * 
 * Note: For date-only inputs (e.g., invoice due date), consider using dateOnly: true
 * to normalize to midnight UTC and avoid timezone surprises.
 */
export function validateDate(
  value: unknown,
  fieldName: string,
  options: {
    required?: boolean;
    minDate?: Date;
    maxDate?: Date;
    allowFuture?: boolean;
    allowPast?: boolean;
    dateOnly?: boolean; // If true, normalize to midnight UTC (date-only, no time component)
  } = {},
): Date {
  const {
    required = true,
    minDate,
    maxDate,
    allowFuture = true,
    allowPast = true,
    dateOnly = false,
  } = options;

  if (value === null || value === undefined) {
    if (required) {
      throw new BadRequestException(`${fieldName} is required`);
    }
    const defaultDate = new Date();
    if (dateOnly) {
      // Normalize to midnight UTC
      return new Date(Date.UTC(defaultDate.getUTCFullYear(), defaultDate.getUTCMonth(), defaultDate.getUTCDate()));
    }
    return defaultDate;
  }

  let date = new Date(value as string | number | Date);

  if (isNaN(date.getTime())) {
    throw new BadRequestException(`${fieldName} must be a valid date`);
  }

  // Normalize to midnight UTC for date-only inputs
  // Helper to normalize dates to midnight UTC
  const norm = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

  // Normalize bounds too to avoid off-by-one errors from time components
  let normalizedMinDate = minDate;
  let normalizedMaxDate = maxDate;

  if (dateOnly) {
    date = norm(date);
    if (minDate) {
      normalizedMinDate = norm(minDate);
    }
    if (maxDate) {
      normalizedMaxDate = norm(maxDate);
    }
  }

  const now = new Date();
  // If dateOnly, normalize now too for consistent comparisons (today is neither past nor future)
  const compareNow = dateOnly ? norm(now) : now;

  if (!allowFuture && date > compareNow) {
    throw new BadRequestException(`${fieldName} cannot be in the future`);
  }

  if (!allowPast && date < compareNow) {
    throw new BadRequestException(`${fieldName} cannot be in the past`);
  }

  if (normalizedMinDate && date < normalizedMinDate) {
    throw new BadRequestException(
      `${fieldName} must be after ${normalizedMinDate.toISOString()}`,
    );
  }

  if (normalizedMaxDate && date > normalizedMaxDate) {
    throw new BadRequestException(
      `${fieldName} must be before ${normalizedMaxDate.toISOString()}`,
    );
  }

  return date;
}

/**
 * Check if value is null or undefined
 */
export function isNullOrUndefined(value: unknown): value is null | undefined {
  return value === null || value === undefined;
}

/**
 * Get value or throw error if null/undefined
 */
export function requireValue<T>(value: T | null | undefined, errorMessage: string): T {
  if (isNullOrUndefined(value)) {
    throw new BadRequestException(errorMessage);
  }
  return value;
}

/**
 * Retry operation with exponential backoff
 * Useful for transient failures like deadlocks, timeouts
 */
export async function retryOperation<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    backoffMultiplier?: number;
    retryableErrors?: (error: unknown) => boolean;
  } = {},
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 100,
    maxDelay = 5000,
    backoffMultiplier = 2,
    retryableErrors = (error: unknown) => {
      if (error instanceof Error) {
        const msg = error.message.toLowerCase();
        return (
          msg.includes('deadlock') ||
          msg.includes('timeout') ||
          msg.includes('could not obtain lock') ||
          msg.includes('connection') ||
          msg.includes('temporary')
        );
      }
      return false;
    },
  } = options;

  let lastError: unknown;
  let delay = initialDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      // Don't retry if error is not retryable
      if (!retryableErrors(error)) {
        throw error;
      }

      // Don't retry on last attempt
      if (attempt === maxRetries) {
        break;
      }

      // Add jitter to prevent thundering herd when multiple requests fail together
      // Jitter spreads out retries to avoid synchronized retry storms
      const jitter = 0.2; // 20% jitter
      const jitteredDelay = Math.round(delay * (1 - jitter + Math.random() * 2 * jitter));

      logger.warn(
        `Operation failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${jitteredDelay}ms (base ${delay}ms)...`,
        error instanceof Error ? error.message : 'Unknown error',
      );

      // Wait before retry with jittered delay
      await new Promise((resolve) => setTimeout(resolve, jitteredDelay));

      // Increase delay for next retry (exponential backoff)
      delay = Math.min(delay * backoffMultiplier, maxDelay);
    }
  }

  // All retries exhausted
  logger.error(`Operation failed after ${maxRetries + 1} attempts`, lastError as any);

  // Always throw an Error instance for proper error handling
  const err = lastError instanceof Error ? lastError : new Error(String(lastError));
  throw err;
}

/**
 * Validate percentage value (0-100)
 * Rejects exponent notation to prevent user input issues (e.g., "1e2" for 100)
 */
export function validatePercentage(
  value: unknown,
  fieldName: string,
  required = true,
): number {
  return validateNumber(value, fieldName, {
    required,
    min: 0,
    max: 100,
    nonNegative: true,
    strictString: true, // Reject exponent notation for user input safety
  });
}

/**
 * Validate email format
 */
export function validateEmail(value: unknown, fieldName: string, required = true): string {
  const str = validateString(value, fieldName, { required, trim: true });
  if (str && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str)) {
    throw new BadRequestException(`${fieldName} must be a valid email address`);
  }
  return str;
}

/**
 * Validate phone number format (basic validation)
 * Requires at least 7 digits and at most 15 digits (E.164 standard)
 */
export function validatePhone(value: unknown, fieldName: string, required = true): string {
  const str = validateString(value, fieldName, { required, trim: true });
  if (str) {
    // Extract digits only
    const digits = str.replace(/\D/g, '');
    
    // Require at least 7 digits (minimum valid phone number) and at most 15 (E.164 standard)
    if (digits.length < 7 || digits.length > 15) {
      throw new BadRequestException(
        `${fieldName} must contain between 7 and 15 digits`,
      );
    }
    
    // Basic format check (allow common separators)
    if (!/^[\d\s\-\+\(\)]+$/.test(str)) {
      throw new BadRequestException(`${fieldName} must be a valid phone number`);
    }
  }
  return str;
}

/**
 * Sanitize string to prevent XSS (basic HTML escaping)
 * Escapes: & < > " '
 * Note: Does not escape / as it's usually unnecessary and can make URLs/paths ugly
 */
export function sanitizeString(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Ensure transaction safety - validate queryRunner is active
 * Handles both function and property forms of isTransactionActive (TypeORM versions vary)
 */
export function ensureTransactionActive(queryRunner: any): void {
  if (!queryRunner) {
    throw new InternalServerErrorException('Transaction queryRunner is required but not provided');
  }

  const active =
    typeof queryRunner.isTransactionActive === 'function'
      ? queryRunner.isTransactionActive()
      : !!queryRunner.isTransactionActive;

  if (!active) {
    throw new InternalServerErrorException('Transaction is not active');
  }
}

/**
 * Validate that array has no duplicates
 * Safely handles undefined/null arrays (treats missing as ok)
 * 
 * Note: If you need to ensure array exists, call validateArray() first.
 */
export function validateNoDuplicates<T>(
  array: T[] | undefined | null,
  fieldName: string,
  getKey: (item: T) => string | number = (item) => String(item),
): void {
  // Treat missing array as ok (no duplicates to check)
  if (!array) {
    return;
  }

  const seen = new Set<string | number>();
  const duplicates: string[] = [];

  for (const item of array) {
    const key = getKey(item);
    if (seen.has(key)) {
      duplicates.push(String(key));
    }
    seen.add(key);
  }

  if (duplicates.length > 0) {
    throw new BadRequestException(
      `${fieldName} contains duplicate values: ${duplicates.join(', ')}`,
    );
  }
}

