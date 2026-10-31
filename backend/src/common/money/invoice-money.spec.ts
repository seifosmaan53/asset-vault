// Copyright (c) 2025 Asset Vault. All rights reserved.

import { BadRequestException } from '@nestjs/common';
import {
  centsToMoney as legacyCentsToMoney,
  moneyToCents as legacyMoneyToCents,
  validateNumber as legacyValidateNumber,
  validatePercentage as legacyValidatePercentage,
} from '../utils/edge-case-protection.util';
import { computeInvoiceTotalsCents as apiComputeInvoiceTotalsCents } from '../../invoices/utils/invoice-totals.util';
import {
  computeInvoiceTotalsCents,
  InvoiceMoneyError,
  invoiceTotalsToMoney,
  MAX_INVOICE_AMOUNT,
  previewInvoiceTotalsCents,
  validateInvoiceItems,
  type InvoiceTotalsResult,
} from './invoice-money';
import { INVOICE_MONEY_CASES } from './invoice-money.cases';

/* ------------------------------------------------------------------ *
 * The API's implementation before this module existed (commit 93bdb9c,
 * src/invoices/utils/invoice-totals.util.ts), kept verbatim in logic and
 * calling the same edge-case validators, as the reference for "behaviour is
 * preserved". Its only intended difference: rates were applied in floating
 * point, so some exact half cents rounded down.
 * ------------------------------------------------------------------ */
function legacyCompute(
  items: ReadonlyArray<object>,
  invoiceDiscount?: number,
  taxPolicy: 'afterDiscount' | 'beforeDiscount' = 'afterDiscount',
): InvoiceTotalsResult {
  const roundCents = (x: number) => (x >= 0 ? Math.round(x) : -Math.round(-x));
  if (!items || items.length === 0) {
    return {
      lines: [],
      invoice: {
        subtotalCents: 0,
        discountCents: 0,
        taxCents: 0,
        totalCents: 0,
      },
    };
  }
  const lines: InvoiceTotalsResult['lines'] = [];
  let sub = 0;
  let disc = 0;
  let tax = 0;
  for (let i = 0; i < items.length; i++) {
    const item = items[i] as Record<string, unknown>;
    const quantity = legacyValidateNumber(
      item.quantity,
      `items[${i}].quantity`,
      {
        required: true,
        integer: true,
        min: 1,
        max: 1000000,
      },
    );
    const unitPriceCents = legacyMoneyToCents(
      item.unitPrice,
      `items[${i}].unitPrice`,
    );
    const taxRate =
      item.taxRate !== undefined && item.taxRate !== null
        ? legacyValidatePercentage(item.taxRate, `items[${i}].taxRate`, false)
        : 0;
    const discountRate =
      item.discountRate !== undefined && item.discountRate !== null
        ? legacyValidatePercentage(
            item.discountRate,
            `items[${i}].discountRate`,
            false,
          )
        : 0;
    const s = quantity * unitPriceCents;
    const d = roundCents(s * (discountRate / 100));
    const t = roundCents(
      (taxPolicy === 'afterDiscount' ? s - d : s) * (taxRate / 100),
    );
    lines.push({
      lineSubtotalCents: s,
      lineDiscountCents: d,
      lineTaxCents: t,
      lineTotalCents: s - d + t,
    });
    sub += s;
    disc += d;
    tax += t;
  }
  let finalDisc = disc;
  if (invoiceDiscount !== undefined && invoiceDiscount !== null) {
    const pct = legacyValidatePercentage(
      invoiceDiscount,
      'invoiceDiscount',
      false,
    );
    finalDisc = Math.max(disc, roundCents(sub * (pct / 100)));
  }
  const result = {
    lines,
    invoice: {
      subtotalCents: sub,
      discountCents: finalDisc,
      taxCents: tax,
      totalCents: sub - finalDisc + tax,
    },
  };
  // The old invoiceTotalsToMoney validated every amount (this is where the size limit applied).
  for (const l of result.lines) {
    for (const v of Object.values(l)) legacyCentsToMoney(v);
  }
  for (const v of Object.values(result.invoice)) legacyCentsToMoney(v);
  return result;
}

function legacyOutcome(
  items: ReadonlyArray<object>,
  invoiceDiscount?: number,
  taxPolicy: 'afterDiscount' | 'beforeDiscount' = 'afterDiscount',
): { error: string } | { totals: InvoiceTotalsResult } {
  try {
    return { totals: legacyCompute(items, invoiceDiscount, taxPolicy) };
  } catch (e) {
    if (e instanceof BadRequestException) return { error: e.message };
    throw e;
  }
}

/* ------------------------------------------------------------------ *
 * Seeded generators (property tests; deterministic, no extra dependency)
 * ------------------------------------------------------------------ */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(r: () => number, xs: readonly T[]): T {
  return xs[Math.floor(r() * xs.length)];
}

/** Valid lines that stay storable even five at a time with 100% tax: unit price
 * up to 9,999.99, quantity up to 1,000; rates with up to two decimals. */
interface NumericItem {
  quantity: number;
  unitPrice: number;
  taxRate?: number;
  discountRate?: number;
}

function validItem(r: () => number): NumericItem {
  const item: NumericItem = {
    quantity: 1 + Math.floor(r() * (r() < 0.9 ? 20 : 1000)),
    unitPrice: Math.floor(r() * 1000000) / 100,
  };
  if (r() < 0.7) item.taxRate = Math.floor(r() * 10001) / 100;
  if (r() < 0.5) item.discountRate = Math.floor(r() * 10001) / 100;
  return item;
}

const ODD_VALUES: readonly unknown[] = [
  undefined,
  null,
  '',
  ' ',
  '0',
  '1',
  '12',
  '12.',
  '.5',
  '12.345',
  '12.5000',
  '17.50',
  '8.875',
  '0.0000001',
  '-1',
  '1e3',
  '1,000',
  'abc',
  ' 7 ',
  0,
  1,
  -1,
  2.5,
  0.1,
  10.005,
  8.875,
  1e-7,
  100,
  100.01,
  150,
  1000000,
  1000001,
  NaN,
  Infinity,
  -Infinity,
  999999999999.99,
  1000000000000,
  true,
  false,
];

function oddItem(r: () => number): Record<string, unknown> {
  const v = () => (r() < 0.5 ? pick(r, ODD_VALUES) : validItem(r).unitPrice);
  const item: Record<string, unknown> = {
    quantity: r() < 0.5 ? pick(r, ODD_VALUES) : 1 + Math.floor(r() * 9),
  };
  item.unitPrice = v();
  if (r() < 0.7)
    item.taxRate =
      r() < 0.5 ? pick(r, ODD_VALUES) : Math.floor(r() * 10001) / 100;
  if (r() < 0.7)
    item.discountRate =
      r() < 0.5 ? pick(r, ODD_VALUES) : Math.floor(r() * 10001) / 100;
  return item;
}

/** Whether a number written out in decimal has five or more decimal places. */
function hasFiveOrMoreDecimals(n: number): boolean {
  const m = /^(\d+)(?:\.(\d+))?(?:e-(\d+))?$/.exec(n.toString());
  if (!m) return false;
  return (m[2]?.length ?? 0) + Number(m[3] ?? 0) > 4;
}

/** Independent integer oracle: `bp` basis points (percent x 100) of `cents`, half away from zero. */
function oraclePercent(cents: number, bp: number): number {
  const n = BigInt(cents) * BigInt(bp);
  return Number((n * 2n + 10000n) / 20000n);
}

/* ------------------------------------------------------------------ */

describe('invoice money (shared by the API and the web app)', () => {
  describe('worked examples (hand-computed; also checked by the web app and the database test)', () => {
    it.each(INVOICE_MONEY_CASES.map((c) => [c.name, c] as const))(
      '%s',
      (_name, c) => {
        const result = computeInvoiceTotalsCents(c.items);
        expect(
          result.lines.map((l) => [
            l.lineSubtotalCents,
            l.lineDiscountCents,
            l.lineTaxCents,
            l.lineTotalCents,
          ]),
        ).toEqual(c.lines);
        expect(result.invoice).toEqual({
          subtotalCents: c.invoice.subtotal,
          discountCents: c.invoice.discount,
          taxCents: c.invoice.tax,
          totalCents: c.invoice.total,
        });
        // The API's wrapper returns the same, and the stored representation matches.
        const api = invoiceTotalsToMoney(apiComputeInvoiceTotalsCents(c.items));
        expect(api.invoice.subtotal.toFixed(4)).toBe(c.stored.subtotal);
        expect(api.invoice.discount.toFixed(4)).toBe(c.stored.discountTotal);
        expect(api.invoice.tax.toFixed(4)).toBe(c.stored.taxTotal);
        expect(api.invoice.total.toFixed(4)).toBe(c.stored.total);
      },
    );
  });

  describe('rules', () => {
    it('taxes the subtotal before discount when asked', () => {
      const r = computeInvoiceTotalsCents(
        [{ quantity: 1, unitPrice: 100, discountRate: 10, taxRate: 10 }],
        undefined,
        'beforeDiscount',
      );
      expect(r.lines[0]).toEqual({
        lineSubtotalCents: 10000,
        lineDiscountCents: 1000,
        lineTaxCents: 1000,
        lineTotalCents: 10000,
      });
    });

    it('applies an invoice-level discount only when it is larger than the line discounts', () => {
      const items = [{ quantity: 1, unitPrice: 100, discountRate: 5 }];
      expect(computeInvoiceTotalsCents(items, 10).invoice).toMatchObject({
        discountCents: 1000,
        totalCents: 9000,
      });
      expect(computeInvoiceTotalsCents(items, 2).invoice).toMatchObject({
        discountCents: 500,
        totalCents: 9500,
      });
    });

    it('applies rates with more than two decimals exactly', () => {
      // 1000 x 8.875% = 88.75 -> 89; 2000 x 0.125% = 2.5 -> 3
      expect(
        computeInvoiceTotalsCents([
          { quantity: 1, unitPrice: 10, taxRate: 8.875 },
        ]).invoice.taxCents,
      ).toBe(89);
      expect(
        computeInvoiceTotalsCents([
          { quantity: 1, unitPrice: 20, taxRate: 0.125 },
        ]).invoice.taxCents,
      ).toBe(3);
    });

    it('accepts numeric strings the way the API validators do', () => {
      expect(
        computeInvoiceTotalsCents([
          {
            quantity: '2',
            unitPrice: '9.99',
            taxRate: '8.25',
            discountRate: '10',
          },
        ]).invoice.totalCents,
      ).toBe(1946);
      expect(
        validateInvoiceItems([{ quantity: 1, unitPrice: '1e3' }])[0].message,
      ).toBe(
        'items[0].unitPrice must be a decimal number (no exponent, commas, or spaces)',
      );
    });

    describe('storage limit: every input and computed amount fits numeric(12,4)', () => {
      const LINE = (i: number) =>
        `items[${i}] amounts must not exceed 99999999.99 (quantity x unit price, discount, tax and line total)`;
      const INVOICE =
        'invoice totals must not exceed 99999999.99 (subtotal, discount, tax and total)';

      it('accepts amounts exactly at the limit', () => {
        expect(MAX_INVOICE_AMOUNT).toBe(99999999.99);
        expect(
          computeInvoiceTotalsCents([{ quantity: 1, unitPrice: 99999999.99 }])
            .invoice.totalCents,
        ).toBe(9999999999);
        // 9,090,909.09 x 11 = 99,999,999.99
        expect(
          validateInvoiceItems([{ quantity: 11, unitPrice: 9090909.09 }]),
        ).toEqual([]);
      });

      it('rejects a unit price above the limit', () => {
        expect(
          validateInvoiceItems([{ quantity: 1, unitPrice: 100000000 }]),
        ).toEqual([
          {
            field: 'items[0].unitPrice',
            message: 'items[0].unitPrice must be at most 99999999.99',
          },
        ]);
      });

      it('rejects valid-looking inputs whose product is too large', () => {
        // 2 x 50,000,000.00 = 100,000,000.00
        expect(
          validateInvoiceItems([{ quantity: 2, unitPrice: 50000000 }])[0],
        ).toEqual({
          field: 'items[0]',
          message: LINE(0),
        });
        // At the limit before tax, over it with tax
        expect(
          validateInvoiceItems([
            { quantity: 1, unitPrice: 99999999.99, taxRate: 1 },
          ])[0],
        ).toEqual({ field: 'items[0]', message: LINE(0) });
        // A 100% discount does not make a too-large subtotal storable
        expect(
          validateInvoiceItems([
            { quantity: 2, unitPrice: 99999999.99, discountRate: 100 },
          ])[0],
        ).toEqual({ field: 'items[0]', message: LINE(0) });
      });

      it('rejects lines that fit one by one but not summed (aggregate overflow)', () => {
        const items = [
          { quantity: 1, unitPrice: 60000000 },
          { quantity: 1, unitPrice: 60000000 },
        ];
        expect(validateInvoiceItems(items)).toEqual([
          { field: 'invoice', message: INVOICE },
        ]);
        expect(() => apiComputeInvoiceTotalsCents(items)).toThrow(INVOICE);
      });
    });

    describe('rate precision: up to four decimal places, applied exactly', () => {
      it('accepts four decimals and applies them exactly', () => {
        // 1000 x 8.8751% = 88.751 -> 89; 10000 x 7.0625% = 706.25 -> 706
        expect(
          computeInvoiceTotalsCents([
            { quantity: 1, unitPrice: 10, taxRate: 8.8751 },
          ]).invoice.taxCents,
        ).toBe(89);
        expect(
          computeInvoiceTotalsCents([
            { quantity: 1, unitPrice: 100, discountRate: 7.0625 },
          ]).invoice.discountCents,
        ).toBe(706);
      });

      it('rejects a fifth decimal place instead of rounding it away', () => {
        expect(
          validateInvoiceItems([
            { quantity: 1, unitPrice: 10, taxRate: 8.87512 },
          ]),
        ).toEqual([
          {
            field: 'items[0].taxRate',
            message: 'items[0].taxRate must have at most 4 decimal places',
          },
        ]);
        expect(
          validateInvoiceItems([
            { quantity: 1, unitPrice: 10, discountRate: 1e-7 },
          ])[0].message,
        ).toBe('items[0].discountRate must have at most 4 decimal places');
        // A loaded numeric(7,4) value is the same rate.
        expect(
          validateInvoiceItems([
            { quantity: 1, unitPrice: 10, taxRate: '8.8750' },
          ]),
        ).toEqual([]);
      });
    });

    it('reports every issue in API order and throws the first', () => {
      const items = [
        { quantity: 2.5, unitPrice: -1, discountRate: 150, taxRate: 8 },
      ];
      expect(validateInvoiceItems(items).map((i) => i.field)).toEqual([
        'items[0].quantity',
        'items[0].unitPrice',
        'items[0].discountRate',
      ]);
      expect(() => computeInvoiceTotalsCents(items)).toThrow(InvoiceMoneyError);
      expect(() => computeInvoiceTotalsCents(items)).toThrow(
        'items[0].quantity must be an integer',
      );
    });

    it('the API wrapper turns an issue into a 400 with the same message', () => {
      expect(() =>
        apiComputeInvoiceTotalsCents([{ quantity: 0, unitPrice: 1 }]),
      ).toThrow(BadRequestException);
      expect(() =>
        apiComputeInvoiceTotalsCents([{ quantity: 0, unitPrice: 1 }]),
      ).toThrow('items[0].quantity must be at least 1');
    });

    it('preview never throws: a rejected line counts as zero and the issues are listed', () => {
      const p = previewInvoiceTotalsCents([
        { quantity: 1, unitPrice: 10 },
        { quantity: 1, unitPrice: 'oops' },
      ]);
      expect(p.totals.invoice.totalCents).toBe(1000);
      expect(p.totals.lines[1]).toEqual({
        lineSubtotalCents: 0,
        lineDiscountCents: 0,
        lineTaxCents: 0,
        lineTotalCents: 0,
      });
      expect(p.issues).toEqual([
        {
          field: 'items[1].unitPrice',
          message:
            'items[1].unitPrice must be a decimal number (no exponent, commas, or spaces)',
        },
      ]);
    });

    it('an empty or missing list is zero', () => {
      for (const items of [[], null, undefined]) {
        expect(computeInvoiceTotalsCents(items).invoice).toEqual({
          subtotalCents: 0,
          discountCents: 0,
          taxCents: 0,
          totalCents: 0,
        });
      }
    });
  });

  describe('properties', () => {
    it('exact: every line equals an independent integer oracle (40,000 random invoices)', () => {
      const r = rng(1);
      for (let n = 0; n < 40000; n++) {
        const items = Array.from({ length: 1 + Math.floor(r() * 4) }, () =>
          validItem(r),
        );
        const result = computeInvoiceTotalsCents(items);
        items.forEach((item, i) => {
          const sub = item.quantity * Math.round(item.unitPrice * 100);
          const disc = oraclePercent(
            sub,
            Math.round((item.discountRate ?? 0) * 100),
          );
          const tax = oraclePercent(
            sub - disc,
            Math.round((item.taxRate ?? 0) * 100),
          );
          expect(result.lines[i]).toEqual({
            lineSubtotalCents: sub,
            lineDiscountCents: disc,
            lineTaxCents: tax,
            lineTotalCents: sub - disc + tax,
          });
        });
      }
    });

    it('exact: rates with up to four decimals (20,000 lines); smaller fractions are rejected', () => {
      const r = rng(5);
      for (let n = 0; n < 20000; n++) {
        const cents = Math.floor(r() * 4e9); // up to 40,000,000.00 so 100% tax still fits
        const k = Math.floor(r() * 1000001); // k / 10000 percent: 0.0000 .. 100.0000
        const rate = k / 10000;
        const exact =
          (BigInt(cents) * BigInt(k) * 2n + 10n ** 6n) / (2n * 10n ** 6n);
        const result = computeInvoiceTotalsCents(
          [{ quantity: 1, unitPrice: cents / 100, taxRate: rate }],
          undefined,
          r() < 0.5 ? 'beforeDiscount' : 'afterDiscount',
        );
        expect(result.lines[0].lineTaxCents).toBe(Number(exact));
        // A rate with a fifth decimal (printed in exponent form when tiny) is rejected.
        const tooFine =
          r() < 0.5 ? rate + 0.00001 : (1 + Math.floor(r() * 9)) * 1e-7;
        if (tooFine <= 100 && hasFiveOrMoreDecimals(tooFine)) {
          expect(
            validateInvoiceItems([
              { quantity: 1, unitPrice: 1, taxRate: tooFine },
            ])[0]?.message,
          ).toBe('items[0].taxRate must have at most 4 decimal places');
        }
      }
    });

    it('invariants: amounts are integers, discount within subtotal, totals are the sums of the lines', () => {
      const r = rng(2);
      for (let n = 0; n < 20000; n++) {
        const items = Array.from({ length: 1 + Math.floor(r() * 5) }, () =>
          validItem(r),
        );
        const { lines, invoice } = computeInvoiceTotalsCents(items);
        for (const l of lines) {
          for (const v of Object.values(l))
            expect(Number.isSafeInteger(v)).toBe(true);
          expect(l.lineDiscountCents).toBeGreaterThanOrEqual(0);
          expect(l.lineDiscountCents).toBeLessThanOrEqual(l.lineSubtotalCents);
          expect(l.lineTaxCents).toBeGreaterThanOrEqual(0);
          expect(l.lineTotalCents).toBe(
            l.lineSubtotalCents - l.lineDiscountCents + l.lineTaxCents,
          );
        }
        const sum = (k: keyof (typeof lines)[number]) =>
          lines.reduce((s, l) => s + l[k], 0);
        expect(invoice).toEqual({
          subtotalCents: sum('lineSubtotalCents'),
          discountCents: sum('lineDiscountCents'),
          taxCents: sum('lineTaxCents'),
          totalCents: sum('lineTotalCents'),
        });
        // Preview agrees exactly when there is nothing to reject.
        expect(previewInvoiceTotalsCents(items)).toEqual({
          totals: { lines, invoice },
          issues: [],
        });
      }
    });

    it('preserved: accepts and rejects what the API did, with the same message, except the new storage and rate limits (30,000 inputs)', () => {
      const r = rng(3);
      let rejected = 0;
      let newlyLimited = 0;
      // The only intended differences: amounts above what numeric(12,4) stores, and rates
      // with more than four decimals, are now rejected (before: failed on write or stored rounded).
      const isNewLimit = (message: string | undefined) =>
        !!message &&
        (/unitPrice must be at most 99999999\.99$/.test(message) ||
          /must have at most 4 decimal places$/.test(message) ||
          /must not exceed 99999999\.99 /.test(message));
      for (let n = 0; n < 30000; n++) {
        // Sometimes no lines at all (the invoice discount is then not checked).
        const items = Array.from(
          { length: r() < 0.05 ? 0 : 1 + Math.floor(r() * 3) },
          () => oddItem(r),
        );
        const invoiceDiscount =
          r() < 0.15 ? (pick(r, ODD_VALUES) as number) : undefined;
        const taxPolicy = r() < 0.3 ? 'beforeDiscount' : 'afterDiscount';
        const before = legacyOutcome(items, invoiceDiscount, taxPolicy);
        const issues = validateInvoiceItems(items, invoiceDiscount, taxPolicy);
        if ('error' in before) {
          rejected++;
          // Never accepted where the API rejected.
          expect(issues.length).toBeGreaterThan(0);
          if (issues[0].message !== before.error) {
            expect(isNewLimit(issues[0].message)).toBe(true);
            newlyLimited++;
          }
        } else if (issues.length > 0) {
          expect(isNewLimit(issues[0].message)).toBe(true);
          newlyLimited++;
        }
      }
      expect(rejected).toBeGreaterThan(10000); // the generator really exercises rejections
      expect(newlyLimited).toBeGreaterThan(0); // and the new limits
    });

    it('preserved: totals equal the previous implementation except at exact half cents, where they now round away from zero', () => {
      const r = rng(4);
      let halfCentFixes = 0;
      for (let n = 0; n < 40000; n++) {
        const items = Array.from({ length: 1 + Math.floor(r() * 3) }, () => {
          const item = validItem(r);
          // Bias towards common half-cent rates so the boundary is actually hit.
          if (r() < 0.5)
            item.taxRate = pick(r, [8.75, 17.5, 12.5, 2.5, 7.25, 0.5]);
          return item;
        });
        const before = legacyCompute(items);
        const after = computeInvoiceTotalsCents(items);
        after.lines.forEach((line, i) => {
          const old = before.lines[i];
          expect(line.lineSubtotalCents).toBe(old.lineSubtotalCents);
          for (const [k, rate, base] of [
            [
              'lineDiscountCents',
              items[i].discountRate ?? 0,
              line.lineSubtotalCents,
            ],
            [
              'lineTaxCents',
              items[i].taxRate ?? 0,
              line.lineSubtotalCents - line.lineDiscountCents,
            ],
          ] as const) {
            // Tax is compared only when the discount (its base) is unchanged.
            if (
              k === 'lineTaxCents' &&
              line.lineDiscountCents !== old.lineDiscountCents
            )
              continue;
            if (line[k] !== old[k]) {
              // Only an exact half cent may differ, by one cent, upwards.
              const exactTimes10000 =
                BigInt(base) * BigInt(Math.round(rate * 100));
              expect(exactTimes10000 % 10000n).toBe(5000n);
              expect(line[k] - old[k]).toBe(1);
              halfCentFixes++;
            }
          }
        });
      }
      expect(halfCentFixes).toBeGreaterThan(0);
    });
  });
});
