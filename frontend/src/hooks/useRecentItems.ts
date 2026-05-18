// Copyright (c) 2025 Asset Vault. All rights reserved.

import { useRecentItems as useRecentItemsContext } from '../contexts/RecentItemsContext';
import { useCallback } from 'react';
import type { RecentItemType } from '../contexts/RecentItemsContext';

/**
 * Hook for tracking and accessing recent items
 */
export const useRecentItems = () => {
  const context = useRecentItemsContext();

  /**
   * Track a viewed item
   */
  const trackView = useCallback(
    (id: string, type: RecentItemType, name: string, url: string) => {
      context.addItem({ id, type, name, url });
    },
    [context.addItem], // Only depend on addItem, not the entire context
  );

  return {
    ...context,
    trackView,
  };
};
