// Copyright (c) 2025 Asset Vault. All rights reserved.

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import type { Response } from 'express';
import {
  attachedRequestId,
  type RequestWithId,
} from '../utils/request-id.util';

/**
 * Request/Response Logging Interceptor
 * Fixes Issue #23: Missing Request/Response Logging Middleware
 */
@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<RequestWithId>();
    const response = context.switchToHttp().getResponse<Response>();
    const { method, url, query, params } = request;
    const body: unknown = request.body;
    const startTime = Date.now();
    const requestId = attachedRequestId(request) || 'unknown';

    // Log request
    this.logger.log(
      `[${requestId}] ${method} ${url} - Query: ${JSON.stringify(query)}, Params: ${JSON.stringify(params)}`,
    );

    // Log request body for non-GET requests (sanitize sensitive data)
    if (method !== 'GET' && body) {
      const sanitizedBody = this.sanitizeBody(body);
      this.logger.debug(
        `[${requestId}] Request body: ${JSON.stringify(sanitizedBody)}`,
      );
    }

    return next.handle().pipe(
      tap({
        next: () => {
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
        error: (error: unknown) => {
          const duration = Date.now() - startTime;
          const statusCode = response.statusCode || 500;
          const err = error instanceof Error ? error : undefined;

          this.logger.error(
            `[${requestId}] ${method} ${url} ${statusCode} - ${duration}ms - Error: ${err?.message}`,
            err?.stack,
          );
        },
      }),
    );
  }

  private sanitizeBody(body: unknown): unknown {
    if (!body || typeof body !== 'object') {
      return body;
    }

    const sanitized: Record<string, unknown> = { ...body };
    const sensitiveFields = [
      'password',
      'token',
      'secret',
      'key',
      'authorization',
      'apiKey',
    ];

    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '***REDACTED***';
      }
    }

    return sanitized;
  }
}
