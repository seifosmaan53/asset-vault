// Copyright (c) 2025 Asset Vault. All rights reserved.

import { BadRequestException } from '@nestjs/common';
import {
  computeInvoiceTotalsCents as computeTotals,
  InvoiceMoneyError,
  invoiceTotalsToMoney,
  type InvoiceItemMoneyInput,
  type InvoiceTotalsResult,
  type TaxPolicy,
} from '../../common/money/invoice-money';

/* The API side of invoice money. Validation and arithmetic live in
   src/common/money/invoice-money.ts, which the web app imports as well, so
   both compute identical totals; here an input it rejects becomes a 400 with
   its message. */

export type { InvoiceTotalsResult };
export { invoiceTotalsToMoney };

/**
 * Invoice totals in integer cents (per-line discount, tax after discount by
 * default, per-line rounding half away from zero).
 *
 * @throws BadRequestException with the first validation issue
 */
export function computeInvoiceTotalsCents(
  items: InvoiceItemMoneyInput[],
  invoiceDiscount?: number,
  taxPolicy: TaxPolicy = 'afterDiscount',
): InvoiceTotalsResult {
  try {
    return computeTotals(items, invoiceDiscount, taxPolicy);
  } catch (error) {
    if (error instanceof InvoiceMoneyError) {
      throw new BadRequestException(error.message);
    }
    throw error;
  }
}
