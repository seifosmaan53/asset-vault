// Copyright (c) 2025 Asset Vault. All rights reserved.

/**
 * Builds the payload sent to PATCH /user-settings.
 *
 * This lived inline in the Settings page, where a stale list of "removed fields"
 * silently dropped 21 real settings from every save -- the form reported success
 * and the values never persisted. It is extracted here so the rules are visible
 * and testable, and so that list cannot quietly rot again.
 */

import type { UserSettings } from '../api/settings';

/** Error-response shapes that must never be echoed back as settings. */
export const ERROR_RESPONSE_PROPERTIES = [
  'statusCode',
  'timestamp',
  'path',
  'message',
  'error',
  'errors',
] as const;

/**
 * Keys stripped before sending.
 *
 * Adding a key here stops that setting from EVER being saved, with no visible
 * failure, so a name belongs here only if the backend genuinely cannot accept it.
 * `settings-payload.util.test.ts` cross-checks this list against the UserSettings
 * type and fails if a real field is added.
 */
export const FIELDS_NOT_ON_BACKEND = [
  // Server-generated credential. The update DTO explicitly refuses it and the
  // client has no business sending it back.
  'twoFactorSecret',
  // Genuinely absent from the entity, the DTO and UserSettings.
  'showDashboardCharts',
  'showNotifications',
  'weeksSupplyTarget',
  'autoCreateClients',
  'defaultClientNotes',
] as const;

/** Fields the API expects as numbers, which the form may hold as strings. */
export const NUMERIC_FIELDS = [
  'defaultTaxRate',
  'defaultPaymentTermsDays',
  'defaultReorderLevel',
  'stockAlertThreshold',
  'itemsPerPage',
  'smtpPort',
] as const;

const INVOICE_NUMBER_PLACEHOLDERS = ['{YYYY}', '{YY}', '{MM}', '{DD}', '{NUM}', '{####}'];

function normalizeValue(key: string, value: unknown): unknown {
  // exportFormats is stored as a JSON string; an array from the form is encoded.
  if (key === 'exportFormats' && value) {
    if (Array.isArray(value)) return JSON.stringify(value);
    if (typeof value === 'string' && value.trim() !== '') return value;
  }

  // An invoice number format without a placeholder would produce duplicate
  // numbers, so an invalid one is dropped rather than sent.
  if (key === 'invoiceNumberFormat') {
    if (!value || (typeof value === 'string' && value.trim() === '')) return undefined;
    const hasPlaceholder = INVOICE_NUMBER_PLACEHOLDERS.some((p) => String(value).includes(p));
    if (!hasPlaceholder) return undefined;
    return typeof value === 'string' ? value.trim() : value;
  }

  if ((NUMERIC_FIELDS as readonly string[]).includes(key)) {
    if (value === null || value === undefined || value === '') return undefined;
    const numValue = typeof value === 'string' ? parseFloat(value) : Number(value);
    return Number.isNaN(numValue) ? undefined : numValue;
  }

  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string' && value.trim() === '') return undefined;
  return value;
}

/**
 * Filters, normalizes, and drops empty values from the settings form data.
 * `exportFormats` is always kept, even when undefined, so clearing every format
 * is sent rather than silently ignored.
 */
export function buildSettingsPayload(mergedData: Record<string, unknown>): UserSettings {
  const entries = Object.entries(mergedData)
    .filter(([key]) => {
      if ((ERROR_RESPONSE_PROPERTIES as readonly string[]).includes(key)) return false;
      if ((FIELDS_NOT_ON_BACKEND as readonly string[]).includes(key)) return false;
      return true;
    })
    .map(([key, value]) => [key, normalizeValue(key, value)] as const)
    .filter(([key, value]) => (key === 'exportFormats' ? true : value !== undefined));

  return Object.fromEntries(entries) as UserSettings;
}
