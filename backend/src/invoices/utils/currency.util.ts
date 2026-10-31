// Copyright (c) 2025 Asset Vault. All rights reserved.

import { validateString } from '../../common/utils/edge-case-protection.util';

/**
 * Validate currency code against ISO 4217 format
 *
 * @param currency - Currency code to validate
 * @param fieldName - Field name for error messages
 * @returns Validated currency code (uppercase)
 * @throws BadRequestException if currency code is invalid
 */
export function validateCurrencyCode(
  currency: unknown,
  fieldName: string = 'currency',
): string {
  // Normalize empty strings to undefined
  if (currency === '' || currency === null) {
    currency = undefined;
  }

  const currencyStr = validateString(currency, fieldName, {
    required: true,
    minLength: 3,
    maxLength: 3,
    pattern: /^[A-Z]{3}$/, // ISO 4217 format: exactly 3 uppercase letters
  });

  // Format check only: any 3-letter uppercase code is accepted; there is no
  // ISO 4217 whitelist.

  return currencyStr;
}
