import { Injectable, Logger, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { DataSource } from 'typeorm';

export interface CacheMetrics {
  hits: number;
  misses: number;
  hitRate: number;
  missRate: number;
  totalRequests: number;
  cacheSize: number;
  evictions: number;
}

export interface QueryMetrics {
  totalQueries: number;
  slowQueries: number;
  averageQueryTime: number;
  slowestQueries: Array<{
    query: string;
    duration: number;
    timestamp: Date;
  }>;
}

export interface DatabaseMetrics {
  activeConnections: number;
  idleConnections: number;
  totalConnections: number;
  maxConnections?: number;
}

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);
  private cacheHits = 0;
  private cacheMisses = 0;
  private cacheEvictions = 0;
  private queryCount = 0;
  private queryExecutionTimes: number[] = [];
  private slowQueries: Array<{
    query: string;
    duration: number;
    timestamp: Date;
  }> = [];
  private readonly SLOW_QUERY_THRESHOLD = 1000; // 1 second in milliseconds
  private readonly MAX_SLOW_QUERIES = 50; // Keep last 50 slow queries

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private dataSource: DataSource,
  ) {}

  /**
   * Record a cache hit
   */
  recordCacheHit(): void {
    this.cacheHits++;
  }

  /**
   * Record a cache miss
   */
  recordCacheMiss(): void {
    this.cacheMisses++;
  }

  /**
   * Record a cache eviction
   */
  recordCacheEviction(): void {
    this.cacheEvictions++;
  }

  /**
   * Record a database query execution
   */
  recordQuery(duration: number, query?: string): void {
    this.queryCount++;
    this.queryExecutionTimes.push(duration);

    // Keep only last 1000 query times for average calculation
    if (this.queryExecutionTimes.length > 1000) {
      this.queryExecutionTimes.shift();
    }

    // Track slow queries
    if (duration > this.SLOW_QUERY_THRESHOLD && query) {
      this.slowQueries.push({
        query: query.substring(0, 200), // Truncate long queries
        duration,
        timestamp: new Date(),
      });

      // Keep only the last N slow queries
      if (this.slowQueries.length > this.MAX_SLOW_QUERIES) {
        this.slowQueries.shift();
      }

      this.logger.warn(`Slow query detected: ${duration}ms - ${query.substring(0, 100)}`);
    }
  }

  /**
   * Get cache metrics
   */
  async getCacheMetrics(): Promise<CacheMetrics> {
    const totalRequests = this.cacheHits + this.cacheMisses;
    const hitRate = totalRequests > 0 ? (this.cacheHits / totalRequests) * 100 : 0;
    const missRate = totalRequests > 0 ? (this.cacheMisses / totalRequests) * 100 : 0;

    // Try to get cache size (may not be available depending on cache store)
    let cacheSize = 0;
    try {
      // For in-memory cache, we can't easily get size, so we'll return 0
      // This would need to be implemented based on the cache store being used
      cacheSize = 0;
    } catch (error) {
      // Cache store may not support size retrieval
      this.logger.debug('Unable to retrieve cache size');
    }

    return {
      hits: this.cacheHits,
      misses: this.cacheMisses,
      hitRate: Math.round(hitRate * 100) / 100,
      missRate: Math.round(missRate * 100) / 100,
      totalRequests,
      cacheSize,
      evictions: this.cacheEvictions,
    };
  }

  /**
   * Get query performance metrics
   */
  getQueryMetrics(): QueryMetrics {
    const averageQueryTime =
      this.queryExecutionTimes.length > 0
        ? this.queryExecutionTimes.reduce((sum, time) => sum + time, 0) / this.queryExecutionTimes.length
        : 0;

    return {
      totalQueries: this.queryCount,
      slowQueries: this.slowQueries.length,
      averageQueryTime: Math.round(averageQueryTime * 100) / 100,
      slowestQueries: [...this.slowQueries].reverse().slice(0, 10), // Return last 10 slowest
    };
  }

  /**
   * Get database connection metrics
   */
  async getDatabaseMetrics(): Promise<DatabaseMetrics> {
    const queryRunner = this.dataSource.createQueryRunner();
    try {
      await queryRunner.connect();
      const result = await queryRunner.query(`
        SELECT 
          count(*) FILTER (WHERE state = 'active') as active_connections,
          count(*) FILTER (WHERE state = 'idle') as idle_connections,
          count(*) as total_connections,
          (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') as max_connections
        FROM pg_stat_activity
        WHERE datname = current_database();
      `);

      if (result && result.length > 0) {
        const row = result[0];
        return {
          activeConnections: parseInt(row.active_connections || '0', 10),
          idleConnections: parseInt(row.idle_connections || '0', 10),
          totalConnections: parseInt(row.total_connections || '0', 10),
          maxConnections: row.max_connections ? parseInt(row.max_connections, 10) : undefined,
        };
      }

      return {
        activeConnections: 0,
        idleConnections: 0,
        totalConnections: 0,
      };
    } catch (error) {
      this.logger.error('Error retrieving database metrics', error);
      return {
        activeConnections: 0,
        idleConnections: 0,
        totalConnections: 0,
      };
    } finally {
      // Always release the query runner, even if an error occurred
      await queryRunner.release();
    }
  }

  /**
   * Get system memory usage
   */
  getMemoryMetrics() {
    const usage = process.memoryUsage();
    return {
      heapUsed: Math.round((usage.heapUsed / 1024 / 1024) * 100) / 100, // MB
      heapTotal: Math.round((usage.heapTotal / 1024 / 1024) * 100) / 100, // MB
      rss: Math.round((usage.rss / 1024 / 1024) * 100) / 100, // MB
      external: Math.round((usage.external / 1024 / 1024) * 100) / 100, // MB
    };
  }

  /**
   * Reset all metrics (useful for testing or periodic resets)
   */
  resetMetrics(): void {
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.cacheEvictions = 0;
    this.queryCount = 0;
    this.queryExecutionTimes = [];
    this.slowQueries = [];
    this.logger.log('Metrics reset');
  }
}

