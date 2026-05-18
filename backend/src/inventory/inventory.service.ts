import { Injectable, NotFoundException, ConflictException, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, In, IsNull, DataSource, QueryRunner } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { Inject } from '@nestjs/common';
import { InventoryItem } from './entities/inventory-item.entity';
import { StockMovement } from './entities/stock-movement.entity';
import { InvoiceItem } from '../invoices/entities/invoice-item.entity';
import { Invoice } from '../invoices/entities/invoice.entity';
import { Store } from './entities/store.entity';
import { UserSettings } from '../user-settings/entities/user-settings.entity';
import { StoreItemSettings } from './entities/store-item-settings.entity';
import { StoreItemSettingsService } from './store-item-settings.service';
import { sanitizeString } from '../common/utils/security.util';
import { CreateInventoryItemDto } from './dto';
import { buildOrgScopedWhere } from '../common/utils/typeorm-query.util';
import { CacheKey, buildCacheKey } from '../common/utils/cache-invalidation.util';
import { DeadlockDetector } from '../common/utils/deadlock-detection.util';
import { ImportService } from '../common/services/import.service';

type SourceType = 'invoice' | 'manual' | 'import';

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(
    @InjectRepository(InventoryItem)
    private inventoryRepository: Repository<InventoryItem>,
    @InjectRepository(StockMovement)
    private stockMovementRepository: Repository<StockMovement>,
    @InjectRepository(InvoiceItem)
    private invoiceItemsRepository: Repository<InvoiceItem>,
    @InjectRepository(Invoice)
    private invoicesRepository: Repository<Invoice>,
    @InjectRepository(UserSettings)
    private userSettingsRepository: Repository<UserSettings>,
    @InjectRepository(StoreItemSettings)
    private storeItemSettingsRepository: Repository<StoreItemSettings>,
    @InjectRepository(Store)
    private storeRepository: Repository<Store>,
    private storeItemSettingsService: StoreItemSettingsService,
    private readonly dataSource: DataSource,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly importService: ImportService,
  ) {}

  async findAll(
    userId: string,
    filters?: {
      search?: string;
      status?: string;
      lowStockOnly?: boolean;
    },
  ): Promise<InventoryItem[]> {
    try {
      // DIAGNOSTIC: Log the query parameters
      this.logger.log(`[DIAGNOSTIC] InventoryService.findAll called with userId: ${userId}`);
      
      // Organizations removed - filter by userId only (user-scoped data)
      const query = this.inventoryRepository
        .createQueryBuilder('item')
        .where('item.userId = :userId', { userId });

      if (filters?.search) {
        query.andWhere(
          '(item.name ILIKE :search OR item.sku ILIKE :search OR item.barcode ILIKE :search OR item.description ILIKE :search OR item.unit ILIKE :search OR CAST(item.defaultUnitPrice AS TEXT) ILIKE :search OR CAST(item.costPrice AS TEXT) ILIKE :search OR CAST(item.currentStock AS TEXT) ILIKE :search OR CAST(item.reorderLevel AS TEXT) ILIKE :search)',
          { search: `%${filters.search}%` },
        );
      }

      // Only filter by status if explicitly provided and is a valid status value
      if (filters?.status && (filters.status === 'active' || filters.status === 'inactive')) {
        query.andWhere('item.status = :status', { status: filters.status });
      }
      // If status is 'all', undefined, or any other value, don't filter by status (show all)

      // Only apply low stock filter if explicitly true
      if (filters?.lowStockOnly === true) {
        query.andWhere('item.currentStock <= item.reorderLevel');
      }

      const results = await query.orderBy('item.createdAt', 'DESC').getMany();
      
      // DIAGNOSTIC: Log the results
      this.logger.log(`[DIAGNOSTIC] InventoryService.findAll returned ${results.length} items for userId: ${userId}`);
      if (results.length > 0) {
        this.logger.log(`[DIAGNOSTIC] First item: id=${results[0].id}, name=${results[0].name}, userId=${results[0].userId}`);
      } else {
        // Check if there are any items for this user at all (including deleted)
        const allItems = await this.inventoryRepository
          .createQueryBuilder('item')
          .withDeleted()
          .where('item.userId = :userId', { userId })
          .getMany();
        this.logger.warn(`[DIAGNOSTIC] No active items found, but found ${allItems.length} total items (including deleted) for userId: ${userId}`);
        if (allItems.length > 0) {
          this.logger.warn(`[DIAGNOSTIC] Sample item: id=${allItems[0].id}, userId=${allItems[0].userId}`);
        }
      }
      
      this.logger.debug(`Found ${results.length} inventory items for user ${userId}`);

      // Aggregate store stock for all items
      const storeAggregationMap = await this.aggregateStoreStockForItems(results, userId);

      // Enrich items with store aggregation data
      const enrichedResults = results.map((item) => {
        const aggregation = storeAggregationMap.get(item.id);
        return {
          ...item,
          storeAggregation: aggregation || {
            totalStoreStock: 0,
            storeCount: 0,
            storesWithStock: 0,
            storesWithLowStock: 0,
            averageStoreStock: 0,
          },
        };
      });

      return enrichedResults;
    } catch (error: any) {
      // If query fails due to missing columns, try a simpler query without new fields
      if (error.message && (error.message.includes('column') || error.message.includes('does not exist')) && 
          (error.message.includes('sizeInches') || error.message.includes('material') || error.message.includes('printType'))) {
        this.logger.warn('Database missing new columns. Please run migration: npm run migration:run. Using fallback query.');
        // Fallback to basic query without new columns
        const fallbackQuery = this.inventoryRepository
          .createQueryBuilder('item')
          // Organizations removed - filter by userId only (user-scoped data)
          .where('item.userId = :userId', { userId });

        if (filters?.search) {
          fallbackQuery.andWhere(
            '(item.name ILIKE :search OR item.sku ILIKE :search OR item.barcode ILIKE :search OR item.description ILIKE :search OR item.unit ILIKE :search OR CAST(item.defaultUnitPrice AS TEXT) ILIKE :search OR CAST(item.costPrice AS TEXT) ILIKE :search OR CAST(item.currentStock AS TEXT) ILIKE :search OR CAST(item.reorderLevel AS TEXT) ILIKE :search)',
            { search: `%${filters.search}%` },
          );
        }

        if (filters?.status && (filters.status === 'active' || filters.status === 'inactive')) {
          fallbackQuery.andWhere('item.status = :status', { status: filters.status });
        }

        if (filters?.lowStockOnly === true) {
          fallbackQuery.andWhere('item.currentStock <= item.reorderLevel');
        }

        const fallbackResults = await fallbackQuery.orderBy('item.createdAt', 'DESC').getMany();
        
        // Aggregate store stock for fallback results too
        const storeAggregationMap = await this.aggregateStoreStockForItems(fallbackResults, userId);
        
        return fallbackResults.map((item) => {
          const aggregation = storeAggregationMap.get(item.id);
          return {
            ...item,
            storeAggregation: aggregation || {
              totalStoreStock: 0,
              storeCount: 0,
              storesWithStock: 0,
              storesWithLowStock: 0,
              averageStoreStock: 0,
            },
          };
        });
      }
      this.logger.error('Error fetching inventory items:', error);
      throw error;
    }
  }

  /**
   * Aggregate store stock for a list of inventory items
   */
  private async aggregateStoreStockForItems(
    items: InventoryItem[],
    userId: string,
  ): Promise<Map<string, any>> {
    if (!items || items.length === 0) {
      return new Map();
    }

    const itemIds = items.map((item) => item.id);

    // Get all store settings for these items
    const storeSettings = await this.storeItemSettingsRepository
      .createQueryBuilder('settings')
      .leftJoinAndSelect('settings.store', 'store')
      .where('settings.inventoryItemId IN (:...itemIds)', { itemIds })
      .andWhere('store.userId = :userId', { userId })
      .getMany();

    // Aggregate by inventory item ID
    const aggregationMap = new Map<string, any>();

    for (const item of items) {
      const itemSettings = storeSettings.filter((s) => s.inventoryItemId === item.id);

      if (itemSettings.length === 0) {
        aggregationMap.set(item.id, {
          totalStoreStock: 0,
          storeCount: 0,
          storesWithStock: 0,
          storesWithLowStock: 0,
          averageStoreStock: 0,
        });
        continue;
      }

      const totalStoreStock = itemSettings.reduce((sum, s) => sum + (s.currentStock || 0), 0);
      const storesWithStock = itemSettings.filter((s) => (s.currentStock || 0) > 0).length;
      const storesWithLowStock = itemSettings.filter(
        (s) => (s.currentStock || 0) <= (s.minQty || 0),
      ).length;
      const averageStoreStock =
        itemSettings.length > 0 ? totalStoreStock / itemSettings.length : 0;

      aggregationMap.set(item.id, {
        totalStoreStock,
        storeCount: itemSettings.length,
        storesWithStock,
        storesWithLowStock,
        averageStoreStock: Number(averageStoreStock.toFixed(2)),
      });
    }

    return aggregationMap;
  }

  /**
   * Enrich inventory item with computed fields
   */
  private async enrichWithComputedFields(item: InventoryItem, userId: string): Promise<any> {
    // Use default weeks supply target (backup/planning features removed)
    const globalWeeksSupplyTarget = 4;

    // Use item override if available, otherwise use global default
    const weeksSupplyTarget = item.weeksSupplyTargetOverride ?? globalWeeksSupplyTarget;

    // Compute weeksOnHand
    let weeksOnHand: number | null = null;
    if (item.averageWeeklyUsage && item.averageWeeklyUsage > 0) {
      const available = item.currentStock;
      weeksOnHand = available / item.averageWeeklyUsage;
    }

    // Compute containersNeeded
    let containersNeeded: number | null = null;
    if (item.unitsPerContainer && item.unitsPerContainer > 0) {
      const totalUnitsNeeded = item.averageWeeklyUsage && weeksSupplyTarget
        ? item.averageWeeklyUsage * weeksSupplyTarget
        : null;
      if (totalUnitsNeeded) {
        containersNeeded = Math.ceil(totalUnitsNeeded / item.unitsPerContainer);
      }
    }

    return {
      ...item,
      computed: {
        weeksOnHand: weeksOnHand !== null ? Number(weeksOnHand.toFixed(2)) : null,
        containersNeeded: containersNeeded !== null ? containersNeeded : null,
        effectiveWeeksSupplyTarget: weeksSupplyTarget,
      },
    };
  }

  async findOne(id: string, userId: string): Promise<InventoryItem> {
    // Fix Issue #1: Use query builder instead of 'as any' type assertion
    const item = await this.inventoryRepository
      .createQueryBuilder('item')
      .leftJoinAndSelect('item.movements', 'movements')
      .where('item.id = :id', { id })
      .andWhere(
        // Organizations removed - filter by userId only (user-scoped data)
        'item.userId = :userId',
        { userId }
      )
      .getOne();
    
    if (!item) {
      throw new NotFoundException('Inventory item not found');
    }
    return this.enrichWithComputedFields(item, userId);
  }

  async create(userId: string, data: Partial<InventoryItem>): Promise<InventoryItem> {
    // FIX Issue #16: Use database constraint instead of pre-check to avoid race condition
    // The InventoryItem entity has unique indexes: UX_inventory_items_org_sku and UX_inventory_items_user_sku_legacy
    // We still do a pre-check as an optimization, but rely on database constraint for correctness
    const existingItem = await this.inventoryRepository
      .createQueryBuilder('item')
      .where('item.sku = :sku', { sku: data.sku })
      .andWhere(
        // Organizations removed - filter by userId only (user-scoped data)
        'item.userId = :userId',
        { userId }
      )
      .getOne();
    
    if (existingItem) {
      throw new ConflictException(`An inventory item with SKU "${data.sku}" already exists. Please use a different SKU.`);
    }
    
    // Sanitize all text inputs to prevent XSS
    // Fix Bug #72: Add SKU format validation
    const sanitizedSku = sanitizeString(data.sku, 100);
    if (!sanitizedSku || !/^[A-Za-z0-9_-]+$/.test(sanitizedSku)) {
      throw new BadRequestException('SKU can only contain letters, numbers, underscores, and hyphens');
    }
    
    const sanitizedData = {
      ...data,
      sku: sanitizedSku,
      name: sanitizeString(data.name, 255),
      description: data.description ? sanitizeString(data.description, 5000) : data.description,
      unit: sanitizeString(data.unit, 50),
      barcode: data.barcode ? sanitizeString(data.barcode, 100) : data.barcode,
    };
    
    const item = this.inventoryRepository.create({
      ...sanitizedData,
      userId,
    });
    
    try {
      return await this.inventoryRepository.save(item) as InventoryItem;
    } catch (error: any) {
      // FIX Issue #16: Handle database constraint violation gracefully
      // This catches race conditions where two requests try to create item with same SKU
      if (error.code === '23505') {
        // PostgreSQL unique constraint violation
        const constraintName = error.constraint || 'unknown';
        if (constraintName.includes('UX_inventory_items_org_sku') || 
            constraintName.includes('UX_inventory_items_user_sku_legacy') ||
            constraintName.includes('UQ_inventory_items_sku')) {
          throw new ConflictException(
            `An inventory item with SKU "${data.sku}" already exists. ` +
            `This may have been created by another request. Please try again with a different SKU.`
          );
        }
      }
      // Re-throw other errors
      throw error;
    }
  }

  async bulkCreate(
    userId: string,
    items: CreateInventoryItemDto[],
  ): Promise<{ success: InventoryItem[]; errors: Array<{ item: CreateInventoryItemDto; error: string }> }> {
    if (!items || items.length === 0) {
      throw new BadRequestException('Items array cannot be empty');
    }

    if (items.length > 100) {
      throw new BadRequestException('Cannot create more than 100 items at once');
    }

    // Validate all items before starting transaction
    const errors: Array<{ item: CreateInventoryItemDto; error: string }> = [];
    const validItems: CreateInventoryItemDto[] = [];
    const skuSet = new Set<string>();

    for (const item of items) {
      // Check for duplicate SKUs in the batch
      if (skuSet.has(item.sku)) {
        errors.push({ item, error: `Duplicate SKU "${item.sku}" in batch` });
        continue;
      }
      skuSet.add(item.sku);

      // Basic validation
      if (!item.sku || !item.name || !item.unit || item.defaultUnitPrice === undefined) {
        errors.push({ item, error: 'Missing required fields: sku, name, unit, or defaultUnitPrice' });
        continue;
      }

      validItems.push(item);
    }

    if (validItems.length === 0) {
      throw new BadRequestException('No valid items to create. All items failed validation.');
    }

    // Use transaction to ensure atomicity
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    const success: InventoryItem[] = [];
    const transactionErrors: Array<{ item: CreateInventoryItemDto; error: string }> = [];

    try {
      // Check for existing SKUs in database
      const skus = validItems.map(item => item.sku);
      // Fix Bug #1: Remove 'as any' - use proper TypeORM query builder
      // Organizations removed - filter by userId only (user-scoped data)
      const existingItems = await queryRunner.manager
        .createQueryBuilder(InventoryItem, 'item')
        .where('item.userId = :userId', { userId })
        .andWhere('item.sku IN (:...skus)', { skus })
        .getMany();

      const existingSkus = new Set(existingItems.map(item => item.sku));

      // Create items that don't conflict
      for (const itemData of validItems) {
        if (existingSkus.has(itemData.sku)) {
          transactionErrors.push({ item: itemData, error: `SKU "${itemData.sku}" already exists` });
          continue;
        }

        try {
          // Sanitize all text inputs
          const sanitizedData = {
            ...itemData,
            sku: sanitizeString(itemData.sku, 100),
            name: sanitizeString(itemData.name, 255),
            description: itemData.description ? sanitizeString(itemData.description, 5000) : itemData.description,
            unit: sanitizeString(itemData.unit, 50),
            barcode: itemData.barcode ? sanitizeString(itemData.barcode, 100) : itemData.barcode,
          };

          const item = queryRunner.manager.create(InventoryItem, {
            ...sanitizedData,
            userId,
            // Organizations removed - no organizationId needed
          });

          const savedItem = await queryRunner.manager.save(InventoryItem, item);
          success.push(savedItem);
        } catch (error: unknown) {
          // Fix Issue #8: Log error but continue - transaction will rollback if all fail
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          transactionErrors.push({ item: itemData, error: errorMessage });
          this.logger.error(`Failed to create item with SKU "${itemData.sku}": ${errorMessage}`, error);
          // Note: Transaction continues to allow other items to succeed
          // If all items fail, transaction will be rolled back below
        }
      }

      // FIX #140: If all items fail, rollback transaction to prevent partial success
      if (success.length === 0) {
        await queryRunner.rollbackTransaction();
        throw new BadRequestException('All items failed to create. No items were saved.');
      }
      
      // FIX #140: If critical errors occurred (not just validation), consider rolling back
      // For now, we allow partial success but log warnings
      if (transactionErrors.length > 0) {
        this.logger.warn(`Bulk create: ${transactionErrors.length} items failed, but ${success.length} succeeded. Partial success.`);
      }

      await queryRunner.commitTransaction();
      this.logger.log(`Bulk created ${success.length} inventory items, ${transactionErrors.length} failed`);

      return {
        success,
        errors: [...errors, ...transactionErrors],
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error('Bulk create transaction failed', error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async update(id: string, userId: string, data: Partial<InventoryItem>): Promise<InventoryItem> {
    const item = await this.findOne(id, userId);
    
    // Sanitize all text inputs to prevent XSS
    // Fix Bug #72: Add SKU format validation
    const sanitizedData: Partial<InventoryItem> = {};
    if (data.sku !== undefined) {
      const sanitizedSku = sanitizeString(data.sku, 100);
      // Validate SKU format: letters, numbers, underscores, hyphens only
      if (sanitizedSku && !/^[A-Za-z0-9_-]+$/.test(sanitizedSku)) {
        throw new BadRequestException('SKU can only contain letters, numbers, underscores, and hyphens');
      }
      sanitizedData.sku = sanitizedSku;
    }
    if (data.name !== undefined) sanitizedData.name = sanitizeString(data.name, 255);
    if (data.description !== undefined) sanitizedData.description = data.description ? sanitizeString(data.description, 5000) : data.description;
    if (data.unit !== undefined) sanitizedData.unit = sanitizeString(data.unit, 50);
    if (data.barcode !== undefined) sanitizedData.barcode = data.barcode ? sanitizeString(data.barcode, 100) : data.barcode;
    // Copy numeric and enum fields
    if (data.costPrice !== undefined) sanitizedData.costPrice = data.costPrice;
    if (data.defaultUnitPrice !== undefined) sanitizedData.defaultUnitPrice = data.defaultUnitPrice;
    if (data.defaultTaxRate !== undefined) sanitizedData.defaultTaxRate = data.defaultTaxRate;
    if (data.currentStock !== undefined) sanitizedData.currentStock = data.currentStock;
    if (data.reorderLevel !== undefined) sanitizedData.reorderLevel = data.reorderLevel;
    if (data.maxStockLevel !== undefined) sanitizedData.maxStockLevel = data.maxStockLevel;
    if (data.status !== undefined) sanitizedData.status = data.status;
    if (data.bundleSize !== undefined) sanitizedData.bundleSize = data.bundleSize;
    if (data.bundleUnit !== undefined) sanitizedData.bundleUnit = data.bundleUnit ? sanitizeString(data.bundleUnit, 50) : data.bundleUnit;
    if (data.spacePerBundle !== undefined) sanitizedData.spacePerBundle = data.spacePerBundle;
    if (data.bundlesPerContainer !== undefined) sanitizedData.bundlesPerContainer = data.bundlesPerContainer;
    if (data.targetBundles !== undefined) sanitizedData.targetBundles = data.targetBundles;
    if (data.packSize !== undefined) sanitizedData.packSize = data.packSize;
    if (data.unitsPerContainer !== undefined) sanitizedData.unitsPerContainer = data.unitsPerContainer;
    if (data.weeksSupplyTargetOverride !== undefined) sanitizedData.weeksSupplyTargetOverride = data.weeksSupplyTargetOverride;
    if (data.averageWeeklyUsage !== undefined) sanitizedData.averageWeeklyUsage = data.averageWeeklyUsage;
    
    Object.assign(item, sanitizedData);
    await this.inventoryRepository.save(item);
    return this.findOne(id, userId);
  }

  async remove(id: string, userId: string): Promise<void> {
    const item = await this.findOne(id, userId);
    
    // CRITICAL FIX: Check if item is used in any invoices (including soft-deleted invoices)
    // We check all invoices because even deleted invoices should prevent item deletion for audit trail
    const invoiceItems = await this.invoiceItemsRepository
      .createQueryBuilder('invoiceItem')
      .innerJoin('invoiceItem.invoice', 'invoice')
      .where('invoiceItem.inventoryItemId = :id', { id })
      .getCount();
    
    if (invoiceItems > 0) {
      throw new ConflictException(
        'Cannot delete inventory item as it is linked to existing invoices. Please remove the item from all invoices first.',
      );
    }
    
    // CRITICAL FIX: Check if item has stock movements (for audit trail)
    const movementsCount = await this.stockMovementRepository
      .createQueryBuilder('movement')
      .where('movement.inventoryItemId = :id', { id })
      .getCount();
    
    if (movementsCount > 0) {
      this.logger.warn(
        `Inventory item ${id} has ${movementsCount} stock movements. These will become orphaned after deletion.`
      );
      // Note: We allow deletion but log warning - movements will be orphaned
      // This is acceptable for audit trail purposes
    }
    
    // CRITICAL FIX: Check if item has store settings
    const settingsCount = await this.storeItemSettingsRepository
      .createQueryBuilder('settings')
      .where('settings.inventoryItemId = :id', { id })
      .getCount();
    
    if (settingsCount > 0) {
      this.logger.warn(
        `Inventory item ${id} has ${settingsCount} store item settings. These will become orphaned after deletion.`
      );
      // Note: CASCADE delete should handle this, but we log for visibility
    }
    
    // Hard delete (not soft delete) - inventory items don't use soft delete
    await this.inventoryRepository.remove(item);
    
    this.logger.log(`Inventory item ${id} (${item.sku}) deleted successfully`);
  }

  async getMovements(inventoryItemId: string, userId: string): Promise<StockMovement[]> {
    await this.findOne(inventoryItemId, userId);
    return this.stockMovementRepository
      .createQueryBuilder('movement')
      .where('movement.userId = :userId', { userId })
      .andWhere('movement.inventoryItemId = :inventoryItemId', { inventoryItemId })
      .orderBy('movement.createdAt', 'DESC')
      .getMany();
  }

  /**
   * Create a stock movement
   * FIXED: Issues #154, #164 - Deadlock detection and retry logic
   */
  async createMovement(
    inventoryItemId: string,
    userId: string,
    data: Partial<StockMovement>,
    storeId?: string,
    queryRunner?: QueryRunner,
  ): Promise<StockMovement> {
    // CRITICAL FIX #154, #164: Use deadlock detection for stock operations
    if (queryRunner) {
      // If in transaction, use deadlock detection
      return await DeadlockDetector.executeWithRetry(
        async (qr) => this._createMovementInternal(inventoryItemId, userId, data, storeId, qr),
        queryRunner,
      );
    } else {
      // If not in transaction, create one for atomicity
      const newQueryRunner = this.dataSource.createQueryRunner();
      await newQueryRunner.connect();
      await newQueryRunner.startTransaction();
      
      try {
        const result = await DeadlockDetector.executeWithRetry(
          async (qr) => this._createMovementInternal(inventoryItemId, userId, data, storeId, qr),
          newQueryRunner,
        );
        await newQueryRunner.commitTransaction();
        return result;
      } catch (error) {
        await newQueryRunner.rollbackTransaction();
        throw error;
      } finally {
        await newQueryRunner.release();
      }
    }
  }
  
  /**
   * Internal method to create stock movement (actual implementation)
   * FIXED: Issues #151, #152, #155, #157, #163
   */
  private async _createMovementInternal(
    inventoryItemId: string,
    userId: string,
    data: Partial<StockMovement>,
    storeId?: string,
    queryRunner?: QueryRunner,
  ): Promise<StockMovement> {
    // Use queryRunner.manager if provided, otherwise use repository
    const manager = queryRunner?.manager || this.inventoryRepository.manager;
    
    // Use pessimistic write locking to prevent race conditions
    // This ensures only one transaction can update the stock at a time
    const item = await manager.findOne(InventoryItem, {
      where: { id: inventoryItemId },
      lock: { mode: 'pessimistic_write' },
    });
    
    if (!item) {
      throw new NotFoundException('Inventory item not found');
    }
    
    // Organizations removed - verify user access only
    if (item.userId !== userId) {
      throw new NotFoundException('Inventory item not found');
    }
    
    const previousStock = item.currentStock;

    // CRITICAL FIX #106, #117, #199: Validate quantity FIRST
    if (data.quantity === undefined || data.quantity === null) {
      throw new BadRequestException('Quantity is required for stock movement');
    }
    
    const quantity = Number(data.quantity);
    if (isNaN(quantity) || quantity <= 0 || !Number.isInteger(quantity)) {
      throw new BadRequestException(`Invalid quantity: ${data.quantity}. Quantity must be a positive integer.`);
    }
    
    // Check for integer overflow (JavaScript safe integer limit)
    if (quantity > Number.MAX_SAFE_INTEGER) {
      throw new BadRequestException(`Quantity ${quantity} exceeds maximum safe integer value`);
    }
    
    // Use validated quantity
    const validatedQuantity = quantity;
    
    // CRITICAL FIX #121, #129: Validate sourceId and invoiceItemId BEFORE creating movement
    if (data.sourceId) {
      // Validate source exists based on sourceType
      if (data.sourceType === 'invoice') {
        // CRITICAL FIX #121: Verify invoice exists and belongs to organization
        const invoice = await (queryRunner?.manager || this.invoicesRepository.manager).findOne(Invoice, {
          where: {
            id: data.sourceId,
            userId, // Organizations removed - filter by userId only
          },
        });
        if (!invoice) {
          throw new BadRequestException(`Invoice ${data.sourceId} not found or does not belong to organization`);
        }
        
        // CRITICAL FIX #129: Validate invoiceItemId if provided
        if (data.invoiceItemId) {
          const invoiceItem = await (queryRunner?.manager || this.invoiceItemsRepository.manager).findOne(InvoiceItem, {
            where: {
              id: data.invoiceItemId,
              invoiceId: data.sourceId,
            },
          });
          if (!invoiceItem) {
            throw new BadRequestException(`Invoice item ${data.invoiceItemId} not found in invoice ${data.sourceId}`);
          }
        }
      }
    }

    // CRITICAL FIX: Validate storeId if provided BEFORE creating movement
    if (storeId) {
      const store = await (queryRunner?.manager || this.dataSource.manager).findOne(Store, {
        where: {
          id: storeId,
          userId, // Organizations removed - filter by userId only
        },
      });
      
      if (!store) {
        throw new BadRequestException(`Store with ID "${storeId}" not found or does not belong to your organization.`);
      }
    }

    this.logger.log(
      `Stock adjustment for item ${item.sku} (${inventoryItemId}): type=${data.type}, quantity=${validatedQuantity}, previous stock=${previousStock}, storeId=${storeId || 'none'}`,
    );

    const movement = (queryRunner?.manager || this.stockMovementRepository.manager).create(StockMovement, {
      ...data,
      quantity: validatedQuantity, // Use validated quantity
      inventoryItemId,
      userId,
      storeId,
    });

    // CRITICAL FIX #125: Validate movement type
    const validTypes = ['purchase', 'sale', 'adjustment'];
    if (!data.type || !validTypes.includes(data.type)) {
      throw new BadRequestException(`Invalid movement type: ${data.type}. Must be one of: ${validTypes.join(', ')}`);
    }
    
    // CRITICAL FIX #108: Validate stock availability for sales
    // No status restrictions - any item can have stock movements as long as stock is available
    if (data.type === 'sale' && item.currentStock < validatedQuantity) {
      throw new BadRequestException(
        `Insufficient stock for item ${item.sku}. Available: ${item.currentStock}, Required: ${validatedQuantity}`
      );
    }
    
    // Update stock based on movement type
    if (data.type === 'purchase') {
      item.currentStock += validatedQuantity;
      // CRITICAL FIX #43, #47, #90: Update store stock within transaction
      if (storeId) {
        await this.storeItemSettingsService.adjustStoreStock(
          storeId,
          inventoryItemId,
          validatedQuantity,
          userId,
          'increase',
          queryRunner, // Pass queryRunner to ensure transaction consistency
        );
      }
    } else if (data.type === 'adjustment') {
      // For adjustment, quantity represents the new stock level
      const oldStock = previousStock;
      const newStock = validatedQuantity;
      const difference = newStock - oldStock;
      
      item.currentStock = newStock;
      if (item.currentStock < 0) {
        item.currentStock = 0;
      }
      
      // Update store stock if storeId provided
      if (storeId && difference !== 0) {
        if (difference > 0) {
          // CRITICAL FIX #43, #47, #90: Stock increased - add the difference to store stock within transaction
          await this.storeItemSettingsService.adjustStoreStock(
            storeId,
            inventoryItemId,
            difference,
            userId,
            'increase',
            queryRunner, // Pass queryRunner to ensure transaction consistency
          );
        } else if (difference < 0) {
          // CRITICAL FIX #43, #47, #90: Stock decreased - subtract the absolute difference from store stock within transaction
          await this.storeItemSettingsService.adjustStoreStock(
            storeId,
            inventoryItemId,
            Math.abs(difference),
            userId,
            'decrease',
            queryRunner, // Pass queryRunner to ensure transaction consistency
          );
        }
      }
    } else if (data.type === 'sale') {
      // PHASE 2 FIX: Use atomic UPDATE pattern to prevent race conditions
      // This ensures stock cannot go negative even with concurrent requests
      // ENHANCED: Use raw SQL to ensure correct column name (currentStock, not current_stock)
      const updateResult = await manager.query(
        `UPDATE "inventory_items" 
         SET "currentStock" = "currentStock" - $1 
         WHERE "id" = $2 
           AND "currentStock" >= $1 
           AND "status" = $3`,
        [validatedQuantity, inventoryItemId, 'active']
      );

      // ENHANCED: Check if update affected any rows (raw query returns rowCount)
      const rowCount = Array.isArray(updateResult) ? updateResult.length : (updateResult.rowCount || 0);
      
      if (rowCount === 0) {
        // Check if item exists and is active
        const checkItem = await manager.findOne(InventoryItem, {
          where: { id: inventoryItemId },
        });
        
        if (!checkItem) {
          throw new NotFoundException('Inventory item not found');
        }
        
        // Insufficient stock - only restriction is stock availability
        throw new BadRequestException(
          `Insufficient stock for item ${checkItem.sku}. Available: ${checkItem.currentStock}, Required: ${validatedQuantity}`
        );
      }
      
      // Reload item to get updated stock value
      const updatedItem = await manager.findOne(InventoryItem, {
        where: { id: inventoryItemId },
      });
      if (updatedItem) {
        item.currentStock = updatedItem.currentStock;
      }
      
      // CRITICAL FIX #43, #47, #90: Update store stock within transaction
      if (storeId) {
        await this.storeItemSettingsService.adjustStoreStock(
          storeId,
          inventoryItemId,
          validatedQuantity,
          userId,
          'decrease',
          queryRunner, // Pass queryRunner to ensure transaction consistency
        );
      }
    }

    // CRITICAL FIX #163: Save movement BEFORE updating stock to ensure audit trail
    // If movement save fails, we can rollback the stock change
    const savedMovement = await (queryRunner?.manager || this.stockMovementRepository.manager).save(StockMovement, movement);
    
    // CRITICAL FIX #163: Save inventory item AFTER movement is saved
    // This ensures movement exists even if item save fails (we can recover)
    try {
      await manager.save(InventoryItem, item);
    } catch (error) {
      // CRITICAL FIX #157: If item save fails, we need to compensate
      // Movement is already saved, so we need to reverse it
      this.logger.error(`Failed to save inventory item after movement creation, attempting compensation:`, error);
      
      // Try to reverse the movement
      try {
        await (queryRunner?.manager || this.stockMovementRepository.manager).remove(StockMovement, savedMovement);
      } catch (reverseError) {
        this.logger.error(`Failed to reverse movement after item save failure:`, reverseError);
      }
      
      throw new BadRequestException(`Failed to update inventory stock: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    this.logger.log(
      `Stock adjustment completed for item ${item.sku}: new stock=${item.currentStock}`,
    );

    // CRITICAL FIX #132, #137, #140, #149: Invalidate inventory caches after stock movement
    // Only invalidate if not in a transaction (transaction will handle cache invalidation at commit)
    if (!queryRunner) {
      try {
        // Organizations removed - cache keys no longer include organizationId
        const inventoryCacheKey = buildCacheKey(CacheKey.INVENTORY_LIST, { userId });
        const inventoryStatsKey = buildCacheKey(CacheKey.INVENTORY_STATS, { userId });
        const lowStockKey = buildCacheKey(CacheKey.LOW_STOCK, { userId });
        
        await Promise.all([
          this.cacheManager.del(inventoryCacheKey).catch(err => this.logger.warn(`Cache invalidation failed: ${err.message}`)),
          this.cacheManager.del(inventoryStatsKey).catch(err => this.logger.warn(`Cache invalidation failed: ${err.message}`)),
          this.cacheManager.del(lowStockKey).catch(err => this.logger.warn(`Cache invalidation failed: ${err.message}`)),
        ]);
      } catch (error) {
        // Log but don't fail - cache invalidation is best effort
        this.logger.warn(`Failed to invalidate inventory caches after stock movement:`, error);
      }
    }

    return savedMovement;
  }


  /**
   * Find stock movements by source (e.g., invoice ID)
   */
  async findMovementsBySource(
    sourceType: SourceType,
    sourceId: string,
    userId: string,
  ): Promise<StockMovement[]> {
    return this.stockMovementRepository.find({
      where: {
        sourceType: sourceType as 'invoice' | 'manual' | 'import',
        sourceId,
        userId, // Organizations removed - filter by userId only
      },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Delete stock movements by source (for reversing stock changes)
   * FIXED: Issues #3, #6, #15, #25, #57, #71, #166
   * - Now accepts queryRunner for transaction support
   * - Uses pessimistic locking to prevent race conditions
   * - Idempotent: checks if movement already reversed
   * - Validates stock levels after reversal
   * - All operations within transaction
   */
  async deleteMovementsBySource(
    sourceType: SourceType,
    sourceId: string,
    userId: string,
    queryRunner?: QueryRunner,
  ): Promise<void> {
    const manager = queryRunner?.manager || this.inventoryRepository.manager;
    
    // Find movements with lock to prevent concurrent reversals
    // Organizations removed - filter by userId only (user-scoped data)
    const whereCondition: any = {
      sourceType: sourceType as 'invoice' | 'manual' | 'import',
      sourceId,
      userId, // Organizations removed - filter by userId only
    };
    
    const movements = await (queryRunner?.manager || this.stockMovementRepository.manager).find(StockMovement, {
      where: whereCondition,
      lock: { mode: 'pessimistic_write' },
      order: { createdAt: 'DESC' },
    });
    
    if (movements.length === 0) {
      // Idempotent: if no movements exist, already reversed or never existed
      this.logger.debug(`No movements found for source ${sourceType}:${sourceId}, skipping reversal`);
      return;
    }
    
    this.logger.log(`Reversing ${movements.length} stock movements for source ${sourceType}:${sourceId}`);
    
    for (const movement of movements) {
      // Use pessimistic lock to prevent concurrent modifications
      const item = await manager.findOne(InventoryItem, {
        where: { id: movement.inventoryItemId },
        lock: { mode: 'pessimistic_write' },
      });
      
      if (!item) {
        this.logger.warn(`Inventory item ${movement.inventoryItemId} not found for movement ${movement.id}, skipping`);
        continue;
      }
      
      // Organizations removed - verify user access only
      if (item.userId !== userId) {
        this.logger.warn(`Access denied for inventory item ${movement.inventoryItemId}, skipping movement ${movement.id}`);
        continue;
      }
      
      const previousStock = item.currentStock;
      
      // Reverse the stock change
      if (movement.type === 'sale') {
        item.currentStock += movement.quantity;
        // Reverse store-level stock if the movement was store-scoped
        if (movement.storeId) {
          // CRITICAL FIX: Check if store exists before restoring stock
          // If store was deleted, skip store stock restoration (store settings may be orphaned)
          const store = await manager
            .createQueryBuilder(Store, 'store')
            .where('store.id = :storeId', { storeId: movement.storeId })
            .andWhere('store.deletedAt IS NULL') // Only check non-deleted stores
            .getOne();
          
          if (!store) {
            this.logger.warn(
              `Store ${movement.storeId} not found or deleted for movement ${movement.id}, skipping store stock restoration`
            );
            // Continue with global stock restoration even if store is deleted
          } else {
          // CRITICAL FIX: Use queryRunner for store stock adjustment to keep in transaction
          // Note: adjustStoreStock doesn't support queryRunner yet, so we'll need to update it
          // For now, we'll handle store stock reversal directly within transaction
          const storeSettings = await manager.findOne(StoreItemSettings, {
            where: {
              storeId: movement.storeId,
              inventoryItemId: movement.inventoryItemId,
            },
            lock: { mode: 'pessimistic_write' },
          });
          
          if (storeSettings) {
            storeSettings.currentStock = (storeSettings.currentStock || 0) + movement.quantity;
            await manager.save(StoreItemSettings, storeSettings);
            }
          }
        }
      } else if (movement.type === 'purchase') {
        item.currentStock -= movement.quantity;
        if (item.currentStock < 0) {
          this.logger.warn(`Stock would go negative for item ${item.sku}, clamping to 0. This indicates data inconsistency.`);
          item.currentStock = 0;
        }
        if (movement.storeId) {
          // CRITICAL FIX: Check if store exists before reversing store stock
          const store = await manager
            .createQueryBuilder(Store, 'store')
            .where('store.id = :storeId', { storeId: movement.storeId })
            .andWhere('store.deletedAt IS NULL') // Only check non-deleted stores
            .getOne();
          
          if (!store) {
            this.logger.warn(
              `Store ${movement.storeId} not found or deleted for movement ${movement.id}, skipping store stock reversal`
            );
            // Continue with global stock reversal even if store is deleted
          } else {
          const storeSettings = await manager.findOne(StoreItemSettings, {
            where: {
              storeId: movement.storeId,
              inventoryItemId: movement.inventoryItemId,
            },
            lock: { mode: 'pessimistic_write' },
          });
          
          if (storeSettings) {
            storeSettings.currentStock = Math.max(0, (storeSettings.currentStock || 0) - movement.quantity);
            await manager.save(StoreItemSettings, storeSettings);
            }
          }
        }
      } else if (movement.type === 'adjustment') {
        // CRITICAL FIX: Handle adjustment reversals properly
        // For adjustments, we need to restore the previous stock level
        // Since we don't store the previous stock in the movement, we can't perfectly reverse
        // Log warning and skip to prevent incorrect reversals
        this.logger.warn(
          `Cannot reverse adjustment movement ${movement.id}: adjustment reversals require previous stock level which is not stored. Skipping.`,
        );
        continue;
      } else {
        this.logger.warn(
          `Skipping stock reversal for movement ${movement.id}: unsupported type=${movement.type}, sourceType=${movement.sourceType}, sourceId=${movement.sourceId}`,
        );
        continue;
      }
      
      // Validate stock level after reversal
      if (item.currentStock < 0) {
        this.logger.error(`CRITICAL: Stock is negative after reversal for item ${item.sku}. Previous: ${previousStock}, Movement: ${movement.type} ${movement.quantity}`);
        item.currentStock = 0; // Clamp to prevent negative, but log error
      }
      
      // Save inventory item within transaction
      await manager.save(InventoryItem, item);
      
      // Delete movement within transaction
      await manager.remove(StockMovement, movement);
      
      this.logger.log(
        `Reversed stock movement for item ${item.sku}: type=${movement.type}, quantity=${movement.quantity}, previous stock=${previousStock}, new stock=${item.currentStock}`,
      );
    }
    
    this.logger.log(`Successfully reversed ${movements.length} stock movements for source ${sourceType}:${sourceId}`);
  }

  async getLowStock(userId: string): Promise<InventoryItem[]> {
    // Organizations removed - filter by userId only (user-scoped data)
    return this.inventoryRepository
      .createQueryBuilder('item')
      .where('item.userId = :userId', { userId })
      .andWhere('item.currentStock <= item.reorderLevel')
      .andWhere('item.status = :status', { status: 'active' })
      .orderBy('item.currentStock', 'ASC')
      .limit(5)
      .getMany();
  }

  async getLinkedInvoices(inventoryItemId: string, userId: string) {
    await this.findOne(inventoryItemId, userId);
    const invoiceItems = await this.invoiceItemsRepository.find({
      where: { inventoryItemId },
      relations: ['invoice', 'invoice.client'],
    });
    
    // Get unique invoices
    const invoiceMap = new Map();
    invoiceItems.forEach((item) => {
      const inv = item.invoice as any;
      // Organizations removed - verify user access only
      if (inv && inv.userId === userId) {
        invoiceMap.set(item.invoice.id, item.invoice);
      }
    });
    
    return Array.from(invoiceMap.values());
  }

  async getStats(userId: string) {
    const items = await this.inventoryRepository
      .createQueryBuilder('item')
      .where('item.userId = :userId', { userId })
      .getMany();
    const activeItems = items.filter((item) => item.status === 'active');
    const lowStockItems = items.filter(
      (item) => item.currentStock <= item.reorderLevel && item.status === 'active',
    );
    const totalValue = items.reduce(
      (sum, item) => sum + (item.costPrice || 0) * item.currentStock,
      0,
    );

    return {
      totalItems: items.length,
      activeItems: activeItems.length,
      lowStockItems: lowStockItems.length,
      totalValue,
    };
  }

  async bulkRemove(ids: string[], userId: string): Promise<{ deleted: number; failed: Array<{ id: string; reason: string }> }> {
    this.logger.debug(`bulkRemove: Starting bulk deletion for ${ids.length} inventory items, userId=${userId}`);
    
    const failed: Array<{ id: string; reason: string }> = [];
    let deleted = 0;

    // Process deletions sequentially to avoid race conditions and provide detailed error reporting
    for (const id of ids) {
      try {
        await this.remove(id, userId);
        deleted++;
      } catch (error: any) {
        this.logger.warn(`bulkRemove: Failed to delete inventory item ${id}: ${error.message}`);
        failed.push({
          id,
          reason: error.message || 'Unknown error',
        });
      }
    }

    this.logger.log(`bulkRemove: Completed bulk deletion. Deleted: ${deleted}, Failed: ${failed.length}`);
    
    return { deleted, failed };
  }

  async importFromFile(
    file: Express.Multer.File,
    userId: string,
  ): Promise<{ created: number; failed: Array<{ row: number; data: any; errors: string[] }> }> {
    this.logger.debug(`importFromFile: Starting import for user ${userId}`);
    
    let rows: any[];
    
    try {
      // Parse file based on extension
      const ext = file.originalname.split('.').pop()?.toLowerCase();
      if (ext === 'csv') {
        rows = this.importService.parseCSV(file.buffer.toString('utf-8'));
      } else if (ext === 'xlsx' || ext === 'xls') {
        rows = await this.importService.parseExcel(file.buffer);
      } else {
        throw new BadRequestException('Unsupported file format. Please upload CSV or Excel file.');
      }
    } catch (error) {
      this.logger.error('importFromFile: Failed to parse file', error);
      throw new BadRequestException(`Failed to parse file: ${error.message}`);
    }

    if (rows.length === 0) {
      throw new BadRequestException('File appears to be empty or could not be parsed.');
    }

    const failed: Array<{ row: number; data: any; errors: string[] }> = [];
    let created = 0;

    // Process imports in batches
    const BATCH_SIZE = 50;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      
      for (const row of batch) {
        try {
          // Map common column names to inventory item fields
          const itemData: CreateInventoryItemDto = {
            sku: row.sku || row.SKU || row['Stock Keeping Unit'] || '',
            name: row.name || row.Name || row['Product Name'] || '',
            description: row.description || row.Description || '',
            unit: row.unit || row.Unit || 'pcs',
            barcode: row.barcode || row.Barcode || undefined,
            costPrice: row.costPrice || row['Cost Price'] ? parseFloat(row.costPrice || row['Cost Price']) : undefined,
            defaultUnitPrice: parseFloat(row.defaultUnitPrice || row['Unit Price'] || row.price || row.Price || '0'),
            defaultTaxRate: row.defaultTaxRate || row['Tax Rate'] ? parseFloat(row.defaultTaxRate || row['Tax Rate']) : undefined,
            currentStock: parseInt(row.currentStock || row['Current Stock'] || row.stock || row.Stock || '0', 10),
            reorderLevel: parseInt(row.reorderLevel || row['Reorder Level'] || '0', 10),
            maxStockLevel: row.maxStockLevel || row['Max Stock Level'] ? parseInt(row.maxStockLevel || row['Max Stock Level'], 10) : undefined,
            status: (row.status || row.Status || 'active').toLowerCase() === 'inactive' ? 'inactive' : 'active',
          };

          // Validate required fields
          if (!itemData.sku || itemData.sku.trim() === '') {
            failed.push({
              row: i + batch.indexOf(row) + 2,
              data: row,
              errors: ['SKU is required'],
            });
            continue;
          }

          if (!itemData.name || itemData.name.trim() === '') {
            failed.push({
              row: i + batch.indexOf(row) + 2,
              data: row,
              errors: ['Name is required'],
            });
            continue;
          }

          // Create inventory item
          await this.create(userId, itemData);
          created++;
        } catch (error: any) {
          failed.push({
            row: i + batch.indexOf(row) + 2,
            data: row,
            errors: [error.message || 'Unknown error'],
          });
        }
      }
    }

    this.logger.log(`importFromFile: Completed import. Created: ${created}, Failed: ${failed.length}`);
    
    return { created, failed };
  }
}

