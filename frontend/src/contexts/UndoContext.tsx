// Copyright (c) 2025 Asset Vault. All rights reserved.

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { globalUndoQueue, type UndoOperation } from '../utils/undoQueue';
import { useToast } from './ToastContext';

interface UndoContextType {
  addOperation: <T>(
    type: string,
    description: string,
    data: T,
    restore: () => Promise<void> | void,
    expirationMs?: number,
  ) => string;
  undo: (id: string) => Promise<boolean>;
  removeOperation: (id: string) => boolean;
  getOperations: () => UndoOperation[];
  getLatestOperation: () => UndoOperation | undefined;
  clearAll: () => void;
}

const UndoContext = createContext<UndoContextType | undefined>(undefined);

export const useUndo = () => {
  const context = useContext(UndoContext);
  if (!context) {
    throw new Error('useUndo must be used within UndoProvider');
  }
  return context;
};

interface UndoProviderProps {
  children: ReactNode;
  showToastOnUndo?: boolean;
}

export const UndoProvider = ({ children, showToastOnUndo = true }: UndoProviderProps) => {
  const [operations, setOperations] = useState<UndoOperation[]>([]);
  const { showToastWithAction } = useToast();

  useEffect(() => {
    // Subscribe to queue changes
    const unsubscribe = globalUndoQueue.subscribe((ops) => {
      setOperations(ops);
    });

    // Initial load
    setOperations(globalUndoQueue.getAll());

    return unsubscribe;
  }, []);

  const addOperation = useCallback(
    <T,>(
      type: string,
      description: string,
      data: T,
      restore: () => Promise<void> | void,
      expirationMs?: number,
    ): string => {
      const id = globalUndoQueue.add(type, description, data, restore, expirationMs);

      // Show toast with undo button
      if (showToastOnUndo) {
        showToastWithAction(description, {
          severity: 'success',
          undo: async () => {
            await undo(id);
          },
          autoHideDuration: expirationMs || 10000,
        });
      }

      return id;
    },
    [showToastOnUndo, showToastWithAction],
  );

  const undo = useCallback(
    async (id: string): Promise<boolean> => {
      const success = await globalUndoQueue.undo(id);
      if (success && showToastOnUndo) {
        showToastWithAction('Action undone', { severity: 'info' });
      }
      return success;
    },
    [showToastOnUndo, showToastWithAction],
  );

  const removeOperation = useCallback((id: string): boolean => {
    return globalUndoQueue.remove(id);
  }, []);

  const getOperations = useCallback((): UndoOperation[] => {
    return globalUndoQueue.getAll();
  }, []);

  const getLatestOperation = useCallback((): UndoOperation | undefined => {
    return globalUndoQueue.getLatest();
  }, []);

  const clearAll = useCallback((): void => {
    globalUndoQueue.clear();
  }, []);

  return (
    <UndoContext.Provider
      value={{
        addOperation,
        undo,
        removeOperation,
        getOperations,
        getLatestOperation,
        clearAll,
      }}
    >
      {children}
    </UndoContext.Provider>
  );
};
