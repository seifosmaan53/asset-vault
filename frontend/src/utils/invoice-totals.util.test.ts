import { describe, it, expect } from 'vitest';
import * as shared from '@invoice-money/invoice-money';
import { INVOICE_MONEY_CASES } from '@invoice-money/invoice-money.cases';
import {
  computeInvoiceTotalsCents,
  invoiceTotalsToMoney,
  previewInvoiceTotalsCents,
  submittedMoneyFields,
  validateInvoiceItems,
  centsToMoney,
} from './invoice-totals.util';

/**
 * The web app uses the API's own invoice-money module
 * (backend/src/common/money/invoice-money.ts). Each "rejects" case is one the
 * API answers with a 400 and the same message; the backend suite checks those
 * messages against the API's validators on 30,000 generated inputs.
 */
describe('one implementation', () => {
  it('the web app exports are the shared module itself, not a copy', () => {
    expect(computeInvoiceTotalsCents).toBe(shared.computeInvoiceTotalsCents);
    expect(validateInvoiceItems).toBe(shared.validateInvoiceItems);
    expect(previewInvoiceTotalsCents).toBe(shared.previewInvoiceTotalsCents);
    expect(invoiceTotalsToMoney).toBe(shared.invoiceTotalsToMoney);
  });
});

describe('the invoice form computes what the API stores', () => {
  it.each(INVOICE_MONEY_CASES.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    // The form's path: values as submitted, previewed, converted for display.
    const { totals, issues } = previewInvoiceTotalsCents(c.items.map(submittedMoneyFields));
    expect(issues).toEqual([]);
    expect(totals.lines.map((l) => [l.lineSubtotalCents, l.lineDiscountCents, l.lineTaxCents, l.lineTotalCents]))
      .toEqual(c.lines);
    const shown = invoiceTotalsToMoney(totals).invoice;
    // The API returns stored totals as numeric(12,4) strings; they parse to what the form shows.
    expect(shown.subtotal).toBe(Number(c.stored.subtotal));
    expect(shown.discount).toBe(Number(c.stored.discountTotal));
    expect(shown.tax).toBe(Number(c.stored.taxTotal));
    expect(shown.total).toBe(Number(c.stored.total));
    expect(JSON.parse(JSON.stringify(shown))).toEqual(shown);
  });

  it('validates values as the API receives them: strings from a loaded invoice, empty fields', () => {
    // An invoice loaded from the API: numeric(12,4) and decimal(5,2) columns arrive as strings;
    // the API's ValidationPipe converts them to numbers before its rules run.
    const loaded = { quantity: 2, unitPrice: '12.5000', taxRate: '17.50', discountRate: '0.00' };
    expect(submittedMoneyFields(loaded)).toEqual({ quantity: 2, unitPrice: 12.5, taxRate: 17.5, discountRate: 0 });
    const { totals, issues } = previewInvoiceTotalsCents([submittedMoneyFields(loaded)]);
    expect(issues).toEqual([]);
    expect(totals.invoice.totalCents).toBe(2938); // 2500 + 437.5 -> 438
    // A cleared price is sent as "" and arrives as 0 (accepted); a cleared quantity arrives as 0.
    expect(validateInvoiceItems([submittedMoneyFields({ quantity: 1, unitPrice: '' })])).toEqual([]);
    expect(validateInvoiceItems([submittedMoneyFields({ quantity: '', unitPrice: 5 })])[0].message)
      .toBe('items[0].quantity must be at least 1');
    // NaN is sent as null by JSON. Both reject it; the API's DTO check answers first,
    // with class-validator's message, so here only the verdict is the API's.
    expect(validateInvoiceItems([submittedMoneyFields({ quantity: NaN, unitPrice: 5 })])[0].message)
      .toBe('items[0].quantity is required');
  });

  it('submits an empty rate as 0, and previews exactly that', () => {
    expect(submittedMoneyFields({ quantity: 1, unitPrice: 5, taxRate: NaN, discountRate: undefined }))
      .toEqual({ quantity: 1, unitPrice: 5, taxRate: 0, discountRate: 0 });
    expect(validateInvoiceItems([submittedMoneyFields({ quantity: 1, unitPrice: 5, taxRate: NaN })])).toEqual([]);
  });

  it('a line the API rejects shows 0 and is listed, so it cannot be submitted', () => {
    const { totals, issues } = previewInvoiceTotalsCents([
      submittedMoneyFields({ quantity: 2, unitPrice: 10 }),
      submittedMoneyFields({ quantity: 2.5, unitPrice: 10 }),
    ]);
    expect(totals.invoice.totalCents).toBe(2000);
    expect(issues).toEqual([{ field: 'items[1].quantity', message: 'items[1].quantity must be an integer' }]);
  });
});

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
      // The API's wording (its non-negative check runs before the minimum check);
      // the former web-app copy said "at least 0".
      expect(errs[0].message).toBe('items[0].unitPrice must be non-negative');
    });

    it('rejects more than two decimal places', () => {
      // The API's wording; the former web-app copy said "cannot be represented safely in cents".
      expect(validateInvoiceItems([{ ...ok, unitPrice: 10.005 }])[0].message)
        .toBe('items[0].unitPrice must have at most 2 decimal places');
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
      // The API's wording; the former web-app copy said "at least 0".
      expect(validateInvoiceItems([{ ...ok, discountRate: -1 }])[0].message)
        .toBe('items[0].discountRate must be non-negative');
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

describe('computeInvoiceTotalsCents', () => {
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
