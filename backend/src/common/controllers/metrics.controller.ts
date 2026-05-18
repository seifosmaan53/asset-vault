import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { ClerkAuthGuard } from '../../auth/clerk-auth.guard';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Roles } from '../../auth/roles.decorator';
import { UserRole } from '../../users/entities/user.entity';
import { MetricsService } from '../services/metrics.service';

@ApiTags('metrics')
@ApiBearerAuth('JWT-auth')
@Controller('metrics')
@UseGuards(ClerkAuthGuard)
@Roles(UserRole.ADMIN, UserRole.OWNER)
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get('cache')
  @ApiOperation({
    summary: 'Get cache metrics',
    description: 'Retrieve cache performance metrics including hit rate, miss rate, and cache statistics. Admin/Owner only.',
  })
  @ApiResponse({ status: 200, description: 'Cache metrics retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin/Owner access required' })
  async getCacheMetrics() {
    return this.metricsService.getCacheMetrics();
  }

  @Get('queries')
  @ApiOperation({
    summary: 'Get query performance metrics',
    description: 'Retrieve database query performance metrics including slow queries and average query time. Admin/Owner only.',
  })
  @ApiResponse({ status: 200, description: 'Query metrics retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin/Owner access required' })
  async getQueryMetrics() {
    return this.metricsService.getQueryMetrics();
  }

  @Get('database')
  @ApiOperation({
    summary: 'Get database connection metrics',
    description: 'Retrieve database connection pool statistics including active and idle connections. Admin/Owner only.',
  })
  @ApiResponse({ status: 200, description: 'Database metrics retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin/Owner access required' })
  async getDatabaseMetrics() {
    return this.metricsService.getDatabaseMetrics();
  }

  @Get('memory')
  @ApiOperation({
    summary: 'Get memory usage metrics',
    description: 'Retrieve application memory usage statistics. Admin/Owner only.',
  })
  @ApiResponse({ status: 200, description: 'Memory metrics retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin/Owner access required' })
  async getMemoryMetrics() {
    return this.metricsService.getMemoryMetrics();
  }

  @Get('all')
  @ApiOperation({
    summary: 'Get all metrics',
    description: 'Retrieve all performance metrics in a single response. Admin/Owner only.',
  })
  @ApiResponse({ status: 200, description: 'All metrics retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin/Owner access required' })
  async getAllMetrics() {
    const [cache, queries, database, memory] = await Promise.all([
      this.metricsService.getCacheMetrics(),
      Promise.resolve(this.metricsService.getQueryMetrics()),
      this.metricsService.getDatabaseMetrics(),
      Promise.resolve(this.metricsService.getMemoryMetrics()),
    ]);

    return {
      cache,
      queries,
      database,
      memory,
      timestamp: new Date().toISOString(),
    };
  }
}

