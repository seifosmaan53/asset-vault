// Copyright (c) 2025 Asset Vault. All rights reserved.

/**
 * API Constants
 * Fixes Issue #77: Missing Constants Extraction
 * 
 * Centralized constants for API configuration
 */

export const API_CONSTANTS = {
  // API Versioning
  VERSION: 'v1',
  PREFIX: 'api/v1',

  // Pagination
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  MIN_PAGE_SIZE: 1,

  // Rate Limiting
  RATE_LIMIT_TTL: 60000, // 60 seconds in milliseconds
  RATE_LIMIT_MAX: 100, // Max requests per window

  // Request Limits
  MAX_BODY_SIZE: '10mb',
  REQUEST_TIMEOUT: 30000, // 30 seconds

  // Cache
  DEFAULT_CACHE_TTL: 300000, // 5 minutes
  MAX_CACHE_ITEMS: 100,

  // Database
  DB_CONNECTION_POOL_MAX: 20,
  DB_CONNECTION_POOL_MIN: 5,
  DB_IDLE_TIMEOUT: 30000, // 30 seconds
  DB_CONNECTION_TIMEOUT: 10000, // 10 seconds
  DB_QUERY_TIMEOUT: 30000, // 30 seconds

  // JWT
  JWT_DEFAULT_EXPIRES_IN: '15m',
  JWT_REFRESH_DEFAULT_EXPIRES_IN: '7d',

  // Email Verification
  EMAIL_VERIFICATION_EXPIRES_HOURS: 24,

  // Password Reset
  PASSWORD_RESET_EXPIRES_HOURS: 1,

  // File Upload
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB in bytes
  ALLOWED_FILE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'],

  // Debouncing
  SEARCH_DEBOUNCE_DELAY: 300, // milliseconds

  // Deadlock Retry
  DEADLOCK_MAX_RETRIES: 3,
  DEADLOCK_BASE_DELAY: 100, // milliseconds

  // Network Retry
  NETWORK_MAX_RETRIES: 3,
  NETWORK_BASE_DELAY: 1000, // milliseconds
} as const;

