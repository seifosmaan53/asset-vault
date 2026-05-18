// Copyright (c) 2025 Asset Vault. All rights reserved.

import { Logger } from '@nestjs/common';
import { QueryRunner } from 'typeorm';

/**
 * Deadlock Detection and Retry Utility
 * Fixes Issue #50: Missing Database Query Deadlock Detection
 */
export class DeadlockDetector {
  private static readonly logger = new Logger('DeadlockDetector');
  private static readonly MAX_RETRIES = 3;
  private static readonly DEADLOCK_ERROR_CODES = ['40P01', '40001']; // PostgreSQL deadlock error codes

  /**
   * Execute a function with deadlock detection and automatic retry
   */
  static async executeWithRetry<T>(
    operation: (queryRunner: QueryRunner) => Promise<T>,
    queryRunner: QueryRunner,
    maxRetries: number = this.MAX_RETRIES,
  ): Promise<T> {
    let lastError: Error | unknown;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await operation(queryRunner);
      } catch (error: any) {
        lastError = error;
        
        // Check if it's a deadlock error
        const isDeadlock = this.isDeadlockError(error);
        
        if (!isDeadlock || attempt === maxRetries - 1) {
          throw error;
        }
        
        // Calculate exponential backoff with jitter
        const baseDelay = 100; // 100ms base delay
        const delay = baseDelay * Math.pow(2, attempt);
        const jitter = Math.random() * 0.3 * delay; // Up to 30% jitter
        const totalDelay = delay + jitter;
        
        this.logger.warn(
          `Deadlock detected (attempt ${attempt + 1}/${maxRetries}). Retrying in ${Math.round(totalDelay)}ms...`,
        );
        
        await new Promise(resolve => setTimeout(resolve, totalDelay));
      }
    }
    
    throw lastError;
  }

  /**
   * Check if an error is a deadlock error
   */
  private static isDeadlockError(error: any): boolean {
    if (!error) return false;
    
    const errorCode = error.code || error.errno || '';
    const errorMessage = error.message || '';
    
    // Check PostgreSQL deadlock error codes
    if (this.DEADLOCK_ERROR_CODES.includes(String(errorCode))) {
      return true;
    }
    
    // Check for deadlock in error message
    const deadlockKeywords = ['deadlock', 'deadlock detected', 'could not obtain lock'];
    const messageLower = errorMessage.toLowerCase();
    
    return deadlockKeywords.some(keyword => messageLower.includes(keyword));
  }

  /**
   * Get retry configuration for deadlock handling
   */
  static getRetryConfig() {
    return {
      maxRetries: this.MAX_RETRIES,
      baseDelay: 100,
      maxDelay: 5000,
    };
  }
}

