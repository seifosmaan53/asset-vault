// Copyright (c) 2025 Asset Vault. All rights reserved.

/**
 * Cache Invalidation Strategy
 * Fixes Issue #82: Missing Database Query Result Caching Strategy
 * 
 * Defines cache invalidation rules and strategies
 */
export enum CacheKey {
  // User-related
  USER_PROFILE = 'user:profile',
  USER_SETTINGS = 'user:settings',
  
  // Client-related
  CLIENTS_LIST = 'clients:list',
  CLIENT_DETAIL = 'client:detail',
  
  // Invoice-related
  INVOICES_LIST = 'invoices:list',
  INVOICE_DETAIL = 'invoice:detail',
  INVOICE_STATS = 'invoices:stats',
  
  // Inventory-related
  INVENTORY_LIST = 'inventory:list',
  INVENTORY_DETAIL = 'inventory:detail',
  INVENTORY_STATS = 'inventory:stats',
  LOW_STOCK = 'inventory:low-stock',
  
  // Store-related
  STORES_LIST = 'stores:list',
  STORE_DETAIL = 'store:detail',
  STORE_STOCK = 'store:stock',
  
  // Analytics-related
  ANALYTICS_REVENUE = 'analytics:revenue',
  ANALYTICS_TOP_ITEMS = 'analytics:top-items',
  ANALYTICS_STORE = 'analytics:store',
}

export interface CacheInvalidationRule {
  /**
   * Cache keys to invalidate when this entity is modified
   */
  invalidateOnCreate?: CacheKey[];
  invalidateOnUpdate?: CacheKey[];
  invalidateOnDelete?: CacheKey[];
}

/**
 * Cache invalidation rules mapping
 */
export const CACHE_INVALIDATION_RULES: Record<string, CacheInvalidationRule> = {
  // User changes invalidate user-related caches
  user: {
    invalidateOnUpdate: [CacheKey.USER_PROFILE],
    invalidateOnDelete: [CacheKey.USER_PROFILE, CacheKey.USER_SETTINGS],
  },

  // Client changes invalidate client and invoice caches
  client: {
    invalidateOnCreate: [CacheKey.CLIENTS_LIST],
    invalidateOnUpdate: [CacheKey.CLIENTS_LIST, CacheKey.CLIENT_DETAIL, CacheKey.INVOICES_LIST],
    invalidateOnDelete: [CacheKey.CLIENTS_LIST, CacheKey.CLIENT_DETAIL, CacheKey.INVOICES_LIST],
  },

  // Invoice changes invalidate invoice and analytics caches
  invoice: {
    invalidateOnCreate: [CacheKey.INVOICES_LIST, CacheKey.INVOICE_STATS, CacheKey.ANALYTICS_REVENUE],
    invalidateOnUpdate: [CacheKey.INVOICES_LIST, CacheKey.INVOICE_DETAIL, CacheKey.INVOICE_STATS, CacheKey.ANALYTICS_REVENUE],
    invalidateOnDelete: [CacheKey.INVOICES_LIST, CacheKey.INVOICE_DETAIL, CacheKey.INVOICE_STATS, CacheKey.ANALYTICS_REVENUE],
  },

  // Inventory changes invalidate inventory and store caches
  inventory: {
    invalidateOnCreate: [CacheKey.INVENTORY_LIST, CacheKey.INVENTORY_STATS],
    invalidateOnUpdate: [CacheKey.INVENTORY_LIST, CacheKey.INVENTORY_DETAIL, CacheKey.INVENTORY_STATS, CacheKey.LOW_STOCK, CacheKey.STORE_STOCK],
    invalidateOnDelete: [CacheKey.INVENTORY_LIST, CacheKey.INVENTORY_DETAIL, CacheKey.INVENTORY_STATS, CacheKey.LOW_STOCK, CacheKey.STORE_STOCK],
  },

  // Store changes invalidate store and analytics caches
  store: {
    invalidateOnCreate: [CacheKey.STORES_LIST],
    invalidateOnUpdate: [CacheKey.STORES_LIST, CacheKey.STORE_DETAIL, CacheKey.STORE_STOCK, CacheKey.ANALYTICS_STORE],
    invalidateOnDelete: [CacheKey.STORES_LIST, CacheKey.STORE_DETAIL, CacheKey.STORE_STOCK, CacheKey.ANALYTICS_STORE],
  },
};

/**
 * Get cache keys to invalidate for an entity operation
 */
export function getCacheKeysToInvalidate(
  entityType: string,
  operation: 'create' | 'update' | 'delete',
): CacheKey[] {
  const rule = CACHE_INVALIDATION_RULES[entityType];
  if (!rule) {
    return [];
  }

  switch (operation) {
    case 'create':
      return rule.invalidateOnCreate || [];
    case 'update':
      return rule.invalidateOnUpdate || [];
    case 'delete':
      return rule.invalidateOnDelete || [];
    default:
      return [];
  }
}

/**
 * Build cache key with parameters
 */
export function buildCacheKey(baseKey: CacheKey, params: Record<string, string | number>): string {
  const paramString = Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}:${value}`)
    .join(':');
  
  return paramString ? `${baseKey}:${paramString}` : baseKey;
}

