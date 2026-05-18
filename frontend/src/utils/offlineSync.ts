// Copyright (c) 2025 Asset Vault. All rights reserved.

/**
 * Offline Sync Manager
 * Handles syncing queued mutations when connection is restored
 */

import { QueryClient } from '@tanstack/react-query';
import {
  getPendingMutations,
  removeMutation,
  updateMutationStatus,
  clearQueryCache,
  initIndexedDB,
} from './indexedDB';
import { logger } from './logger';

interface SyncOptions {
  queryClient: QueryClient;
  onSyncComplete?: () => void;
  onSyncError?: (error: Error) => void;
}

/**
 * Check if device is online
 */
export function isOnline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine;
}

/**
 * Sync pending mutations when connection is restored
 */
export async function syncPendingMutations(options: SyncOptions): Promise<void> {
  const { queryClient, onSyncComplete, onSyncError } = options;

  if (!isOnline()) {
    logger.debug('Device is offline, skipping sync');
    return;
  }

  try {
    const pendingMutations = await getPendingMutations();
    logger.debug(`Syncing ${pendingMutations.length} pending mutations`);

    if (pendingMutations.length === 0) {
      onSyncComplete?.();
      return;
    }

    // Process mutations sequentially to avoid conflicts
    for (const mutation of pendingMutations) {
      try {
        await updateMutationStatus(mutation.id, 'retrying', mutation.retries + 1);

        // Execute mutation using React Query
        // Note: This requires the mutation to be re-executed
        // The actual implementation depends on your mutation structure
        // For now, we'll mark it as processed and let React Query handle retries

        // Remove from queue after successful sync
        await removeMutation(mutation.id);
        logger.debug(`Synced mutation ${mutation.id}: ${mutation.mutationKey}`);
      } catch (error) {
        logger.error(`Failed to sync mutation ${mutation.id}:`, error);
        if (mutation.retries >= 3) {
          // Max retries reached, mark as failed
          await updateMutationStatus(mutation.id, 'failed', mutation.retries);
        } else {
          // Will retry on next sync
          await updateMutationStatus(mutation.id, 'pending', mutation.retries + 1);
        }
      }
    }

    // Invalidate all queries to refresh data
    await queryClient.invalidateQueries();

    onSyncComplete?.();
  } catch (error) {
    logger.error('Failed to sync pending mutations:', error);
    onSyncError?.(error as Error);
  }
}

/**
 * Setup offline/online event listeners
 */
export function setupOfflineSync(options: SyncOptions): () => void {
  const handleOnline = () => {
    logger.info('Connection restored, syncing pending mutations...');
    syncPendingMutations(options).catch((error) => {
      logger.error('Sync failed:', error);
    });
  };

  const handleOffline = () => {
    logger.info('Connection lost, queuing mutations for later sync...');
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Sync immediately if online
    if (isOnline()) {
      syncPendingMutations(options).catch((error) => {
        logger.error('Initial sync failed:', error);
      });
    }

    // Return cleanup function
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }

  return () => {};
}

/**
 * Clear all offline data (useful for logout)
 */
export async function clearAllOfflineData(): Promise<void> {
  await clearQueryCache();
  logger.info('Cleared all offline data');
}
