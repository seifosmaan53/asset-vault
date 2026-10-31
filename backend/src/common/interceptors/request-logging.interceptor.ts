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
 * Key names whose values never reach a log line: any spelling of password/pass, secret, token,
 * authorization, credential, cookie, signature, and names ending in "key" (apiKey, privateKey).
 * Matched case-insensitively anywhere in the name, so smtpPassword, currentPassword,
 * clientSecret and refreshToken are covered, not only the exact words.
 */
const SENSITIVE_KEY =
  /pass|secret|token|authori[sz]ation|credential|cookie|signature|key$/i;
const MAX_REDACT_DEPTH = 6;

/** A copy of `value` with every sensitive key's value replaced, at any nesting depth. */
export function redactSensitive(value: unknown, depth = 0): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (depth >= MAX_REDACT_DEPTH) return '[truncated]';
  if (Array.isArray(value)) {
    return value.map((item: unknown) => redactSensitive(item, depth + 1));
  }
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    out[key] = SENSITIVE_KEY.test(key)
      ? '***REDACTED***'
      : redactSensitive(item, depth + 1);
  }
  return out;
}

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
      const sanitizedBody = redactSensitive(body);
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
}
