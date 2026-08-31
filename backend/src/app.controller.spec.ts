import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MetricsService } from './common/services/metrics.service';

/* This file used to be the untouched Nest scaffold test asserting
   `appController.getHello()` returned 'Hello World!'. That method was removed long ago,
   so the suite failed to compile — which is also why it never caught anything.
   AppController's only route is the public /health probe, so that is what we test. */
describe('AppController', () => {
  let appController: AppController;

  const metricsService = {
    getCacheMetrics: jest.fn().mockResolvedValue({ hitRate: 0.9, totalRequests: 10 }),
    getDatabaseMetrics: jest.fn().mockResolvedValue({
      activeConnections: 1,
      totalConnections: 2,
      maxConnections: 10,
    }),
    getMemoryMetrics: jest.fn().mockReturnValue({ heapUsed: 1024, rss: 2048 }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        { provide: MetricsService, useValue: metricsService },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('GET /health', () => {
    it('reports ok and includes uptime and a timestamp', async () => {
      const result = await appController.getHealth();

      expect(result.status).toBe('ok');
      expect(typeof result.uptime).toBe('number');
      expect(new Date(result.timestamp).toString()).not.toBe('Invalid Date');
    });

    it('surfaces cache, database and memory metrics', async () => {
      const result = await appController.getHealth();

      expect(result.cache).toEqual({ hitRate: 0.9, totalRequests: 10 });
      expect(result.database).toEqual({
        activeConnections: 1,
        totalConnections: 2,
        maxConnections: 10,
      });
      expect(result.memory).toEqual({ heapUsed: 1024, rss: 2048 });
    });

    it('gathers the three metric sources concurrently', async () => {
      await appController.getHealth();

      expect(metricsService.getCacheMetrics).toHaveBeenCalledTimes(1);
      expect(metricsService.getDatabaseMetrics).toHaveBeenCalledTimes(1);
      expect(metricsService.getMemoryMetrics).toHaveBeenCalledTimes(1);
    });
  });
});
