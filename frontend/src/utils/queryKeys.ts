// Copyright (c) 2025 Asset Vault. All rights reserved.
// Query key utilities for consistent cache management
// FIX #105: Standardized query keys across all hooks

/**
 * Invoice query keys
 */
export const invoiceKeys = {
  all: ['invoices'] as const,
  lists: () => [...invoiceKeys.all, 'list'] as const,
  list: (filters?: { status?: string; type?: string; search?: string }) => {
    const normalized = {
      status: filters?.status || '',
      type: filters?.type || '',
      search: filters?.search || '',
    };
    return [...invoiceKeys.lists(), normalized.status, normalized.type, normalized.search] as const;
  },
  paged: (params?: { page?: number; limit?: number; status?: string; type?: string; search?: string }) => {
    const normalized = {
      page: params?.page || 1,
      limit: params?.limit || 100,
      status: params?.status || '',
      type: params?.type || '',
      search: params?.search || '',
    };
    return [...invoiceKeys.all, 'paged', normalized.page, normalized.limit, normalized.status, normalized.type, normalized.search] as const;
  },
  details: () => [...invoiceKeys.all, 'detail'] as const,
  detail: (id: string) => [...invoiceKeys.details(), id] as const,
  stats: () => [...invoiceKeys.all, 'stats'] as const,
};

/**
 * Inventory query keys
 */
export const inventoryKeys = {
  all: ['inventory'] as const,
  lists: () => [...inventoryKeys.all, 'list'] as const,
  list: (filters?: { search?: string; category?: string; status?: string; lowStockOnly?: boolean }) => {
    return [...inventoryKeys.lists(), filters] as const;
  },
  details: () => [...inventoryKeys.all, 'detail'] as const,
  detail: (id: string) => [...inventoryKeys.details(), id] as const,
  stats: () => [...inventoryKeys.all, 'stats'] as const,
  lowStock: () => [...inventoryKeys.all, 'low-stock'] as const,
  movements: (id: string) => [...inventoryKeys.detail(id), 'movements'] as const,
  linkedInvoices: (id: string) => [...inventoryKeys.detail(id), 'invoices'] as const,
};

/**
 * Client query keys
 */
export const clientKeys = {
  all: ['clients'] as const,
  lists: () => [...clientKeys.all, 'list'] as const,
  list: () => [...clientKeys.lists()] as const,
  details: () => [...clientKeys.all, 'detail'] as const,
  detail: (id: string) => [...clientKeys.details(), id] as const,
};

/**
 * Store query keys
 */
export const storeKeys = {
  all: ['stores'] as const,
  lists: () => [...storeKeys.all, 'list'] as const,
  list: () => [...storeKeys.lists()] as const,
  details: () => [...storeKeys.all, 'detail'] as const,
  detail: (id: string) => [...storeKeys.details(), id] as const,
  stocks: () => [...storeKeys.all, 'stocks'] as const,
  stock: (storeId: string, itemId?: string) => {
    if (itemId) {
      return [...storeKeys.stocks(), storeId, itemId] as const;
    }
    return [...storeKeys.stocks(), storeId] as const;
  },
};

/**
 * Analytics query keys
 */
export const analyticsKeys = {
  all: ['analytics'] as const,
  overview: () => [...analyticsKeys.all, 'overview'] as const,
  stores: (storeId?: string) => {
    if (storeId) {
      return [...analyticsKeys.all, 'stores', storeId] as const;
    }
    return [...analyticsKeys.all, 'stores'] as const;
  },
};

/**
 * Settings query keys
 */
export const settingsKeys = {
  all: ['settings'] as const,
  detail: () => [...settingsKeys.all, 'detail'] as const,
};

