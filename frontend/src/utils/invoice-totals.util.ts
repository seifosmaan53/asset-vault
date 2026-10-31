// Copyright (c) 2025 Asset Vault. All rights reserved.
/* Invoice money for the web app. Validation and arithmetic are NOT implemented
   here: they come from backend/src/common/money/invoice-money.ts (alias
   `@invoice-money`), the same module the API uses, so the form computes
   exactly the totals the API stores and rejects exactly what it rejects. */

import {
  previewInvoiceTotalsCents,
  type InvoiceItemMoneyInput,
  type InvoiceTotalsPreview,
} from '@invoice-money/invoice-money';

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

/* ------------------------------------------------------------------ *
 * Which form lines are submitted, and what blocks submit
 * ------------------------------------------------------------------ */

/** A form line with its description (as the invoice form holds it). */
export interface InvoiceFormLine extends InvoiceFormMoneyFields {
  description?: string | null;
  inventoryItemId?: string | null;
}

/** Longest description the API accepts (InvoiceItemDto @MaxLength). */
export const MAX_DESCRIPTION_LENGTH = 1000;

function isBlank(value: unknown): boolean {
  return value === undefined || value === null || value === '' || (typeof value === 'number' && Number.isNaN(value));
}

/**
 * A line nobody has filled in, exactly as "Add item" creates it: no
 * description, no inventory item, quantity 1 (or empty), and no price or
 * rates. It is left out of both the totals and the submitted invoice. Any
 * other line is submitted and must have a description.
 */
export function isPlaceholderLine(item: InvoiceFormLine | null | undefined): boolean {
  if (!item) return true;
  const zeroOrBlank = (v: unknown) => isBlank(v) || Number(v) === 0;
  return (
    isBlank(item.description?.trim()) &&
    !item.inventoryItemId &&
    (isBlank(item.quantity) || Number(item.quantity) === 1) &&
    zeroOrBlank(item.unitPrice) &&
    zeroOrBlank(item.taxRate) &&
    zeroOrBlank(item.discountRate)
  );
}

export interface InvoiceFormIssue {
  /** 1-based number of the form line, or null for invoice-level issues. */
  line: number | null;
  field: string;
  message: string;
}

export interface InvoiceFormCheck {
  /** Form indexes of the lines that are submitted, in order. */
  submitted: number[];
  /** Totals of exactly those lines (lines the API would reject count as 0). */
  preview: InvoiceTotalsPreview;
  /** Everything that blocks submit, naming the form line. */
  issues: InvoiceFormIssue[];
}

/**
 * The invoice form's lines checked as one: placeholder lines are ignored;
 * every other line is submitted, needs a description, and passes the shared
 * money rules (the API's). Totals shown and the payload come from the same
 * submitted lines, so they agree.
 */
export function checkInvoiceFormLines(
  items: ReadonlyArray<InvoiceFormLine | null | undefined> | null | undefined,
): InvoiceFormCheck {
  const submitted: number[] = [];
  const issues: InvoiceFormIssue[] = [];
  (items ?? []).forEach((item, index) => {
    if (isPlaceholderLine(item)) return;
    submitted.push(index);
    const description = item?.description ?? '';
    if (description.trim() === '') {
      issues.push({ line: index + 1, field: `items[${index}].description`, message: `Line ${index + 1}: description is required` });
    } else if (description.length > MAX_DESCRIPTION_LENGTH) {
      issues.push({
        line: index + 1,
        field: `items[${index}].description`,
        message: `Line ${index + 1}: description must not exceed ${MAX_DESCRIPTION_LENGTH} characters`,
      });
    }
  });
  const preview = previewInvoiceTotalsCents(submitted.map((i) => submittedMoneyFields(items?.[i])));
  for (const issue of preview.issues) {
    // The API's messages index the submitted lines ("items[0]..."); name the form line instead.
    const match = /^items\[(\d+)\]\.?(.*)$/.exec(issue.message);
    if (match) {
      const line = submitted[Number(match[1])] + 1;
      issues.push({ line, field: issue.field, message: `Line ${line}: ${match[2].trim()}` });
    } else {
      issues.push({ line: null, field: issue.field, message: issue.message.charAt(0).toUpperCase() + issue.message.slice(1) });
    }
  }
  return { submitted, preview, issues };
}
