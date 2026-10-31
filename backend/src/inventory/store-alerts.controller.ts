import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import type { AuthenticatedRequest } from '../users/interfaces/authenticated-request.interface';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { StoreAlertsService } from './store-alerts.service';

@ApiTags('store-alerts')
@Controller('inventory/store-alerts')
@UseGuards(ClerkAuthGuard)
@ApiBearerAuth('JWT-auth')
export class StoreAlertsController {
  constructor(private readonly storeAlertsService: StoreAlertsService) {}

  @Get()
  @ApiOperation({
    summary: 'Get all store alerts',
    description:
      'Retrieve all store alerts for the authenticated user, optionally filtered by store and resolution status.',
  })
  @ApiResponse({ status: 200, description: 'List of store alerts' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getAlerts(
    @Request() req: AuthenticatedRequest,
    @Query('storeId') storeId?: string,
    @Query('resolved') resolved?: string,
  ) {
    // FIX Issue #43: Add organization context validation
    const resolvedBool =
      resolved === 'true' ? true : resolved === 'false' ? false : undefined;
    // Organizations removed - organizationId is always null, data is user-scoped
    return this.storeAlertsService.getAlerts(
      req.user.userId,
      storeId,
      resolvedBool,
    );
  }

  @Get('store/:storeId')
  @ApiOperation({
    summary: 'Get alerts for a specific store',
    description: 'Retrieve unresolved alerts for a specific store.',
  })
  @ApiResponse({ status: 200, description: 'List of store alerts' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getStoreAlerts(
    @Param('storeId') storeId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    // FIX Issue #43: Add organization context validation
    // Organizations removed - organizationId is always null, data is user-scoped
    return this.storeAlertsService.getStoreAlerts(storeId, req.user.userId);
  }

  @Patch(':id/resolve')
  @ApiOperation({
    summary: 'Mark alert as resolved',
    description: 'Mark a store alert as resolved.',
  })
  @ApiResponse({ status: 200, description: 'Alert resolved successfully' })
  @ApiResponse({ status: 404, description: 'Alert not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async markAlertResolved(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const result = await this.storeAlertsService.markAlertResolved(
      id,
      req.user.userId,
    );
    return result;
  }

  @Get('check')
  @ApiOperation({
    summary: 'Manually trigger alert check',
    description:
      'Manually trigger a check for reorder alerts. This is normally done automatically via cron job.',
  })
  @ApiResponse({ status: 200, description: 'Alert check completed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async checkAlerts(@Request() req: AuthenticatedRequest) {
    return this.storeAlertsService.checkStoreAlerts(req.user.userId);
  }
}
