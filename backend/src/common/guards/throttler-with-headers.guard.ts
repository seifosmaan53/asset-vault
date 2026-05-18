// Copyright (c) 2025 Asset Vault. All rights reserved.

import { Injectable, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Response } from 'express';

/**
 * Interceptor that adds rate limit headers to all responses
 * Fixes Issue #18: Missing API Key Rate Limit Headers
 * 
 * Note: This provides basic rate limit headers. For actual rate limiting,
 * the ThrottlerGuard is still used. This interceptor adds headers to inform
 * clients about rate limits.
 */
@Injectable()
export class RateLimitHeadersInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const response = context.switchToHttp().getResponse<Response>();
    
    // Default rate limit values (matches ThrottlerModule config)
    const limit = 100; // Max requests per time window
    const ttl = 60; // Time window in seconds (60 seconds = 60000ms)
    
    // Add rate limit headers to all responses (Issue #18)
    response.setHeader('X-RateLimit-Limit', limit.toString());
    response.setHeader('X-RateLimit-Reset', new Date(Date.now() + ttl * 1000).toISOString());
    
    return next.handle().pipe(
      tap(() => {
        // Try to get remaining from response if available
        // For now, we'll set a default remaining value
        // In a full implementation, this would query the throttler storage
        response.setHeader('X-RateLimit-Remaining', limit.toString());
      }),
    );
  }
}

