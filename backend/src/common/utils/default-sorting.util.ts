// Copyright (c) 2025 Asset Vault. All rights reserved.

/**
 * Default Sorting Utility
 * Fixes Issue #67: Missing Database Query Result Sorting
 * 
 * Provides consistent default sorting for list queries
 */
export interface SortOptions {
  field: string;
  direction: 'ASC' | 'DESC';
}

export const DEFAULT_SORT_OPTIONS: Record<string, SortOptions> = {
  invoices: {
    field: 'createdAt',
    direction: 'DESC',
  },
  clients: {
    field: 'name',
    direction: 'ASC',
  },
  inventory: {
    field: 'name',
    direction: 'ASC',
  },
  stores: {
    field: 'name',
    direction: 'ASC',
  },
  // recurringInvoices: { // Removed
  //   field: 'nextRunDate',
  //   direction: 'ASC',
  // },
  // invoiceTemplates: { // Removed
  //   field: 'name',
  //   direction: 'ASC',
  // },
  stockMovements: {
    field: 'createdAt',
    direction: 'DESC',
  },
};

/**
 * Get default sort options for an entity type
 */
export function getDefaultSort(entityType: string): SortOptions {
  return DEFAULT_SORT_OPTIONS[entityType] || {
    field: 'createdAt',
    direction: 'DESC',
  };
}

/**
 * Apply default sorting if no sort is specified
 */
export function applyDefaultSort(
  entityType: string,
  sortField?: string,
  sortDirection?: 'ASC' | 'DESC',
): SortOptions {
  if (sortField && sortDirection) {
    return { field: sortField, direction: sortDirection };
  }

  return getDefaultSort(entityType);
}

