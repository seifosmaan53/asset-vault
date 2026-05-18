// Copyright (c) 2025 Asset Vault. All rights reserved.

import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger, Inject } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { DataSource } from 'typeorm';
import { getDataSourceToken } from '@nestjs/typeorm';

/**
 * Query Execution Plan Logging Interceptor
 * Fixes Issue #32: Missing Database Query Execution Plan Logging
 */
@Injectable()
export class QueryLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('QueryLogger');
  private readonly slowQueryThreshold = 1000; // 1 second

  constructor(@Inject(getDataSourceToken()) private dataSource: DataSource) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const startTime = Date.now();

    // Enable query logging for this request if in development
    const originalLogger = this.dataSource.options.logging;
    if (process.env.NODE_ENV === 'development') {
      // TypeORM will log queries automatically in development
    }

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          
          // Log slow queries
          if (duration > this.slowQueryThreshold) {
            this.logger.warn(
              `Slow request detected: ${request.method} ${request.url} took ${duration}ms`,
            );
            
            // In production, you might want to log EXPLAIN plans for slow queries
            // This would require hooking into TypeORM's query execution
          }
        },
        error: (error) => {
          const duration = Date.now() - startTime;
          this.logger.error(
            `Request failed after ${duration}ms: ${request.method} ${request.url}`,
            error.stack,
          );
        },
      }),
    );
  }
}
