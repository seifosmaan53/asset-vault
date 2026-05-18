// Copyright (c) 2025 Asset Vault. All rights reserved.

/**
 * IndexedDB Wrapper for Offline Support
 * Provides persistent storage for React Query cache and offline mutation queue
 */

import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';
import { logger } from './logger';

// Database schema
interface InvoiceMeDB extends DBSchema {
  queryCache: {
    key: string; // Query key as JSON string
    value: {
      data: unknown;
      timestamp: number;
      queryKey: string;
    };
    indexes: { 'by-timestamp': number };
  };
  mutationQueue: {
    key: number; // Auto-increment ID
    value: {
      id: number;
      mutationKey: string;
      variables: unknown;
      timestamp: number;
      retries: number;
      status: 'pending' | 'failed' | 'retrying';
    };
    indexes: { 'by-timestamp': number };
  };
  offlineData: {
    key: string; // Entity type + ID (e.g., 'invoice:123')
    value: {
      entityType: string;
      entityId: string;
      data: unknown;
      timestamp: number;
    };
    indexes: { 'by-entity-type': string; 'by-timestamp': number };
  };
}

const DB_NAME = 'invoiceme-db';
const DB_VERSION = 1;

let dbInstance: IDBPDatabase<InvoiceMeDB> | null = null;

/**
 * Initialize IndexedDB database
 */
export async function initIndexedDB(): Promise<IDBPDatabase<InvoiceMeDB>> {
  if (dbInstance) {
    return dbInstance;
  }

  dbInstance = await openDB<InvoiceMeDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Query cache store
      if (!db.objectStoreNames.contains('queryCache')) {
        const queryStore = db.createObjectStore('queryCache', { keyPath: 'queryKey' });
        queryStore.createIndex('by-timestamp', 'timestamp');
      }

      // Mutation queue store
      if (!db.objectStoreNames.contains('mutationQueue')) {
        const mutationStore = db.createObjectStore('mutationQueue', {
          keyPath: 'id',
          autoIncrement: true,
        });
        mutationStore.createIndex('by-timestamp', 'timestamp');
      }

      // Offline data store
      if (!db.objectStoreNames.contains('offlineData')) {
        const offlineStore = db.createObjectStore('offlineData', { keyPath: 'entityType' });
        offlineStore.createIndex('by-entity-type', 'entityType');
        offlineStore.createIndex('by-timestamp', 'timestamp');
      }
    },
  });

  return dbInstance;
}

/**
 * Get database instance
 */
export async function getDB(): Promise<IDBPDatabase<InvoiceMeDB>> {
  if (!dbInstance) {
    return await initIndexedDB();
  }
  return dbInstance;
}

/**
 * Store query result in IndexedDB
 */
export async function storeQueryCache(queryKey: string, data: unknown): Promise<void> {
  try {
    const db = await getDB();
    await db.put('queryCache', {
      queryKey,
      data,
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('Failed to store query cache:', error);
  }
}

/**
 * Retrieve query result from IndexedDB
 */
export async function getQueryCache(queryKey: string): Promise<unknown | null> {
  try {
    const db = await getDB();
    const cached = await db.get('queryCache', queryKey);
    if (cached && Date.now() - cached.timestamp < 24 * 60 * 60 * 1000) {
      // Cache valid for 24 hours
      return cached.data;
    }
    return null;
  } catch (error) {
    logger.error('Failed to get query cache:', error);
    return null;
  }
}

/**
 * Clear query cache
 */
export async function clearQueryCache(): Promise<void> {
  try {
    const db = await getDB();
    await db.clear('queryCache');
  } catch (error) {
    logger.error('Failed to clear query cache:', error);
  }
}

/**
 * Add mutation to offline queue
 */
export async function queueMutation(
  mutationKey: string,
  variables: unknown,
): Promise<number> {
  try {
    const db = await getDB();
    const id = await db.add('mutationQueue', {
      id: 0, // Auto-increment
      mutationKey,
      variables,
      timestamp: Date.now(),
      retries: 0,
      status: 'pending',
    });
    return id as number;
  } catch (error) {
    logger.error('Failed to queue mutation:', error);
    throw error;
  }
}

/**
 * Get pending mutations from queue
 */
export async function getPendingMutations(): Promise<
  Array<{
    id: number;
    mutationKey: string;
    variables: unknown;
    timestamp: number;
    retries: number;
    status: 'pending' | 'failed' | 'retrying';
  }>
> {
  try {
    const db = await getDB();
    const all = await db.getAll('mutationQueue');
    return all.filter((m) => m.status === 'pending' || m.status === 'retrying');
  } catch (error) {
    logger.error('Failed to get pending mutations:', error);
    return [];
  }
}

/**
 * Remove mutation from queue
 */
export async function removeMutation(id: number): Promise<void> {
  try {
    const db = await getDB();
    await db.delete('mutationQueue', id);
  } catch (error) {
    logger.error('Failed to remove mutation:', error);
  }
}

/**
 * Update mutation status
 */
export async function updateMutationStatus(
  id: number,
  status: 'pending' | 'failed' | 'retrying',
  retries?: number,
): Promise<void> {
  try {
    const db = await getDB();
    const mutation = await db.get('mutationQueue', id);
    if (mutation) {
      await db.put('mutationQueue', {
        ...mutation,
        status,
        retries: retries !== undefined ? retries : mutation.retries,
      });
    }
  } catch (error) {
    logger.error('Failed to update mutation status:', error);
  }
}

/**
 * Store offline entity data
 */
export async function storeOfflineData(
  entityType: string,
  entityId: string,
  data: unknown,
): Promise<void> {
  try {
    const db = await getDB();
    const key = `${entityType}:${entityId}`;
    await db.put('offlineData', {
      entityType: key,
      entityId,
      data,
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('Failed to store offline data:', error);
  }
}

/**
 * Get offline entity data
 */
export async function getOfflineData(entityType: string, entityId: string): Promise<unknown | null> {
  try {
    const db = await getDB();
    const key = `${entityType}:${entityId}`;
    const cached = await db.get('offlineData', key);
    return cached?.data || null;
  } catch (error) {
    logger.error('Failed to get offline data:', error);
    return null;
  }
}

/**
 * Clear all offline data
 */
export async function clearOfflineData(): Promise<void> {
  try {
    const db = await getDB();
    await db.clear('offlineData');
  } catch (error) {
    logger.error('Failed to clear offline data:', error);
  }
}
