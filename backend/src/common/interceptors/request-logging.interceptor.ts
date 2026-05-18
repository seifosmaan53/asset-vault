// Copyright (c) 2025 Asset Vault. All rights reserved.

import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';

/**
 * Request/Response Logging Interceptor
 * Fixes Issue #23: Missing Request/Response Logging Middleware
 */
@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const { method, url, body, query, params } = request;
    const startTime = Date.now();
    const requestId = request['requestId'] || 'unknown';

    // Log request
    this.logger.log(
      `[${requestId}] ${method} ${url} - Query: ${JSON.stringify(query)}, Params: ${JSON.stringify(params)}`,
    );

    // Log request body for non-GET requests (sanitize sensitive data)
    if (method !== 'GET' && body) {
      const sanitizedBody = this.sanitizeBody(body);
      this.logger.debug(`[${requestId}] Request body: ${JSON.stringify(sanitizedBody)}`);
    }

    return next.handle().pipe(
      tap({
        next: (data) => {
          const duration = Date.now() - startTime;
          const statusCode = response.statusCode;
          
          this.logger.log(
            `[${requestId}] ${method} ${url} ${statusCode} - ${duration}ms`,
          );

          // Log slow requests
          if (duration > 1000) {
            this.logger.warn(
              `[${requestId}] Slow request detected: ${method} ${url} took ${duration}ms`,
            );
          }
        },
        error: (error) => {
          const duration = Date.now() - startTime;
          const statusCode = response.statusCode || 500;
          
          this.logger.error(
            `[${requestId}] ${method} ${url} ${statusCode} - ${duration}ms - Error: ${error.message}`,
            error.stack,
          );
        },
      }),
    );
  }

  private sanitizeBody(body: any): any {
    if (!body || typeof body !== 'object') {
      return body;
    }

    const sanitized = { ...body };
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'authorization', 'apiKey'];

    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '***REDACTED***';
      }
    }

    return sanitized;
  }
}

