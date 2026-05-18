// Copyright (c) 2025 Asset Vault. All rights reserved.

import { SetMetadata } from '@nestjs/common';

export const CACHE_KEY = 'cache';

export interface CacheOptions {
  maxAge?: number; // Cache duration in seconds
  private?: boolean; // Whether cache is private (default: true)
}

/**
 * Decorator to configure cache headers for an endpoint
 * Usage: @Cache({ maxAge: 600, private: false })
 */
export const Cache = (options: CacheOptions = {}) => SetMetadata(CACHE_KEY, options);

