// Copyright (c) 2025 Asset Vault. All rights reserved.

import { useState, useEffect, useCallback } from 'react';
import { logger } from '../utils/logger';

export interface ColumnPreferences {
  visible: boolean;
  width?: number;
  order?: number;
}

export interface TableColumnPreferences {
  [columnId: string]: ColumnPreferences;
}

const STORAGE_PREFIX = 'table-columns-';

/**
 * Hook for managing table column preferences (visibility, width, order)
 */
export const useTableColumns = (
  tableId: string,
  defaultColumns: string[],
  defaultPreferences?: TableColumnPreferences,
) => {
  const storageKey = `${STORAGE_PREFIX}${tableId}`;

  const [preferences, setPreferences] = useState<TableColumnPreferences>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      logger.warn('Failed to load column preferences:', error);
    }
    return defaultPreferences || {};
  });

  // Initialize preferences for columns that don't have them
  useEffect(() => {
    const updated = { ...preferences };
    let hasChanges = false;

    defaultColumns.forEach((columnId, index) => {
      if (!updated[columnId]) {
        updated[columnId] = {
          visible: true,
          order: index,
        };
        hasChanges = true;
      }
    });

    if (hasChanges) {
      setPreferences(updated);
      try {
        localStorage.setItem(storageKey, JSON.stringify(updated));
      } catch (error) {
        logger.warn('Failed to save column preferences:', error);
      }
    }
  }, [defaultColumns, storageKey, preferences]);

  // Save preferences to localStorage
  const savePreferences = useCallback(
    (newPreferences: TableColumnPreferences) => {
      setPreferences(newPreferences);
      try {
        localStorage.setItem(storageKey, JSON.stringify(newPreferences));
      } catch (error) {
        logger.warn('Failed to save column preferences:', error);
      }
    },
    [storageKey],
  );

  // Toggle column visibility
  const toggleColumnVisibility = useCallback(
    (columnId: string) => {
      const updated = {
        ...preferences,
        [columnId]: {
          ...preferences[columnId],
          visible: !preferences[columnId]?.visible,
        },
      };
      savePreferences(updated);
    },
    [preferences, savePreferences],
  );

  // Set column width
  const setColumnWidth = useCallback(
    (columnId: string, width: number) => {
      const updated = {
        ...preferences,
        [columnId]: {
          ...preferences[columnId],
          width,
        },
      };
      savePreferences(updated);
    },
    [preferences, savePreferences],
  );

  // Set column order
  const setColumnOrder = useCallback(
    (columnIds: string[]) => {
      const updated = { ...preferences };
      columnIds.forEach((columnId, index) => {
        updated[columnId] = {
          ...updated[columnId],
          order: index,
        };
      });
      savePreferences(updated);
    },
    [preferences, savePreferences],
  );

  // Reset to defaults
  const resetPreferences = useCallback(() => {
    const defaultPrefs: TableColumnPreferences = {};
    defaultColumns.forEach((columnId, index) => {
      defaultPrefs[columnId] = {
        visible: true,
        order: index,
      };
    });
    savePreferences(defaultPrefs);
  }, [defaultColumns, savePreferences]);

  // Get visible columns in order
  const getVisibleColumns = useCallback((): string[] => {
    return defaultColumns
      .filter((colId) => preferences[colId]?.visible !== false)
      .sort((a, b) => {
        const orderA = preferences[a]?.order ?? defaultColumns.indexOf(a);
        const orderB = preferences[b]?.order ?? defaultColumns.indexOf(b);
        return orderA - orderB;
      });
  }, [defaultColumns, preferences]);

  return {
    preferences,
    toggleColumnVisibility,
    setColumnWidth,
    setColumnOrder,
    resetPreferences,
    getVisibleColumns,
  };
};
