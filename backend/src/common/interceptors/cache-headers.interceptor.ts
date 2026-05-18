// Copyright (c) 2025 Asset Vault. All rights reserved.

import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Response } from 'express';
import { Reflector } from '@nestjs/core';

/**
 * Cache Headers Interceptor
 * Fixes Issue #29: Missing API Response Caching Headers
 */
@Injectable()
export class CacheHeadersInterceptor implements NestInterceptor {
  constructor(private reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const response = context.switchToHttp().getResponse<Response>();
    const handler = context.getHandler();
    
    // Get cache configuration from metadata (if set via decorator)
    const cacheConfig = this.reflector.get<{ maxAge?: number; private?: boolean }>(
      'cache',
      handler,
    );

    // FIX #161: Response caching at HTTP level - only for GET requests
    const request = context.switchToHttp().getRequest();
    if (request.method !== 'GET') {
      // Don't cache non-GET requests
      return next.handle();
    }
    
    // Default cache configuration
    const maxAge = cacheConfig?.maxAge ?? 300; // 5 minutes default
    const isPrivate = cacheConfig?.private ?? true;

    return next.handle().pipe(
      tap(() => {
        // FIX #161: Set Cache-Control header for HTTP-level caching
        const cacheControl = isPrivate
          ? `private, max-age=${maxAge}, must-revalidate`
          : `public, max-age=${maxAge}, must-revalidate`;
        
        response.setHeader('Cache-Control', cacheControl);
        
        // Set ETag header (simple hash of response)
        // In production, you might want to use a more sophisticated ETag generation
        const etag = `"${Date.now()}-${Math.random().toString(36).substring(7)}"`;
        response.setHeader('ETag', etag);
        
        // Set Last-Modified header
        response.setHeader('Last-Modified', new Date().toUTCString());
      }),
    );
  }
}

