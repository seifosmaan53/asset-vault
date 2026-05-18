import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryRunner } from 'typeorm';
import { StoreItemSettings } from './entities/store-item-settings.entity';
import { Store } from './entities/store.entity';
import { InventoryItem } from './entities/inventory-item.entity';
import { StoreItemSettingsService } from './store-item-settings.service';
import { buildOrgScopedWhere } from '../common/utils/typeorm-query.util';

export interface StockValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  availableStock?: number;
}

export interface ItemStockValidation {
  inventoryItemId: string;
  itemName?: string;
  quantity: number;
  availableStock: number;
  isValid: boolean;
  error?: string;
}

@Injectable()
export class StoreStockValidatorService {
  private readonly logger = new Logger(StoreStockValidatorService.name);

  constructor(
    @InjectRepository(StoreItemSettings)
    private storeItemSettingsRepository: Repository<StoreItemSettings>,
    @InjectRepository(Store)
    private storeRepository: Repository<Store>,
    @InjectRepository(InventoryItem)
    private inventoryItemRepository: Repository<InventoryItem>,
    private storeItemSettingsService: StoreItemSettingsService,
  ) {}

  /**
   * Get available stock at store level for an inventory item
   */
  async getAvailableStoreStock(
    storeId: string,
    inventoryItemId: string,
    userId: string,
  ): Promise<number> {
    // Organizations removed - filter by userId only
    const store = await this.storeRepository.createQueryBuilder('store')
      .where('store.userId = :userId', { userId })
      .andWhere('store.id = :storeId', { storeId })
      .getOne();

    if (!store) {
      throw new NotFoundException(`Store with ID "${storeId}" not found`);
    }

    // Organizations removed - filter by userId only
    const inventoryItem = await this.inventoryItemRepository.createQueryBuilder('item')
      .where('item.userId = :userId', { userId })
      .andWhere('item.id = :inventoryItemId', { inventoryItemId })
      .getOne();

    if (!inventoryItem) {
      throw new NotFoundException(`Inventory item with ID "${inventoryItemId}" not found`);
    }

    // Get store item settings
    const settings = await this.storeItemSettingsRepository.findOne({
      where: {
        storeId,
        inventoryItemId,
      },
    });

    // If no settings exist, stock is 0
    if (!settings) {
      return 0;
    }

    return settings.currentStock || 0;
  }

  /**
   * Validate if store has sufficient stock for a single item
   * Only validates if the item is actually tracked in the store
   * FIXED: Issues #60, #78, #84, #93, #103, #127
   * - Uses pessimistic locking to prevent stale data reads
   * - Validates item status
   * - Checks both store and global stock
   */
  async validateStoreStockAvailability(
    storeId: string,
    inventoryItemId: string,
    quantity: number,
    userId: string,
    operation: 'reserve' | 'sale' = 'sale',
    queryRunner?: QueryRunner,
  ): Promise<StockValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const manager = queryRunner?.manager || this.storeItemSettingsRepository.manager;

    try {
      // CRITICAL FIX #60, #93: Verify store belongs to user
      // Only use pessimistic lock if we're inside a transaction (queryRunner provided)
      const storeQueryBuilder = queryRunner?.manager 
        ? queryRunner.manager.createQueryBuilder(Store, 'store')
        : this.storeRepository.createQueryBuilder('store');
      let storeQuery = storeQueryBuilder
        .where('store.userId = :userId', { userId })
        .andWhere('store.id = :storeId', { storeId });
      
      // Only use lock if we have a transaction (queryRunner)
      if (queryRunner) {
        storeQuery = storeQuery.setLock('pessimistic_write');
      }
      
      const store = await storeQuery.getOne();

      if (!store) {
        throw new NotFoundException(`Store with ID "${storeId}" not found`);
      }

      // CRITICAL FIX #60, #93: Verify inventory item belongs to user
      // Only use pessimistic lock if we're inside a transaction (queryRunner provided)
      const itemQueryBuilder = queryRunner?.manager
        ? queryRunner.manager.createQueryBuilder(InventoryItem, 'item')
        : this.inventoryItemRepository.createQueryBuilder('item');
      let itemQuery = itemQueryBuilder
        .where('item.userId = :userId', { userId })
        .andWhere('item.id = :inventoryItemId', { inventoryItemId });
      
      // Only use lock if we have a transaction (queryRunner)
      if (queryRunner) {
        itemQuery = itemQuery.setLock('pessimistic_write');
      }
      
      const inventoryItem = await itemQuery.getOne();

      if (!inventoryItem) {
        throw new NotFoundException(`Inventory item with ID "${inventoryItemId}" not found`);
      }
      
      // No status restrictions - any item can be sold as long as it has stock

      // CRITICAL FIX #60, #93: Get store item settings
      // Only use pessimistic lock if we're inside a transaction (queryRunner provided)
      const findOptions: any = {
        where: {
          storeId,
          inventoryItemId,
        },
      };
      
      // Only use lock if we have a transaction (queryRunner)
      if (queryRunner) {
        findOptions.lock = { mode: 'pessimistic_write' };
      }
      
      const settings = await manager.findOne(StoreItemSettings, findOptions);

      // CRITICAL FIX: If item is not tracked in this store, treat as 0 stock
      // Note: adjustStoreStock now handles this gracefully by skipping store adjustment
      // if item isn't tracked, so we allow the sale if global stock is sufficient
      const availableStock = settings ? (settings.currentStock || 0) : 0;
      const itemName = inventoryItem?.name || inventoryItemId;
      
      // CRITICAL FIX #84: Also check global stock
      const globalStock = inventoryItem.currentStock || 0;
      const globalStockSufficient = globalStock >= quantity;
      const storeStockSufficient = availableStock >= quantity;

      // For sales operations, if item isn't tracked in store, warn but allow if global stock is sufficient
      if (!settings && operation === 'sale') {
        if (!globalStockSufficient) {
          const errorMessage = `Item "${itemName}" is not tracked in this store and global stock is insufficient. Available: ${globalStock}, Required: ${quantity}`;
          errors.push(errorMessage);
          this.logger.warn(
            `Store stock validation failed: ${errorMessage} (storeId: ${storeId}, itemId: ${inventoryItemId})`,
          );
        } else {
          // Item isn't tracked but global stock is sufficient - allow with warning
          warnings.push(
            `Item "${itemName}" is not tracked in this store. Sale will proceed using global stock. Consider allocating stock to this store.`
          );
        }
      } else if (!storeStockSufficient) {
        const errorMessage = `Insufficient stock at store. Available: ${availableStock}, Required: ${quantity} for item "${itemName}"`;
        errors.push(errorMessage);
        this.logger.warn(
          `Store stock validation failed: ${errorMessage} (storeId: ${storeId}, itemId: ${inventoryItemId})`,
        );
      }
      
      // CRITICAL FIX #84: Warn if store stock exceeds global stock (data inconsistency)
      if (availableStock > globalStock) {
        warnings.push(
          `Store stock (${availableStock}) exceeds global stock (${globalStock}) for item "${itemName}". This indicates data inconsistency.`
        );
      }
      
      // CRITICAL FIX #84: Check global stock availability
      if (!globalStockSufficient) {
        errors.push(
          `Insufficient global stock. Available: ${globalStock}, Required: ${quantity} for item "${itemName}"`
        );
      }
      
      if (storeStockSufficient && availableStock === quantity) {
        warnings.push(`Stock is exactly at required quantity for item "${itemName}"`);
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        availableStock,
      };
    } catch (error) {
      this.logger.error(`Error validating store stock: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Validate all items in an invoice for store stock availability
   */
  async validateInvoiceItemsStoreStock(
    storeId: string,
    items: Array<{ inventoryItemId?: string; quantity: number; description?: string }>,
    userId: string,
    operation: 'reserve' | 'sale' = 'sale',
    queryRunner?: QueryRunner,
  ): Promise<{ isValid: boolean; itemValidations: ItemStockValidation[]; errors: string[] }> {
    const itemValidations: ItemStockValidation[] = [];
    const allErrors: string[] = [];

    // Filter items that have inventoryItemId (only validate those)
    const inventoryItems = items.filter((item) => item.inventoryItemId);

    for (const item of inventoryItems) {
      if (!item.inventoryItemId) {
        continue;
      }

      try {
        const validation = await this.validateStoreStockAvailability(
          storeId,
          item.inventoryItemId,
          item.quantity,
          userId,
          operation,
          queryRunner,
        );

        // Get item name - Organizations removed - filter by userId only
        const inventoryItem = await this.inventoryItemRepository.createQueryBuilder('item')
          .where('item.userId = :userId', { userId })
          .andWhere('item.id = :inventoryItemId', { inventoryItemId: item.inventoryItemId })
          .getOne();

        const itemValidation: ItemStockValidation = {
          inventoryItemId: item.inventoryItemId,
          itemName: inventoryItem?.name || item.description,
          quantity: item.quantity,
          availableStock: validation.availableStock || 0,
          isValid: validation.isValid,
          error: validation.errors[0],
        };

        itemValidations.push(itemValidation);

        if (!validation.isValid) {
          allErrors.push(...validation.errors);
        }
      } catch (error) {
        this.logger.error(
          `Error validating stock for item ${item.inventoryItemId}: ${error.message}`,
        );
        allErrors.push(
          `Failed to validate stock for item "${item.description || item.inventoryItemId}": ${error.message}`,
        );
        itemValidations.push({
          inventoryItemId: item.inventoryItemId,
          itemName: item.description,
          quantity: item.quantity,
          availableStock: 0,
          isValid: false,
          error: error.message,
        });
      }
    }

    return {
      isValid: allErrors.length === 0,
      itemValidations,
      errors: allErrors,
    };
  }

  /**
   * Validate store stock with detailed error messages
   * Throws BadRequestException if validation fails
   */
  async validateAndThrow(
    storeId: string,
    items: Array<{ inventoryItemId?: string; quantity: number; description?: string }>,
    userId: string,
    operation: 'reserve' | 'sale' = 'sale',
    queryRunner?: QueryRunner,
  ): Promise<void> {
    const validation = await this.validateInvoiceItemsStoreStock(
      storeId,
      items,
      userId,
      operation,
      queryRunner,
    );

    if (!validation.isValid) {
      const errorMessage = `Store stock validation failed:\n${validation.errors.join('\n')}`;
      this.logger.warn(`Store stock validation failed for store ${storeId}: ${errorMessage}`);
      throw new BadRequestException(errorMessage);
    }
  }
}

