// Copyright (c) 2025 Asset Vault. All rights reserved.

/* Invoice money: the one implementation of invoice-amount validation and
   arithmetic, used by both the API and the web app.

   - API: backend/src/invoices/utils/invoice-totals.util.ts calls it and turns
     the first issue into a 400 response, so server-side validation stays
     authoritative.
   - Web app: frontend/src/utils/invoice-totals.util.ts imports this file
     through the `@invoice-money` alias. The invoice form previews totals with
     it while someone is typing, shows the same issues the API would reject,
     and blocks submit until there are none.

   Keep this file free of imports (NestJS, React, Node built-ins): both builds
   compile it as plain TypeScript.

   Rules (those of the API's earlier implementation):
   - Amounts have two decimal places in every currency: the API validates and
     stores all currencies that way. Internally everything is integer cents.
   - Quantity: an integer from 1 to 1,000,000. Unit price: 0 to
     999,999,999,999.99 with at most two decimals. Tax and discount rates:
     optional, 0 to 100.
   - Per line: the discount is its rate of the line subtotal; tax is charged
     on the amount after discount ('afterDiscount', the default) or on the
     subtotal ('beforeDiscount'). Each is rounded to the cent, half away from
     zero, computed exactly in integers: never with floating-point rates,
     which rounded some exact half cents the wrong way (180 cents at 17.5%).
   - Invoice totals are the sums of the rounded lines. An optional
     invoice-level discount percentage replaces the sum of the line discounts
     when it is larger.
*/

/** Largest money value the API accepts. */
export const MAX_SAFE_FINANCIAL_VALUE = 999999999999.99;
/** The same limit in cents; also bounds every computed line and invoice amount. */
export const MAX_SAFE_CENTS = Math.round(MAX_SAFE_FINANCIAL_VALUE * 100);
/** Largest quantity per line. */
export const MAX_QUANTITY = 1000000;

export type TaxPolicy = 'afterDiscount' | 'beforeDiscount';

/** The money fields of an invoice line, as received (numbers or numeric strings). */
export interface InvoiceItemMoneyInput {
  quantity?: unknown;
  unitPrice?: unknown;
  taxRate?: unknown;
  discountRate?: unknown;
}

export interface InvoiceMoneyIssue {
  /** Path of the offending field, e.g. "items[0].quantity". */
  field: string;
  /** The message the API responds with. */
  message: string;
}

export interface InvoiceLineTotalsCents {
  lineSubtotalCents: number;
  lineDiscountCents: number;
  lineTaxCents: number;
  lineTotalCents: number;
}

export interface InvoiceTotalsResult {
  lines: InvoiceLineTotalsCents[];
  invoice: {
    subtotalCents: number;
    discountCents: number;
    taxCents: number;
    totalCents: number;
  };
}

export interface InvoiceTotalsMoney {
  lines: Array<{
    lineSubtotal: number;
    lineDiscount: number;
    lineTax: number;
    lineTotal: number;
  }>;
  invoice: {
    subtotal: number;
    discount: number;
    tax: number;
    total: number;
  };
}

/** Thrown by computeInvoiceTotalsCents for input the API rejects. */
export class InvoiceMoneyError extends Error {
  readonly issue: InvoiceMoneyIssue;

  constructor(issue: InvoiceMoneyIssue) {
    super(issue.message);
    this.name = 'InvoiceMoneyError';
    this.issue = issue;
  }
}

/* ------------------------------------------------------------------ *
 * Validation (the API's rules and messages, in the API's order)
 * ------------------------------------------------------------------ */

type Checked =
  | { ok: true; value: number }
  | { ok: false; issue: InvoiceMoneyIssue };

interface NumberRules {
  required?: boolean;
  min?: number;
  max?: number;
  integer?: boolean;
  nonNegative?: boolean;
  /** Strings must be plain decimals (no exponent, commas or spaces). */
  strictString?: boolean;
}

const DECIMAL_STRING = /^-?(\d+(\.\d*)?|\.\d+)$/;
const MONEY_STRING = /^(\d+(\.\d{0,2})?|\.\d{1,2})$/;

function fail(
  field: string,
  reason: string,
): { ok: false; issue: InvoiceMoneyIssue } {
  return { ok: false, issue: { field, message: `${field} ${reason}` } };
}

function checkNumber(
  value: unknown,
  field: string,
  rules: NumberRules,
): Checked {
  const {
    required = true,
    min = Number.MIN_SAFE_INTEGER,
    max = Number.MAX_SAFE_INTEGER,
    integer = false,
    nonNegative = false,
    strictString = false,
  } = rules;
  const lo = Math.max(min, Number.MIN_SAFE_INTEGER);
  const hi = Math.min(max, Number.MAX_SAFE_INTEGER);

  if (value === null || value === undefined) {
    return required ? fail(field, 'is required') : { ok: true, value: 0 };
  }
  if (
    strictString &&
    typeof value === 'string' &&
    !DECIMAL_STRING.test(value.trim())
  ) {
    return fail(
      field,
      'must be a decimal number (no exponent, commas, or spaces)',
    );
  }
  const num = Number(value);
  if (Number.isNaN(num)) return fail(field, 'must be a valid number');
  if (!Number.isFinite(num)) return fail(field, 'must be a finite number');
  if (integer && !Number.isInteger(num))
    return fail(field, 'must be an integer');
  if (nonNegative && num < 0) return fail(field, 'must be non-negative');
  if (num < lo) return fail(field, `must be at least ${lo}`);
  if (num > hi) return fail(field, `must be at most ${hi}`);
  return { ok: true, value: num };
}

/** A required, non-negative money amount with at most two decimals, in cents. */
function checkMoneyCents(value: unknown, field: string): Checked {
  const checked = checkNumber(value, field, {
    min: 0,
    max: MAX_SAFE_FINANCIAL_VALUE,
    nonNegative: true,
    strictString: true,
  });
  if (!checked.ok) return checked;
  const rounded = Math.round(checked.value * 100) / 100;
  const tooPrecise =
    typeof value === 'string'
      ? !MONEY_STRING.test(value.trim())
      : Math.abs(checked.value - rounded) > 1e-8;
  if (tooPrecise) return fail(field, 'must have at most 2 decimal places');
  const cents = Math.round(rounded * 100);
  if (Math.abs(rounded - cents / 100) > 1e-8) {
    return fail(field, 'cannot be represented safely in cents');
  }
  if (Math.abs(cents) > MAX_SAFE_CENTS) return fail(field, 'is too large');
  return { ok: true, value: cents };
}

/** An optional percentage (absent = 0). */
function checkPercentage(value: unknown, field: string): Checked {
  if (value === null || value === undefined) return { ok: true, value: 0 };
  return checkNumber(value, field, {
    required: false,
    min: 0,
    max: 100,
    nonNegative: true,
    strictString: true,
  });
}

/* ------------------------------------------------------------------ *
 * Exact arithmetic
 * ------------------------------------------------------------------ */

/** The exact decimal value of a finite number, as numerator / 10^scale. */
function toDecimalFraction(num: number): {
  numerator: bigint;
  denominator: bigint;
} {
  const match = /^(-?)(\d+)(?:\.(\d+))?(?:e([+-]\d+))?$/.exec(num.toString());
  if (!match) throw new Error(`Unexpected number format: ${num}`);
  const [, sign, whole, fraction = '', exponent = '0'] = match;
  let digits = BigInt(`${sign}${whole}${fraction}`);
  let scale = fraction.length - Number(exponent);
  if (scale < 0) {
    digits *= 10n ** BigInt(-scale);
    scale = 0;
  }
  return { numerator: digits, denominator: 10n ** BigInt(scale) };
}

/** numerator / denominator rounded to an integer, half away from zero. */
function roundHalfAwayFromZero(numerator: bigint, denominator: bigint): bigint {
  const negative = numerator < 0n !== denominator < 0n;
  const n = numerator < 0n ? -numerator : numerator;
  const d = denominator < 0n ? -denominator : denominator;
  let quotient = n / d;
  if ((n % d) * 2n >= d) quotient += 1n;
  return negative ? -quotient : quotient;
}

/** `percent`% of `cents`, rounded to the cent (half away from zero), exactly. */
function percentOfCents(cents: bigint, percent: number): bigint {
  if (percent === 0) return 0n;
  const { numerator, denominator } = toDecimalFraction(percent);
  return roundHalfAwayFromZero(cents * numerator, 100n * denominator);
}

/* ------------------------------------------------------------------ *
 * Evaluation
 * ------------------------------------------------------------------ */

const ZERO_LINE: InvoiceLineTotalsCents = {
  lineSubtotalCents: 0,
  lineDiscountCents: 0,
  lineTaxCents: 0,
  lineTotalCents: 0,
};

export interface InvoiceTotalsPreview {
  totals: InvoiceTotalsResult;
  /** Every reason the API rejects the input, in the order it checks them. */
  issues: InvoiceMoneyIssue[];
}

const TOO_LARGE = `amount must be at most ${MAX_SAFE_CENTS}`;

function evaluate(
  items:
    | ReadonlyArray<InvoiceItemMoneyInput | null | undefined>
    | null
    | undefined,
  invoiceDiscount: unknown,
  taxPolicy: TaxPolicy,
): InvoiceTotalsPreview {
  const fieldIssues: InvoiceMoneyIssue[] = [];
  const amountIssues: InvoiceMoneyIssue[] = [];
  const lines: InvoiceLineTotalsCents[] = [];
  let subtotal = 0n;
  let lineDiscounts = 0n;
  let tax = 0n;

  const bounded = (field: string, ...amounts: bigint[]) => {
    if (amounts.some((a) => a > BigInt(MAX_SAFE_CENTS))) {
      amountIssues.push({ field, message: TOO_LARGE });
    }
  };

  (items ?? []).forEach((item, i) => {
    const quantity = checkNumber(item?.quantity, `items[${i}].quantity`, {
      integer: true,
      min: 1,
      max: MAX_QUANTITY,
    });
    const unitPrice = checkMoneyCents(item?.unitPrice, `items[${i}].unitPrice`);
    const taxRate = checkPercentage(item?.taxRate, `items[${i}].taxRate`);
    const discountRate = checkPercentage(
      item?.discountRate,
      `items[${i}].discountRate`,
    );
    if (!quantity.ok || !unitPrice.ok || !taxRate.ok || !discountRate.ok) {
      for (const c of [quantity, unitPrice, taxRate, discountRate]) {
        if (!c.ok) fieldIssues.push(c.issue);
      }
      lines.push({ ...ZERO_LINE });
      return;
    }

    const lineSubtotal = BigInt(quantity.value) * BigInt(unitPrice.value);
    const lineDiscount = percentOfCents(lineSubtotal, discountRate.value);
    const afterDiscount = lineSubtotal - lineDiscount;
    const lineTax = percentOfCents(
      taxPolicy === 'afterDiscount' ? afterDiscount : lineSubtotal,
      taxRate.value,
    );
    const lineTotal = afterDiscount + lineTax;
    bounded(`items[${i}]`, lineSubtotal, lineDiscount, lineTax, lineTotal);

    lines.push({
      lineSubtotalCents: Number(lineSubtotal),
      lineDiscountCents: Number(lineDiscount),
      lineTaxCents: Number(lineTax),
      lineTotalCents: Number(lineTotal),
    });
    subtotal += lineSubtotal;
    lineDiscounts += lineDiscount;
    tax += lineTax;
  });

  let discount = lineDiscounts;
  if (invoiceDiscount !== undefined && invoiceDiscount !== null) {
    const percent = checkPercentage(invoiceDiscount, 'invoiceDiscount');
    if (!percent.ok) {
      fieldIssues.push(percent.issue);
    } else {
      const invoiceLevel = percentOfCents(subtotal, percent.value);
      if (invoiceLevel > discount) discount = invoiceLevel;
    }
  }
  const total = subtotal - discount + tax;
  bounded('invoice', subtotal, discount, tax, total);

  return {
    totals: {
      lines,
      invoice: {
        subtotalCents: Number(subtotal),
        discountCents: Number(discount),
        taxCents: Number(tax),
        totalCents: Number(total),
      },
    },
    issues: [...fieldIssues, ...amountIssues],
  };
}

/* ------------------------------------------------------------------ *
 * Public API
 * ------------------------------------------------------------------ */

/**
 * Every reason the API rejects these invoice amounts, in the API's order.
 * An empty list means computeInvoiceTotalsCents succeeds for them.
 */
export function validateInvoiceItems(
  items:
    | ReadonlyArray<InvoiceItemMoneyInput | null | undefined>
    | null
    | undefined,
  invoiceDiscount?: unknown,
  taxPolicy: TaxPolicy = 'afterDiscount',
): InvoiceMoneyIssue[] {
  return evaluate(items, invoiceDiscount, taxPolicy).issues;
}

/**
 * Invoice totals in integer cents. Throws InvoiceMoneyError with the first
 * issue the API reports (see validateInvoiceItems).
 */
export function computeInvoiceTotalsCents(
  items:
    | ReadonlyArray<InvoiceItemMoneyInput | null | undefined>
    | null
    | undefined,
  invoiceDiscount?: unknown,
  taxPolicy: TaxPolicy = 'afterDiscount',
): InvoiceTotalsResult {
  const { totals, issues } = evaluate(items, invoiceDiscount, taxPolicy);
  if (issues.length > 0) throw new InvoiceMoneyError(issues[0]);
  return totals;
}

/**
 * Totals for display while input is incomplete: never throws. A line with an
 * issue counts as zero; `issues` lists what the API would reject, so a caller
 * shows them and does not submit. With no issues, `totals` equals
 * computeInvoiceTotalsCents.
 */
export function previewInvoiceTotalsCents(
  items:
    | ReadonlyArray<InvoiceItemMoneyInput | null | undefined>
    | null
    | undefined,
  invoiceDiscount?: unknown,
  taxPolicy: TaxPolicy = 'afterDiscount',
): InvoiceTotalsPreview {
  return evaluate(items, invoiceDiscount, taxPolicy);
}

/** Cents to a money amount (always exact to two decimals). */
export function centsToMoney(cents: number): number {
  return cents / 100;
}

/** The totals as money amounts, as the API stores and returns them. */
export function invoiceTotalsToMoney(
  result: InvoiceTotalsResult,
): InvoiceTotalsMoney {
  return {
    lines: result.lines.map((line) => ({
      lineSubtotal: centsToMoney(line.lineSubtotalCents),
      lineDiscount: centsToMoney(line.lineDiscountCents),
      lineTax: centsToMoney(line.lineTaxCents),
      lineTotal: centsToMoney(line.lineTotalCents),
    })),
    invoice: {
      subtotal: centsToMoney(result.invoice.subtotalCents),
      discount: centsToMoney(result.invoice.discountCents),
      tax: centsToMoney(result.invoice.taxCents),
      total: centsToMoney(result.invoice.totalCents),
    },
  };
}
