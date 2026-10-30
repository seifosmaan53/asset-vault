// Copyright (c) 2025 Asset Vault. All rights reserved.
/* Invoice money for the web app. Validation and arithmetic are NOT implemented
   here: they come from backend/src/common/money/invoice-money.ts (alias
   `@invoice-money`), the same module the API uses, so the form computes
   exactly the totals the API stores and rejects exactly what it rejects. */

import type { InvoiceItemMoneyInput } from '@invoice-money/invoice-money';

export {
  centsToMoney,
  computeInvoiceTotalsCents,
  invoiceTotalsToMoney,
  InvoiceMoneyError,
  previewInvoiceTotalsCents,
  validateInvoiceItems,
} from '@invoice-money/invoice-money';
export type {
  InvoiceItemMoneyInput as InvoiceItemDto,
  InvoiceMoneyIssue as InvoiceValidationError,
  InvoiceTotalsPreview,
  InvoiceTotalsResult,
} from '@invoice-money/invoice-money';

/** A form line's money fields. */
export interface InvoiceFormMoneyFields {
  quantity?: unknown;
  unitPrice?: unknown;
  taxRate?: unknown;
  discountRate?: unknown;
}

/**
 * The money fields of a form line exactly as the invoice form submits them
 * (an empty tax or discount rate is sent as 0). Totals and validation shown in
 * the form use this, so they describe what the API receives.
 */
export function submittedMoneyFields(item: InvoiceFormMoneyFields | null | undefined): InvoiceItemMoneyInput {
  return {
    quantity: item?.quantity,
    unitPrice: item?.unitPrice,
    taxRate: item?.taxRate || 0,
    discountRate: item?.discountRate || 0,
  };
}
