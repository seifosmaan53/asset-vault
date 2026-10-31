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
import type { Request as ExpressRequest, Response } from 'express';
import type { RequestUser } from '../auth/interfaces/request-user.interface';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { InvoicesService } from './invoices.service';
import { CreateInvoiceDto, UpdateInvoiceDto } from './dto';
import { SendInvoiceEmailDto } from './dto/send-invoice-email.dto';
import {
  readInvoiceListFilters,
  readInvoicePageParams,
} from './utils/invoice-list-query.util';
import {
  CreateInvoiceResponseDto,
  UpdateInvoiceResponseDto,
} from './dto/invoice-response.dto';
import { InvoiceStatsResponseDto } from './dto/invoice-stats-response.dto';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { QuotaGuard } from '../subscriptions/quota.guard';
import { errorMessage, errorStack } from './utils/error-details.util';
// Organizations removed - OrganizationId decorator no longer needed

/** Every route here sits behind ClerkAuthGuard, which sets `user` before the handler runs. */
interface AuthenticatedRequest extends ExpressRequest {
  user: RequestUser;
}

@ApiTags('invoices')
@ApiBearerAuth('Bearer')
@Controller('invoices')
@UseGuards(ClerkAuthGuard)
export class InvoicesController {
  private readonly logger = new Logger(InvoicesController.name);

  constructor(private readonly invoicesService: InvoicesService) {}

  @Get()
  @ApiOperation({
    summary: 'Get all invoices',
    description:
      'Retrieve a list of invoices with optional filtering by status, type, client, and date range.',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['draft', 'sent', 'paid', 'overdue', 'cancelled'],
    description: 'Filter by invoice status',
  })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: ['invoice', 'estimate'],
    description: 'Filter by invoice type',
  })
  @ApiQuery({
    name: 'clientId',
    required: false,
    type: String,
    description: 'Filter by client ID',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Search by invoice number or client name',
  })
  @ApiResponse({
    status: 200,
    description: 'List of invoices retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findAll(
    @Request() req: AuthenticatedRequest,
    @Query() query: Record<string, unknown>,
  ) {
    const filters = readInvoiceListFilters(query);
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

      this.logger.log(
        `findAll: Fetching invoices for userId: ${req.user.userId}`,
      );

      // Organizations removed - data is user-scoped
      const result = await this.invoicesService.findAll(
        req.user.userId,
        filters,
      );
      this.logger.log(
        `findAll: Successfully fetched ${result.length} invoices for userId: ${req.user.userId}`,
      );
      return result;
    } catch (error: unknown) {
      this.logger.error(`Error in findAll: ${errorMessage(error)}`, {
        stack: errorStack(error),
        userId: req.user?.userId,
        filters,
        errorName:
          typeof error === 'object' && error !== null
            ? error.constructor?.name
            : undefined,
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
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: '1-based page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Page size (default: 100, max: 1000)',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['draft', 'sent', 'paid', 'overdue', 'cancelled'],
    description: 'Filter by invoice status',
  })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: ['invoice', 'estimate'],
    description: 'Filter by invoice type',
  })
  @ApiQuery({
    name: 'clientId',
    required: false,
    type: String,
    description: 'Filter by client ID',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Search by invoice number or client name',
  })
  @ApiResponse({
    status: 200,
    description: 'Paged invoices retrieved successfully with pagination links',
  })
  getPaged(
    @Request() req: AuthenticatedRequest,
    @Query() query: Record<string, unknown>,
  ) {
    // Organizations removed - data is user-scoped
    return this.invoicesService.findPaged(
      req.user.userId,
      readInvoicePageParams(query),
    );
  }

  @Get('stats')
  @ApiOperation({
    summary: 'Get invoice statistics',
    description:
      'Retrieve statistics about invoices including counts and totals by status.',
  })
  @ApiResponse({
    status: 200,
    description: 'Invoice statistics retrieved successfully',
    type: InvoiceStatsResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getStats(
    @Request() req: AuthenticatedRequest,
  ): Promise<InvoiceStatsResponseDto> {
    // Organizations removed - data is user-scoped
    const stats = await this.invoicesService.getStats(req.user.userId);
    // Issue #36 & #62: Return with DTO and success message
    return {
      ...stats,
      message: 'Invoice statistics retrieved successfully',
    };
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get invoice by ID',
    description:
      'Retrieve a single invoice by its ID with all line items and client information.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Invoice ID' })
  @ApiResponse({ status: 200, description: 'Invoice retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findOne(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    // Organizations removed - data is user-scoped
    return this.invoicesService.findOne(id, req.user.userId);
  }

  @Post()
  @UseGuards(QuotaGuard)
  @ApiOperation({
    summary: 'Create a new invoice',
    description:
      'Create a new invoice or estimate with line items, tax, and discount calculations.',
  })
  @ApiResponse({
    status: 201,
    description: 'Invoice created successfully',
    type: CreateInvoiceResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request - validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async create(
    @Body() createDto: CreateInvoiceDto,
    @Request() req: AuthenticatedRequest,
  ): Promise<CreateInvoiceResponseDto> {
    // Organizations removed - data is user-scoped
    const invoice = await this.invoicesService.create(
      req.user.userId,
      createDto,
    );
    // Issue #36 & #62: Return with DTO and success message
    return {
      data: invoice,
      message: 'Invoice created successfully',
    };
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update an invoice',
    description:
      'Update an existing invoice. Only draft invoices can be fully edited.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Invoice ID' })
  @ApiResponse({
    status: 200,
    description: 'Invoice updated successfully',
    type: UpdateInvoiceResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  @ApiResponse({
    status: 400,
    description: 'Bad request - cannot edit non-draft invoice',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateInvoiceDto,
    @Request() req: AuthenticatedRequest,
  ): Promise<UpdateInvoiceResponseDto> {
    // Log the update data for debugging (excluding sensitive info)
    const logger = new Logger(InvoicesController.name);
    logger.log(
      `Updating invoice ${id} with data: ${JSON.stringify({ ...updateDto, items: updateDto.items?.length || 0 })}`,
    );
    // Organizations removed - data is user-scoped
    const invoice = await this.invoicesService.update(
      id,
      req.user.userId,
      updateDto,
    );
    // Issue #36 & #62: Return with DTO and success message
    return {
      data: invoice,
      message: 'Invoice updated successfully',
    };
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  @ApiOperation({
    summary: 'Delete an invoice',
    description:
      'Delete an invoice. Only draft invoices can be deleted. Admin/Owner only.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Invoice ID' })
  @ApiResponse({ status: 200, description: 'Invoice deleted successfully' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  @ApiResponse({
    status: 400,
    description: 'Bad request - cannot delete non-draft invoice',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin/Owner access required',
  })
  remove(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    // Organizations removed - data is user-scoped
    return this.invoicesService.remove(id, req.user.userId);
  }

  @Post(':id/convert')
  @ApiOperation({
    summary: 'Convert estimate to invoice',
    description:
      'Convert an estimate to a regular invoice with a new invoice number.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Estimate ID' })
  @ApiResponse({
    status: 200,
    description: 'Estimate converted to invoice successfully',
  })
  @ApiResponse({ status: 404, description: 'Estimate not found' })
  @ApiResponse({ status: 400, description: 'Bad request - not an estimate' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  convert(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    // Organizations removed - data is user-scoped
    const result = this.invoicesService.convertEstimateToInvoice(
      id,
      req.user.userId,
    );
    return result;
  }

  @Post(':id/send')
  @ApiOperation({
    summary: 'Send invoice via email',
    description:
      'Send an invoice to the client via email. Requires SMTP or SendGrid configuration.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Invoice ID' })
  @ApiResponse({ status: 200, description: 'Invoice email sent successfully' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  @ApiResponse({
    status: 400,
    description:
      'Bad request - Email service not configured or client email missing',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async send(
    @Param('id') id: string,
    @Body() emailOptions: SendInvoiceEmailDto,
    @Request() req: AuthenticatedRequest,
  ) {
    // Organizations removed - data is user-scoped
    const result = await this.invoicesService.sendEmail(
      id,
      req.user.userId,
      emailOptions,
    );
    return result;
  }

  @Post(':id/pdf')
  @ApiOperation({
    summary: 'Generate invoice PDF',
    description: 'Generate and download a PDF version of the invoice.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Invoice ID' })
  @ApiResponse({
    status: 200,
    description: 'PDF generated successfully',
    content: { 'application/pdf': {} },
  })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async generatePdf(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    // Organizations removed - data is user-scoped
    const pdfBuffer = await this.invoicesService.generatePdf(
      id,
      req.user.userId,
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=invoice-${id}.pdf`,
    );
    res.send(pdfBuffer);
  }

  @Post('backfill-paid-at')
  @Roles(UserRole.ADMIN, UserRole.OWNER) // FIX Issue #44: Ensure admin-only access
  @ApiOperation({
    summary: 'Backfill paid dates',
    description:
      'Backfill paidAt dates for invoices that are marked as paid but missing the paidAt timestamp. Admin/Owner only.',
  })
  @ApiResponse({
    status: 200,
    description: 'Paid dates backfilled successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin/Owner access required',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async backfillPaidAt(@Request() req: AuthenticatedRequest) {
    const result = await this.invoicesService.backfillPaidAtDates(
      req.user.userId,
    );
    return result;
  }
}
