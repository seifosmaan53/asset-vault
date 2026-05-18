// Copyright (c) 2025 Asset Vault. All rights reserved.

import { useUndo as useUndoContext } from '../contexts/UndoContext';
import { useToast } from '../contexts/ToastContext';
import { useCallback } from 'react';

/**
 * Hook for undo operations
 * Provides a convenient interface for adding undo operations and showing toast notifications
 */
export const useUndo = () => {
  const undoContext = useUndoContext();
  const { showToastWithAction } = useToast();

  /**
   * Add an undo operation with automatic toast notification
   */
  const addUndoOperation = useCallback(
    <T,>(
      type: string,
      description: string,
      data: T,
      restore: () => Promise<void> | void,
      expirationMs: number = 10000,
    ): string => {
      return undoContext.addOperation(type, description, data, restore, expirationMs);
    },
    [undoContext],
  );

  /**
   * Execute undo for an operation
   */
  const executeUndo = useCallback(
    async (id: string): Promise<boolean> => {
      return await undoContext.undo(id);
    },
    [undoContext],
  );

  /**
   * Quick helper for delete operations with undo
   */
  const createDeleteUndo = useCallback(
    <T,>(
      type: string,
      itemName: string,
      deletedItem: T,
      restoreFn: (item: T) => Promise<void> | void,
      expirationMs: number = 10000,
    ): string => {
      return addUndoOperation(
        type,
        `${itemName} deleted`,
        deletedItem,
        () => restoreFn(deletedItem),
        expirationMs,
      );
    },
    [addUndoOperation],
  );

  /**
   * Quick helper for create operations with undo
   */
  const createCreateUndo = useCallback(
    <T,>(
      type: string,
      itemName: string,
      createdItem: T,
      deleteFn: (item: T) => Promise<void> | void,
      expirationMs: number = 10000,
    ): string => {
      return addUndoOperation(
        type,
        `${itemName} created`,
        createdItem,
        () => deleteFn(createdItem),
        expirationMs,
      );
    },
    [addUndoOperation],
  );

  /**
   * Quick helper for update operations with undo
   */
  const createUpdateUndo = useCallback(
    <T,>(
      type: string,
      itemName: string,
      previousData: T,
      restoreFn: (item: T) => Promise<void> | void,
      expirationMs: number = 10000,
    ): string => {
      return addUndoOperation(
        type,
        `${itemName} updated`,
        previousData,
        () => restoreFn(previousData),
        expirationMs,
      );
    },
    [addUndoOperation],
  );

  return {
    addOperation: addUndoOperation,
    undo: executeUndo,
    removeOperation: undoContext.removeOperation,
    getOperations: undoContext.getOperations,
    getLatestOperation: undoContext.getLatestOperation,
    clearAll: undoContext.clearAll,
    createDeleteUndo,
    createCreateUndo,
    createUpdateUndo,
  };
};
