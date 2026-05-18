import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  Query,
  Res,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import type { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { InvoicesService } from './invoices.service';
import { CreateInvoiceDto, UpdateInvoiceDto } from './dto';
import {
  InvoiceResponseDto,
  InvoiceListResponseDto,
  CreateInvoiceResponseDto,
  UpdateInvoiceResponseDto,
  DeleteInvoiceResponseDto,
} from './dto/invoice-response.dto';
import { InvoiceStatsResponseDto } from './dto/invoice-stats-response.dto';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { QuotaGuard } from '../subscriptions/quota.guard';
// Organizations removed - OrganizationId decorator no longer needed

@ApiTags('invoices')
@ApiBearerAuth('Bearer')
@Controller('invoices')
@UseGuards(ClerkAuthGuard)
export class InvoicesController {
  private readonly logger = new Logger(InvoicesController.name);
  
  constructor(
    private readonly invoicesService: InvoicesService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get all invoices', description: 'Retrieve a list of invoices with optional filtering by status, type, client, and date range.' })
  @ApiQuery({ name: 'status', required: false, enum: ['draft', 'sent', 'paid', 'overdue', 'cancelled'], description: 'Filter by invoice status' })
  @ApiQuery({ name: 'type', required: false, enum: ['invoice', 'estimate'], description: 'Filter by invoice type' })
  @ApiQuery({ name: 'clientId', required: false, type: String, description: 'Filter by client ID' })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Search by invoice number or client name' })
  @ApiResponse({ status: 200, description: 'List of invoices retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findAll(@Request() req, @Query() filters: any) {
    try {
      // Validate user is authenticated
      if (!req.user || !req.user.userId) {
        this.logger.error('findAll: req.user or req.user.userId is missing', {
          hasUser: !!req.user,
          hasUserId: !!req.user?.userId,
          url: req.url,
          method: req.method,
        });
        throw new UnauthorizedException('User not authenticated');
      }
      
      this.logger.log(`findAll: Fetching invoices for userId: ${req.user.userId}`);
      
      // Organizations removed - data is user-scoped
      const result = await this.invoicesService.findAll(req.user.userId, filters);
      this.logger.log(`findAll: Successfully fetched ${result.length} invoices for userId: ${req.user.userId}`);
      return result;
    } catch (error: any) {
      this.logger.error(`Error in findAll: ${error.message}`, {
        stack: error.stack,
        userId: req.user?.userId,
        filters,
        errorName: error.constructor?.name,
      });
      // Re-throw the error so NestJS exception filter can handle it
      throw error;
    }
  }

  @Get('paged')
  @ApiOperation({
    summary: 'Get invoices (paged)',
    description:
      'Retrieve invoices with server-side pagination and HATEOAS links. Defaults to 100 per page. Use this for large datasets.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, description: '1-based page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Page size (default: 100, max: 1000)' })
  @ApiQuery({ name: 'status', required: false, enum: ['draft', 'sent', 'paid', 'overdue', 'cancelled'], description: 'Filter by invoice status' })
  @ApiQuery({ name: 'type', required: false, enum: ['invoice', 'estimate'], description: 'Filter by invoice type' })
  @ApiQuery({ name: 'clientId', required: false, type: String, description: 'Filter by client ID' })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Search by invoice number or client name' })
  @ApiResponse({ status: 200, description: 'Paged invoices retrieved successfully with pagination links' })
  getPaged(@Request() req, @Query() query: any) {
    // Organizations removed - data is user-scoped
    return this.invoicesService.findPaged(req.user.userId, query);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get invoice statistics', description: 'Retrieve statistics about invoices including counts and totals by status.' })
  @ApiResponse({ status: 200, description: 'Invoice statistics retrieved successfully', type: InvoiceStatsResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getStats(@Request() req): Promise<InvoiceStatsResponseDto> {
    // Organizations removed - data is user-scoped
    const stats = await this.invoicesService.getStats(req.user.userId);
    // Issue #36 & #62: Return with DTO and success message
    return {
      ...stats,
      message: 'Invoice statistics retrieved successfully',
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get invoice by ID', description: 'Retrieve a single invoice by its ID with all line items and client information.' })
  @ApiParam({ name: 'id', type: String, description: 'Invoice ID' })
  @ApiResponse({ status: 200, description: 'Invoice retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findOne(@Param('id') id: string, @Request() req) {
    // Organizations removed - data is user-scoped
    return this.invoicesService.findOne(id, req.user.userId);
  }

  @Post()
  @UseGuards(QuotaGuard)
  @ApiOperation({ summary: 'Create a new invoice', description: 'Create a new invoice or estimate with line items, tax, and discount calculations.' })
  @ApiResponse({ status: 201, description: 'Invoice created successfully', type: CreateInvoiceResponseDto })
  @ApiResponse({ status: 400, description: 'Bad request - validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async create(@Body() createDto: CreateInvoiceDto, @Request() req): Promise<CreateInvoiceResponseDto> {
    try {
      // Organizations removed - data is user-scoped
      const invoice = await this.invoicesService.create(req.user.userId, createDto);
      // Issue #36 & #62: Return with DTO and success message
      return {
        data: invoice,
        message: 'Invoice created successfully',
      };
    } catch (error: any) {
      throw error;
    }
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an invoice', description: 'Update an existing invoice. Only draft invoices can be fully edited.' })
  @ApiParam({ name: 'id', type: String, description: 'Invoice ID' })
  @ApiResponse({ status: 200, description: 'Invoice updated successfully', type: UpdateInvoiceResponseDto })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  @ApiResponse({ status: 400, description: 'Bad request - cannot edit non-draft invoice' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async update(@Param('id') id: string, @Body() updateDto: UpdateInvoiceDto, @Request() req): Promise<UpdateInvoiceResponseDto> {
    // Log the update data for debugging (excluding sensitive info)
    const logger = new Logger(InvoicesController.name);
    logger.log(`Updating invoice ${id} with data: ${JSON.stringify({ ...updateDto, items: updateDto.items?.length || 0 })}`);
    try {
      // Organizations removed - data is user-scoped
      const invoice = await this.invoicesService.update(id, req.user.userId, updateDto);
      // Issue #36 & #62: Return with DTO and success message
      return {
        data: invoice,
        message: 'Invoice updated successfully',
      };
    } catch (error: any) {
      throw error;
    }
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  @ApiOperation({ summary: 'Delete an invoice', description: 'Delete an invoice. Only draft invoices can be deleted. Admin/Owner only.' })
  @ApiParam({ name: 'id', type: String, description: 'Invoice ID' })
  @ApiResponse({ status: 200, description: 'Invoice deleted successfully' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  @ApiResponse({ status: 400, description: 'Bad request - cannot delete non-draft invoice' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin/Owner access required' })
  remove(@Param('id') id: string, @Request() req) {
    // Organizations removed - data is user-scoped
    return this.invoicesService.remove(id, req.user.userId);
  }

  @Post(':id/convert')
  @ApiOperation({ summary: 'Convert estimate to invoice', description: 'Convert an estimate to a regular invoice with a new invoice number.' })
  @ApiParam({ name: 'id', type: String, description: 'Estimate ID' })
  @ApiResponse({ status: 200, description: 'Estimate converted to invoice successfully' })
  @ApiResponse({ status: 404, description: 'Estimate not found' })
  @ApiResponse({ status: 400, description: 'Bad request - not an estimate' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  convert(@Param('id') id: string, @Request() req) {
    try {
      // Organizations removed - data is user-scoped
      const result = this.invoicesService.convertEstimateToInvoice(id, req.user.userId);
      return result;
    } catch (error: any) {
      throw error;
    }
  }

  @Post(':id/send')
  @ApiOperation({ summary: 'Send invoice via email', description: 'Send an invoice to the client via email. Requires SMTP or SendGrid configuration.' })
  @ApiParam({ name: 'id', type: String, description: 'Invoice ID' })
  @ApiResponse({ status: 200, description: 'Invoice email sent successfully' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  @ApiResponse({ status: 400, description: 'Bad request - Email service not configured or client email missing' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async send(@Param('id') id: string, @Body() emailOptions: any, @Request() req) {
    try {
      // Organizations removed - data is user-scoped
      const result = await this.invoicesService.sendEmail(id, req.user.userId, emailOptions);
      return result;
    } catch (error: any) {
      throw error;
    }
  }

  @Post(':id/pdf')
  @ApiOperation({ summary: 'Generate invoice PDF', description: 'Generate and download a PDF version of the invoice.' })
  @ApiParam({ name: 'id', type: String, description: 'Invoice ID' })
  @ApiResponse({ status: 200, description: 'PDF generated successfully', content: { 'application/pdf': {} } })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async generatePdf(@Param('id') id: string, @Request() req, @Res() res: Response) {
    try {
      // Organizations removed - data is user-scoped
      const pdfBuffer = await this.invoicesService.generatePdf(id, req.user.userId);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=invoice-${id}.pdf`);
      res.send(pdfBuffer);
    } catch (error: any) {
      throw error;
    }
  }

  @Post('backfill-paid-at')
  @Roles(UserRole.ADMIN, UserRole.OWNER) // FIX Issue #44: Ensure admin-only access
  @ApiOperation({ summary: 'Backfill paid dates', description: 'Backfill paidAt dates for invoices that are marked as paid but missing the paidAt timestamp. Admin/Owner only.' })
  @ApiResponse({ status: 200, description: 'Paid dates backfilled successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin/Owner access required' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async backfillPaidAt(@Request() req) {
    try {
      const result = await this.invoicesService.backfillPaidAtDates(req.user.userId);
      return result;
    } catch (error: any) {
      throw error;
    }
  }
}

