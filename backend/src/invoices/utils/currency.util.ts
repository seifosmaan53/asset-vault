// Copyright (c) 2025 Asset Vault. All rights reserved.

import { BadRequestException } from '@nestjs/common';
import { validateString } from '../../common/utils/edge-case-protection.util';

/**
 * Common ISO 4217 currency codes
 * This is a subset of all valid codes - can be expanded if needed
 */
const VALID_CURRENCY_CODES = [
  'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY', 'INR', 'SGD',
  'HKD', 'NZD', 'MXN', 'BRL', 'ZAR', 'SEK', 'NOK', 'DKK', 'PLN', 'RUB',
  'TRY', 'AED', 'SAR', 'THB', 'MYR', 'PHP', 'IDR', 'KRW', 'VND', 'ILS',
  'CLP', 'ARS', 'COP', 'PEN', 'UAH', 'CZK', 'HUF', 'RON', 'BGN', 'HRK',
  'RSD', 'BAM', 'MKD', 'ALL', 'ISK', 'MDL', 'GEL', 'AMD', 'AZN', 'BYN',
  'KZT', 'KGS', 'TJS', 'TMT', 'UZS', 'MNT', 'BDT', 'PKR', 'LKR', 'NPR',
  'AFN', 'IRR', 'IQD', 'JOD', 'LBP', 'SYP', 'YER', 'OMR', 'KWD', 'BHD',
  'QAR', 'EGP', 'LYD', 'TND', 'DZD', 'MAD', 'ETB', 'KES', 'UGX', 'TZS',
  'RWF', 'BIF', 'DJF', 'SOS', 'ERN', 'SDG', 'SSP', 'ZWL', 'AOA', 'MZN',
  'MWK', 'ZMW', 'BWP', 'SZL', 'LSL', 'NAD', 'MGA', 'KMF', 'SCR', 'MUR',
  'MVR', 'BND', 'LAK', 'MMK', 'KHR', 'XAF', 'XOF', 'XPF', 'XCD', 'XAF',
] as const;

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

  // Check against whitelist (optional - can be made configurable)
  // For now, we'll validate format only and allow any 3-letter uppercase code
  // This is more permissive but still ensures valid format
  
  return currencyStr;
}

