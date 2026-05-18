// Copyright (c) 2025 Asset Vault. All rights reserved.

import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { logger } from '../utils/logger';

export type RecentItemType = 'invoice' | 'client' | 'inventory' | 'store';

export interface RecentItem {
  id: string;
  type: RecentItemType;
  name: string;
  url: string;
  viewedAt: number;
}

interface RecentItemsContextType {
  recentItems: RecentItem[];
  addItem: (item: Omit<RecentItem, 'viewedAt'>) => void;
  removeItem: (id: string, type: RecentItemType) => void;
  clearAll: () => void;
  getItemsByType: (type: RecentItemType) => RecentItem[];
}

const RecentItemsContext = createContext<RecentItemsContextType | undefined>(undefined);

export const useRecentItems = () => {
  const context = useContext(RecentItemsContext);
  if (!context) {
    throw new Error('useRecentItems must be used within RecentItemsProvider');
  }
  return context;
};

interface RecentItemsProviderProps {
  children: ReactNode;
  maxItems?: number;
}

const STORAGE_KEY = 'recent-items';
const DEFAULT_MAX_ITEMS = 10;

export const RecentItemsProvider = ({
  children,
  maxItems = DEFAULT_MAX_ITEMS,
}: RecentItemsProviderProps) => {
  const [recentItems, setRecentItems] = useState<RecentItem[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      logger.warn('Failed to load recent items:', error);
    }
    return [];
  });

  // Save to localStorage whenever items change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(recentItems));
    } catch (error) {
      logger.warn('Failed to save recent items:', error);
    }
  }, [recentItems]);

  const addItem = useCallback(
    (item: Omit<RecentItem, 'viewedAt'>) => {
      setRecentItems((prev) => {
        // Remove existing item with same id and type
        const filtered = prev.filter(
          (existing) => !(existing.id === item.id && existing.type === item.type),
        );
        // Add new item at the beginning
        const updated = [
          { ...item, viewedAt: Date.now() },
          ...filtered,
        ].slice(0, maxItems);
        return updated;
      });
    },
    [maxItems],
  );

  const removeItem = useCallback((id: string, type: RecentItemType) => {
    setRecentItems((prev) =>
      prev.filter((item) => !(item.id === id && item.type === type)),
    );
  }, []);

  const clearAll = useCallback(() => {
    setRecentItems([]);
  }, []);

  const getItemsByType = useCallback(
    (type: RecentItemType) => {
      return recentItems
        .filter((item) => item.type === type)
        .sort((a, b) => b.viewedAt - a.viewedAt);
    },
    [recentItems],
  );

  return (
    <RecentItemsContext.Provider
      value={{
        recentItems,
        addItem,
        removeItem,
        clearAll,
        getItemsByType,
      }}
    >
      {children}
    </RecentItemsContext.Provider>
  );
};
