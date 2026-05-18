import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { ReportFiltersDto } from './dto/report-filters.dto';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';

@ApiTags('reports')
@ApiBearerAuth('Bearer')
@Controller('reports')
@UseGuards(ClerkAuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('profit-loss')
  @ApiOperation({ summary: 'Generate Profit & Loss report', description: 'Generate a profit and loss report with revenue, costs, and profit breakdown' })
  @ApiResponse({ status: 200, description: 'Profit & Loss report generated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getProfitLossReport(@Query() filters: ReportFiltersDto, @Request() req) {
    return this.reportsService.generateProfitLossReport(req.user.userId, filters);
  }

  @Get('sales-trends')
  @ApiOperation({ summary: 'Generate Sales Trends report', description: 'Generate a sales trends report showing revenue over time' })
  @ApiResponse({ status: 200, description: 'Sales Trends report generated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getSalesTrendsReport(@Query() filters: ReportFiltersDto, @Request() req) {
    return this.reportsService.generateSalesTrendsReport(req.user.userId, filters);
  }

  @Get('client-sales')
  @ApiOperation({ summary: 'Generate Client Sales Summary', description: 'Generate a report showing sales breakdown by client' })
  @ApiResponse({ status: 200, description: 'Client Sales report generated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getClientSalesReport(@Query() filters: ReportFiltersDto, @Request() req) {
    return this.reportsService.generateClientSalesReport(req.user.userId, filters);
  }

  @Get('inventory-valuation')
  @ApiOperation({ summary: 'Generate Inventory Valuation report', description: 'Generate a report showing current inventory value' })
  @ApiResponse({ status: 200, description: 'Inventory Valuation report generated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getInventoryValuationReport(@Query() filters: ReportFiltersDto, @Request() req) {
    return this.reportsService.generateInventoryValuationReport(req.user.userId, filters);
  }

  @Get('invoice-aging')
  @ApiOperation({ summary: 'Generate Invoice Aging report', description: 'Generate a report showing outstanding invoices by age' })
  @ApiResponse({ status: 200, description: 'Invoice Aging report generated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getInvoiceAgingReport(@Query() filters: ReportFiltersDto, @Request() req) {
    return this.reportsService.generateInvoiceAgingReport(req.user.userId, filters);
  }

  @Get('payment-collection')
  @ApiOperation({ summary: 'Generate Payment Collection Analysis', description: 'Generate a report analyzing payment collection patterns' })
  @ApiResponse({ status: 200, description: 'Payment Collection report generated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getPaymentCollectionReport(@Query() filters: ReportFiltersDto, @Request() req) {
    return this.reportsService.generatePaymentCollectionReport(req.user.userId, filters);
  }
}
