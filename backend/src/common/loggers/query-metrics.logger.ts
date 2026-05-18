import { Logger as TypeORMLogger } from 'typeorm';
import { Injectable, Logger } from '@nestjs/common';
import { MetricsService } from '../services/metrics.service';

/**
 * Custom TypeORM logger that tracks query performance
 */
@Injectable()
export class QueryMetricsLogger implements TypeORMLogger {
  private readonly logger = new Logger(QueryMetricsLogger.name);

  constructor(private metricsService: MetricsService) {}

  logQuery(query: string, parameters?: any[]) {
    // This method is called before a query is executed
    // We'll track execution time in logQueryError or logSlowQuery
  }

  logQueryError(error: string | Error, query: string, parameters?: any[]) {
    // Track failed queries
    this.logger.error(`Query error: ${error instanceof Error ? error.message : error}`, {
      query: query.substring(0, 200), // Truncate long queries
      parameters,
    });
  }

  logQuerySlow(time: number, query: string, parameters?: any[]) {
    // Track slow queries
    this.metricsService.recordQuery(time, query);
  }

  logSchemaBuild(message: string) {
    // Schema build logs (not critical for metrics)
  }

  logMigration(message: string) {
    // Migration logs (not critical for metrics)
  }

  log(level: 'log' | 'info' | 'warn', message: any) {
    // General logs
    if (level === 'log' || level === 'info') {
      // Can extract query execution time from message if needed
      // TypeORM's default logger includes timing information
    }
  }
}

