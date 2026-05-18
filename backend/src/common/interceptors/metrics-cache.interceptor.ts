import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { Reflector } from '@nestjs/core';
import { MetricsService } from '../services/metrics.service';

/**
 * Enhanced cache interceptor that tracks cache hits and misses
 * 
 * Usage: Replace @UseInterceptors(CacheInterceptor) with @UseInterceptors(MetricsCacheInterceptor)
 * in controllers where you want to track cache metrics.
 */
@Injectable()
export class MetricsCacheInterceptor implements NestInterceptor {
  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private reflector: Reflector,
    private metricsService: MetricsService,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const key = this.trackBy(context);

    if (!key) {
      // No cache key, proceed normally
      return next.handle();
    }

    // Try to get from cache
    const cachedValue = await this.cacheManager.get(key);

    if (cachedValue !== undefined && cachedValue !== null) {
      // Cache hit
      this.metricsService.recordCacheHit();
      return new Observable((observer) => {
        observer.next(cachedValue);
        observer.complete();
      });
    } else {
      // Cache miss - execute the handler and cache the result
      this.metricsService.recordCacheMiss();
      return next.handle().pipe(
        tap(async (response) => {
          // Get TTL from metadata or use default
          const ttl = this.reflector.get<number>('cache-ttl', context.getHandler()) || 300000; // Default 5 minutes
          try {
            await this.cacheManager.set(key, response, ttl);
          } catch (error) {
            // If cache is full, record eviction
            this.metricsService.recordCacheEviction();
          }
        }),
      );
    }
  }

  /**
   * Generate cache key based on request
   */
  protected trackBy(context: ExecutionContext): string | undefined {
    const request = context.switchToHttp().getRequest();
    const { url, method } = request;
    
    // Generate a simple cache key based on URL and method
    // For more complex scenarios, you might want to include query params, user ID, etc.
    if (method === 'GET') {
      return `${method}:${url}`;
    }
    return undefined; // Only cache GET requests by default
  }
}

