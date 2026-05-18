import { Injectable, NotFoundException, BadRequestException, Logger, Inject, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, IsNull, DataSource, QueryRunner } from 'typeorm';
import { Invoice } from './entities/invoice.entity';
import { InvoiceItem } from './entities/invoice-item.entity';
import { CreateInvoiceDto, UpdateInvoiceDto, InvoiceItemDto } from './dto';
import { InventoryService } from '../inventory/inventory.service';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { StockMovement } from '../inventory/entities/stock-movement.entity';
import { Store } from '../inventory/entities/store.entity';
import { StoreService } from '../inventory/store.service';
import { StoreStockValidatorService } from '../inventory/store-stock-validator.service';
import { InvoicePdfService } from './invoice-pdf.service';
import { UserSettingsService } from '../user-settings/user-settings.service';
import { sanitizeString } from '../common/utils/security.util';
import { createPaginatedResponse, PaginatedResponse } from '../common/utils/pagination-links.util';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { CacheKey, buildCacheKey, getCacheKeysToInvalidate } from '../common/utils/cache-invalidation.util';
import { applyDefaultSort } from '../common/utils/default-sorting.util';
import { computeInvoiceTotalsCents, invoiceTotalsToMoney } from './utils/invoice-totals.util';
import { centsToMoney } from '../common/utils/edge-case-protection.util';
import {
  validateStatusTransition,
  validateStatusBusinessRules,
  shouldAffectStock,
  InvoiceStatus,
} from './utils/invoice-status.util';
import { InvoiceStatusHistory } from './entities/invoice-status-history.entity';
import { validateDate, validateUUID, validateString } from '../common/utils/edge-case-protection.util';
import { validateCurrencyCode } from './utils/currency.util';
import { Client } from '../clients/entities/client.entity';
import { UsageService, UsageMetric } from '../subscriptions/usage.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { QuotaExceededException } from '../common/exceptions/subscription.exception';
import { MailService } from '../mail/mail.service';

@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);

  private readonly DEFAULT_PAGE_SIZE = 100;
  private readonly MAX_PAGE_SIZE = 200; // Reduced from 1000 to prevent performance issues

  constructor(
    @InjectRepository(Invoice)
    private invoicesRepository: Repository<Invoice>,
    @InjectRepository(InvoiceItem)
    private invoiceItemsRepository: Repository<InvoiceItem>,
    @InjectRepository(InvoiceStatusHistory)
    private statusHistoryRepository: Repository<InvoiceStatusHistory>,
    private inventoryService: InventoryService,
    private storeService: StoreService,
    private storeStockValidator: StoreStockValidatorService,
    private invoicePdfService: InvoicePdfService,
    private userSettingsService: UserSettingsService,
    private mailService: MailService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly dataSource: DataSource,
    private usageService: UsageService,
    private subscriptionsService: SubscriptionsService,
  ) {}

  async findAll(
    userId: string,
    filters?: {
      status?: string;
      type?: string;
      search?: string;
      storeId?: string;
      issueDateFrom?: string;
      issueDateTo?: string;
      dueDateFrom?: string;
      dueDateTo?: string;
      paidDateFrom?: string;
      paidDateTo?: string;
      createdAtFrom?: string;
      createdAtTo?: string;
      totalMin?: number;
      totalMax?: number;
      subtotalMin?: number;
      subtotalMax?: number;
    },
  ): Promise<Invoice[]> {
    try {
      // Validate userId
      if (!userId) {
        this.logger.error('[findAll] userId is missing or undefined');
        throw new BadRequestException('User ID is required');
      }
      
      // DIAGNOSTIC: Log the query parameters
      this.logger.log(`[DIAGNOSTIC] findAll called with userId: ${userId}`);
      
      const query = this.invoicesRepository
        .createQueryBuilder('invoice')
        .leftJoinAndSelect('invoice.client', 'client', 'client.deletedAt IS NULL')
        .leftJoinAndSelect('invoice.store', 'store', 'store.deletedAt IS NULL') // CRITICAL: Exclude soft-deleted stores
        // Load items separately to avoid TypeORM soft delete filtering (InvoiceItem uses CASCADE, not soft delete)
        .leftJoin('invoice.items', 'items')
        .addSelect([
          'items.id',
          'items.invoiceId',
          'items.inventoryItemId',
          'items.description',
          'items.quantity',
          'items.unitPrice',
          'items.taxRate',
          'items.discountRate',
          'items.lineTotal',
          'items.createdAt',
        ])
        // Organizations removed - filter by userId only (user-scoped data)
        .where('invoice.userId = :userId', { userId })
        .andWhere('invoice.deletedAt IS NULL'); // Explicitly exclude soft-deleted invoices
      
      // DIAGNOSTIC: Log the SQL query (only in development to avoid performance issues)
      if (process.env.NODE_ENV !== 'production') {
        try {
          const sql = query.getSql();
          this.logger.log(`[DIAGNOSTIC] SQL Query: ${sql}`);
        } catch (sqlError) {
          this.logger.warn(`[DIAGNOSTIC] Could not get SQL query: ${sqlError}`);
        }
      }

      if (filters?.status) {
        query.andWhere('invoice.status = :status', { status: filters.status });
      }

      if (filters?.type) {
        query.andWhere('invoice.type = :type', { type: filters.type });
      }

      if (filters?.search) {
        // Safely handle null client in search query
        query.andWhere(
          '(invoice.number ILIKE :search OR (client.name IS NOT NULL AND client.name ILIKE :search) OR (client.email IS NOT NULL AND client.email ILIKE :search) OR invoice.status::text ILIKE :search OR invoice.type::text ILIKE :search OR invoice.currency ILIKE :search OR invoice.notes ILIKE :search OR CAST(invoice.total AS TEXT) ILIKE :search)',
          { search: `%${filters.search}%` },
        );
      }

      if (filters?.storeId) {
        query.andWhere('invoice.storeId = :storeId', { storeId: filters.storeId });
      }

      // Date range filters
      if (filters?.issueDateFrom) {
        query.andWhere('invoice.issueDate >= :issueDateFrom', { issueDateFrom: filters.issueDateFrom });
      }
      if (filters?.issueDateTo) {
        query.andWhere('invoice.issueDate <= :issueDateTo', { issueDateTo: filters.issueDateTo });
      }
      if (filters?.dueDateFrom) {
        query.andWhere('invoice.dueDate >= :dueDateFrom', { dueDateFrom: filters.dueDateFrom });
      }
      if (filters?.dueDateTo) {
        query.andWhere('invoice.dueDate <= :dueDateTo', { dueDateTo: filters.dueDateTo });
      }
      if (filters?.paidDateFrom) {
        query.andWhere('invoice.paidAt >= :paidDateFrom', { paidDateFrom: filters.paidDateFrom });
      }
      if (filters?.paidDateTo) {
        query.andWhere('invoice.paidAt <= :paidDateTo', { paidDateTo: filters.paidDateTo });
      }
      if (filters?.createdAtFrom) {
        query.andWhere('invoice.createdAt >= :createdAtFrom', { createdAtFrom: filters.createdAtFrom });
      }
      if (filters?.createdAtTo) {
        query.andWhere('invoice.createdAt <= :createdAtTo', { createdAtTo: filters.createdAtTo });
      }

      // Amount range filters
      if (filters?.totalMin !== undefined) {
        query.andWhere('invoice.total >= :totalMin', { totalMin: filters.totalMin });
      }
      if (filters?.totalMax !== undefined) {
        query.andWhere('invoice.total <= :totalMax', { totalMax: filters.totalMax });
      }
      if (filters?.subtotalMin !== undefined) {
        query.andWhere('invoice.subtotal >= :subtotalMin', { subtotalMin: filters.subtotalMin });
      }
      if (filters?.subtotalMax !== undefined) {
        query.andWhere('invoice.subtotal <= :subtotalMax', { subtotalMax: filters.subtotalMax });
      }

      const results = await query
        .orderBy('invoice.issueDate', 'DESC') // Primary sort by issue date (newest first)
        .addOrderBy('invoice.createdAt', 'DESC') // Secondary sort by creation date
        .addOrderBy('invoice.updatedAt', 'DESC') // Tertiary sort by updatedAt
        .addOrderBy('invoice.number', 'DESC') // Final fallback: invoice number
        .getMany();
      
      // DIAGNOSTIC: Log the results
      this.logger.log(`[DIAGNOSTIC] findAll returned ${results.length} invoices for userId: ${userId}`);
      if (results.length > 0) {
        this.logger.log(`[DIAGNOSTIC] First invoice: id=${results[0].id}, number=${results[0].number}, userId=${results[0].userId}`);
      } else {
        // Check if there are any invoices for this user at all (including deleted)
        const allInvoices = await this.invoicesRepository
          .createQueryBuilder('invoice')
          .withDeleted()
          .where('invoice.userId = :userId', { userId })
          .getMany();
        this.logger.warn(`[DIAGNOSTIC] No active invoices found, but found ${allInvoices.length} total invoices (including deleted) for userId: ${userId}`);
        if (allInvoices.length > 0) {
          this.logger.warn(`[DIAGNOSTIC] Sample invoice: id=${allInvoices[0].id}, userId=${allInvoices[0].userId}, deletedAt=${allInvoices[0].deletedAt}`);
        }
      }
      
      return results;
    } catch (error: any) {
      this.logger.error(`[findAll] Error fetching invoices for userId ${userId}: ${error.message}`, error.stack);
      // Re-throw HttpExceptions as-is, wrap other errors
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      // Wrap database and other errors in InternalServerErrorException
      throw new InternalServerErrorException(
        `Failed to fetch invoices: ${error.message || 'Unknown error'}`,
      );
    }
  }

  async findPaged(
    userId: string,
    params?: {
      page?: number;
      limit?: number;
      status?: string;
      type?: string;
      search?: string;
      storeId?: string;
      issueDateFrom?: string;
      issueDateTo?: string;
      dueDateFrom?: string;
      dueDateTo?: string;
      paidDateFrom?: string;
      paidDateTo?: string;
      createdAtFrom?: string;
      createdAtTo?: string;
      totalMin?: number;
      totalMax?: number;
      subtotalMin?: number;
      subtotalMax?: number;
    },
  ): Promise<PaginatedResponse<Invoice>> {
    const pageRaw = Number(params?.page ?? 1);
    const limitRaw = Number(params?.limit ?? this.DEFAULT_PAGE_SIZE);

    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
    const limitUncapped =
      Number.isFinite(limitRaw) && limitRaw > 0 ? Math.floor(limitRaw) : this.DEFAULT_PAGE_SIZE;
    const limit = Math.min(Math.max(1, limitUncapped), this.MAX_PAGE_SIZE);

    const query = this.invoicesRepository
      .createQueryBuilder('invoice')
      .leftJoinAndSelect('invoice.client', 'client', 'client.deletedAt IS NULL')
      .leftJoinAndSelect('invoice.store', 'store', 'store.deletedAt IS NULL') // CRITICAL: Exclude soft-deleted stores
      // Load items separately to avoid TypeORM soft delete filtering (InvoiceItem uses CASCADE, not soft delete)
      .leftJoin('invoice.items', 'items')
      .addSelect([
        'items.id',
        'items.invoiceId',
        'items.inventoryItemId',
        'items.description',
        'items.quantity',
        'items.unitPrice',
        'items.taxRate',
        'items.discountRate',
        'items.lineTotal',
        'items.createdAt',
      ])
      // Fix: Properly respect organization boundaries
      // Organizations removed - filter by userId only (user-scoped data)
      .where('invoice.userId = :userId', { userId })
      .andWhere('invoice.deletedAt IS NULL'); // Explicitly exclude soft-deleted invoices

    if (params?.status) {
      query.andWhere('invoice.status = :status', { status: params.status });
    }

    if (params?.type) {
      query.andWhere('invoice.type = :type', { type: params.type });
    }

    if (params?.search) {
      query.andWhere(
        '(invoice.number ILIKE :search OR client.name ILIKE :search OR client.email ILIKE :search OR invoice.status::text ILIKE :search OR invoice.type::text ILIKE :search OR invoice.currency ILIKE :search OR invoice.notes ILIKE :search OR CAST(invoice.total AS TEXT) ILIKE :search)',
        { search: `%${params.search}%` },
      );
    }

    if (params?.storeId) {
      query.andWhere('invoice.storeId = :storeId', { storeId: params.storeId });
    }

    // Date range filters
    if (params?.issueDateFrom) {
      query.andWhere('invoice.issueDate >= :issueDateFrom', { issueDateFrom: params.issueDateFrom });
    }
    if (params?.issueDateTo) {
      query.andWhere('invoice.issueDate <= :issueDateTo', { issueDateTo: params.issueDateTo });
    }
    if (params?.dueDateFrom) {
      query.andWhere('invoice.dueDate >= :dueDateFrom', { dueDateFrom: params.dueDateFrom });
    }
    if (params?.dueDateTo) {
      query.andWhere('invoice.dueDate <= :dueDateTo', { dueDateTo: params.dueDateTo });
    }
    if (params?.paidDateFrom) {
      query.andWhere('invoice.paidAt >= :paidDateFrom', { paidDateFrom: params.paidDateFrom });
    }
    if (params?.paidDateTo) {
      query.andWhere('invoice.paidAt <= :paidDateTo', { paidDateTo: params.paidDateTo });
    }
    if (params?.createdAtFrom) {
      query.andWhere('invoice.createdAt >= :createdAtFrom', { createdAtFrom: params.createdAtFrom });
    }
    if (params?.createdAtTo) {
      query.andWhere('invoice.createdAt <= :createdAtTo', { createdAtTo: params.createdAtTo });
    }

    // Amount range filters
    if (params?.totalMin !== undefined) {
      query.andWhere('invoice.total >= :totalMin', { totalMin: params.totalMin });
    }
    if (params?.totalMax !== undefined) {
      query.andWhere('invoice.total <= :totalMax', { totalMax: params.totalMax });
    }
    if (params?.subtotalMin !== undefined) {
      query.andWhere('invoice.subtotal >= :subtotalMin', { subtotalMin: params.subtotalMin });
    }
    if (params?.subtotalMax !== undefined) {
      query.andWhere('invoice.subtotal <= :subtotalMax', { subtotalMax: params.subtotalMax });
    }

    // IMPORTANT: counting with joins can over-count due to invoice_items join.
    // Use DISTINCT invoice.id for accurate totals.
    // Query timeout is handled at connection level (statement_timeout: 30000 in app.module.ts)
    const total = await query
      .clone()
      .select('invoice.id')
      .distinct(true)
      .getCount();

    const skip = (page - 1) * limit;
    const data = await query
      .clone()
      .orderBy('invoice.issueDate', 'DESC') // Primary sort by issue date (newest first)
      .addOrderBy('invoice.createdAt', 'DESC') // Secondary sort by creation date
      .addOrderBy('invoice.updatedAt', 'DESC') // Tertiary sort by updatedAt
      .addOrderBy('invoice.number', 'DESC') // Final fallback: invoice number
      .skip(skip)
      .take(limit)
      .getMany();

    // Issue #71: Add pagination links (HATEOAS)
    const baseUrl = '/api/v1/invoices/paged';
    const queryParams: Record<string, string | number | boolean> = {};
    if (params?.status) queryParams.status = params.status;
    if (params?.type) queryParams.type = params.type;
    if (params?.search) queryParams.search = params.search;
    if (params?.storeId) queryParams.storeId = params.storeId;
    return createPaginatedResponse(data, page, limit, total, baseUrl, queryParams);
  }

  async findOne(id: string, userId: string): Promise<Invoice> {
    // Check cache first (granular cache key with invoice ID)
    // Organizations removed - cache keys no longer include organizationId
    const cacheKey = buildCacheKey(CacheKey.INVOICE_DETAIL, { invoiceId: id, userId });
    const cached = await this.cacheManager.get<Invoice>(cacheKey);
    if (cached) {
      this.logger.debug(`Returning cached invoice ${id}`);
      return cached;
    }
    
    // Fix Issue #1: Use query builder instead of 'as any' type assertion
    // InvoiceItem doesn't have soft delete (uses CASCADE), so we don't filter by deletedAt
    // Load items separately to avoid TypeORM soft delete filtering
    const invoice = await this.invoicesRepository
      .createQueryBuilder('invoice')
      .leftJoinAndSelect('invoice.client', 'client', 'client.deletedAt IS NULL')
      .leftJoinAndSelect('invoice.store', 'store', 'store.deletedAt IS NULL') // CRITICAL: Exclude soft-deleted stores
      .leftJoin('invoice.items', 'items')
      .addSelect([
        'items.id',
        'items.invoiceId',
        'items.inventoryItemId',
        'items.description',
        'items.quantity',
        'items.unitPrice',
        'items.taxRate',
        'items.discountRate',
        'items.lineTotal',
        'items.createdAt',
      ])
      .leftJoinAndSelect('items.inventoryItem', 'inventoryItem')
      .where('invoice.id = :id', { id })
      .andWhere('invoice.userId = :userId', { userId })
      .andWhere('invoice.deletedAt IS NULL') // Explicitly exclude soft-deleted invoices
      .getOne();
    
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }
    
    // Cache for 5 minutes
    await this.cacheManager.set(cacheKey, invoice, 300000);
    return invoice;
  }

  async create(userId: string, data: CreateInvoiceDto & { status?: string; paymentTermsDays?: number; terms?: string; metadataJson?: any; isDuplicate?: boolean }): Promise<Invoice> {
    this.logger.log(`Creating invoice for user ${userId}, type: ${data.type}`);
    
    // Note: Quota check is handled by QuotaGuard, which skips quota for duplications
    // The isDuplicate flag is checked by the guard, so we don't need to check quota here
    // Extract isDuplicate flag (it will be ignored when saving since it's not part of Invoice entity)
    const isDuplicate = data.isDuplicate;
    
    // Check subscription and quota before creating invoice (only if not a duplication)
    // Note: This is a fallback - QuotaGuard should have already handled this
    if (!isDuplicate) {
    const subscription = await this.subscriptionsService.getSubscription(userId);
    if (subscription && subscription.plan) {
      const limit = subscription.plan.features?.maxInvoices as number | null;
      const hasQuota = await this.usageService.checkQuota(userId, UsageMetric.INVOICES_CREATED, limit);
      if (!hasQuota) {
        const currentUsage = await this.usageService.getUsage(userId, UsageMetric.INVOICES_CREATED);
        throw new QuotaExceededException('invoices', limit || 0, currentUsage);
        }
      }
    }
    
    // CRITICAL FIX #191: Validate invoice has at least one item
    if (!data.items || data.items.length === 0) {
      throw new BadRequestException('Invoice must have at least one item');
    }
    
    // CRITICAL FIX #69: Validate storeId and stock BEFORE transaction starts
    // This prevents starting a transaction that will fail validation
    let validatedStoreId: string | undefined = undefined;
    if (data.storeId && typeof data.storeId === 'string' && data.storeId.trim() !== '') {
      try {
        await this.storeService.findOne(data.storeId, userId);
        validatedStoreId = data.storeId;
      } catch (error) {
        throw new BadRequestException(`Store with ID "${data.storeId}" not found or does not belong to user`);
      }

      // CRITICAL FIX #69: Validate store stock availability BEFORE transaction
      // Note: This validation happens outside transaction, but we'll re-validate inside transaction with locks
      if (data.items && data.items.length > 0) {
        const operation = (data.status || 'draft') === 'draft' ? 'reserve' : 'sale';
        try {
          await this.storeStockValidator.validateAndThrow(
            validatedStoreId,
            data.items,
            userId,
            operation,
          );
        } catch (error) {
          // Re-throw BadRequestException from validator
          throw error;
        }
      }
    }
    
    data.storeId = validatedStoreId;
    
    // Get user settings for defaults
    const settings = await this.userSettingsService.getSettings(userId);
    
    // PHASE 4 FIX: Use validateDate with dateOnly: true for consistent date handling
    const tenYearsAgo = new Date();
    tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);
    const oneYearFromNow = new Date();
    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
    
    const issueDate = validateDate(data.issueDate, 'issueDate', {
      required: true,
      dateOnly: true, // Normalize to midnight UTC
      allowFuture: true, // Allow future dates for scheduled invoices
      minDate: tenYearsAgo,
      maxDate: oneYearFromNow,
    });
    
    // Calculate due date if not provided, using defaultPaymentTermsDays
    let dueDate: Date | null = null;
    if (data.dueDate) {
      dueDate = validateDate(data.dueDate, 'dueDate', {
        required: false,
        dateOnly: true,
        minDate: issueDate, // Must be after issue date
      });
    } else {
      // Auto-calculate due date from issue date
      const paymentTermsDays = typeof data.paymentTermsDays === 'number' 
        ? data.paymentTermsDays 
        : (settings?.defaultPaymentTermsDays || 30);
      dueDate = new Date(issueDate);
      dueDate.setUTCDate(dueDate.getUTCDate() + Number(paymentTermsDays));
      // Normalize to midnight UTC
      dueDate = new Date(Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth(), dueDate.getUTCDate()));
    }
    
    // Sanitize text inputs to prevent XSS
    // CRITICAL: Exclude items from invoiceData to prevent cascade save with invalid quantity types
    const { items, ...dataWithoutItems } = data;
    // PHASE 5 FIX: Validate currency code
    const validatedCurrency = validateCurrencyCode(data.currency || 'USD', 'currency');
    
    const invoiceData = {
      ...dataWithoutItems,
      userId,
      status: (data.status || 'draft') as 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled', // Default to 'draft' if not provided
      issueDate: issueDate,
      dueDate: dueDate,
      currency: validatedCurrency,
      // Apply default notes and terms if not provided, and sanitize
      notes: data.notes || settings?.defaultInvoiceNotes || null,
      metadataJson: {
        ...(data.metadataJson || {}),
        terms: data.terms || settings?.defaultInvoiceTerms || null,
      },
    };
    
    // Sanitize notes and terms
    if (invoiceData.notes && typeof invoiceData.notes === 'string') {
      invoiceData.notes = sanitizeString(invoiceData.notes, 10000);
    } else if (!invoiceData.notes) {
      invoiceData.notes = null;
    }
    if (invoiceData.metadataJson?.terms && typeof invoiceData.metadataJson.terms === 'string') {
      invoiceData.metadataJson.terms = sanitizeString(invoiceData.metadataJson.terms, 5000);
    }
    // Fix Bug #22: Remove double type assertion - use proper type casting
    // Ensure notes is string or undefined (not empty object)
    const notesValue = typeof invoiceData.notes === 'string' ? invoiceData.notes : undefined;
    // CRITICAL: Ensure items are NOT included in invoice object to prevent cascade save
    // Items will be saved separately with proper integer quantity conversion
    const invoice = this.invoicesRepository.create({
      ...invoiceData,
      dueDate: invoiceData.dueDate || undefined,
      notes: notesValue,
      items: undefined, // Explicitly exclude items to prevent cascade save
    }) as Invoice;

    // Calculate totals using cents-based function (single source of truth)
    const totalsResult = computeInvoiceTotalsCents(data.items);
    const totals = invoiceTotalsToMoney(totalsResult);
    invoice.subtotal = totals.invoice.subtotal;
    invoice.taxTotal = totals.invoice.tax;
    invoice.discountTotal = totals.invoice.discount;
    invoice.total = totals.invoice.total;

    // CRITICAL FIX #124: Generate invoice number will be done within transaction
    // We'll generate it after transaction starts to ensure uniqueness

    // Use a transaction to ensure invoice and items are created atomically
    const queryRunner = this.invoicesRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    
    // FIX #130: Set transaction timeout (30 seconds)
    await queryRunner.query('SET LOCAL statement_timeout = 30000');
    
    await queryRunner.startTransaction();
    
    let savedInvoice: Invoice;
    
    try {
      // CRITICAL FIX #124: Generate invoice number within transaction to prevent duplicates
      if (!invoice.number) {
        invoice.number = await this.generateInvoiceNumber(userId, invoice.type, settings, queryRunner);
      }
      
      // Save invoice within transaction
      savedInvoice = await queryRunner.manager.save(Invoice, invoice);
      this.logger.log(`Invoice created: ${savedInvoice.number} (${savedInvoice.id})`);

      // CRITICAL FIX #113: Validate no duplicate inventory items
      if (data.items && data.items.length > 0) {
        const inventoryItemIds = new Set<string>();
        for (const item of data.items) {
          if (item.inventoryItemId) {
            if (inventoryItemIds.has(item.inventoryItemId)) {
              throw new BadRequestException(
                `Duplicate inventory item ${item.inventoryItemId} in invoice. Each inventory item can only appear once per invoice.`
              );
            }
            inventoryItemIds.add(item.inventoryItemId);
          }
        }
      }
      
      // Create invoice items - use totals from computeInvoiceTotalsCents for consistency
      // This ensures line totals match invoice totals exactly
      const itemsToInsert = (data.items || []).map((item: InvoiceItemDto, index: number) => {
        // Get line totals from the cents-based calculation (already validated)
        const lineTotals = totalsResult.lines[index];
        if (!lineTotals) {
          throw new BadRequestException(`Missing line totals for item ${index + 1}`);
        }
        
        // Validate optional inventoryItemId field with proper type checking
        let validatedInventoryItemId: string | null = null;
        if (item.inventoryItemId) {
          if (typeof item.inventoryItemId === 'string') {
            const trimmed = item.inventoryItemId.trim();
            // Validate UUID format if provided
            if (trimmed !== '' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
              validatedInventoryItemId = trimmed;
            } else if (trimmed !== '') {
              this.logger.warn(`Invalid inventoryItemId format: ${trimmed}, setting to null`);
            }
          } else {
            this.logger.warn(`Invalid inventoryItemId type: ${typeof item.inventoryItemId}, expected string, setting to null`);
          }
        }
        
        // Convert cents back to money for storage (database stores as decimal)
        return {
          inventoryItemId: validatedInventoryItemId,
          description: String(item.description || ''),
          quantity: Math.floor(Number(item.quantity)), // Must be integer for database column type 'int'
          unitPrice: Number(Number(item.unitPrice).toFixed(2)), // Use original unitPrice from item
          taxRate: item.taxRate !== undefined && item.taxRate !== null ? Number(Number(item.taxRate).toFixed(2)) : 0,
          discountRate: item.discountRate !== undefined && item.discountRate !== null ? Number(Number(item.discountRate).toFixed(2)) : 0,
          lineTotal: centsToMoney(lineTotals.lineTotalCents), // Use calculated total from cents function
          invoiceId: String(savedInvoice.id),
        };
      });
      
      // Verify lineTotal is set for all items and log values before insert
      itemsToInsert.forEach((item, index) => {
        this.logger.log(`Item ${index} before insert - lineTotal: ${item.lineTotal}, type: ${typeof item.lineTotal}, quantity: ${item.quantity}, unitPrice: ${item.unitPrice}`);
        if (item.lineTotal === null || item.lineTotal === undefined || isNaN(item.lineTotal)) {
          this.logger.error(`CRITICAL: Item ${index} has invalid lineTotal before insert: ${item.lineTotal}`);
          // Force recalculate
          const qty = Number(item.quantity) || 0;
          const price = Number(item.unitPrice) || 0;
          const tax = Number(item.taxRate || 0) || 0;
          const discount = Number(item.discountRate || 0) || 0;
          const subtotal = qty * price;
          const disc = (subtotal * discount) / 100;
          const afterDisc = subtotal - disc;
          const taxAmount = (afterDisc * tax) / 100;
          item.lineTotal = Number((Math.round((afterDisc + taxAmount) * 100) / 100).toFixed(2));
          this.logger.log(`Recalculated lineTotal for item ${index}: ${item.lineTotal}`);
        }
      });
      
      // Insert items using query builder to ensure all fields are explicitly included
      this.logger.log(`Inserting ${itemsToInsert.length} items with lineTotal values: ${itemsToInsert.map(i => i.lineTotal).join(', ')}`);
      
      // Use query builder to explicitly set all values including lineTotal
      if (itemsToInsert.length > 0) {
        const values = itemsToInsert.map(item => ({
          inventoryItemId: item.inventoryItemId,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          taxRate: item.taxRate,
          discountRate: item.discountRate,
          lineTotal: item.lineTotal,
          invoiceId: item.invoiceId,
        }));
        
        // Double-check all values and ensure they're correct types
        values.forEach((val, idx) => {
          // CRITICAL: Ensure quantity is an integer (database column is type 'int')
          val.quantity = Math.floor(Number(val.quantity));
          if (isNaN(val.quantity) || val.quantity < 1) {
            throw new BadRequestException(`Invalid quantity at index ${idx}: ${val.quantity}. Must be a positive integer.`);
          }
          
          // Force convert lineTotal to number
          val.lineTotal = Number(val.lineTotal);
          if (val.lineTotal === null || val.lineTotal === undefined || isNaN(val.lineTotal)) {
            this.logger.error(`CRITICAL: Value ${idx} has invalid lineTotal: ${val.lineTotal}, fixing...`);
            val.lineTotal = 0;
          }
          this.logger.log(`Item ${idx} - lineTotal: ${val.lineTotal} (${typeof val.lineTotal}), quantity: ${val.quantity} (${typeof val.quantity}), unitPrice: ${val.unitPrice}`);
        });
        
        // Use queryRunner.query to insert with raw SQL to ensure lineTotal is explicitly included
        // This bypasses TypeORM's entity mapping which might be filtering out lineTotal
        // Insert each item individually with explicit lineTotal in raw SQL
        // Capture the inserted invoice item IDs so stock movements can link back to the exact invoice line (auditability).
        const insertedInvoiceItems: Array<{
          id: string;
          inventoryItemId: string | null;
          quantity: number;
        }> = [];
        for (const val of values) {
        // Final safety check: ensure lineTotal is never null, undefined, or NaN
        let finalLineTotal = val.lineTotal;
        if (finalLineTotal === null || finalLineTotal === undefined || isNaN(finalLineTotal)) {
          // Recalculate lineTotal as a last resort
          const qty = Number(val.quantity) || 0;
          const price = Number(val.unitPrice) || 0;
          const tax = Number(val.taxRate || 0) || 0;
          const discount = Number(val.discountRate || 0) || 0;
          const subtotal = qty * price;
          const disc = (subtotal * discount) / 100;
          const afterDisc = subtotal - disc;
          const taxAmount = (afterDisc * tax) / 100;
          finalLineTotal = Math.round((afterDisc + taxAmount) * 100) / 100;
          this.logger.warn(`Final safety check: Recalculated lineTotal from ${val.lineTotal} to ${finalLineTotal}`);
        }
        
        // Ensure it's a number, not null/undefined
        finalLineTotal = Number(finalLineTotal);
        if (isNaN(finalLineTotal) || finalLineTotal === null || finalLineTotal === undefined) {
          finalLineTotal = 0;
          this.logger.error(`CRITICAL: lineTotal still invalid after all checks, defaulting to 0`);
        }
        
        // Sanitize description to prevent XSS and SQL injection
        const sanitizedDescription = sanitizeString(val.description, 1000);
        
        this.logger.log(`Inserting item with lineTotal: ${finalLineTotal} (type: ${typeof finalLineTotal})`);
        
        const insertResult = await queryRunner.query(
          `INSERT INTO "invoice_items" ("invoiceId", "inventoryItemId", "description", "quantity", "unitPrice", "taxRate", "discountRate", "lineTotal") 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING "id"`,
          [
            val.invoiceId,
            val.inventoryItemId,
            sanitizedDescription, // Use sanitized description
            val.quantity,
            val.unitPrice,
            val.taxRate,
            val.discountRate,
            finalLineTotal, // Use the final validated value
          ],
        );

          const insertedId = insertResult?.[0]?.id;
          if (insertedId) {
            insertedInvoiceItems.push({
              id: insertedId,
              inventoryItemId: val.inventoryItemId ?? null,
              quantity: val.quantity,
            });
          }
        }

        // PHASE 3 FIX: Stock should only be affected at specific status transitions, not in Draft
        // Estimates never affect stock
        // IMPORTANT: Stock movements must be created within the transaction to prevent race conditions
        // Draft invoices do NOT affect stock - stock is only deducted when moving to Sent/Paid
        const shouldDeductStock = savedInvoice.type !== 'estimate' 
          && savedInvoice.status !== 'cancelled' 
          && savedInvoice.status !== 'draft'; // PHASE 3: Draft doesn't affect stock
        if (shouldDeductStock) {
          for (const item of insertedInvoiceItems) {
            if (item.inventoryItemId) {
              // Deduct stock for draft, sent, and paid invoices
              // CRITICAL FIX #5, #108: Validate stock availability within transaction with locks
              const inventoryItem = await queryRunner.manager.findOne(InventoryItem, {
                where: { id: item.inventoryItemId },
                lock: { mode: 'pessimistic_write' },
              });
              
              if (!inventoryItem) {
                throw new NotFoundException(`Inventory item ${item.inventoryItemId} not found`);
              }
              
              // Organizations removed - verify user access only
              if (inventoryItem.userId !== userId) {
                throw new NotFoundException(`Inventory item ${item.inventoryItemId} not found`);
              }
              
              // CRITICAL FIX #108, #126: Validate stock availability - only restriction is stock level
              // No status restrictions - any item can be sold as long as it has stock
              if (inventoryItem.currentStock < item.quantity) {
                throw new BadRequestException(
                  `Insufficient stock for item ${inventoryItem.name || inventoryItem.sku}. Available: ${inventoryItem.currentStock}, Required: ${item.quantity}`
                );
              }
              
              // CRITICAL FIX #22: Create movement within transaction - failures cause rollback
              await this.inventoryService.createMovement(
                item.inventoryItemId,
                userId,
                {
                  type: 'sale',
                  quantity: item.quantity,
                  sourceType: 'invoice',
                  sourceId: savedInvoice.id,
                  invoiceItemId: item.id,
                  note: `Invoice ${savedInvoice.number}${savedInvoice.status === 'draft' ? ' (draft)' : ''}`,
                },
                savedInvoice.storeId,
                queryRunner, // Pass queryRunner to ensure transaction consistency
              );
            }
          }
        }
      }
      
      // Commit transaction (stock movements are already created above)
      await queryRunner.commitTransaction();
      
      // Track usage after successful invoice creation
      try {
        await this.usageService.trackUsage(userId, UsageMetric.INVOICES_CREATED, 1);
      } catch (error: any) {
        // Don't fail invoice creation if usage tracking fails
        this.logger.error(`Failed to track usage for invoice creation: ${error.message}`);
      }
      
      // Invalidate list and stats caches on create (granular invalidation)
      // Organizations removed - cache keys no longer include organizationId
      const statsCacheKey = buildCacheKey(CacheKey.INVOICE_STATS, { userId });
      await this.cacheManager.del(statsCacheKey);
      // Note: List caches are handled by frontend query invalidation, so we don't invalidate them here
      // to avoid unnecessary refetches. The frontend will refetch when needed.
      
      return savedInvoice;
    } catch (error) {
      // Rollback transaction on error
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      // Release query runner
      await queryRunner.release();
    }
  }

  /**
   * Update an existing invoice
   * Issue #76: Enhanced code documentation
   * Issue #87: Status code standardization (200 OK)
   * Issue #88: Enhanced null handling
   * 
   * @param id - The ID of the invoice to update
   * @param userId - The ID of the user performing the update
   * @param data - Partial invoice data to update
   * @param organizationId - The organization ID for multi-tenant support
   * @returns The updated invoice entity
   * @throws NotFoundException if invoice not found
   * @throws BadRequestException if validation fails or invoice cannot be edited
   */
  /**
   * Update an existing invoice
   * FIXED: Issues #1-40 (Invoice Update & Stock Reversal)
   * - Entire operation wrapped in transaction
   * - Pessimistic locking on invoice to prevent concurrent updates
   * - Stock reversals happen within transaction using queryRunner
   * - Stock validation before creating new movements
   * - All stock operations atomic
   * - Proper error handling with rollback
   */
  async update(id: string, userId: string, data: UpdateInvoiceDto): Promise<Invoice> {
    this.logger.log(`Updating invoice ${id} for user ${userId}`);
    
    // CRITICAL FIX #2, #41: Wrap entire operation in transaction
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    
    // FIX #130: Set transaction timeout (30 seconds)
    await queryRunner.query('SET LOCAL statement_timeout = 30000');
    
    await queryRunner.startTransaction();
    
    try {
      // FIX #132: Lock order consistency - always lock invoice first, then inventory items
      // This prevents deadlocks by ensuring consistent lock order across all transactions
      // CRITICAL FIX #21, #44, #61: Use pessimistic locking to prevent concurrent updates
      // NOTE: Cannot use relations with pessimistic lock due to PostgreSQL limitation:
      // "FOR UPDATE cannot be applied to the nullable side of an outer join"
      // So we load the invoice first with lock, then load relations separately
      const invoice = await queryRunner.manager.findOne(Invoice, {
        where: {
          id,
          // Organizations removed - filter by userId only (user-scoped data)
          userId,
        },
        lock: { mode: 'pessimistic_write' },
      });
      
      // FIX #135: Release query runner on early return
      if (!invoice) {
        await queryRunner.rollbackTransaction();
        await queryRunner.release();
        throw new NotFoundException('Invoice not found');
      }
      
      // Load relations separately after acquiring the lock (without lock to avoid outer join issue)
      const invoiceWithRelations = await queryRunner.manager
        .createQueryBuilder(Invoice, 'invoice')
        .leftJoinAndSelect('invoice.items', 'items')
        .leftJoinAndSelect('invoice.client', 'client', 'client.deletedAt IS NULL') // CRITICAL: Exclude soft-deleted clients
        .leftJoinAndSelect('invoice.store', 'store', 'store.deletedAt IS NULL') // CRITICAL: Exclude soft-deleted stores
        .where('invoice.id = :id', { id: invoice.id })
        .getOne();
      
      if (invoiceWithRelations) {
        invoice.items = invoiceWithRelations.items || [];
        invoice.client = invoiceWithRelations.client;
        invoice.store = invoiceWithRelations.store;
      }
      
      // Verify access
      // Organizations removed - verify user access only
      const hasAccess = invoice.userId === userId;
      if (!hasAccess) {
        throw new NotFoundException('Invoice not found');
      }
      
      const oldStatus = invoice.status;
      const oldType = invoice.type;
      const oldItems = invoice.items || [];
      
      // PHASE 3 FIX: Use status FSM to validate transitions
      if (data.status !== undefined) {
        const validStatuses: InvoiceStatus[] = ['draft', 'sent', 'paid', 'overdue', 'cancelled'];
        if (!validStatuses.includes(data.status as InvoiceStatus)) {
          throw new BadRequestException(`Invalid status: ${data.status}. Must be one of: ${validStatuses.join(', ')}`);
        }
        
        if (data.status !== oldStatus) {
          // Validate status transition using FSM
          validateStatusTransition(oldStatus as InvoiceStatus, data.status as InvoiceStatus);
          
          // Validate business rules for the new status
          // Use invoice.total for validation (updateData.total not calculated yet)
          const invoiceTotal = invoice.total;
          const itemCount = (data.items || invoice.items || []).length;
          // Get client email for validation
          let clientEmail: string | null = null;
          if (invoice.client?.email) {
            clientEmail = invoice.client.email;
          } else if (data.clientId) {
            const client = await queryRunner.manager
              .createQueryBuilder(Client, 'client')
              .where('client.id = :id', { id: data.clientId })
              .andWhere('client.userId = :userId', { userId })
              .select(['client.id', 'client.email'])
              .getOne();
            clientEmail = client?.email || null;
          }
          
          validateStatusBusinessRules(
            data.status as InvoiceStatus,
            invoiceTotal,
            itemCount,
            clientEmail,
          );
          
          this.logger.log(`Invoice status transition: ${oldStatus} -> ${data.status}`);
          
          // FIX #134: Create status history atomically within same transaction
          // Use queryRunner.manager to ensure it's part of the same transaction
          const statusHistory = queryRunner.manager.create(InvoiceStatusHistory, {
            invoiceId: id,
            fromStatus: oldStatus as InvoiceStatus,
            toStatus: data.status as InvoiceStatus,
            userId,
            note: `Status changed from ${oldStatus} to ${data.status}`,
          });
          await queryRunner.manager.save(InvoiceStatusHistory, statusHistory);
        }
      }
      
      // CRITICAL FIX #116: Validate invoice type changes are allowed
      if (data.type !== undefined && data.type !== oldType) {
        // Can't change paid invoice to estimate
        if (oldStatus === 'paid' && data.type === 'estimate') {
          throw new BadRequestException('Cannot change paid invoice to estimate');
        }
        // Can't change estimate to invoice if it's already paid
        if (oldType === 'estimate' && data.type === 'invoice' && oldStatus === 'paid') {
          throw new BadRequestException('Cannot change paid estimate to invoice');
        }
      }
      
      // CRITICAL FIX #130: Validate client exists and belongs to organization
      // Also validate that clientId is not empty string (should be valid UUID or undefined)
      if (data.clientId !== undefined) {
        // Handle empty string - convert to undefined
        if (data.clientId === '' || (typeof data.clientId === 'string' && data.clientId.trim() === '')) {
          throw new BadRequestException('Client ID cannot be empty');
        }
        
        // Only validate if clientId is different from current
        if (data.clientId !== invoice.clientId) {
          const client = await queryRunner.manager
            .createQueryBuilder('Client', 'client')
            .where('client.id = :clientId', { clientId: data.clientId })
            .andWhere('client.userId = :userId', { userId })
            .getOne();
          
          if (!client) {
            throw new NotFoundException(`Client with ID "${data.clientId}" not found or does not belong to organization`);
          }
        }
      }

    // Strip lineTotal from items if present (backend recalculates it)
    // This prevents validation errors since lineTotal is not in the DTO
    if (data.items && Array.isArray(data.items)) {
      data.items = data.items.map((item: any) => {
        const { lineTotal, ...itemWithoutLineTotal } = item;
        return itemWithoutLineTotal;
      });
    }

    // PHASE 4 FIX: Dates are now validated using validateDate in the update logic below
    // No need to normalize here - validateDate handles all formats

      // Handle type change from estimate to invoice
      // When changing from estimate to invoice, regenerate invoice number and ensure status is draft
      let shouldGenerateInvoiceNumber = false;
      if (oldType === 'estimate' && data.type === 'invoice') {
        this.logger.log(`Converting estimate ${invoice.number} to invoice`);
        // CRITICAL FIX #124: Generate number within transaction
        shouldGenerateInvoiceNumber = true;
        // Ensure status is draft when converting (unless explicitly set to something else)
        if (data.status === undefined || data.status === null) {
          data.status = 'draft';
        }
      }

    // Validate new storeId if provided (convert empty string to undefined)
    const validatedStoreId = data.storeId !== undefined && data.storeId !== null && typeof data.storeId === 'string' && data.storeId.trim() !== ''
      ? data.storeId
      : data.storeId === '' || (typeof data.storeId === 'string' && data.storeId.trim() === '')
        ? undefined
        : data.storeId;

    if (validatedStoreId) {
      try {
        await this.storeService.findOne(validatedStoreId, userId);
      } catch (error) {
        throw new BadRequestException(`Store with ID "${validatedStoreId}" not found or does not belong to user`);
      }

      // Validate store stock if storeId is being set/changed and invoice has items
      const itemsToValidate = data.items && data.items.length > 0
        ? data.items
        : invoice.items || [];
      
      if (itemsToValidate.length > 0 && itemsToValidate.some((item: any) => item.inventoryItemId)) {
        const operation = (data.status !== undefined ? data.status : invoice.status) === 'draft' ? 'reserve' : 'sale';
        const itemsForValidation = itemsToValidate
          .filter((item: any) => item.inventoryItemId)
          .map((item: any) => ({
            inventoryItemId: item.inventoryItemId,
            quantity: item.quantity,
            description: item.description,
          }));
        
        if (itemsForValidation.length > 0) {
          try {
            await this.storeStockValidator.validateAndThrow(
              validatedStoreId,
              itemsForValidation,
              userId,
              operation,
              queryRunner, // Pass queryRunner for pessimistic locking inside transaction
            );
          } catch (error) {
            throw error;
          }
        }
      }
    }

    // Update data.storeId to the processed value
    data.storeId = validatedStoreId;

      // CRITICAL FIX #1, #3, #6, #17: Handle stock reversals within transaction
      // IMPORTANT: this must be idempotent: reverse any prior invoice movements once, then re-apply based on new state.
      // PHASE 3 FIX: Only reverse stock if invoice was in a status that affects stock (not draft)
      const oldAffectsStockForReversal = oldType !== 'estimate' && oldStatus !== 'cancelled' && oldStatus !== 'draft';
      if (oldAffectsStockForReversal && oldItems.length > 0) {
        // CRITICAL FIX #3: Pass queryRunner to ensure reversal happens in transaction
        await this.inventoryService.deleteMovementsBySource('invoice', id, userId, queryRunner);
      }

    // Create properly typed update object
    interface InvoiceUpdateData {
      [key: string]: any;
      subtotal?: number;
      taxTotal?: number;
      discountTotal?: number;
      total?: number;
      issueDate?: string;
      dueDate?: string;
      paidAt?: string | undefined;
      notes?: string | undefined;
      metadataJson?: { terms?: string } | any;
    }

    const updateData: InvoiceUpdateData = {};
    
    // Only copy defined fields from data
    // CRITICAL: Ensure clientId is not empty string (foreign key constraint)
    if (data.clientId !== undefined) {
      if (data.clientId === '' || (typeof data.clientId === 'string' && data.clientId.trim() === '')) {
        throw new BadRequestException('Client ID cannot be empty');
      }
      updateData.clientId = data.clientId;
    }
    // CRITICAL: Ensure storeId is null if empty string (storeId is nullable)
    if (data.storeId !== undefined) {
      if (data.storeId === '' || (typeof data.storeId === 'string' && data.storeId.trim() === '')) {
        updateData.storeId = null; // Convert empty string to null for nullable field
      } else {
        updateData.storeId = data.storeId;
      }
    }
    if (data.number !== undefined) updateData.number = data.number;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.issueDate !== undefined) updateData.issueDate = data.issueDate;
    if (data.dueDate !== undefined) updateData.dueDate = data.dueDate;
    // PHASE 5 FIX: Validate currency code using ISO 4217 format
    if (data.currency !== undefined) {
      updateData.currency = validateCurrencyCode(data.currency, 'currency');
    }
    if (data.status !== undefined) {
      updateData.status = data.status;
      this.logger.log(`Status update requested: ${invoice.status} -> ${data.status}`);
    }
    if (data.notes !== undefined) {
      updateData.notes = typeof data.notes === 'string' ? sanitizeString(data.notes, 10000) : undefined;
    }

    // Sanitize text inputs
    if ((data as any).metadataJson?.terms !== undefined) {
      updateData.metadataJson = {
        ...((data as any).metadataJson || {}),
        terms: (data as any).metadataJson.terms ? sanitizeString((data as any).metadataJson.terms, 5000) : (data as any).metadataJson.terms,
      };
    }
    
    if (data.items) {
      // Sanitize item descriptions
      data.items = data.items.map((item) => ({
        ...item,
        description: item.description ? sanitizeString(item.description, 1000) : item.description,
      }));
      
      // FIX #121: Recalculate totals AFTER items are validated but BEFORE they're saved
      // This ensures totals are based on the actual items that will be saved
      // Note: Items are validated above, so totals calculation uses validated items
      const totalsResult = computeInvoiceTotalsCents(data.items);
      const totals = invoiceTotalsToMoney(totalsResult);
      updateData.subtotal = totals.invoice.subtotal;
      updateData.taxTotal = totals.invoice.tax;
      updateData.discountTotal = totals.invoice.discount;
      updateData.total = totals.invoice.total;

      // CRITICAL FIX #113: Validate no duplicate inventory items
      if (data.items && data.items.length > 0) {
        const inventoryItemIds = new Set<string>();
        for (const item of data.items) {
          if (item.inventoryItemId) {
            if (inventoryItemIds.has(item.inventoryItemId)) {
              throw new BadRequestException(
                `Duplicate inventory item ${item.inventoryItemId} in invoice. Each inventory item can only appear once per invoice.`
              );
            }
            inventoryItemIds.add(item.inventoryItemId);
          }
        }
      }
      
      // CRITICAL FIX #53, #59: Update items within transaction
      // CRITICAL: Validate all referenced inventory items exist before deleting old items
      const inventoryItemIds = new Set<string>();
      for (const item of data.items || []) {
        if (item.inventoryItemId) {
          inventoryItemIds.add(item.inventoryItemId);
        }
      }
      
      // Validate all inventory items exist and belong to user/organization
      if (inventoryItemIds.size > 0) {
        const idsArray = Array.from(inventoryItemIds);
        const queryBuilder = queryRunner.manager
          .createQueryBuilder(InventoryItem, 'item')
          .where('item.id IN (:...ids)', { ids: idsArray });
        
        // Organizations removed - filter by userId only
        queryBuilder.andWhere('item.userId = :userId', { userId });
        
        const inventoryItems = await queryBuilder.getMany();
        
        const foundIds = new Set(inventoryItems.map(item => item.id));
        const missingIds = idsArray.filter(id => !foundIds.has(id));
        
        if (missingIds.length > 0) {
          throw new BadRequestException(
            `Invalid inventory item(s): ${missingIds.join(', ')}. One or more inventory items do not exist or do not belong to your organization.`
          );
        }
      }
      
      await queryRunner.manager.delete(InvoiceItem, { invoiceId: id });
      const items = (data.items || []).map((item: InvoiceItemDto, index: number) => {
        // Get line totals from the cents-based calculation (already validated)
        const lineTotals = totalsResult.lines[index];
        if (!lineTotals) {
          throw new BadRequestException(`Missing line totals for item ${index + 1}`);
        }
        
        // Validate quantity (must be integer, min 1) - validation already done in computeInvoiceTotalsCents
        const quantity = Math.floor(Number(item.quantity));
        
        // Validate unit price - validation already done in computeInvoiceTotalsCents
        const unitPrice = Number(item.unitPrice);
        
        // Create the item object with all required fields
        // Sanitize description to prevent XSS
        const itemData: any = {
          inventoryItemId: item.inventoryItemId || null,
          description: item.description ? sanitizeString(item.description, 1000) : '',
          quantity: quantity, // CRITICAL: Must be integer for database column type 'int'
          unitPrice: Number(Number(unitPrice).toFixed(2)),
          taxRate: item.taxRate !== undefined && item.taxRate !== null ? Number(Number(item.taxRate).toFixed(2)) : 0,
          discountRate: item.discountRate !== undefined && item.discountRate !== null ? Number(Number(item.discountRate).toFixed(2)) : 0,
          lineTotal: centsToMoney(lineTotals.lineTotalCents), // Use calculated total from cents function
          invoiceId: id,
        };
        
        return itemData;
      });
      // FIX #129: Ensure all updates are atomic - save items within transaction
      // If any item save fails, entire transaction rolls back
      const createdItems = items.map((item) => queryRunner.manager.create(InvoiceItem, item as Partial<InvoiceItem>));
      const savedItems = await queryRunner.manager.save(InvoiceItem, createdItems);
      
      // FIX #129: Verify all items were saved with IDs - if not, transaction will rollback
      const itemsWithoutIds = savedItems.filter(item => !item.id);
      if (itemsWithoutIds.length > 0) {
        this.logger.error(`Some invoice items were saved without IDs: ${itemsWithoutIds.length} items`);
        throw new BadRequestException('Failed to save invoice items. Transaction will be rolled back.');
      }
      
      // FIX #129: Verify totals match saved items - ensure data consistency
      // Recalculate totals from saved items to ensure consistency
      const savedItemsForValidation = savedItems.map(item => ({
        description: item.description || '', // Required by InvoiceItemDto type
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discountRate: item.discountRate || 0,
        taxRate: item.taxRate || 0,
      }));
      
      const validationTotalsResult = computeInvoiceTotalsCents(savedItemsForValidation);
      const validationTotals = invoiceTotalsToMoney(validationTotalsResult);
      
      // Verify totals match (allow small floating point differences)
      const totalDiff = Math.abs(updateData.total - validationTotals.invoice.total);
      if (totalDiff > 0.01) {
        this.logger.error(`Total mismatch: calculated=${updateData.total}, validated=${validationTotals.invoice.total}`);
        throw new BadRequestException('Invoice totals validation failed. Transaction will be rolled back.');
      }
      
      this.logger.log(`Saved ${savedItems.length} invoice items for invoice ${id}`);
      delete data.items;
    }

    // Validate and parse dates
    if (data.issueDate) {
      const issueDate = new Date(data.issueDate);
      if (isNaN(issueDate.getTime())) {
        throw new BadRequestException('Invalid issue date format');
      }
      updateData.issueDate = issueDate.toISOString().split('T')[0];
    }
    if (data.dueDate) {
      const dueDate = new Date(data.dueDate);
      if (isNaN(dueDate.getTime())) {
        throw new BadRequestException('Invalid due date format');
      }
      updateData.dueDate = dueDate.toISOString().split('T')[0];
    }
    // Handle paidAt - can be set, cleared (null), or left unchanged (undefined)
    if (data.paidAt !== undefined) {
      if (data.paidAt === null) {
        // Explicitly clearing paidAt - convert null to undefined
        updateData.paidAt = undefined;
      } else {
        // Setting paidAt to a date
        const paidAt = new Date(data.paidAt);
        if (isNaN(paidAt.getTime())) {
          throw new BadRequestException('Invalid paidAt date format');
        }
        updateData.paidAt = paidAt.toISOString();
      }
    }
    
    // CRITICAL FIX #193: Validate status changes from cancelled
    if (data.status !== undefined && invoice.status === 'cancelled' && data.status !== 'cancelled') {
      throw new BadRequestException('Cannot change status from cancelled. Please create a new invoice.');
    }
    
    // CRITICAL FIX #128: Validate date logic comprehensively
    if (updateData.issueDate) {
      const issueDate = new Date(updateData.issueDate);
      if (isNaN(issueDate.getTime())) {
        throw new BadRequestException('Invalid issue date format');
      }
      // Issue date can be in past or future (for backdating or future invoices)
      // But we should validate it's not too far in the past (e.g., more than 10 years)
      const tenYearsAgo = new Date();
      tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);
      if (issueDate < tenYearsAgo) {
        throw new BadRequestException('Issue date cannot be more than 10 years in the past');
      }
    }
    
    if (updateData.dueDate) {
      const dueDate = new Date(updateData.dueDate);
      if (isNaN(dueDate.getTime())) {
        throw new BadRequestException('Invalid due date format');
      }
      
      // If issue date is also being updated, validate due date is after issue date
      if (updateData.issueDate) {
        const issueDate = new Date(updateData.issueDate);
        if (dueDate < issueDate) {
          throw new BadRequestException('Due date must be after issue date');
        }
      } else {
        // If issue date not being updated, check against existing issue date
        const issueDate = new Date(invoice.issueDate);
        if (dueDate < issueDate) {
          throw new BadRequestException('Due date must be after issue date');
        }
      }
    }

    // Handle paidAt based on status changes
    if (data.status !== undefined) {
      // Automatically set paidAt when status changes to 'paid'
      if (data.status === 'paid' && invoice.status !== 'paid') {
        // Only set paidAt if it wasn't explicitly provided in the request
        if (data.paidAt === undefined && updateData.paidAt === undefined) {
          updateData.paidAt = new Date().toISOString();
          this.logger.log(`Auto-setting paidAt for invoice ${invoice.number}`);
        } else if (data.paidAt !== undefined) {
          // Use the provided paidAt value
          updateData.paidAt = data.paidAt;
        }
      }
      
      // Clear paidAt when status changes away from 'paid'
      if (data.status !== 'paid' && invoice.status === 'paid') {
        // Always clear paidAt when changing away from paid status
        // If data.paidAt is explicitly null, use it; otherwise set to undefined
        if (data.paidAt === null || data.paidAt === undefined) {
          updateData.paidAt = undefined;
          this.logger.log(`Clearing paidAt for invoice ${invoice.number} (status changed from paid to ${data.status})`);
        }
      }
    }

    // Fix Issue #1: Use query builder instead of 'as any' type assertion
    // Log the update data for debugging
    this.logger.log(`Updating invoice ${id} with data: ${JSON.stringify(updateData)}`);
    
      // Ensure status is explicitly included if it's being updated
      if (data.status !== undefined && !updateData.status) {
        this.logger.warn(`Status was in data but not in updateData! Adding it explicitly.`);
        updateData.status = data.status;
      }
      
      // CRITICAL FIX #124: Generate invoice number within transaction if needed
      if (shouldGenerateInvoiceNumber) {
        const settings = await this.userSettingsService.getSettings(userId);
        updateData.number = await this.generateInvoiceNumber(userId, 'invoice', settings, queryRunner);
        this.logger.log(`Generated new invoice number within transaction: ${updateData.number}`);
      }
      
      // CRITICAL FIX #26: Update invoice within transaction
      // CRITICAL: Final validation before save - ensure all foreign keys are valid
      if (updateData.clientId) {
        const clientExists = await queryRunner.manager
          .createQueryBuilder('Client', 'client')
          .where('client.id = :clientId', { clientId: updateData.clientId })
          // Organizations removed - filter by userId only (user-scoped data)
          .andWhere('client.userId = :userId', { userId })
          .getOne();
        
        if (!clientExists) {
          throw new BadRequestException(`Client with ID "${updateData.clientId}" does not exist or does not belong to your organization.`);
        }
      }
      
      if (updateData.storeId) {
        const storeExists = await queryRunner.manager
          .createQueryBuilder('Store', 'store')
          .where('store.id = :storeId', { storeId: updateData.storeId })
          .andWhere('store.userId = :userId', { userId })
          .getOne();
        
        if (!storeExists) {
          throw new BadRequestException(`Store with ID "${updateData.storeId}" does not exist or does not belong to your organization.`);
        }
      }
      
      Object.assign(invoice, updateData);
      const updatedInvoice = await queryRunner.manager.save(Invoice, invoice);
      
      // Reload with items to get fresh data
      const invoiceWithItems = await queryRunner.manager.findOne(Invoice, {
        where: { id },
        relations: ['items', 'client', 'store'],
      });
      
      if (!invoiceWithItems) {
        throw new NotFoundException('Invoice not found after update');
      }
      
      // Log invoice items for debugging
      if (invoiceWithItems.items && invoiceWithItems.items.length > 0) {
        this.logger.log(`Invoice ${id} has ${invoiceWithItems.items.length} items after update`);
        invoiceWithItems.items.forEach((item, index) => {
          this.logger.log(`Item ${index}: id=${item.id}, inventoryItemId=${item.inventoryItemId}, quantity=${item.quantity}`);
        });
      } else {
        this.logger.warn(`Invoice ${id} has no items after update`);
      }
      
      // Verify the status was actually updated
      if (data.status !== undefined && invoiceWithItems.status !== data.status) {
        this.logger.error(`Status update failed! Expected ${data.status} but got ${invoiceWithItems.status}`);
        throw new BadRequestException(`Failed to update invoice status. Expected ${data.status} but got ${invoiceWithItems.status}`);
      }
      
      // CRITICAL FIX #5, #9, #23, #38: Validate stock before creating new movements
      const newStatus = data.status !== undefined ? data.status : invoiceWithItems.status;
      const newType = data.type !== undefined ? data.type : invoiceWithItems.type;
      const newItems = invoiceWithItems.items || [];
      const newStoreId = data.storeId !== undefined ? data.storeId : invoiceWithItems.storeId;
      const oldStoreId = invoice.storeId; // Store old storeId for cache invalidation

      // PHASE 3 FIX: Use shouldAffectStock to determine when stock should be affected
      // Draft invoices do NOT affect stock - stock is only deducted when moving to Sent/Paid
      // Only estimates don't affect stock
      const statusChanged = data.status !== undefined && data.status !== oldStatus;
      const shouldUpdateStock = statusChanged && shouldAffectStock(oldStatus as InvoiceStatus, newStatus as InvoiceStatus);
      const itemsWereUpdated = data.items !== undefined;
      // Stock should be updated if:
      // 1. Status changed and shouldAffectStock returns true (e.g., draft -> sent, sent -> paid)
      // 2. Items were updated and invoice is in a status that affects stock (sent/paid, not draft/cancelled)
      const needsStockUpdate = shouldUpdateStock || (newType !== 'estimate' && newStatus !== 'cancelled' && newStatus !== 'draft' && itemsWereUpdated);
      
      if (needsStockUpdate && newItems.length > 0) {
        // CRITICAL FIX: Validate newStoreId if provided before creating movements
        // This provides defensive validation even though createMovement will also validate
        if (newStoreId) {
          const store = await queryRunner.manager.findOne(Store, {
            where: {
              id: newStoreId,
              // Organizations removed - filter by userId only (user-scoped data)
              userId,
            },
          });
          
          if (!store) {
            throw new BadRequestException(`Store with ID "${newStoreId}" not found or does not belong to your organization.`);
          }
        }
        
        // CRITICAL FIX #5: Validate stock availability before creating movements
        const itemsNeedingStock = newItems.filter(item => item.inventoryItemId);
        
        for (const newItem of itemsNeedingStock) {
          if (!newItem.inventoryItemId) continue;
          
          // Validate inventory item exists and is accessible
          const inventoryItem = await queryRunner.manager.findOne(InventoryItem, {
            where: { id: newItem.inventoryItemId },
            lock: { mode: 'pessimistic_write' },
          });
          
          if (!inventoryItem) {
            throw new NotFoundException(`Inventory item ${newItem.inventoryItemId} not found`);
          }
          
          // Verify organization access
          // Organizations removed - verify user access only
          if (inventoryItem.userId !== userId) {
            throw new NotFoundException(`Inventory item ${newItem.inventoryItemId} not found`);
          }
          
          // CRITICAL FIX #108, #126: Validate stock availability - only restriction is stock level
          // No status restrictions - any item can be sold as long as it has stock
          if (inventoryItem.currentStock < newItem.quantity) {
            throw new BadRequestException(
              `Insufficient stock for item ${inventoryItem.name || inventoryItem.sku}. Available: ${inventoryItem.currentStock}, Required: ${newItem.quantity}`
            );
          }
          
          // CRITICAL FIX #36: Validate quantity is positive and ensure it's an integer
          const quantityValue = Number(newItem.quantity);
          if (isNaN(quantityValue) || quantityValue <= 0) {
            throw new BadRequestException(`Invalid quantity: ${newItem.quantity}. Quantity must be a positive number.`);
          }
          const quantity = Math.floor(quantityValue); // Ensure integer for database column type 'int'
          if (quantity < 1) {
            throw new BadRequestException(`Quantity must be at least 1 (got ${quantityValue} which rounded to ${quantity})`);
          }
          // Update the item with integer quantity
          newItem.quantity = quantity;
          
          
          // CRITICAL FIX: Validate store-specific stock availability before creating movement
          // This prevents the error "Insufficient store stock" that occurs when adjustStoreStock is called
          if (newStoreId) {
            try {
              const stockValidation = await this.storeStockValidator.validateStoreStockAvailability(
                newStoreId,
                newItem.inventoryItemId,
                quantity,
                userId,
                'sale',
                queryRunner, // Pass queryRunner for pessimistic locking inside transaction
              );
              
              if (!stockValidation.isValid) {
                const errorMessage = stockValidation.errors.length > 0
                  ? stockValidation.errors.join('; ')
                  : `Insufficient store stock for item ${inventoryItem.name || inventoryItem.sku}`;
                throw new BadRequestException(errorMessage);
              }
            } catch (validationError: any) {
              // If it's already a BadRequestException, re-throw it
              if (validationError instanceof BadRequestException) {
                throw validationError;
              }
              // Otherwise, wrap it
              throw new BadRequestException(
                `Store stock validation failed for item ${inventoryItem.name || inventoryItem.sku}: ${validationError.message}`
              );
            }
          }
          
          // CRITICAL FIX #195: This is already handled by duplicate check above, but ensure we don't process duplicates
          // The duplicate check at line 943-950 prevents this, but adding defensive check here too
          
          // CRITICAL FIX: Validate invoice item has an ID before using it
          if (!newItem.id) {
            this.logger.error(`Invoice item missing ID for invoice ${id}, inventoryItemId: ${newItem.inventoryItemId}`);
            throw new BadRequestException('Invoice item is missing an ID. Please try updating the invoice again.');
          }
          
          // CRITICAL FIX: Verify invoice item exists in database before creating movement
          // Use the same queryRunner manager to ensure we see uncommitted changes within the transaction
          const invoiceItemExists = await queryRunner.manager.findOne(InvoiceItem, {
            where: {
              id: newItem.id,
              invoiceId: id,
            },
          });
          
          if (!invoiceItemExists) {
            this.logger.error(`Invoice item ${newItem.id} not found in database for invoice ${id}. Item data: ${JSON.stringify({ id: newItem.id, invoiceId: id, inventoryItemId: newItem.inventoryItemId, description: newItem.description })}`);
            throw new BadRequestException(`Invoice item ${newItem.id} not found. The invoice item may not have been saved properly. Please try updating the invoice again.`);
          }
          
          // CRITICAL FIX: Check if stock movement already exists for this invoice item to prevent duplicates
          const existingMovement = await queryRunner.manager.findOne(StockMovement, {
            where: {
              invoiceItemId: newItem.id,
              sourceType: 'invoice',
              sourceId: id,
              type: 'sale',
            },
          });
          
          if (existingMovement) {
            this.logger.log(`Stock movement already exists for invoice item ${newItem.id}, skipping creation`);
            continue; // Skip creating duplicate movement
          }
          
          // CRITICAL FIX #4, #22: Create movement within transaction using queryRunner
          try {
            await this.inventoryService.createMovement(
              newItem.inventoryItemId,
              userId,
              {
                type: 'sale',
                quantity: newItem.quantity,
                sourceType: 'invoice',
                sourceId: id,
                invoiceItemId: newItem.id, // Only set if newItem.id exists (validated above)
                note: `Invoice ${invoiceWithItems.number}`,
              },
              newStoreId,
              queryRunner, // CRITICAL: Pass queryRunner to ensure transaction consistency
            );
            this.logger.log(`Created stock movement for invoice ${id}, item ${newItem.id}, quantity ${newItem.quantity}`);
          } catch (movementError: any) {
            // Log detailed error information for debugging
            this.logger.error(`Failed to create movement for invoice ${id}, item ${newItem.id}:`, movementError);
            this.logger.error(`Movement data: ${JSON.stringify({ inventoryItemId: newItem.inventoryItemId, invoiceItemId: newItem.id, storeId: newStoreId, quantity: newItem.quantity })}`);
            throw movementError; // Re-throw to be caught by outer error handler
          }
        }
      }
      
      // CRITICAL FIX #41: Commit transaction only after all operations succeed
      await queryRunner.commitTransaction();
      
      // CRITICAL FIX #131, #135, #137: Invalidate all related caches after successful commit
      // Organizations removed - cache keys no longer include organizationId
      const detailCacheKey = buildCacheKey(CacheKey.INVOICE_DETAIL, { invoiceId: id, userId });
      const statsCacheKey = buildCacheKey(CacheKey.INVOICE_STATS, { userId });
      
      // CRITICAL FIX #137: Invalidate inventory caches if stock was affected
      const cacheKeysToInvalidate = [detailCacheKey, statsCacheKey];
      
      // Check if stock was affected (need to check both old and new state)
      // Determine if old invoice state affected stock
      const oldAffectsStock = oldType !== 'estimate' && oldStatus !== 'cancelled' && oldStatus !== 'draft';
      // Determine if new invoice state affects stock
      const newAffectsStock = newType !== 'estimate' && newStatus !== 'cancelled' && newStatus !== 'draft';
      const stockWasAffected = (oldAffectsStock && oldItems.length > 0) || (newAffectsStock && newItems.length > 0);
      
      if (stockWasAffected) {
        // Stock was affected, invalidate inventory caches
        cacheKeysToInvalidate.push(
          // Organizations removed - cache keys no longer include organizationId
          buildCacheKey(CacheKey.INVENTORY_LIST, { userId }),
          buildCacheKey(CacheKey.INVENTORY_STATS, { userId }),
          buildCacheKey(CacheKey.LOW_STOCK, { userId }),
        );
        
        // If storeId is involved, invalidate store stock caches
        const storeIdToCheck = newStoreId || oldStoreId;
        if (storeIdToCheck) {
          cacheKeysToInvalidate.push(
            // Organizations removed - cache keys no longer include organizationId
            buildCacheKey(CacheKey.STORE_STOCK, { storeId: storeIdToCheck, userId }),
          );
        }
      }
      
      // FIX #125: Cache invalidation happens AFTER transaction commit (already done above)
      // FIX #137: Use cache stampede prevention for cache repopulation
      // Invalidate all caches, log errors but don't fail the operation
      for (const cacheKey of cacheKeysToInvalidate) {
        try {
          await this.cacheManager.del(cacheKey);
        } catch (error) {
          this.logger.error(`Failed to invalidate cache key ${cacheKey}:`, error);
          // Continue with other cache invalidations
        }
      }
      
      // Reload invoice from database to return fresh data
      const finalInvoice = await this.findOne(id, userId);
      
      this.logger.log(`Invoice updated: ${finalInvoice.number} (${id})`);
      return finalInvoice;
      
    } catch (error) {
      // CRITICAL FIX #41, #152, #156, #165: Rollback transaction on any error with proper error handling
      await queryRunner.rollbackTransaction();
      
      // CRITICAL FIX #156: Handle specific database errors
      if (error instanceof Error) {
        const errorMessage = error.message.toLowerCase();
        
        // Check for deadlock errors
        if (errorMessage.includes('deadlock') || errorMessage.includes('could not obtain lock')) {
          this.logger.error(`Deadlock detected during invoice update for ${id}, transaction rolled back:`, error);
          throw new BadRequestException('A database deadlock occurred. Please try again.');
        }
        
        // Check for constraint violations
        // PostgreSQL error codes: 23503 = foreign key violation, 23505 = unique constraint violation
        const isConstraintError = errorMessage.includes('violates foreign key constraint') || 
                                  errorMessage.includes('constraint') || 
                                  errorMessage.includes('foreign key') ||
                                  (error as any)?.code === '23503' ||
                                  (error as any)?.code === '23505';
        
        if (isConstraintError) {
          // Log full error details for debugging
          this.logger.error(`Constraint violation during invoice update for ${id}:`, error);
          this.logger.error(`Error message: ${error.message}`);
          this.logger.error(`Error code: ${(error as any)?.code || 'unknown'}`);
          this.logger.error(`Error detail: ${(error as any)?.detail || 'none'}`);
          this.logger.error(`Error constraint: ${(error as any)?.constraint || 'none'}`);
          this.logger.error(`Error table: ${(error as any)?.table || 'none'}`);
          this.logger.error(`Error column: ${(error as any)?.column || 'none'}`);
          this.logger.error(`Full error object: ${JSON.stringify(error, Object.getOwnPropertyNames(error))}`);
          this.logger.error(`Update data: ${JSON.stringify(data, null, 2)}`);
          
          // Try to extract more specific error information from PostgreSQL error
          let specificError = 'Invalid data: constraint violation. Please check all referenced entities exist.';
          const fullErrorMsg = error.message || '';
          const errorDetail = (error as any)?.detail || '';
          const errorConstraint = (error as any)?.constraint || '';
          const errorTable = (error as any)?.table || '';
          const errorColumn = (error as any)?.column || '';
          
          // Combine all error information for better matching
          const allErrorText = `${fullErrorMsg} ${errorDetail} ${errorConstraint} ${errorTable} ${errorColumn}`.toLowerCase();
          
          // PostgreSQL foreign key errors typically include the constraint name or table name
          // Check for stock_movements table first (most specific)
          if (allErrorText.includes('stock_movements') || allErrorText.includes('stock_movement')) {
            // Check if it's a store-related constraint in stock_movements
            if (allErrorText.includes('store') || allErrorText.includes('store_id') || errorColumn === 'storeId') {
              specificError = 'Invalid store ID. The store does not exist or does not belong to your organization.';
            } else if (allErrorText.includes('inventory') || allErrorText.includes('inventory_item') || errorColumn === 'inventoryItemId') {
              specificError = 'Invalid inventory item ID. One or more inventory items do not exist or do not belong to your organization.';
            } else if (allErrorText.includes('invoice_item') || errorColumn === 'invoiceItemId') {
              specificError = 'Invalid invoice item ID. The invoice item does not exist or is invalid.';
            } else {
              specificError = 'Invalid data: constraint violation in stock movement. Please check all referenced entities (store, inventory item, invoice item) exist.';
            }
          } else if (allErrorText.includes('client') || allErrorText.includes('clients') || errorColumn === 'clientId') {
            specificError = 'Invalid client ID. The client does not exist or does not belong to your organization.';
          } else if (allErrorText.includes('store') || allErrorText.includes('stores') || errorColumn === 'storeId') {
            specificError = 'Invalid store ID. The store does not exist or does not belong to your organization.';
          } else if (allErrorText.includes('inventory') || allErrorText.includes('inventory_items') || allErrorText.includes('invoice_items')) {
            specificError = 'Invalid inventory item ID. One or more inventory items do not exist or do not belong to your organization.';
          } else {
            // Include the actual error message and details in the response for debugging
            const debugInfo = process.env.NODE_ENV === 'development' 
              ? ` (Table: ${errorTable || 'unknown'}, Column: ${errorColumn || 'unknown'}, Constraint: ${errorConstraint || 'unknown'})`
              : '';
            specificError = `Invalid data: constraint violation. ${fullErrorMsg}${debugInfo}`;
          }
          
          throw new BadRequestException(specificError);
        }
        
        // Check for unique constraint violations
        if (errorMessage.includes('duplicate key') || errorMessage.includes('unique constraint')) {
          this.logger.error(`Unique constraint violation during invoice update for ${id}:`, error);
          throw new BadRequestException('Duplicate entry detected. This invoice number may already exist.');
        }
      }
      
      this.logger.error(`Invoice update failed for ${id}, transaction rolled back:`, error);
      throw error;
    } finally {
      // CRITICAL: Always release query runner
      await queryRunner.release();
    }
  }

  /**
   * Delete an invoice
   * FIXED: Issues #13, #153, #161
   * - Stock reversal within transaction
   * - Proper error handling with rollback
   * - Idempotent stock reversal
   */
  /**
   * Delete an invoice
   * FIXES: Issue #37 - Prevents deletion of paid or sent invoices
   * FIXED: Issues #13, #153, #161 - Stock reversal within transaction
   */
  async remove(id: string, userId: string): Promise<void> {
    // CRITICAL FIX #41: Wrap deletion in transaction
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    
    try {
      // CRITICAL FIX: First check if invoice exists (including soft-deleted) to provide better error messages
      // This helps distinguish between "invoice doesn't exist" vs "invoice already deleted" vs "access denied"
      const anyInvoice = await queryRunner.manager
        .createQueryBuilder(Invoice, 'invoice')
        .withDeleted() // Include soft-deleted invoices
        .where('invoice.id = :id', { id })
        .getOne();
      
      if (!anyInvoice) {
        this.logger.warn(`Invoice deletion attempted for non-existent invoice: ${id} by user ${userId}`);
        await queryRunner.rollbackTransaction();
        await queryRunner.release();
        throw new NotFoundException(`Invoice with ID ${id} not found`);
      }
      
      // Check if invoice is already soft-deleted (idempotent operation)
      if (anyInvoice.deletedAt) {
        this.logger.debug(`Invoice ${id} is already soft-deleted (deletedAt: ${anyInvoice.deletedAt}), returning early (idempotent)`);
        await queryRunner.rollbackTransaction();
        await queryRunner.release();
        return; // Idempotent - already deleted, success
      }
      
      // Verify access - check if invoice belongs to user
      if (anyInvoice.userId !== userId) {
        this.logger.warn(`Invoice deletion attempted for invoice ${id} by unauthorized user ${userId} (invoice belongs to ${anyInvoice.userId})`);
        await queryRunner.rollbackTransaction();
        await queryRunner.release();
        throw new NotFoundException(`Invoice with ID ${id} not found`); // Don't reveal existence to unauthorized users
      }
      
      // CRITICAL FIX #21, #44: Lock invoice during deletion
      // NOTE: Cannot use relations with pessimistic lock due to PostgreSQL limitation:
      // "FOR UPDATE cannot be applied to the nullable side of an outer join"
      // So we load the invoice first with lock, then load relations separately
      const invoiceLocked = await queryRunner.manager.findOne(Invoice, {
        where: {
          id,
          // Organizations removed - filter by userId only (user-scoped data)
          userId,
        },
        lock: { mode: 'pessimistic_write' },
      });
      
      if (!invoiceLocked) {
        // Invoice was deleted between our check and lock (race condition)
        // Re-check if it's soft-deleted to confirm
        const recheckInvoice = await queryRunner.manager
          .createQueryBuilder(Invoice, 'invoice')
          .withDeleted()
          .where('invoice.id = :id', { id })
          .getOne();
        
        if (recheckInvoice?.deletedAt) {
          // Invoice was soft-deleted between checks - idempotent success
          this.logger.debug(`Invoice ${id} was soft-deleted concurrently, returning early (idempotent)`);
          await queryRunner.rollbackTransaction();
          await queryRunner.release();
          return; // Idempotent - already deleted, success
        }
        
        // Invoice doesn't exist or access denied - this shouldn't happen if our checks above worked
        this.logger.warn(`Invoice ${id} not found with lock after initial check - possible race condition or data inconsistency`);
        await queryRunner.rollbackTransaction();
        await queryRunner.release();
        throw new NotFoundException(`Invoice with ID ${id} not found`);
      }
      
      // Load relations separately after acquiring the lock (without lock to avoid outer join issue)
      const invoice = await queryRunner.manager
        .createQueryBuilder(Invoice, 'invoice')
        .leftJoinAndSelect('invoice.items', 'items')
        .where('invoice.id = :id', { id })
        .andWhere('invoice.userId = :userId', { userId })
        .getOne();
      
      if (!invoice) {
        await queryRunner.rollbackTransaction();
        await queryRunner.release();
        throw new NotFoundException('Invoice not found');
      }
      
      // CRITICAL FIX #37: Prevent deletion of paid invoices to maintain financial integrity
      // Allow deletion of all other invoice statuses (draft, sent, cancelled, overdue)
      // Paid invoices cannot be deleted as they represent completed financial transactions
      // Stock movements will be automatically reversed when invoice is deleted
      // Note: Deletion is a soft delete, so invoices are marked as deleted but remain in database
      if (invoice.status === 'paid') {
        await queryRunner.rollbackTransaction();
        await queryRunner.release();
        throw new BadRequestException(
          `Cannot delete invoice with status 'paid'. Paid invoices represent completed financial transactions and cannot be deleted for audit purposes. ` +
          `If you need to void this invoice, please mark it as cancelled first.`
        );
      }
      
      // CRITICAL FIX #13, #153: Reverse stock changes within transaction
      // Reverse stock for all non-estimate invoices when deleted (draft, sent, cancelled)
      // Note: For draft invoices, stock may have been deducted, so we reverse it
      // For sent invoices, stock was definitely deducted, so we reverse it
      // For cancelled invoices, check if they had stock movements (they might have been sent before cancellation)
      // Paid invoices cannot be deleted (blocked above), so we don't need to handle them here
      const invoiceStatus = invoice.status as string;
      // UPDATED: Reverse stock for all non-estimate invoices (draft, sent, cancelled) when deleted
      // This ensures stock is properly restored when invoices are deleted
      if (invoice.type !== 'estimate') {
        // CRITICAL FIX #3: Pass queryRunner to ensure reversal happens in transaction
        // This will only reverse movements if they exist (idempotent operation)
        await this.inventoryService.deleteMovementsBySource('invoice', id, userId, queryRunner);
      }
      
      // CRITICAL FIX: InvoiceItem doesn't have @DeleteDateColumn, so we must hard delete items before soft deleting invoice
      // TypeORM's softRemove tries to cascade soft delete to related entities, but InvoiceItem doesn't support soft delete
      // We need to manually delete the items first, then soft delete the invoice
      if (invoice.items && invoice.items.length > 0) {
        await queryRunner.manager.remove(InvoiceItem, invoice.items);
        this.logger.debug(`Deleted ${invoice.items.length} invoice items for invoice ${id}`);
      }
      
      // CRITICAL FIX #161: Soft delete invoice within transaction (after items are deleted)
      await queryRunner.manager.softRemove(Invoice, invoice);
      
      // Commit transaction
      await queryRunner.commitTransaction();
      
      // CRITICAL FIX #131, #135: Invalidate caches after successful commit
      // Organizations removed - cache keys no longer include organizationId
      const detailCacheKey = buildCacheKey(CacheKey.INVOICE_DETAIL, { invoiceId: id, userId });
      await this.cacheManager.del(detailCacheKey);
      // Organizations removed - cache keys no longer include organizationId
      const statsCacheKey = buildCacheKey(CacheKey.INVOICE_STATS, { userId });
      await this.cacheManager.del(statsCacheKey);
      
    } catch (error) {
      // CRITICAL FIX #153, #165: Rollback on error
      // Check if transaction is still active before rolling back (TypeORM versions vary)
      let isActive = false;
      try {
        // Type-safe check for transaction active state
        const transactionActive = (queryRunner as any).isTransactionActive;
        if (typeof transactionActive === 'function') {
          isActive = transactionActive();
        } else if (transactionActive !== undefined) {
          isActive = !!transactionActive;
        }
      } catch {
        // If checking transaction state fails, assume it's not active
        isActive = false;
      }
      
      if (isActive) {
        try {
          await queryRunner.rollbackTransaction();
        } catch (rollbackError) {
          this.logger.error(`Failed to rollback transaction during invoice deletion:`, rollbackError);
        }
      }
      this.logger.error(`Invoice deletion failed for ${id}, transaction rolled back:`, error);
      throw error;
    } finally {
      // Always release the query runner, even if transaction was already released
      if (queryRunner.isReleased === false) {
        await queryRunner.release();
      }
    }
  }

  /**
   * Convert estimate to invoice
   * FIXED: Issue #12, #124 - Uses transaction and proper number generation
   */
  async convertEstimateToInvoice(id: string, userId: string): Promise<Invoice> {
    // CRITICAL FIX #41: Wrap conversion in transaction
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    
    try {
      // CRITICAL FIX #21, #44: Lock estimate during conversion
      const estimate = await queryRunner.manager.findOne(Invoice, {
        where: {
          id,
          // Organizations removed - filter by userId only (user-scoped data)
          userId,
        },
        lock: { mode: 'pessimistic_write' },
      });
      
      if (!estimate) {
        throw new NotFoundException('Estimate not found');
      }
      
      if (estimate.type !== 'estimate') {
        throw new BadRequestException('Only estimates can be converted to invoices');
      }
      
      // Verify access - Organizations removed - verify user access only
      const hasAccess = estimate.userId === userId;
      if (!hasAccess) {
        throw new NotFoundException('Estimate not found');
      }

      // Update the estimate to become an invoice
      estimate.type = 'invoice';
      estimate.status = 'draft';
      
      // CRITICAL FIX #12, #124: Generate new invoice number within transaction
      const settings = await this.userSettingsService.getSettings(userId);
      estimate.number = await this.generateInvoiceNumber(userId, 'invoice', settings, queryRunner);
      
      const savedInvoice = await queryRunner.manager.save(Invoice, estimate);
      
      await queryRunner.commitTransaction();
      
      // Invalidate caches
      // Organizations removed - cache keys no longer include organizationId
      const detailCacheKey = buildCacheKey(CacheKey.INVOICE_DETAIL, { invoiceId: id, userId });
      await this.cacheManager.del(detailCacheKey);
      // Organizations removed - cache keys no longer include organizationId
      const statsCacheKey = buildCacheKey(CacheKey.INVOICE_STATS, { userId });
      await this.cacheManager.del(statsCacheKey);
      
      return savedInvoice;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Estimate conversion failed for ${id}, transaction rolled back:`, error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Duplicate an existing invoice
   * Creates a new invoice with the same data but resets status, number, and dates
   */
  async duplicateInvoice(id: string, userId: string): Promise<Invoice> {
    // Find the original invoice
    const originalInvoice = await this.findOne(id, userId);
    
    if (!originalInvoice) {
      throw new NotFoundException('Invoice not found');
    }

    // Create a new invoice with the same data
    const duplicateData: CreateInvoiceDto & { status?: string; isDuplicate?: boolean } = {
      clientId: originalInvoice.clientId,
      storeId: originalInvoice.storeId || undefined,
      type: originalInvoice.type,
      issueDate: new Date().toISOString().split('T')[0], // Today's date
      dueDate: originalInvoice.dueDate ? new Date(originalInvoice.dueDate).toISOString().split('T')[0] : undefined,
      currency: originalInvoice.currency,
      notes: originalInvoice.notes || undefined,
      items: originalInvoice.items.map(item => ({
        inventoryItemId: item.inventoryItemId || undefined,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxRate: item.taxRate,
        discountRate: item.discountRate,
      })),
      isDuplicate: true, // Flag to skip quota check
      status: 'draft', // Always start as draft
    };

    // Create the duplicate invoice
    return await this.create(userId, duplicateData);
  }

  /**
   * Get invoice statistics
   * Issue #28: Enhanced query result caching
   * Issue #57: Optimized query aggregation using database functions
   */
  async getStats(userId: string): Promise<{
    totalCount: number;
    unpaidCount: number;
    unpaidAmount: number;
    overdueCount: number;
    overdueAmount: number;
    monthlyTotal: number;
    totalAmount: number;
  }> {
    // DIAGNOSTIC: Log the query parameters
    this.logger.log(`[DIAGNOSTIC] getStats called with userId: ${userId}`);
    
    // Issue #28: Cache stats for 5 minutes
    // Organizations removed - cache keys no longer include organizationId
    const cacheKey = buildCacheKey(CacheKey.INVOICE_STATS, { userId });
    const cached = await this.cacheManager.get<{
      totalCount: number;
      unpaidCount: number;
      unpaidAmount: number;
      overdueCount: number;
      overdueAmount: number;
      monthlyTotal: number;
      totalAmount: number;
    }>(cacheKey);
    if (cached) {
      this.logger.debug(`Returning cached stats for user ${userId}`);
      this.logger.log(`[DIAGNOSTIC] Returning cached stats: totalCount=${cached.totalCount}`);
      return cached;
    }

    // Issue #57: Use database aggregation instead of loading all invoices
    // Organizations removed - filter by userId only (user-scoped data)
    const stats = await this.invoicesRepository
      .createQueryBuilder('invoice')
      .where('invoice.userId = :userId', { userId })
      .andWhere('invoice.deletedAt IS NULL')
      .select([
        'COUNT(*) as totalCount',
        'COUNT(CASE WHEN invoice.status = \'sent\' THEN 1 END) as sentCount',
        'COUNT(CASE WHEN invoice.status = \'overdue\' THEN 1 END) as overdueCount',
        'COALESCE(SUM(CASE WHEN invoice.status IN (\'sent\', \'overdue\') THEN invoice.total ELSE 0 END), 0) as totalUnpaid',
        'COALESCE(SUM(CASE WHEN invoice.status = \'overdue\' THEN invoice.total ELSE 0 END), 0) as totalOverdue',
        'COALESCE(SUM(invoice.total), 0) as totalAmount',
      ])
      .getRawOne();
    
    // DIAGNOSTIC: Log the raw stats
    this.logger.log(`[DIAGNOSTIC] Raw stats from database: ${JSON.stringify(stats)}`);

    // Calculate monthly total: sum of paid invoices where paidAt is in current month
    // Use UTC dates to avoid timezone issues
    const now = new Date();
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
    const endOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
    
    const monthlyStats = await this.invoicesRepository
      .createQueryBuilder('invoice')
      .where('invoice.userId = :userId', { userId })
      .andWhere('invoice.deletedAt IS NULL')
      .andWhere('invoice.status = :status', { status: 'paid' })
      .andWhere('invoice.paidAt IS NOT NULL')
      .andWhere('invoice.paidAt >= :startOfMonth', { startOfMonth })
      .andWhere('invoice.paidAt <= :endOfMonth', { endOfMonth })
      .select('COALESCE(SUM(invoice.total), 0) as monthlyTotal')
      .getRawOne();

    // Issue #61: Null safety - ensure all values are numbers
    // Map to frontend expected format
    const result = {
      totalCount: Number(stats?.totalCount || 0),
      unpaidCount: Number(stats?.sentCount || 0),
      unpaidAmount: Number(stats?.totalUnpaid || 0),
      overdueCount: Number(stats?.overdueCount || 0),
      overdueAmount: Number(stats?.totalOverdue || 0),
      monthlyTotal: Number(monthlyStats?.monthlyTotal || 0),
      totalAmount: Number(stats?.totalAmount || 0),
    };

    // DIAGNOSTIC: Log the final result
    this.logger.log(`[DIAGNOSTIC] Final stats result: ${JSON.stringify(result)}`);
    
    // Cache for 5 minutes
    await this.cacheManager.set(cacheKey, result, 300000);
    return result;
  }

  async backfillPaidAtDates(userId: string) {
    // Find all paid invoices without paidAt date
    const paidInvoicesWithoutPaidAt = await this.invoicesRepository.find({
      where: {
        userId,
        status: 'paid',
        paidAt: IsNull(),
      },
    });

    this.logger.log(`Found ${paidInvoicesWithoutPaidAt.length} paid invoices without paidAt date`);

    let updatedCount = 0;
    for (const invoice of paidInvoicesWithoutPaidAt) {
      // Use updatedAt if available (when invoice was last updated, likely when marked as paid)
      // Otherwise fall back to issueDate
      const paidAtDate = invoice.updatedAt || invoice.issueDate || new Date();
      
      await this.invoicesRepository.update(
        { id: invoice.id },
        { paidAt: paidAtDate }
      );
      
      updatedCount++;
      this.logger.log(`Updated invoice ${invoice.number} with paidAt: ${paidAtDate}`);
    }

    return {
      updatedCount,
      message: `Successfully updated ${updatedCount} invoice(s) with paidAt dates`,
    };
  }

  /**
   * @deprecated Use computeInvoiceTotalsCents from utils/invoice-totals.util.ts instead
   * This method is kept for backward compatibility but should not be used in new code.
   * All invoice totals should be calculated using the cents-based function for consistency.
   */
  private calculateTotals(items: InvoiceItemDto[]) {
    // Delegate to the new cents-based function for consistency
    const totalsResult = computeInvoiceTotalsCents(items);
    const totals = invoiceTotalsToMoney(totalsResult);
      return {
      subtotal: totals.invoice.subtotal,
      taxTotal: totals.invoice.tax,
      discountTotal: totals.invoice.discount,
      total: totals.invoice.total,
    };
  }

  /**
   * Generate a unique invoice number
   * FIXED: Issue #124 - Race condition in invoice number generation
   * - Uses queryRunner for transaction support
   * - Retries on duplicate number conflicts
   * - Generates number within transaction to prevent duplicates
   */
  private async generateInvoiceNumber(
    userId: string,
    type: 'invoice' | 'estimate',
    settings: any | undefined,
    queryRunner?: QueryRunner,
  ): Promise<string> {
    const manager = queryRunner?.manager || this.invoicesRepository.manager;
    
    // Use user's invoice number format if available
    const format = settings?.invoiceNumberFormat || 'INV-{YYYY}-{NUM}';
    const prefix = type === 'invoice' ? 'INV' : 'EST';
    const now = new Date();
    const year = now.getFullYear();
    const yearShort = String(year).slice(-2);
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    
    // FIX Issue #19: Make invoice number generation atomic
    // Note: We do NOT use FOR UPDATE on the count query because PostgreSQL doesn't allow
    // FOR UPDATE with aggregate functions. Instead, we rely on transaction isolation
    // and pessimistic locking at the uniqueness check level (line 2008).
    const maxRetries = 10;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      // Build count query with proper scoping
      // IMPORTANT: No lock on count query - PostgreSQL doesn't allow FOR UPDATE with COUNT(*)
      let countQuery = manager
        .createQueryBuilder(Invoice, 'invoice')
        .where('invoice.type = :type', { type })
        .andWhere('invoice.deletedAt IS NULL'); // Exclude soft-deleted invoices
      
      // Organizations removed - filter by userId only (user-scoped data)
      countQuery = countQuery.andWhere('invoice.userId = :userId', { userId });
      
      // FIX Issue #19: Count existing invoices to generate next number
      // Note: Locking is handled at the uniqueness check level (line 2008) to avoid
      // PostgreSQL error with FOR UPDATE on aggregate functions
      const count = await countQuery.getCount();
      
      const number = String(count + 1).padStart(4, '0');
      
      // Replace format placeholders
      let invoiceNumber = format
        .replace(/{YYYY}/g, String(year))
        .replace(/{YY}/g, yearShort)
        .replace(/{MM}/g, month)
        .replace(/{DD}/g, day)
        .replace(/{NUM}/g, number)
        .replace(/{####}/g, number);
      
      // If format doesn't include prefix, add it
      if (!invoiceNumber.startsWith(prefix) && format === 'INV-{YYYY}-{NUM}') {
        invoiceNumber = `${prefix}-${year}-${number}`;
      }
      
      // FIX Issue #19: Double-check uniqueness with lock (defensive check)
      // Even with FOR UPDATE, we verify the number doesn't exist
      const existing = await manager.findOne(Invoice, {
        where: {
          number: invoiceNumber,
          type,
          // Organizations removed - filter by userId only (user-scoped data)
          userId,
        },
        lock: { mode: 'pessimistic_write' }, // Lock during check
      });
      
      if (!existing) {
        // Number is unique, return it
        return invoiceNumber;
      }
      
      // FIX #123: Number exists - add jittered delay to prevent thundering herd
      this.logger.warn(`Invoice number ${invoiceNumber} already exists, retrying (attempt ${attempt + 1}/${maxRetries})`);
      
      // FIX #123: Add jittered delay to reduce collision probability
      if (attempt < maxRetries - 1) {
        const baseDelay = 10 * (attempt + 1);
        const jitter = Math.random() * 0.3 * baseDelay; // 30% jitter
        await new Promise(resolve => setTimeout(resolve, baseDelay + jitter));
      }
    }
    
    // If all retries failed, use timestamp-based fallback
    const timestamp = Date.now();
    const fallbackNumber = `${prefix}-${year}-${String(timestamp).slice(-6)}`;
    this.logger.warn(`Failed to generate unique invoice number after ${maxRetries} attempts, using fallback: ${fallbackNumber}`);
    return fallbackNumber;
  }

  /**
   * Send invoice email
   * FIXES: Issue #1, #2, #3 - Email sending is now atomic with status update
   * - Transaction is started first
   * - Status is updated within transaction
   * - Email is sent AFTER transaction commits
   * - If email fails after commit, it's logged for manual intervention
   */
  async sendEmail(
    id: string, 
    userId: string,
    options?: {
      subject?: string;
      message?: string;
      to?: string;
      includePdf?: boolean;
    },
  ): Promise<{ message: string; emailError?: string }> {
    // CRITICAL FIX #1, #3: Start transaction FIRST, then send email AFTER commit
    // This ensures status update and email sending are properly coordinated
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    
    let invoiceToUpdate: Invoice | null = null;
    
    try {
      // CRITICAL FIX #1: Lock invoice during status update
      // NOTE: Cannot use relations with pessimistic lock due to PostgreSQL limitation:
      // "FOR UPDATE cannot be applied to the nullable side of an outer join"
      // So we load the invoice first with lock, then load relations separately
      const invoiceLocked = await queryRunner.manager.findOne(Invoice, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      
      if (!invoiceLocked) {
        throw new NotFoundException('Invoice not found');
      }
      
      // Verify access - Organizations removed - verify user access only
      const hasAccess = invoiceLocked.userId === userId;
      if (!hasAccess) {
        throw new NotFoundException('Invoice not found');
      }
      
      // Load relations separately after acquiring the lock (without lock to avoid outer join issue)
      invoiceToUpdate = await queryRunner.manager
        .createQueryBuilder(Invoice, 'invoice')
        .leftJoinAndSelect('invoice.items', 'items')
        .leftJoinAndSelect('invoice.client', 'client', 'client.deletedAt IS NULL') // CRITICAL: Exclude soft-deleted clients
        .leftJoinAndSelect('invoice.store', 'store', 'store.deletedAt IS NULL') // CRITICAL: Exclude soft-deleted stores
        .leftJoinAndSelect('invoice.user', 'user')
        .where('invoice.id = :id', { id })
        .andWhere('invoice.userId = :userId', { userId })
        .getOne();
      
      if (!invoiceToUpdate) {
        throw new NotFoundException('Invoice not found');
      }
      
      // Email functionality removed - no need to check client email
      
      // Update invoice status to 'sent' if it's currently 'draft'
      if (invoiceToUpdate.status === 'draft') {
        invoiceToUpdate.status = 'sent';
        await queryRunner.manager.save(Invoice, invoiceToUpdate);
        
        // CRITICAL FIX #5, #22: If status changed, we need to create stock movements
        // Check if invoice affects stock
        if (invoiceToUpdate.type !== 'estimate' && invoiceToUpdate.items && invoiceToUpdate.items.length > 0) {
          for (const item of invoiceToUpdate.items) {
            if (item.inventoryItemId) {
              // CRITICAL FIX #108, #126: Validate stock and item status
              const inventoryItem = await queryRunner.manager.findOne(InventoryItem, {
                where: { id: item.inventoryItemId },
                lock: { mode: 'pessimistic_write' },
              });
              
              if (!inventoryItem) {
                this.logger.warn(`Inventory item ${item.inventoryItemId} not found, skipping stock movement`);
                continue;
              }
              
              // No status restrictions - only check stock availability
              if (inventoryItem.currentStock < item.quantity) {
                // CRITICAL FIX #22: Don't silently fail - this is a data consistency issue
                throw new BadRequestException(
                  `Insufficient stock for item ${inventoryItem.name || inventoryItem.sku}. Available: ${inventoryItem.currentStock}, Required: ${item.quantity}`
                );
              }
              
              // CRITICAL FIX #22: Create movement - failures cause rollback
              await this.inventoryService.createMovement(
                item.inventoryItemId,
                invoiceToUpdate.userId,
                {
                  type: 'sale',
                  quantity: item.quantity,
                  sourceType: 'invoice',
                  sourceId: id,
                  invoiceItemId: item.id,
                  note: `Invoice ${invoiceToUpdate.number}`,
                },
                invoiceToUpdate.storeId,
                queryRunner,
              );
            }
          }
        }
      }
      
      // CRITICAL FIX #1, #3: Commit transaction BEFORE sending email
      // This ensures status is updated atomically
      await queryRunner.commitTransaction();
      
      // Send email after transaction commits
      try {
        const recipientEmail = options?.to || invoiceToUpdate.client?.email;
        if (!recipientEmail) {
          this.logger.warn(`Invoice ${invoiceToUpdate.number} has no recipient email, skipping email send`);
          return { message: 'Invoice status updated to sent. Email not sent: recipient email not available.' };
        }

        const emailSubject = options?.subject || `Invoice ${invoiceToUpdate.number} from ${invoiceToUpdate.store?.name || 'Your Company'}`;
        const emailMessage = options?.message || this.buildInvoiceEmailHtml(invoiceToUpdate);
        
        const emailOptions: any = {
          to: recipientEmail,
          subject: emailSubject,
          html: emailMessage,
        };

        // Include PDF if requested (default: true)
        if (options?.includePdf !== false) {
          const pdfBuffer = await this.generatePdf(id, userId);
          emailOptions.attachments = [
            {
              filename: `invoice-${invoiceToUpdate.number}.pdf`,
              content: pdfBuffer,
              contentType: 'application/pdf',
            },
          ];
        }
        
        await this.mailService.sendMail(emailOptions);

        this.logger.log(`Invoice ${invoiceToUpdate.number} email sent successfully to ${recipientEmail}`);
        return { message: 'Invoice sent successfully via email' };
      } catch (emailError: any) {
        // Email failure after commit is logged but doesn't rollback the status change
        this.logger.error(`Failed to send email for invoice ${invoiceToUpdate.number}:`, emailError);
        // Status is already updated, so we return success but note the email failure
        return { 
          message: 'Invoice status updated to sent, but email failed to send. Please check email configuration.',
          emailError: emailError.message,
        };
      }
    } catch (error) {
      // CRITICAL FIX #1, #3: Rollback transaction if anything fails before email send
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to update invoice status for email send:`, error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Build HTML email content for invoice
   */
  private buildInvoiceEmailHtml(invoice: Invoice): string {
    const storeName = invoice.store?.name || 'Your Company';
    const clientName = invoice.client?.name || 'Client';
    
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #1976d2; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background-color: #f5f5f5; }
            .invoice-details { background-color: white; padding: 20px; margin: 20px 0; border-radius: 5px; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
            .button { display: inline-block; padding: 12px 24px; background-color: #1976d2; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Invoice ${invoice.number}</h1>
            </div>
            <div class="content">
              <p>Dear ${clientName},</p>
              <p>Please find attached invoice ${invoice.number} from ${storeName}.</p>
              <div class="invoice-details">
                <p><strong>Invoice Number:</strong> ${invoice.number}</p>
                <p><strong>Issue Date:</strong> ${new Date(invoice.issueDate).toLocaleDateString()}</p>
                ${invoice.dueDate ? `<p><strong>Due Date:</strong> ${new Date(invoice.dueDate).toLocaleDateString()}</p>` : ''}
                <p><strong>Total Amount:</strong> ${invoice.currency} ${invoice.total.toFixed(2)}</p>
              </div>
              <p>Thank you for your business!</p>
            </div>
            <div class="footer">
              <p>This is an automated email. Please do not reply.</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  async generatePdf(id: string, userId: string): Promise<Buffer> {
    return this.invoicePdfService.generateInvoicePdf(id, userId);
  }
}

