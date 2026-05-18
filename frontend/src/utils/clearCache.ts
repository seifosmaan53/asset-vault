// Copyright (c) 2025 Asset Vault. All rights reserved.
// Utility to clear React Query cache and localStorage

import { QueryClient } from '@tanstack/react-query';
import { logger } from './logger';

/**
 * Clear all React Query cache
 */

export function clearReactQueryCache(queryClient: QueryClient) {
  queryClient.clear();
  logger.debug('React Query cache cleared');
}

/**
 * Clear all localStorage data related to the app
 */
export function clearLocalStorage() {
  if (typeof window === 'undefined') return;
  
  try {
    // Clear organization-related storage (if any remains)
    localStorage.removeItem('organization-storage');
    localStorage.removeItem('organization-id');
    localStorage.removeItem('x-organization-id');
    
    // Clear React Query persistence (if using)
    const reactQueryKeys = Object.keys(localStorage).filter(key => 
      key.startsWith('REACT_QUERY_OFFLINE_CACHE') || 
      key.startsWith('tanstack-query')
    );
    reactQueryKeys.forEach(key => localStorage.removeItem(key));
    
    logger.debug('LocalStorage cleared');
  } catch (error) {
    logger.error('Error clearing localStorage:', error);
  }
}

/**
 * Clear all caches (React Query + localStorage)
 */
export function clearAllCaches(queryClient: QueryClient) {
  clearReactQueryCache(queryClient);
  clearLocalStorage();
  logger.debug('All caches cleared');
}

