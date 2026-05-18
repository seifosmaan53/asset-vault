// Copyright (c) 2025 Asset Vault. All rights reserved.

import { SetMetadata } from '@nestjs/common';

export const STANDARD_STATUS_KEY = 'standardStatus';

/**
 * Standard Status Code Decorator
 * Fixes Issue #66: Missing API Response Status Code Standardization
 * 
 * Ensures consistent HTTP status codes across endpoints
 */
export const StandardStatus = (status: number) => SetMetadata(STANDARD_STATUS_KEY, status);

/**
 * Standard status codes for common operations
 */
export const StandardStatusCodes = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
} as const;

