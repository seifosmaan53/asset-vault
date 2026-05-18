import { Controller, Get, Patch, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { StoreAlertsService } from './store-alerts.service';
import { OrganizationId } from '../organizations/organization-context.decorator';

@ApiTags('store-alerts')
@Controller('inventory/store-alerts')
@UseGuards(ClerkAuthGuard)
@ApiBearerAuth('JWT-auth')
export class StoreAlertsController {
  constructor(private readonly storeAlertsService: StoreAlertsService) {}

  @Get()
  @ApiOperation({
    summary: 'Get all store alerts',
    description: 'Retrieve all store alerts for the authenticated user, optionally filtered by store and resolution status.',
  })
  @ApiResponse({ status: 200, description: 'List of store alerts' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getAlerts(
    @Request() req,
    @Query('storeId') storeId?: string,
    @Query('resolved') resolved?: string,
    @OrganizationId() organizationId?: string | null,
  ) {
    // FIX Issue #43: Add organization context validation
    const resolvedBool = resolved === 'true' ? true : resolved === 'false' ? false : undefined;
    // Organizations removed - organizationId is always null, data is user-scoped
    return this.storeAlertsService.getAlerts(req.user.userId, storeId, resolvedBool, null);
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
    @Request() req,
    @OrganizationId() organizationId?: string | null,
  ) {
    // FIX Issue #43: Add organization context validation
    // Organizations removed - organizationId is always null, data is user-scoped
    return this.storeAlertsService.getStoreAlerts(storeId, req.user.userId, null);
  }

  @Patch(':id/resolve')
  @ApiOperation({
    summary: 'Mark alert as resolved',
    description: 'Mark a store alert as resolved.',
  })
  @ApiResponse({ status: 200, description: 'Alert resolved successfully' })
  @ApiResponse({ status: 404, description: 'Alert not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async markAlertResolved(@Param('id') id: string, @Request() req) {
    try {
      const result = await this.storeAlertsService.markAlertResolved(id, req.user.userId);
      return result;
    } catch (error: any) {
      throw error;
    }
  }

  @Get('check')
  @ApiOperation({
    summary: 'Manually trigger alert check',
    description: 'Manually trigger a check for reorder alerts. This is normally done automatically via cron job.',
  })
  @ApiResponse({ status: 200, description: 'Alert check completed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async checkAlerts(@Request() req) {
    return this.storeAlertsService.checkStoreAlerts(req.user.userId);
  }
}

