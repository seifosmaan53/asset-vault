// Copyright (c) 2025 Asset Vault. All rights reserved.
/* Mirrors backend/src/invoices/utils/invoice-totals.util.ts.

   The arithmetic is identical. The difference is in HOW invalid input is reported:
   the backend throws BadRequestException, while this copy must not throw — it runs
   inside a useMemo during render in InvoiceForm, so a throw on a half-typed value
   (a discount of "150" mid-keystroke) would blank the form.

   Instead, `validateInvoiceItems()` returns the SAME verdicts the backend would throw
   on, as data. Callers show those errors and block submit, so the UI can no longer
   display a total for an invoice the API will reject.

   Keep both the arithmetic AND the validation rules in sync by hand until the module
   is extracted into a package both sides import. The rules mirrored here come from
   backend/src/common/utils/edge-case-protection.util.ts. */

/**
 * Round cents value symmetrically (round half away from zero)
 * For positive: Math.round (rounds 0.5 up)
 * For negative: -Math.round(-x) (rounds -0.5 down, symmetric)
 */
function roundCents(x: number): number {
  return x >= 0 ? Math.round(x) : -Math.round(-x);
}

/**
 * Convert money (decimal) to cents (integer)
 */
function moneyToCents(money: number): number {
  return roundCents(money * 100);
}

/**
 * Convert cents (integer) to money (decimal)
 */
export function centsToMoney(cents: number): number {
  return cents / 100;
}

/**
 * Apply percentage to money amount (returns cents)
 */
function moneyApplyPercent(money: number, percent: number): number {
  const cents = moneyToCents(money);
  const percentCents = roundCents(cents * (percent / 100));
  return percentCents;
}

export interface InvoiceItemDto {
  quantity: number;
  unitPrice: number;
  discountRate?: number;
  taxRate?: number;
  description?: string;
  inventoryItemId?: string;
}

export interface InvoiceTotalsResult {
  lines: Array<{
    lineSubtotalCents: number;
    lineDiscountCents: number;
    lineTaxCents: number;
    lineTotalCents: number;
  }>;
  invoice: {
    subtotalCents: number;
    discountCents: number;
    taxCents: number;
    totalCents: number;
  };
}

/**
 * Compute invoice totals using cents-based arithmetic
 * 
 * This function provides a single source of truth for all invoice calculations,
 * preventing floating-point precision errors and ensuring consistency between
 * frontend and backend.
 * 
 * Policy decisions:
 * - Discount allocation: Per-line (each item has its own discount rate)
 * - Tax policy: After discount (tax calculated on discounted amount)
 * - Rounding policy: Per-line (round each line, then sum)
 * - Rounding method: Round half away from zero (symmetric rounding)
 */
export function computeInvoiceTotalsCents(
  items: InvoiceItemDto[],
  invoiceDiscount?: number,
  taxPolicy: 'afterDiscount' | 'beforeDiscount' = 'afterDiscount',
  roundingPolicy: 'perLine' | 'invoiceOnly' = 'perLine'
): InvoiceTotalsResult {
  /* Both of these are part of the documented signature but are not implemented yet
     (the body only applies per-line discounts and always rounds per line). Silently
     ignoring them would hand back a total that is quietly wrong, so fail loudly. */
  if (invoiceDiscount !== undefined && invoiceDiscount !== 0) {
    throw new Error(
      'computeInvoiceTotalsCents: invoice-level discount is not implemented yet — ' +
      'apply the discount per line item instead.',
    );
  }
  if (roundingPolicy !== 'perLine') {
    throw new Error(
      "computeInvoiceTotalsCents: only the 'perLine' rounding policy is implemented.",
    );
  }

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

  const lineResults = items.map((item) => {
    // Validate and convert to cents
    const quantity = Math.floor(Number(item.quantity)) || 0;
    if (quantity < 1) {
      return {
        lineSubtotalCents: 0,
        lineDiscountCents: 0,
        lineTaxCents: 0,
        lineTotalCents: 0,
      };
    }

    const unitPriceCents = moneyToCents(Number(item.unitPrice) || 0);
    const discountRate = Number(item.discountRate) || 0;
    const taxRate = Number(item.taxRate) || 0;

    // Calculate line subtotal in cents
    const lineSubtotalCents = roundCents(unitPriceCents * quantity);

    // Calculate line discount in cents
    const lineDiscountCents = roundCents(lineSubtotalCents * (discountRate / 100));

    // Calculate line amount after discount
    const lineAfterDiscountCents = lineSubtotalCents - lineDiscountCents;

    // Calculate line tax in cents (after discount if policy is 'afterDiscount')
    let lineTaxCents = 0;
    if (taxPolicy === 'afterDiscount') {
      lineTaxCents = roundCents(lineAfterDiscountCents * (taxRate / 100));
    } else {
      lineTaxCents = roundCents(lineSubtotalCents * (taxRate / 100));
    }

    // Calculate line total in cents
    const lineTotalCents = lineAfterDiscountCents + lineTaxCents;

    return {
      lineSubtotalCents,
      lineDiscountCents,
      lineTaxCents,
      lineTotalCents,
    };
  });

  // Sum all line totals
  const invoiceSubtotalCents = lineResults.reduce((sum, line) => sum + line.lineSubtotalCents, 0);
  const invoiceDiscountCents = lineResults.reduce((sum, line) => sum + line.lineDiscountCents, 0);
  const invoiceTaxCents = lineResults.reduce((sum, line) => sum + line.lineTaxCents, 0);
  const invoiceTotalCents = lineResults.reduce((sum, line) => sum + line.lineTotalCents, 0);

  return {
    lines: lineResults,
    invoice: {
      subtotalCents: invoiceSubtotalCents,
      discountCents: invoiceDiscountCents,
      taxCents: invoiceTaxCents,
      totalCents: invoiceTotalCents,
    },
  };
}

/**
 * Convert invoice totals result from cents to money (for display)
 */
export function invoiceTotalsToMoney(result: InvoiceTotalsResult): {
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
} {
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


/* ------------------------------------------------------------------ *
 * Validation parity with the backend
 * ------------------------------------------------------------------ */

/** Largest money value the backend accepts (MAX_SAFE_FINANCIAL_VALUE). */
const MAX_SAFE_FINANCIAL_VALUE = 999999999999.99;

/** Largest quantity the backend accepts per line item. */
const MAX_QUANTITY = 1000000;

export interface InvoiceValidationError {
  /** Dotted path of the offending field, e.g. "items[0].quantity". */
  field: string;
  /** Human-readable reason, worded as the backend words it. */
  message: string;
}

/** Mirrors backend validateNumber() for a required, finite number. */
function checkNumber(
  value: unknown,
  field: string,
  opts: { integer?: boolean; min?: number; max?: number; required?: boolean },
): { ok: true; value: number } | { ok: false; error: InvoiceValidationError } {
  const { integer = false, min, max, required = true } = opts;
  const err = (message: string) => ({ ok: false as const, error: { field, message } });

  if (value === null || value === undefined || value === '') {
    return required ? err(`${field} is required`) : { ok: true, value: 0 };
  }

  const num = Number(value);
  if (Number.isNaN(num)) return err(`${field} must be a valid number`);
  if (!Number.isFinite(num)) return err(`${field} must be a finite number`);
  if (integer && !Number.isInteger(num)) return err(`${field} must be an integer`);
  if (min !== undefined && num < min) return err(`${field} must be at least ${min}`);
  if (max !== undefined && num > max) return err(`${field} must be at most ${max}`);

  return { ok: true, value: num };
}

/** Mirrors backend validateMoney(): non-negative, finite, at most 2 decimal places. */
function checkMoney(value: unknown, field: string): InvoiceValidationError | null {
  const base = checkNumber(value, field, { min: 0, max: MAX_SAFE_FINANCIAL_VALUE });
  if (!base.ok) return base.error;

  // Backend enforces 2 decimal places via a cents round-trip.
  const cents = Math.round(base.value * 100);
  if (Math.abs(base.value - cents / 100) > 1e-8) {
    return { field, message: `${field} cannot be represented safely in cents` };
  }
  return null;
}

/** Mirrors backend validatePercentage(): a finite number in [0, 100]. */
function checkPercentage(value: unknown, field: string): InvoiceValidationError | null {
  if (value === null || value === undefined || value === '') return null; // optional
  const base = checkNumber(value, field, { min: 0, max: 100 });
  return base.ok ? null : base.error;
}

/**
 * Return every reason the backend would reject these items, as data.
 *
 * An empty array means `computeInvoiceTotalsCents` will produce a total the API
 * will also accept. A non-empty array means the displayed total is not
 * submittable, and the caller should surface the messages and block submit.
 */
export function validateInvoiceItems(
  items: InvoiceItemDto[] | null | undefined,
  invoiceDiscount?: number,
): InvoiceValidationError[] {
  const errors: InvoiceValidationError[] = [];
  if (!items || items.length === 0) return errors;

  let subtotalCents = 0;

  items.forEach((item, i) => {
    const qtyField = `items[${i}].quantity`;
    const priceField = `items[${i}].unitPrice`;

    const qty = checkNumber(item?.quantity, qtyField, {
      integer: true,
      min: 1,
      max: MAX_QUANTITY,
    });
    if (!qty.ok) errors.push(qty.error);

    const priceErr = checkMoney(item?.unitPrice, priceField);
    if (priceErr) errors.push(priceErr);

    const taxErr = checkPercentage(item?.taxRate, `items[${i}].taxRate`);
    if (taxErr) errors.push(taxErr);

    const discErr = checkPercentage(item?.discountRate, `items[${i}].discountRate`);
    if (discErr) errors.push(discErr);

    if (qty.ok && !priceErr) {
      subtotalCents += qty.value * Math.round(Number(item.unitPrice) * 100);
    }
  });

  // Backend rejects an invoice-level discount larger than the subtotal.
  if (invoiceDiscount !== undefined && invoiceDiscount !== null) {
    const pctErr = checkPercentage(invoiceDiscount, 'invoiceDiscount');
    if (pctErr) {
      errors.push(pctErr);
    } else {
      const discountCents = roundCents(subtotalCents * (Number(invoiceDiscount) / 100));
      if (discountCents > subtotalCents) {
        errors.push({
          field: 'invoiceDiscount',
          message: `Invoice-level discount (${invoiceDiscount}%) exceeds subtotal`,
        });
      }
    }
  }

  return errors;
}
