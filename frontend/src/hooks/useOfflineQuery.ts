// Copyright (c) 2025 Asset Vault. All rights reserved.

/**
 * React Query hook with IndexedDB persistence for offline support
 */

import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import { getQueryCache, storeQueryCache } from '../utils/indexedDB';
import { isOnline } from '../utils/offlineSync';

export function useOfflineQuery<TData = unknown, TError = unknown>(
  options: UseQueryOptions<TData, TError> & {
    queryKey: string[];
  },
) {
  const queryKey = JSON.stringify(options.queryKey);

  return useQuery<TData, TError>({
    ...options,
    queryFn: async (context) => {
      // If offline, try to return cached data
      if (!isOnline()) {
        const cached = await getQueryCache(queryKey);
        if (cached) {
          return cached as TData;
        }
        throw new Error('Offline and no cached data available');
      }

      /* queryFn is `QueryFunction | typeof skipToken` in TanStack v5, and skipToken is a
         symbol rather than a function — so it cannot simply be called. Checking first
         also gives a clear failure instead of "not a function" if a caller passes
         skipToken to a hook whose whole purpose is fetching and caching.
         The context is forwarded rather than dropped: it carries the query key, the abort
         signal and the page param, so calling with no arguments would break cancellation
         and any paginated caller. */
      if (typeof options.queryFn !== 'function') {
        throw new Error('useOfflineQuery requires a queryFn that can be called');
      }

      // Online: fetch from API
      const data = await options.queryFn(context);

      // Store in IndexedDB for offline access
      await storeQueryCache(queryKey, data);

      return data;
    },
    /* placeholderData takes a value (or a function of the previous one), not a promise.
       loadFromCache is async, so this handed React Query a Promise to render. The cache
       is already consulted inside queryFn above, which is where the await belongs. */
    // Retry less when offline
    retry: isOnline() ? options.retry : 0,
  });
}
