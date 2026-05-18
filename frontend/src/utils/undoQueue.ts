// Copyright (c) 2025 Asset Vault. All rights reserved.

import { logger } from './logger';

export interface UndoOperation<T = unknown> {
  id: string;
  type: string;
  description: string;
  data: T;
  restore: () => Promise<void> | void;
  timestamp: number;
  expiresAt: number;
}

const UNDO_EXPIRATION_MS = 10000; // 10 seconds default

export class UndoQueue {
  private operations: Map<string, UndoOperation> = new Map();
  private listeners: Set<(operations: UndoOperation[]) => void> = new Set();

  /**
   * Add an operation to the undo queue
   */
  add<T>(
    type: string,
    description: string,
    data: T,
    restore: () => Promise<void> | void,
    expirationMs: number = UNDO_EXPIRATION_MS,
  ): string {
    const id = `undo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = Date.now();
    const expiresAt = timestamp + expirationMs;

    const operation: UndoOperation<T> = {
      id,
      type,
      description,
      data,
      restore,
      timestamp,
      expiresAt,
    };

    this.operations.set(id, operation);
    this.notifyListeners();

    // Auto-remove expired operations
    setTimeout(() => {
      if (this.operations.has(id)) {
        const op = this.operations.get(id);
        if (op && Date.now() >= op.expiresAt) {
          this.remove(id);
        }
      }
    }, expirationMs);

    return id;
  }

  /**
   * Remove an operation from the queue
   */
  remove(id: string): boolean {
    const removed = this.operations.delete(id);
    if (removed) {
      this.notifyListeners();
    }
    return removed;
  }

  /**
   * Execute undo for an operation
   */
  async undo(id: string): Promise<boolean> {
    const operation = this.operations.get(id);
    if (!operation) {
      return false;
    }

    try {
      await operation.restore();
      this.remove(id);
      return true;
    } catch (error) {
      logger.error('Undo operation failed:', error);
      return false;
    }
  }

  /**
   * Get all operations
   */
  getAll(): UndoOperation[] {
    return Array.from(this.operations.values());
  }

  /**
   * Get operations by type
   */
  getByType(type: string): UndoOperation[] {
    return Array.from(this.operations.values()).filter((op) => op.type === type);
  }

  /**
   * Get the most recent operation
   */
  getLatest(): UndoOperation | undefined {
    const operations = this.getAll();
    if (operations.length === 0) return undefined;
    return operations.sort((a, b) => b.timestamp - a.timestamp)[0];
  }

  /**
   * Clear all operations
   */
  clear(): void {
    this.operations.clear();
    this.notifyListeners();
  }

  /**
   * Clear expired operations
   */
  clearExpired(): void {
    const now = Date.now();
    const expired = Array.from(this.operations.entries()).filter(
      ([, op]) => now >= op.expiresAt,
    );
    expired.forEach(([id]) => this.operations.delete(id));
    if (expired.length > 0) {
      this.notifyListeners();
    }
  }

  /**
   * Subscribe to queue changes
   */
  subscribe(listener: (operations: UndoOperation[]) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    const operations = this.getAll();
    this.listeners.forEach((listener) => listener(operations));
  }

  /**
   * Get operation count
   */
  size(): number {
    return this.operations.size;
  }

  /**
   * Check if an operation exists
   */
  has(id: string): boolean {
    return this.operations.has(id);
  }
}

// Global singleton instance
export const globalUndoQueue = new UndoQueue();

// Auto-cleanup expired operations every 5 seconds
if (typeof window !== 'undefined') {
  setInterval(() => {
    globalUndoQueue.clearExpired();
  }, 5000);
}
