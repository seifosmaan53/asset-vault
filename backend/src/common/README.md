# Common Module - Metrics and Monitoring

This module provides performance monitoring and metrics collection for the application.

## Features

- **Cache Metrics**: Track cache hit rates, miss rates, and evictions
- **Query Metrics**: Monitor database query performance and slow queries
- **Database Metrics**: Track connection pool statistics
- **Memory Metrics**: Monitor application memory usage

## Usage

### Accessing Metrics Endpoints

All metrics endpoints are protected and require Admin or Owner role.

**Base URL**: `/api/v1/metrics`

**Endpoints**:
- `GET /cache` - Cache performance metrics
- `GET /queries` - Database query performance metrics
- `GET /database` - Database connection pool metrics
- `GET /memory` - Application memory usage
- `GET /all` - All metrics in a single response

### Tracking Cache Metrics

To track cache metrics, you have two options:

#### Option 1: Use MetricsCacheInterceptor (Recommended)

Replace the standard `CacheInterceptor` with `MetricsCacheInterceptor` in your controllers:

```typescript
import { MetricsCacheInterceptor } from '../common/interceptors/metrics-cache.interceptor';

@Controller('analytics')
export class AnalyticsController {
  @Get('stores')
  @UseInterceptors(MetricsCacheInterceptor) // Use metrics-aware interceptor
  @CacheTTL(300000) // 5 minutes
  async getStoresAnalytics(@Request() req) {
    return this.analyticsService.getStoresSummary(req.user.userId);
  }
}
```

#### Option 2: Manual Tracking

Manually track cache operations in your service:

```typescript
import { MetricsService } from '../common/services/metrics.service';

constructor(private metricsService: MetricsService) {}

async getData(key: string) {
  const cached = await this.cacheManager.get(key);
  if (cached) {
    this.metricsService.recordCacheHit();
    return cached;
  }
  
  this.metricsService.recordCacheMiss();
  const data = await this.fetchData();
  await this.cacheManager.set(key, data, ttl);
  return data;
}
```

### Tracking Query Metrics

Query metrics are automatically tracked when using TypeORM with slow query logging enabled. To enable:

1. Configure TypeORM to log slow queries in `app.module.ts`:
```typescript
TypeOrmModule.forRoot({
  // ... other config
  logger: new QueryMetricsLogger(metricsService),
  maxQueryExecutionTime: 1000, // Log queries slower than 1 second
}),
```

Note: Query tracking requires additional setup. Currently, slow queries are tracked via the logger when enabled.

### Health Check Enhancement

The health check endpoint (`/api/v1/health`) now includes basic metrics:
- Cache hit rate
- Database connection stats
- Memory usage

## Metrics Structure

### Cache Metrics
```json
{
  "hits": 150,
  "misses": 50,
  "hitRate": 75.0,
  "missRate": 25.0,
  "totalRequests": 200,
  "cacheSize": 0,
  "evictions": 0
}
```

### Query Metrics
```json
{
  "totalQueries": 1000,
  "slowQueries": 5,
  "averageQueryTime": 45.2,
  "slowestQueries": [
    {
      "query": "SELECT ...",
      "duration": 1250,
      "timestamp": "2024-01-01T12:00:00Z"
    }
  ]
}
```

### Database Metrics
```json
{
  "activeConnections": 5,
  "idleConnections": 10,
  "totalConnections": 15,
  "maxConnections": 100
}
```

## Performance Considerations

- Metrics are stored in-memory and reset on application restart
- Slow query tracking keeps the last 50 slow queries
- Query execution times are averaged over the last 1000 queries
- Metrics collection has minimal performance impact

## Future Enhancements

- Persist metrics to database for historical analysis
- Add alerting for cache hit rates below threshold
- Export metrics in Prometheus format
- Add dashboard visualization

