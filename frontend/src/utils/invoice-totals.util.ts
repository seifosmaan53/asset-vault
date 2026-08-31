// Copyright (c) 2025 Asset Vault. All rights reserved.
/* Mirrors backend/src/invoices/utils/invoice-totals.util.ts. The two are NOT identical:
   the backend validates its inputs and throws BadRequestException, this copy does not,
   so the UI can show a total for an invoice the API will reject. Keep the arithmetic in
   sync by hand until the module is extracted into a package both sides import. */

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

