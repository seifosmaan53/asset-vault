// Copyright (c) 2025 Asset Vault. All rights reserved.

/**
 * Error Codes Utility
 * Fixes Issue #65: Missing Standardized Error Codes
 * 
 * Centralized error codes for consistent error handling
 */

export enum ErrorCode {
  // Authentication & Authorization (1000-1999)
  AUTH_REQUIRED = 'AUTH_1001',
  AUTH_INVALID_TOKEN = 'AUTH_1002',
  AUTH_TOKEN_EXPIRED = 'AUTH_1003',
  AUTH_INVALID_CREDENTIALS = 'AUTH_1004',
  AUTH_EMAIL_NOT_VERIFIED = 'AUTH_1005',
  AUTH_INSUFFICIENT_PERMISSIONS = 'AUTH_1006',

  // Validation (2000-2999)
  VALIDATION_FAILED = 'VALID_2001',
  VALIDATION_MISSING_FIELD = 'VALID_2002',
  VALIDATION_INVALID_FORMAT = 'VALID_2003',
  VALIDATION_OUT_OF_RANGE = 'VALID_2004',

  // Resource Not Found (3000-3999)
  NOT_FOUND = 'NOTF_3001',
  USER_NOT_FOUND = 'NOTF_3002',
  CLIENT_NOT_FOUND = 'NOTF_3003',
  INVOICE_NOT_FOUND = 'NOTF_3004',
  INVENTORY_NOT_FOUND = 'NOTF_3005',

  // Business Logic (4000-4999)
  BUSINESS_RULE_VIOLATION = 'BIZ_4001',
  INSUFFICIENT_STOCK = 'BIZ_4002',
  DUPLICATE_ENTRY = 'BIZ_4003',
  INVALID_STATE_TRANSITION = 'BIZ_4004',

  // Database (5000-5999)
  DB_CONNECTION_ERROR = 'DB_5001',
  DB_QUERY_ERROR = 'DB_5002',
  DB_DEADLOCK = 'DB_5003',
  DB_TIMEOUT = 'DB_5004',
  DB_CONSTRAINT_VIOLATION = 'DB_5005',

  // External Services (6000-6999)
  EXTERNAL_SERVICE_ERROR = 'EXT_6001',
  EMAIL_SEND_FAILED = 'EXT_6002',
  FILE_UPLOAD_FAILED = 'EXT_6003',

  // Rate Limiting (7000-7999)
  RATE_LIMIT_EXCEEDED = 'RATE_7001',

  // Internal Server (9000-9999)
  INTERNAL_ERROR = 'INT_9001',
  NOT_IMPLEMENTED = 'INT_9002',
}

/**
 * Get error code from error type
 */
export function getErrorCode(error: Error | string): ErrorCode {
  const errorMessage = typeof error === 'string' ? error : error.message.toLowerCase();

  if (errorMessage.includes('unauthorized') || errorMessage.includes('authentication')) {
    return ErrorCode.AUTH_REQUIRED;
  }
  if (errorMessage.includes('not found')) {
    return ErrorCode.NOT_FOUND;
  }
  if (errorMessage.includes('validation') || errorMessage.includes('invalid')) {
    return ErrorCode.VALIDATION_FAILED;
  }
  if (errorMessage.includes('deadlock')) {
    return ErrorCode.DB_DEADLOCK;
  }
  if (errorMessage.includes('timeout')) {
    return ErrorCode.DB_TIMEOUT;
  }

  return ErrorCode.INTERNAL_ERROR;
}

/**
 * Get user-friendly error message from error code
 */
export function getErrorMessage(code: ErrorCode): string {
  const messages: Record<ErrorCode, string> = {
    [ErrorCode.AUTH_REQUIRED]: 'Authentication required',
    [ErrorCode.AUTH_INVALID_TOKEN]: 'Invalid authentication token',
    [ErrorCode.AUTH_TOKEN_EXPIRED]: 'Authentication token has expired',
    [ErrorCode.AUTH_INVALID_CREDENTIALS]: 'Invalid email or password',
    [ErrorCode.AUTH_EMAIL_NOT_VERIFIED]: 'Email address not verified',
    [ErrorCode.AUTH_INSUFFICIENT_PERMISSIONS]: 'Insufficient permissions',
    [ErrorCode.VALIDATION_FAILED]: 'Validation failed',
    [ErrorCode.VALIDATION_MISSING_FIELD]: 'Required field is missing',
    [ErrorCode.VALIDATION_INVALID_FORMAT]: 'Invalid format',
    [ErrorCode.VALIDATION_OUT_OF_RANGE]: 'Value is out of allowed range',
    [ErrorCode.NOT_FOUND]: 'Resource not found',
    [ErrorCode.USER_NOT_FOUND]: 'User not found',
    [ErrorCode.CLIENT_NOT_FOUND]: 'Client not found',
    [ErrorCode.INVOICE_NOT_FOUND]: 'Invoice not found',
    [ErrorCode.INVENTORY_NOT_FOUND]: 'Inventory item not found',
    [ErrorCode.BUSINESS_RULE_VIOLATION]: 'Business rule violation',
    [ErrorCode.INSUFFICIENT_STOCK]: 'Insufficient stock available',
    [ErrorCode.DUPLICATE_ENTRY]: 'Duplicate entry',
    [ErrorCode.INVALID_STATE_TRANSITION]: 'Invalid state transition',
    [ErrorCode.DB_CONNECTION_ERROR]: 'Database connection error',
    [ErrorCode.DB_QUERY_ERROR]: 'Database query error',
    [ErrorCode.DB_DEADLOCK]: 'Database deadlock detected',
    [ErrorCode.DB_TIMEOUT]: 'Database query timeout',
    [ErrorCode.DB_CONSTRAINT_VIOLATION]: 'Database constraint violation',
    [ErrorCode.EXTERNAL_SERVICE_ERROR]: 'External service error',
    [ErrorCode.EMAIL_SEND_FAILED]: 'Failed to send email',
    [ErrorCode.FILE_UPLOAD_FAILED]: 'File upload failed',
    [ErrorCode.RATE_LIMIT_EXCEEDED]: 'Rate limit exceeded',
    [ErrorCode.INTERNAL_ERROR]: 'Internal server error',
    [ErrorCode.NOT_IMPLEMENTED]: 'Feature not implemented',
  };

  return messages[code] || 'An error occurred';
}

