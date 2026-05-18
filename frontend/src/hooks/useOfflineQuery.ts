// Copyright (c) 2025 Asset Vault. All rights reserved.

/**
 * React Query hook with IndexedDB persistence for offline support
 */

import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { getQueryCache, storeQueryCache } from '../utils/indexedDB';
import { isOnline } from '../utils/offlineSync';

export function useOfflineQuery<TData = unknown, TError = unknown>(
  options: UseQueryOptions<TData, TError> & {
    queryKey: string[];
  },
) {
  const queryKey = JSON.stringify(options.queryKey);

  // Try to load from IndexedDB first
  const loadFromCache = async () => {
    if (!isOnline()) {
      const cached = await getQueryCache(queryKey);
      if (cached) {
        return cached as TData;
      }
    }
    return undefined;
  };

  return useQuery<TData, TError>({
    ...options,
    queryFn: async () => {
      // If offline, try to return cached data
      if (!isOnline()) {
        const cached = await getQueryCache(queryKey);
        if (cached) {
          return cached as TData;
        }
        throw new Error('Offline and no cached data available');
      }

      // Online: fetch from API
      const data = await options.queryFn!();

      // Store in IndexedDB for offline access
      await storeQueryCache(queryKey, data);

      return data;
    },
    // Use cached data as placeholder
    placeholderData: loadFromCache,
    // Retry less when offline
    retry: isOnline() ? options.retry : 0,
  });
}
