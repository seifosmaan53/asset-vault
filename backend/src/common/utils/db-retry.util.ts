// Copyright (c) 2025 Asset Vault. All rights reserved.

import { Logger } from '@nestjs/common';

/**
 * Database connection retry utility with exponential backoff
 * Fixes Issue #24: Missing Database Connection Retry Logic
 */
export async function retryDatabaseConnection<T>(
  operation: () => Promise<T>,
  maxRetries: number = 5,
  initialDelay: number = 1000,
  logger?: Logger,
): Promise<T> {
  let lastError: Error | unknown;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      // Check if it's a connection error
      const isConnectionError = 
        error instanceof Error && (
          error.message.includes('ECONNREFUSED') ||
          error.message.includes('ETIMEDOUT') ||
          error.message.includes('connection') ||
          error.message.includes('Connection') ||
          error.message.includes('timeout')
        );
      
      if (!isConnectionError || attempt === maxRetries - 1) {
        throw error;
      }
      
      // Calculate exponential backoff delay
      const delay = initialDelay * Math.pow(2, attempt);
      const jitter = Math.random() * 0.3 * delay; // Add up to 30% jitter
      const totalDelay = delay + jitter;
      
      if (logger) {
        logger.warn(
          `Database connection attempt ${attempt + 1}/${maxRetries} failed. Retrying in ${Math.round(totalDelay)}ms...`,
          error instanceof Error ? error.message : String(error),
        );
      }
      
      await new Promise(resolve => setTimeout(resolve, totalDelay));
    }
  }
  
  throw lastError;
}

