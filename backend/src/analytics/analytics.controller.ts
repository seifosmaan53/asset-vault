import { Controller, Get, Post, Body, UseGuards, Request, Query, Param, NotFoundException, UseInterceptors, Res, Logger } from '@nestjs/common';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CacheInterceptor, CacheKey, CacheTTL } from '@nestjs/cache-manager';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import type { Response } from 'express';
import { AnalyticsService } from './analytics.service';
import { StoreReportPdfService } from './store-report-pdf.service';
import { createExcelWorkbook, formatCurrencyForExcel, type ExcelSheet } from '../common/utils/excel-export.util';

@ApiTags('analytics')
@ApiBearerAuth('JWT-auth')
@Controller('analytics')
@UseGuards(ClerkAuthGuard)
export class AnalyticsController {
  private readonly logger = new Logger(AnalyticsController.name);

  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly storeReportPdfService: StoreReportPdfService,
  ) {}

  @Get('invoices-by-status')
  @ApiOperation({ summary: 'Get invoices by status', description: 'Retrieve count of invoices grouped by status (draft, sent, paid, overdue, cancelled).' })
  @ApiResponse({ status: 200, description: 'Invoice status counts retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getInvoicesByStatus(@Request() req) {
    return this.analyticsService.getInvoicesByStatus(req.user.userId);
  }

  @Get('top-clients')
  @ApiOperation({ summary: 'Get top clients by revenue', description: 'Retrieve top clients ranked by total revenue from sent, paid, and overdue invoices (excludes draft and cancelled).' })
  @ApiResponse({ status: 200, description: 'Top clients retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getTopClients(@Request() req) {
    // Return top 10 clients to match frontend display
    return this.analyticsService.getTopClients(req.user.userId, 10, 0);
  }

  @Get('top-items')
  @ApiOperation({ summary: 'Get top items by sales', description: 'Retrieve top inventory items ranked by revenue from sent, paid, and overdue invoices (excludes draft and cancelled).' })
  @ApiResponse({ status: 200, description: 'Top items retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getTopItems(@Request() req, @Query('page') page?: string, @Query('limit') limit?: string) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;
    const skip = (pageNum - 1) * limitNum;
    const results = await this.analyticsService.getTopItems(req.user.userId, limitNum, skip);
    return {
      data: results,
      page: pageNum,
      limit: limitNum,
      total: results.length, // Note: For accurate total, would need a separate count query
    };
  }

  @Get('stores')
  @CacheTTL(30000) // 30 seconds - shorter TTL for more real-time updates
  @ApiOperation({ summary: 'Get stores analytics summary', description: 'Retrieve summary analytics for all stores.' })
  @ApiResponse({ status: 200, description: 'Stores analytics retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getStoresAnalytics(@Request() req) {
    try {
      this.logger.log(`Fetching stores analytics for user ${req.user.userId}`);
      const result = await this.analyticsService.getStoresSummary(req.user.userId);
      this.logger.log(`Successfully retrieved ${result.length} stores analytics`);
      return result;
    } catch (error) {
      this.logger.error(`Error fetching stores analytics for user ${req.user.userId}:`, error);
      throw error;
    }
  }

  @Get('stores/:storeId')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(60000) // 1 minute for detailed queries
  @ApiOperation({ summary: 'Get detailed store analytics', description: 'Retrieve detailed analytics for a specific store.' })
  @ApiResponse({ status: 200, description: 'Store analytics retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Store not found' })
  async getStoreAnalytics(
    @Request() req,
    @Param('storeId') storeId: string,
  ) {
    const summary = await this.analyticsService.getStoresSummary(req.user.userId);
    const storeSummary = summary.find((s) => s.storeId === storeId);

    if (!storeSummary) {
      throw new NotFoundException(`Store with ID "${storeId}" not found`);
    }

    const [revenue, topClients, topItems, turnover, trends] = await Promise.all([
      this.analyticsService.getStoreRevenueReport(req.user.userId, storeId, undefined, undefined),
      this.analyticsService.getTopClientsByStore(req.user.userId, storeId, 10),
      this.analyticsService.getTopItemsByStore(req.user.userId, storeId, 10),
      this.analyticsService.getStoreInventoryTurnover(req.user.userId, storeId),
      this.analyticsService.getStoreSalesTrends(req.user.userId, storeId, 'monthly'),
    ]);

    return {
      ...storeSummary,
      revenue: revenue[0] || null,
      topClients,
      topItems,
      turnover: turnover[0] || null,
      trends,
    };
  }

  @Get('stores/:storeId/revenue')
  @ApiOperation({ summary: 'Get store revenue report', description: 'Retrieve revenue report for a specific store with optional date filtering.' })
  @ApiResponse({ status: 200, description: 'Store revenue retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getStoreRevenue(
    @Request() req,
    @Param('storeId') storeId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    // Organizations removed - organizationId is always null, data is user-scoped
    return this.analyticsService.getStoreRevenueReport(req.user.userId, storeId, start, end);
  }

  @Get('stores/:storeId/items')
  @ApiOperation({ summary: 'Get top items for store', description: 'Retrieve top items by revenue for a specific store.' })
  @ApiResponse({ status: 200, description: 'Store items retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getStoreItems(
    @Request() req,
    @Param('storeId') storeId: string,
    @Query('limit') limit?: string,
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 10;
    // Organizations removed - organizationId is always null, data is user-scoped
    return this.analyticsService.getTopItemsByStore(req.user.userId, storeId, limitNum);
  }

  @Get('stores/:storeId/clients')
  @ApiOperation({ summary: 'Get top clients for store', description: 'Retrieve top clients by revenue for a specific store.' })
  @ApiResponse({ status: 200, description: 'Store clients retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getStoreClients(
    @Request() req,
    @Param('storeId') storeId: string,
    @Query('limit') limit?: string,
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 10;
    // Organizations removed - organizationId is always null, data is user-scoped
    return this.analyticsService.getTopClientsByStore(req.user.userId, storeId, limitNum);
  }

  @Get('stores/:storeId/trends')
  @ApiOperation({ summary: 'Get store sales trends', description: 'Retrieve sales trends over time for a specific store.' })
  @ApiResponse({ status: 200, description: 'Store trends retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getStoreTrends(
    @Request() req,
    @Param('storeId') storeId: string,
    @Query('period') period?: 'daily' | 'weekly' | 'monthly' | 'yearly',
  ) {
    return this.analyticsService.getStoreSalesTrends(
      req.user.userId,
      storeId,
      period || 'monthly',
    );
  }

  @Get('sales-by-category')
  @ApiOperation({ 
    summary: 'Get sales by category', 
    description: 'Retrieve sales aggregated by inventory item category. Supports optional date range and store filtering.' 
  })
  @ApiResponse({ status: 200, description: 'Sales by category retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getSalesByCategory(
    @Request() req,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('storeId') storeId?: string,
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    // Organizations removed - organizationId is always null, data is user-scoped
    return this.analyticsService.getSalesByCategory(req.user.userId, start, end, storeId);
  }

  @Get('revenue-by-payment-method')
  @ApiOperation({ 
    summary: 'Get revenue by payment method', 
    description: 'Retrieve revenue aggregated by payment method (parsed from paymentMethodNote). Only includes paid invoices. Supports optional date range and store filtering.' 
  })
  @ApiResponse({ status: 200, description: 'Revenue by payment method retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getRevenueByPaymentMethod(
    @Request() req,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('storeId') storeId?: string,
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    // Organizations removed - organizationId is always null, data is user-scoped
    return this.analyticsService.getRevenueByPaymentMethod(req.user.userId, start, end, storeId);
  }

  @Get('invoices-by-status-store')
  @ApiOperation({ summary: 'Get invoices by status and store', description: 'Retrieve count of invoices grouped by status and store.' })
  @ApiResponse({ status: 200, description: 'Invoice status by store retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getInvoicesByStatusAndStore(
    @Request() req,
    @Query('storeId') storeId?: string,
  ) {
    // Organizations removed - organizationId is always null, data is user-scoped
    return this.analyticsService.getInvoicesByStatusAndStore(req.user.userId, storeId);
  }

  @Post('stores/compare')
  @ApiOperation({
    summary: 'Compare multiple stores',
    description: 'Compare performance metrics across multiple stores with optional date filtering.',
  })
  @ApiResponse({ status: 200, description: 'Store comparison retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async compareStores(
    @Request() req,
    @Body() body: { storeIds: string[]; startDate?: string; endDate?: string },
  ) {
    try {
      const startDate = body.startDate ? new Date(body.startDate) : undefined;
      const endDate = body.endDate ? new Date(body.endDate) : undefined;
      // Organizations removed - organizationId is always null, data is user-scoped
      const result = await this.analyticsService.compareStores(req.user.userId, body.storeIds, startDate, endDate);
      return result;
    } catch (error: any) {
      throw error;
    }
  }

  @Get('stores/:storeId/export/csv')
  @ApiOperation({
    summary: 'Export store analytics to CSV',
    description: 'Export store analytics data to CSV format.',
  })
  @ApiResponse({ status: 200, description: 'CSV export generated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async exportStoreCSV(@Param('storeId') storeId: string, @Request() req, @Res() res: Response) {
    // Organizations removed - organizationId is always null, data is user-scoped
    const summary = await this.analyticsService.getStoresSummary(req.user.userId);
    const storeSummary = summary.find((s) => s.storeId === storeId);

    if (!storeSummary) {
      throw new NotFoundException(`Store with ID "${storeId}" not found`);
    }

    const [revenue, topClients, topItems, turnover] = await Promise.all([
      this.analyticsService.getStoreRevenueReport(req.user.userId, storeId, undefined, undefined),
      this.analyticsService.getTopClientsByStore(req.user.userId, storeId, 10),
      this.analyticsService.getTopItemsByStore(req.user.userId, storeId, 10),
      this.analyticsService.getStoreInventoryTurnover(req.user.userId, storeId),
    ]);

    // Generate CSV
    const csvRows: string[][] = [];
    csvRows.push(['Store Analytics Report']);
    csvRows.push(['Store Name', storeSummary.storeName]);
    csvRows.push(['Store Code', storeSummary.storeCode]);
    csvRows.push(['']);
    csvRows.push(['Metric', 'Value']);
    csvRows.push(['Total Revenue', storeSummary.totalRevenue.toFixed(2)]);
    csvRows.push(['Paid Revenue', storeSummary.paidRevenue.toFixed(2)]);
    csvRows.push(['Total Invoices', storeSummary.totalInvoices.toString()]);
    csvRows.push(['Average Invoice Value', storeSummary.averageInvoiceValue.toFixed(2)]);
    if (turnover && turnover.length > 0 && turnover[0]) {
      csvRows.push(['Inventory Turnover', turnover[0].turnover.toFixed(2)]);
    }
    csvRows.push(['']);

    // Add top items
    if (topItems && topItems.length > 0) {
      csvRows.push(['Top Items']);
      csvRows.push(['Item Name', 'SKU', 'Revenue', 'Quantity', 'Invoice Count']);
      topItems.forEach((item) => {
        csvRows.push([
          item.itemName,
          item.sku || '',
          item.totalRevenue.toFixed(2),
          item.totalQuantity.toString(),
          item.invoiceCount.toString(),
        ]);
      });
      csvRows.push(['']);
    }

    // Add top clients
    if (topClients && topClients.length > 0) {
      csvRows.push(['Top Clients']);
      csvRows.push(['Client Name', 'Revenue', 'Paid Revenue', 'Invoice Count']);
      topClients.forEach((client) => {
        csvRows.push([
          client.clientName,
          client.totalRevenue.toFixed(2),
          client.paidRevenue.toFixed(2),
          client.invoiceCount.toString(),
        ]);
      });
    }

    const csvContent = csvRows.map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="store-${storeId}-analytics.csv"`);
    res.send(csvContent);
  }

  @Get('stores/:storeId/export/excel')
  @ApiOperation({
    summary: 'Export store analytics to Excel',
    description: 'Export store analytics report to Excel format with multiple sheets.',
  })
  @ApiResponse({ status: 200, description: 'Excel export generated successfully', content: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {} } })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Store not found' })
  async exportStoreExcel(@Param('storeId') storeId: string, @Request() req, @Res() res: Response) {
    // Organizations removed - organizationId is always null, data is user-scoped
    const summary = await this.analyticsService.getStoresSummary(req.user.userId);
    const storeSummary = summary.find((s) => s.storeId === storeId);

    if (!storeSummary) {
      throw new NotFoundException(`Store with ID "${storeId}" not found`);
    }

    const [revenue, topClients, topItems, turnover] = await Promise.all([
      this.analyticsService.getStoreRevenueReport(req.user.userId, storeId, undefined, undefined),
      this.analyticsService.getTopClientsByStore(req.user.userId, storeId, 10),
      this.analyticsService.getTopItemsByStore(req.user.userId, storeId, 10),
      this.analyticsService.getStoreInventoryTurnover(req.user.userId, storeId),
    ]);

    // Prepare sheets
    const sheets: ExcelSheet[] = [];

    // Summary sheet
    const summaryData: any[][] = [
      ['Store Name', storeSummary.storeName],
      ['Store Code', storeSummary.storeCode],
      [''],
      ['Metric', 'Value'],
      ['Total Revenue', formatCurrencyForExcel(storeSummary.totalRevenue)],
      ['Paid Revenue', formatCurrencyForExcel(storeSummary.paidRevenue)],
      ['Total Invoices', storeSummary.totalInvoices],
      ['Average Invoice Value', formatCurrencyForExcel(storeSummary.averageInvoiceValue)],
    ];

    if (turnover && turnover.length > 0 && turnover[0]) {
      summaryData.push(['Inventory Turnover', formatCurrencyForExcel(turnover[0].turnover)]);
    }

    sheets.push({
      name: 'Summary',
      data: summaryData,
      columnWidths: [25, 20],
    });

    // Top Items sheet
    if (topItems && topItems.length > 0) {
      const itemsData: any[][] = topItems.map((item) => [
        item.itemName,
        item.sku || '',
        formatCurrencyForExcel(item.totalRevenue),
        item.totalQuantity,
        item.invoiceCount,
      ]);

      sheets.push({
        name: 'Top Items',
        headers: ['Item Name', 'SKU', 'Revenue', 'Quantity', 'Invoice Count'],
        data: itemsData,
        columnWidths: [30, 15, 15, 12, 15],
      });
    }

    // Top Clients sheet
    if (topClients && topClients.length > 0) {
      const clientsData: any[][] = topClients.map((client) => [
        client.clientName,
        formatCurrencyForExcel(client.totalRevenue),
        formatCurrencyForExcel(client.paidRevenue),
        client.invoiceCount,
      ]);

      sheets.push({
        name: 'Top Clients',
        headers: ['Client Name', 'Total Revenue', 'Paid Revenue', 'Invoice Count'],
        data: clientsData,
        columnWidths: [30, 18, 18, 15],
      });
    }

    // Generate Excel file
    const buffer = await createExcelWorkbook({
      filename: `store-${storeId}-analytics.xlsx`,
      sheets,
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="store-${storeId}-analytics.xlsx"`);
    res.send(buffer);
  }

  @Get('stores/:storeId/export/pdf')
  @ApiOperation({
    summary: 'Export store analytics to PDF',
    description: 'Export store analytics report to PDF format.',
  })
  @ApiResponse({ status: 200, description: 'PDF export generated successfully', content: { 'application/pdf': {} } })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Store not found' })
  async exportStorePDF(@Param('storeId') storeId: string, @Request() req, @Res() res: Response) {
    // Organizations removed - organizationId is always null, data is user-scoped
    const pdfBuffer = await this.storeReportPdfService.generateStoreReportPdf(storeId, req.user.userId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=store-${storeId}-report.pdf`);
    res.send(pdfBuffer);
  }
}

