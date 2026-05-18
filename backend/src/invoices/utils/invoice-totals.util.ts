// Copyright (c) 2025 Asset Vault. All rights reserved.

import { BadRequestException } from '@nestjs/common';
import {
  moneyToCents,
  centsToMoney,
  moneyApplyPercent,
  moneyAdd,
  moneySubtract,
  validateNumber,
  validatePercentage,
} from '../../common/utils/edge-case-protection.util';
import { InvoiceItemDto } from '../dto';

/**
 * Round cents value symmetrically (round half away from zero)
 * For positive: Math.round (rounds 0.5 up)
 * For negative: -Math.round(-x) (rounds -0.5 down, symmetric)
 */
function roundCents(x: number): number {
  return x >= 0 ? Math.round(x) : -Math.round(-x);
}

/**
 * Result structure for invoice totals calculation
 */
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
 * - Tax base: Tax after discount (standard practice)
 * - Rounding: Round at line level, sum lines to totals (per-line rounding)
 * 
 * @param items - Array of invoice items
 * @param invoiceDiscount - Optional invoice-level discount percentage (0-100)
 * @param taxPolicy - Whether tax is calculated after discount (default) or before
 * @param roundingPolicy - Whether to round per-line (default) or only at invoice level
 * @returns Totals in cents (integers) for precise calculations
 */
export function computeInvoiceTotalsCents(
  items: InvoiceItemDto[],
  invoiceDiscount?: number,
  taxPolicy: 'afterDiscount' | 'beforeDiscount' = 'afterDiscount',
  roundingPolicy: 'perLine' | 'invoiceOnly' = 'perLine',
): InvoiceTotalsResult {
  // Validate items array
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

  const lineResults: InvoiceTotalsResult['lines'] = [];
  let invoiceSubtotalCents = 0;
  let invoiceDiscountCents = 0;
  let invoiceTaxCents = 0;

  // Process each line item
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    
    // Validate quantity (must be integer, min 1)
    const quantity = validateNumber(item.quantity, `items[${i}].quantity`, {
      required: true,
      integer: true, // No flooring - reject decimals upfront
      min: 1,
      max: 1000000, // Reasonable upper bound
    });

    // Validate unit price (non-negative)
    const unitPriceCents = moneyToCents(item.unitPrice, `items[${i}].unitPrice`);

    // Validate tax rate (0-100, optional)
    const taxRate = item.taxRate !== undefined && item.taxRate !== null
      ? validatePercentage(item.taxRate, `items[${i}].taxRate`, false)
      : 0;

    // Validate discount rate (0-100, optional)
    const discountRate = item.discountRate !== undefined && item.discountRate !== null
      ? validatePercentage(item.discountRate, `items[${i}].discountRate`, false)
      : 0;

    // Calculate line subtotal in cents
    const lineSubtotalCents = quantity * unitPriceCents;

    // Calculate line discount in cents
    const lineDiscountCents = roundCents(lineSubtotalCents * (discountRate / 100));

    // Calculate line amount after discount
    const lineAfterDiscountCents = lineSubtotalCents - lineDiscountCents;

    // Validate discount doesn't exceed subtotal (prevent negative)
    if (lineAfterDiscountCents < 0) {
      throw new BadRequestException(
        `Item ${i + 1}: Discount (${discountRate}%) exceeds subtotal. Discount amount: ${centsToMoney(lineDiscountCents)}, Subtotal: ${centsToMoney(lineSubtotalCents)}`
      );
    }

    // Calculate tax based on policy
    let lineTaxCents: number;
    if (taxPolicy === 'afterDiscount') {
      // Tax calculated on amount after discount (standard practice)
      lineTaxCents = roundCents(lineAfterDiscountCents * (taxRate / 100));
    } else {
      // Tax calculated on subtotal before discount (less common)
      lineTaxCents = roundCents(lineSubtotalCents * (taxRate / 100));
    }

    // Calculate line total: subtotal - discount + tax
    const lineTotalCents = lineAfterDiscountCents + lineTaxCents;

    // Validate line total is non-negative (unless supporting credit notes)
    if (lineTotalCents < 0) {
      throw new BadRequestException(
        `Item ${i + 1}: Line total cannot be negative. Total: ${centsToMoney(lineTotalCents)}`
      );
    }

    // Store line results
    lineResults.push({
      lineSubtotalCents,
      lineDiscountCents,
      lineTaxCents,
      lineTotalCents,
    });

    // Accumulate invoice totals
    invoiceSubtotalCents += lineSubtotalCents;
    invoiceDiscountCents += lineDiscountCents;
    invoiceTaxCents += lineTaxCents;
  }

  // Apply invoice-level discount if provided
  let finalInvoiceDiscountCents = invoiceDiscountCents;
  if (invoiceDiscount !== undefined && invoiceDiscount !== null) {
    const invoiceDiscountPercent = validatePercentage(invoiceDiscount, 'invoiceDiscount', false);
    const invoiceLevelDiscountCents = roundCents(invoiceSubtotalCents * (invoiceDiscountPercent / 100));
    
    // Validate invoice discount doesn't exceed subtotal
    if (invoiceLevelDiscountCents > invoiceSubtotalCents) {
      throw new BadRequestException(
        `Invoice-level discount (${invoiceDiscountPercent}%) exceeds subtotal. Discount: ${centsToMoney(invoiceLevelDiscountCents)}, Subtotal: ${centsToMoney(invoiceSubtotalCents)}`
      );
    }
    
    // Invoice-level discount replaces or adds to line discounts (policy decision: replaces)
    // For now, we'll use the larger of line discounts or invoice discount
    // This can be made configurable if needed
    finalInvoiceDiscountCents = Math.max(invoiceDiscountCents, invoiceLevelDiscountCents);
  }

  // Calculate final invoice total
  const invoiceTotalCents = invoiceSubtotalCents - finalInvoiceDiscountCents + invoiceTaxCents;

  // Validate invoice total is non-negative
  if (invoiceTotalCents < 0) {
    throw new BadRequestException(
      `Invoice total cannot be negative. Total: ${centsToMoney(invoiceTotalCents)}, Subtotal: ${centsToMoney(invoiceSubtotalCents)}, Discount: ${centsToMoney(finalInvoiceDiscountCents)}, Tax: ${centsToMoney(invoiceTaxCents)}`
    );
  }

  return {
    lines: lineResults,
    invoice: {
      subtotalCents: invoiceSubtotalCents,
      discountCents: finalInvoiceDiscountCents,
      taxCents: invoiceTaxCents,
      totalCents: invoiceTotalCents,
    },
  };
}

/**
 * Convert invoice totals result from cents to money (for display/API responses)
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

