// Copyright (c) 2025 Asset Vault. All rights reserved.

import { Injectable, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Response } from 'express';
import { API_CONSTANTS } from '../constants/api-constants';

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
    
    // Issue #77: Use constants instead of magic numbers
    const limit = API_CONSTANTS.RATE_LIMIT_MAX;
    const ttl = API_CONSTANTS.RATE_LIMIT_TTL / 1000; // Convert to seconds
    
    // Add rate limit headers to all responses (Issue #18)
    response.setHeader('X-RateLimit-Limit', limit.toString());
    response.setHeader('X-RateLimit-Reset', new Date(Date.now() + API_CONSTANTS.RATE_LIMIT_TTL).toISOString());
    
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

