import { describe, it, expect } from 'vitest';
import {
  computeInvoiceTotalsCents,
  validateInvoiceItems,
  centsToMoney,
} from './invoice-totals.util';

/**
 * These cases encode the rules in
 * backend/src/common/utils/edge-case-protection.util.ts as applied by
 * backend/src/invoices/utils/invoice-totals.util.ts.
 *
 * The point of this suite is drift detection: if the backend rules change and
 * this copy is not updated, the UI goes back to displaying totals the API
 * rejects. Each "rejects" case is one the backend throws BadRequestException on.
 */
describe('validateInvoiceItems — parity with backend validation', () => {
  const ok = { quantity: 2, unitPrice: 10, discountRate: 10, taxRate: 8 };

  it('accepts a valid line', () => {
    expect(validateInvoiceItems([ok])).toEqual([]);
  });

  it('accepts an empty or absent item list', () => {
    expect(validateInvoiceItems([])).toEqual([]);
    expect(validateInvoiceItems(null)).toEqual([]);
  });

  describe('quantity', () => {
    it('rejects a fractional quantity (backend: integer, no flooring)', () => {
      const errs = validateInvoiceItems([{ ...ok, quantity: 2.5 }]);
      expect(errs).toHaveLength(1);
      expect(errs[0].field).toBe('items[0].quantity');
      expect(errs[0].message).toMatch(/must be an integer/);
    });

    it('rejects zero and negative quantity (backend: min 1)', () => {
      expect(validateInvoiceItems([{ ...ok, quantity: 0 }])[0].message).toMatch(/at least 1/);
      expect(validateInvoiceItems([{ ...ok, quantity: -1 }])[0].message).toMatch(/at least 1/);
    });

    it('rejects quantity above the backend ceiling of 1,000,000', () => {
      expect(validateInvoiceItems([{ ...ok, quantity: 1000001 }])[0].message)
        .toMatch(/at most 1000000/);
      expect(validateInvoiceItems([{ ...ok, quantity: 1000000 }])).toEqual([]);
    });

    it('rejects a missing quantity (backend: required)', () => {
      const errs = validateInvoiceItems([{ ...ok, quantity: undefined as unknown as number }]);
      expect(errs[0].message).toMatch(/is required/);
    });
  });

  describe('unitPrice', () => {
    it('rejects a negative unit price (backend validateMoney min 0)', () => {
      const errs = validateInvoiceItems([{ ...ok, unitPrice: -5 }]);
      expect(errs[0].field).toBe('items[0].unitPrice');
      expect(errs[0].message).toMatch(/at least 0/);
    });

    it('rejects more than two decimal places', () => {
      expect(validateInvoiceItems([{ ...ok, unitPrice: 10.005 }])[0].message)
        .toMatch(/cannot be represented safely in cents/);
      expect(validateInvoiceItems([{ ...ok, unitPrice: 10.05 }])).toEqual([]);
    });

    it('rejects NaN and Infinity', () => {
      expect(validateInvoiceItems([{ ...ok, unitPrice: NaN }])[0].message).toMatch(/valid number/);
      expect(validateInvoiceItems([{ ...ok, unitPrice: Infinity }])[0].message).toMatch(/finite/);
    });

    it('accepts zero', () => {
      expect(validateInvoiceItems([{ ...ok, unitPrice: 0 }])).toEqual([]);
    });
  });

  describe('rates', () => {
    it('rejects a percentage above 100', () => {
      expect(validateInvoiceItems([{ ...ok, discountRate: 150 }])[0].message)
        .toMatch(/at most 100/);
      expect(validateInvoiceItems([{ ...ok, taxRate: 150 }])[0].message)
        .toMatch(/at most 100/);
    });

    it('rejects a negative percentage', () => {
      expect(validateInvoiceItems([{ ...ok, discountRate: -1 }])[0].message)
        .toMatch(/at least 0/);
    });

    it('treats absent rates as optional', () => {
      expect(validateInvoiceItems([{ quantity: 1, unitPrice: 5 }])).toEqual([]);
    });
  });

  it('reports every offending field, not just the first', () => {
    const errs = validateInvoiceItems([
      { quantity: 2.5, unitPrice: -1, discountRate: 150, taxRate: 8 },
    ]);
    expect(errs.map((e) => e.field)).toEqual([
      'items[0].quantity',
      'items[0].unitPrice',
      'items[0].discountRate',
    ]);
  });

  it('indexes errors by line', () => {
    const errs = validateInvoiceItems([ok, { ...ok, quantity: 0 }]);
    expect(errs).toHaveLength(1);
    expect(errs[0].field).toBe('items[1].quantity');
  });

  describe('invoice-level discount', () => {
    it('rejects a percentage outside 0-100', () => {
      expect(validateInvoiceItems([ok], 150)[0].field).toBe('invoiceDiscount');
    });

    it('accepts a discount within the subtotal', () => {
      expect(validateInvoiceItems([ok], 50)).toEqual([]);
    });
  });
});

describe('computeInvoiceTotalsCents — arithmetic unchanged', () => {
  it('computes discount then tax, per line, in cents', () => {
    // 2 x 10.00 = 20.00; 10% discount = 2.00; tax 8% on 18.00 = 1.44; total 19.44
    const r = computeInvoiceTotalsCents([
      { quantity: 2, unitPrice: 10, discountRate: 10, taxRate: 8 },
    ]);
    expect(r.invoice.subtotalCents).toBe(2000);
    expect(r.invoice.discountCents).toBe(200);
    expect(r.invoice.taxCents).toBe(144);
    expect(r.invoice.totalCents).toBe(1944);
    expect(centsToMoney(r.invoice.totalCents)).toBe(19.44);
  });

  it('still returns zeroed totals for an empty list', () => {
    const r = computeInvoiceTotalsCents([]);
    expect(r.invoice.totalCents).toBe(0);
    expect(r.lines).toEqual([]);
  });
});
