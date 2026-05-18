// Copyright (c) 2025 Asset Vault. All rights reserved.

import { SetMetadata } from '@nestjs/common';

export const API_VERSION_KEY = 'apiVersion';
export const DEFAULT_API_VERSION = 'v1';

/**
 * API Version Decorator
 * Fixes Issue #33: Enhanced API Versioning Strategy
 * 
 * Allows controllers/endpoints to specify their API version
 */
export const ApiVersion = (version: string = DEFAULT_API_VERSION) =>
  SetMetadata(API_VERSION_KEY, version);

