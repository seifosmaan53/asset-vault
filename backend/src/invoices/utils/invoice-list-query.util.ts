// Copyright (c) 2025 Asset Vault. All rights reserved.

/**
 * Filters accepted by GET /invoices and GET /invoices/paged. Express hands over the query
 * string as-is (no DTO is bound to it), so the amount and paging values arrive as strings;
 * the service passes amounts straight to SQL parameters and converts page/limit with Number().
 */
export interface InvoiceListFilters {
  status?: string;
  type?: string;
  search?: string;
  storeId?: string;
  issueDateFrom?: string;
  issueDateTo?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
  paidDateFrom?: string;
  paidDateTo?: string;
  createdAtFrom?: string;
  createdAtTo?: string;
  totalMin?: number | string;
  totalMax?: number | string;
  subtotalMin?: number | string;
  subtotalMax?: number | string;
}

export interface InvoicePageParams extends InvoiceListFilters {
  page?: number | string;
  limit?: number | string;
}

const FILTER_KEYS = [
  'status',
  'type',
  'search',
  'storeId',
  'issueDateFrom',
  'issueDateTo',
  'dueDateFrom',
  'dueDateTo',
  'paidDateFrom',
  'paidDateTo',
  'createdAtFrom',
  'createdAtTo',
  'totalMin',
  'totalMax',
  'subtotalMin',
  'subtotalMax',
] as const satisfies readonly (keyof InvoiceListFilters)[];

const PAGE_KEYS = ['page', 'limit'] as const;

function pickStrings<K extends string>(
  query: Record<string, unknown>,
  keys: readonly K[],
): Partial<Record<K, string>> {
  const picked: Partial<Record<K, string>> = {};
  for (const key of keys) {
    const value = query[key];
    // A repeated (?status=a&status=b) or bracketed (?status[x]=a) parameter parses to an
    // array or object; none of these filters accepts one, so it is ignored.
    if (typeof value === 'string') {
      picked[key] = value;
    }
  }
  return picked;
}

/** Read the list filters from a parsed query string, keeping only known, single-valued keys. */
export function readInvoiceListFilters(
  query: Record<string, unknown>,
): InvoiceListFilters {
  return pickStrings(query, FILTER_KEYS);
}

/** As readInvoiceListFilters, plus page and limit. */
export function readInvoicePageParams(
  query: Record<string, unknown>,
): InvoicePageParams {
  return pickStrings(query, [...FILTER_KEYS, ...PAGE_KEYS]);
}
