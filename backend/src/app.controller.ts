import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from './auth/public.decorator';
import { MetricsService } from './common/services/metrics.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly metricsService: MetricsService,
  ) {}

  @Public()
  @Get('health')
  async getHealth() {
    const [cache, database, memory] = await Promise.all([
      this.metricsService.getCacheMetrics(),
      this.metricsService.getDatabaseMetrics(),
      Promise.resolve(this.metricsService.getMemoryMetrics()),
    ]);

    return {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      cache: {
        hitRate: cache.hitRate,
        totalRequests: cache.totalRequests,
      },
      database: {
        activeConnections: database.activeConnections,
        totalConnections: database.totalConnections,
        maxConnections: database.maxConnections,
      },
      memory: {
        heapUsed: memory.heapUsed,
        rss: memory.rss,
      },
    };
  }
}
