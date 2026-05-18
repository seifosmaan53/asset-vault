// Copyright (c) 2025 Asset Vault. All rights reserved.

import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode, getErrorCode, getErrorMessage } from './error-codes.util';

/**
 * Error Formatter Utility
 * Fixes Issue #100: Missing Consistent Error Response Formatting
 * 
 * Provides consistent error response formatting across the application
 */
export class ErrorFormatter {
  /**
   * Format error response consistently
   */
  static formatError(
    error: Error | HttpException | unknown,
    statusCode?: HttpStatus,
    path?: string,
  ): {
    statusCode: number;
    errorCode: ErrorCode;
    timestamp: string;
    path?: string;
    message: string;
    errors?: Record<string, string[]>;
    details?: any;
  } {
    let status = statusCode || HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'An error occurred';
    let errors: Record<string, string[]> | undefined;
    let details: any;

    if (error instanceof HttpException) {
      status = error.getStatus();
      const response = error.getResponse();
      
      if (typeof response === 'string') {
        message = response;
      } else if (typeof response === 'object' && response !== null) {
        const responseObj = response as { message?: string | string[]; errors?: Record<string, string[]> };
        message = Array.isArray(responseObj.message) 
          ? responseObj.message.join(', ') 
          : (responseObj.message || message);
        errors = responseObj.errors;
      }
    } else if (error instanceof Error) {
      message = error.message;
      details = process.env.NODE_ENV === 'development' ? error.stack : undefined;
    }

    const errorCode = getErrorCode(error instanceof Error ? error : message);

    return {
      statusCode: status,
      errorCode,
      timestamp: new Date().toISOString(),
      ...(path ? { path } : {}),
      message,
      ...(errors ? { errors } : {}),
      ...(details ? { details } : {}),
    };
  }

  /**
   * Format validation errors
   */
  static formatValidationErrors(
    validationErrors: Array<{ property: string; constraints?: Record<string, string> }>,
  ): Record<string, string[]> {
    const errors: Record<string, string[]> = {};

    validationErrors.forEach(error => {
      if (error.constraints) {
        errors[error.property] = Object.values(error.constraints);
      }
    });

    return errors;
  }

  /**
   * Format database errors
   */
  static formatDatabaseError(error: any): {
    message: string;
    errorCode: ErrorCode;
    details?: any;
  } {
    const errorMessage = error?.message || 'Database error';
    
    // Check for specific database error types
    if (errorMessage.includes('deadlock')) {
      return {
        message: 'A database deadlock occurred. Please try again.',
        errorCode: ErrorCode.DB_DEADLOCK,
      };
    }
    
    if (errorMessage.includes('timeout')) {
      return {
        message: 'Database query timed out. Please try again.',
        errorCode: ErrorCode.DB_TIMEOUT,
      };
    }
    
    if (errorMessage.includes('constraint') || errorMessage.includes('unique')) {
      return {
        message: 'Database constraint violation',
        errorCode: ErrorCode.DB_CONSTRAINT_VIOLATION,
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      };
    }

    return {
      message: 'Database error occurred',
      errorCode: ErrorCode.DB_QUERY_ERROR,
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
    };
  }
}

