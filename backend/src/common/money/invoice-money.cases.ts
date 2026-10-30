// Copyright (c) 2025 Asset Vault. All rights reserved.

/* Worked invoice-money examples with their expected totals, computed by hand
   (not by the code under test). Used by three test suites so the same inputs
   are checked everywhere:
   - backend/src/common/money/invoice-money.spec.ts (the module and the API's wrapper),
   - backend/test/invoice-money.db.spec.ts (POST /invoices on a real database, read back),
   - frontend/src/utils/invoice-totals.util.test.ts (the invoice form's path).
   Test data only; not part of the build. */

export interface InvoiceMoneyCase {
  name: string;
  items: Array<{
    quantity: number;
    unitPrice: number;
    taxRate?: number;
    discountRate?: number;
  }>;
  /** Expected per line: [subtotal, discount, tax, total] in cents. */
  lines: Array<[number, number, number, number]>;
  /** Expected invoice totals in cents. */
  invoice: { subtotal: number; discount: number; tax: number; total: number };
  /** The invoice totals as the API returns them after storing (numeric(12,4)). */
  stored: {
    subtotal: string;
    discountTotal: string;
    taxTotal: string;
    total: string;
  };
}

export const INVOICE_MONEY_CASES: InvoiceMoneyCase[] = [
  {
    // 1998 x 10% = 199.8 -> 200; (1998 - 200) x 8.25% = 148.335 -> 148
    name: 'line discount, then tax on the discounted amount',
    items: [{ quantity: 2, unitPrice: 9.99, discountRate: 10, taxRate: 8.25 }],
    lines: [[1998, 200, 148, 1946]],
    invoice: { subtotal: 1998, discount: 200, tax: 148, total: 1946 },
    stored: {
      subtotal: '19.9800',
      discountTotal: '2.0000',
      taxTotal: '1.4800',
      total: '19.4600',
    },
  },
  {
    // 180 x 17.5% = 31.5 exactly -> 32 (half away from zero; floating point gave 31)
    name: 'exact half cent at 17.5% rounds up',
    items: [{ quantity: 1, unitPrice: 1.8, taxRate: 17.5 }],
    lines: [[180, 0, 32, 212]],
    invoice: { subtotal: 180, discount: 0, tax: 32, total: 212 },
    stored: {
      subtotal: '1.8000',
      discountTotal: '0.0000',
      taxTotal: '0.3200',
      total: '2.1200',
    },
  },
  {
    // 360 x 8.75% = 31.5 exactly -> 32 (floating point gave 31)
    name: 'exact half cent at 8.75% rounds up',
    items: [{ quantity: 1, unitPrice: 3.6, taxRate: 8.75 }],
    lines: [[360, 0, 32, 392]],
    invoice: { subtotal: 360, discount: 0, tax: 32, total: 392 },
    stored: {
      subtotal: '3.6000',
      discountTotal: '0.0000',
      taxTotal: '0.3200',
      total: '3.9200',
    },
  },
  {
    // 3750 x 20% = 750; 5 x 50% = 2.5 -> 3; 1110 x 15% = 166.5 -> 167, 943 x 7% = 66.01 -> 66
    name: 'several lines, rounded per line, then summed',
    items: [
      { quantity: 3, unitPrice: 12.5, taxRate: 20 },
      { quantity: 1, unitPrice: 0.05, discountRate: 50 },
      { quantity: 10, unitPrice: 1.11, discountRate: 15, taxRate: 7 },
    ],
    lines: [
      [3750, 0, 750, 4500],
      [5, 3, 0, 2],
      [1110, 167, 66, 1009],
    ],
    invoice: { subtotal: 4865, discount: 170, tax: 816, total: 5511 },
    stored: {
      subtotal: '48.6500',
      discountTotal: '1.7000',
      taxTotal: '8.1600',
      total: '55.1100',
    },
  },
  {
    name: '100% discount leaves nothing to tax',
    items: [{ quantity: 4, unitPrice: 25, discountRate: 100, taxRate: 10 }],
    lines: [[10000, 10000, 0, 0]],
    invoice: { subtotal: 10000, discount: 10000, tax: 0, total: 0 },
    stored: {
      subtotal: '100.0000',
      discountTotal: '100.0000',
      taxTotal: '0.0000',
      total: '0.0000',
    },
  },
  {
    name: 'free line',
    items: [{ quantity: 5, unitPrice: 0 }],
    lines: [[0, 0, 0, 0]],
    invoice: { subtotal: 0, discount: 0, tax: 0, total: 0 },
    stored: {
      subtotal: '0.0000',
      discountTotal: '0.0000',
      taxTotal: '0.0000',
      total: '0.0000',
    },
  },
  {
    // 999,999,000 x 5% = 49,999,950
    name: 'large amounts stay exact',
    items: [{ quantity: 1000, unitPrice: 9999.99, taxRate: 5 }],
    lines: [[999999000, 0, 49999950, 1049998950]],
    invoice: {
      subtotal: 999999000,
      discount: 0,
      tax: 49999950,
      total: 1049998950,
    },
    stored: {
      subtotal: '9999990.0000',
      discountTotal: '0.0000',
      taxTotal: '499999.5000',
      total: '10499989.5000',
    },
  },
];
