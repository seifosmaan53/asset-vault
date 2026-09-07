// Copyright (c) 2025 Asset Vault. All rights reserved.

import { describe, it, expect } from 'vitest';
// ?raw gives the file's text without pulling in Node types, which this
// project's tsconfig does not include.
import userSettingsSource from '../api/settings.ts?raw';
import {
  buildSettingsPayload,
  FIELDS_NOT_ON_BACKEND,
  ERROR_RESPONSE_PROPERTIES,
  NUMERIC_FIELDS,
} from './settings-payload.util';

/** Field names declared on an interface/type body in a .ts source file. */
function declaredFields(src: string): Set<string> {
  const names = new Set<string>();
  for (const m of src.matchAll(/^\s{2,}(\w+)\??\s*:/gm)) names.add(m[1]);
  return names;
}

describe('buildSettingsPayload', () => {
  /**
   * The regression this file exists for. A stale strip list silently dropped 21
   * real settings from every save: the form said "saved" and nothing persisted.
   * Any of these reappearing in FIELDS_NOT_ON_BACKEND must fail loudly.
   */
  const REAL_SETTINGS_THAT_WERE_SILENTLY_DROPPED = [
    'enableTwoFactorAuth',
    'fontSize',
    'compactMode',
    'autoBackup',
    'backupRetentionDays',
    'allowDataExport',
    'backupSchedule',
    'backupTime',
    'exportFormats',
    'notificationFrequency',
    'quietHoursStart',
    'quietHoursEnd',
    'additionalTaxRates',
    'inventoryUnitConversion',
    'defaultClientPaymentMethod',
    'defaultClientCreditLimit',
    'defaultClientCurrency',
    'invoiceHeaderText',
    'showInvoiceWatermark',
    'invoiceWatermarkText',
  ];

  it.each(REAL_SETTINGS_THAT_WERE_SILENTLY_DROPPED)(
    'sends %s instead of dropping it',
    (field) => {
      const value = field === 'exportFormats' ? '["pdf"]' : 'a-value';
      const payload = buildSettingsPayload({ [field]: value });
      expect(Object.keys(payload)).toContain(field);
    },
  );

  it('never sends twoFactorSecret, which the API refuses by design', () => {
    const payload = buildSettingsPayload({
      twoFactorSecret: 'JBSWY3DPEHPK3PXP',
      companyName: 'Acme',
    });
    expect(payload).not.toHaveProperty('twoFactorSecret');
    expect(payload).toHaveProperty('companyName', 'Acme');
  });

  it('does not echo an error response back as settings', () => {
    const payload = buildSettingsPayload({
      statusCode: 400,
      message: 'Bad Request',
      error: 'Bad Request',
      timestamp: '2026-01-01',
      path: '/user-settings',
      errors: ['nope'],
      companyName: 'Acme',
    });
    expect(Object.keys(payload)).toEqual(['companyName']);
  });

  describe('exportFormats', () => {
    it('encodes an array as JSON', () => {
      const payload = buildSettingsPayload({ exportFormats: ['pdf', 'csv'] });
      expect(payload.exportFormats).toBe('["pdf","csv"]');
    });

    it('passes an existing JSON string through unchanged', () => {
      const payload = buildSettingsPayload({ exportFormats: '["pdf"]' });
      expect(payload.exportFormats).toBe('["pdf"]');
    });

    it('is kept even when empty, so clearing every format is saved', () => {
      const payload = buildSettingsPayload({ exportFormats: '' });
      expect(Object.keys(payload)).toContain('exportFormats');
    });
  });

  describe('invoiceNumberFormat', () => {
    it('keeps a format containing a placeholder', () => {
      const payload = buildSettingsPayload({ invoiceNumberFormat: 'INV-{YYYY}-{####}' });
      expect(payload.invoiceNumberFormat).toBe('INV-{YYYY}-{####}');
    });

    it('drops a format with no placeholder, which would repeat numbers', () => {
      const payload = buildSettingsPayload({ invoiceNumberFormat: 'INV-STATIC' });
      expect(payload).not.toHaveProperty('invoiceNumberFormat');
    });
  });

  describe('numeric fields', () => {
    it.each(NUMERIC_FIELDS)('converts %s from a string to a number', (field) => {
      const payload = buildSettingsPayload({ [field]: '12' });
      expect(payload[field as keyof typeof payload]).toBe(12);
    });

    it('drops a value that is not a number rather than sending NaN', () => {
      const payload = buildSettingsPayload({ smtpPort: 'not-a-port' });
      expect(payload).not.toHaveProperty('smtpPort');
    });

    it('keeps zero, which is a real value', () => {
      const payload = buildSettingsPayload({ defaultTaxRate: 0 });
      expect(payload.defaultTaxRate).toBe(0);
    });
  });

  describe('empty values', () => {
    it('drops null, undefined, and whitespace-only strings', () => {
      const payload = buildSettingsPayload({
        companyName: null,
        companyEmail: undefined,
        companyPhone: '   ',
        language: 'en',
      });
      expect(Object.keys(payload)).toEqual(['language']);
    });

    it('keeps false, which is a real value', () => {
      const payload = buildSettingsPayload({ showCurrencySymbol: false });
      expect(payload.showCurrencySymbol).toBe(false);
    });
  });
});

/**
 * Guard on the list itself. Adding a name to FIELDS_NOT_ON_BACKEND stops that
 * setting from ever saving, with no visible failure -- exactly how the original
 * bug survived. This fails if a name that the API really accepts is added.
 */
describe('FIELDS_NOT_ON_BACKEND', () => {
  it('contains no field that UserSettings declares', () => {
    const userSettingsFields = declaredFields(userSettingsSource);
    // sanity-check the parse itself before trusting the assertion below
    expect(userSettingsFields.size).toBeGreaterThan(30);
    expect(userSettingsFields).toContain('companyName');

    const wronglyStripped = FIELDS_NOT_ON_BACKEND.filter((f) => userSettingsFields.has(f));
    expect(wronglyStripped).toEqual([]);
  });

  it('still strips twoFactorSecret, which UserSettings deliberately omits', () => {
    expect(FIELDS_NOT_ON_BACKEND).toContain('twoFactorSecret');
    expect(declaredFields(userSettingsSource).has('twoFactorSecret')).toBe(false);
  });

  it('shares no name with ERROR_RESPONSE_PROPERTIES', () => {
    const overlap = FIELDS_NOT_ON_BACKEND.filter((f) =>
      (ERROR_RESPONSE_PROPERTIES as readonly string[]).includes(f),
    );
    expect(overlap).toEqual([]);
  });
});
