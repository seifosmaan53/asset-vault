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
 * A value as the API's validation sees it after the form sent it: JSON turns
 * NaN and Infinity into null, and the API's ValidationPipe
 * (enableImplicitConversion, number DTO fields) converts strings with Number().
 * So a price loaded from the API as "12.5000" (numeric(12,4)) is 12.5 there.
 */
function asTheApiReceives(value: unknown): unknown {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') return Number(value);
  return value;
}

/**
 * The money fields of a form line as the API receives them when the form
 * submits (an empty tax or discount rate is sent as 0). Totals and validation
 * shown in the form use this, so they describe what the API computes.
 */
export function submittedMoneyFields(item: InvoiceFormMoneyFields | null | undefined): InvoiceItemMoneyInput {
  return {
    quantity: asTheApiReceives(item?.quantity),
    unitPrice: asTheApiReceives(item?.unitPrice),
    taxRate: asTheApiReceives(item?.taxRate || 0),
    discountRate: asTheApiReceives(item?.discountRate || 0),
  };
}
