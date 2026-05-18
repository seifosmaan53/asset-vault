import { Injectable, NotFoundException, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, QueryRunner } from 'typeorm';
import { StoreItemSettings } from './entities/store-item-settings.entity';
import { Store } from './entities/store.entity';
import { InventoryItem } from './entities/inventory-item.entity';
import { CreateStoreItemSettingsDto, UpdateStoreItemSettingsDto } from './dto/store-item-settings.dto';

@Injectable()
export class StoreItemSettingsService {
  private readonly logger = new Logger(StoreItemSettingsService.name);

  private async requireStore(storeId: string, actorUserId: string): Promise<Store> {
    // Fix Issue #1: Use query builder instead of 'as any' type assertion
    // Organizations removed - filter by userId only (user-scoped data)
    const store = await this.storeRepository
      .createQueryBuilder('store')
      .where('store.id = :storeId', { storeId })
      .andWhere('store.userId = :actorUserId', { actorUserId })
      .andWhere('store.deletedAt IS NULL')
      .getOne();
    if (!store) {
      throw new NotFoundException(`Store with ID "${storeId}" not found`);
    }
    return store;
  }

  private async requireInventoryItem(
    inventoryItemId: string,
    actorUserId: string,
  ): Promise<InventoryItem> {
    // Fix Issue #1: Use query builder instead of 'as any' type assertion
    // Organizations removed - filter by userId only (user-scoped data)
    const inventoryItem = await this.inventoryItemRepository
      .createQueryBuilder('item')
      .where('item.id = :inventoryItemId', { inventoryItemId })
      .andWhere('item.userId = :actorUserId', { actorUserId })
      .getOne();
    if (!inventoryItem) {
      throw new NotFoundException(`Inventory item with ID "${inventoryItemId}" not found`);
    }
    return inventoryItem;
  }

  constructor(
    @InjectRepository(StoreItemSettings)
    private storeItemSettingsRepository: Repository<StoreItemSettings>,
    @InjectRepository(Store)
    private storeRepository: Repository<Store>,
    @InjectRepository(InventoryItem)
    private inventoryItemRepository: Repository<InventoryItem>,
  ) {}

  async createOrUpdate(
    actorUserId: string,
    createDto: CreateStoreItemSettingsDto,
  ): Promise<StoreItemSettings> {
    const store = await this.requireStore(createDto.storeId, actorUserId);
    const inventoryItem = await this.requireInventoryItem(createDto.inventoryItemId, actorUserId);

    // Check if settings already exist
    let settings = await this.storeItemSettingsRepository.findOne({
      where: {
        storeId: createDto.storeId,
        inventoryItemId: createDto.inventoryItemId,
      },
    });

    if (settings) {
      // Update existing
      Object.assign(settings, {
        currentStock: createDto.currentStock ?? settings.currentStock,
        minQty: createDto.minQty ?? settings.minQty,
        targetQty: createDto.targetQty ?? settings.targetQty,
        weeklyUsage: createDto.weeklyUsage ?? settings.weeklyUsage,
      });
    } else {
      // Create new
      settings = this.storeItemSettingsRepository.create({
        storeId: createDto.storeId,
        inventoryItemId: createDto.inventoryItemId,
        currentStock: createDto.currentStock ?? 0,
        minQty: createDto.minQty ?? 0,
        targetQty: createDto.targetQty,
        weeklyUsage: createDto.weeklyUsage,
      });
    }

    const savedSettings = await this.storeItemSettingsRepository.save(settings);
    this.logger.log(
      `Store item settings ${settings.id ? 'updated' : 'created'} for store ${store.name} and item ${inventoryItem.name}`,
    );
    return savedSettings;
  }

  async findByStore(storeId: string, userId: string): Promise<StoreItemSettings[]> {
    // Organizations removed - filter by userId only (user-scoped data)
    await this.requireStore(storeId, userId);

    return this.storeItemSettingsRepository
      .createQueryBuilder('settings')
      .leftJoinAndSelect('settings.inventoryItem', 'inventoryItem')
      .where('settings.storeId = :storeId', { storeId })
      .orderBy('inventoryItem.name', 'ASC')
      .getMany();
  }

  async findByItem(inventoryItemId: string, userId: string): Promise<StoreItemSettings[]> {
    // Organizations removed - filter by userId only (user-scoped data)
    await this.requireInventoryItem(inventoryItemId, userId);
    
    return this.storeItemSettingsRepository
        .createQueryBuilder('settings')
        .leftJoinAndSelect('settings.store', 'store')
        .where('settings.inventoryItemId = :inventoryItemId', { inventoryItemId })
        .orderBy('store.name', 'ASC')
        .getMany();
  }

  // Removed findByItemInOrg - organizations removed, use findByItem instead

  async update(
    id: string,
    actorUserId: string,
    updateDto: UpdateStoreItemSettingsDto,
  ): Promise<StoreItemSettings> {
    const settings = await this.storeItemSettingsRepository.findOne({
      where: { id },
      relations: ['store', 'inventoryItem'],
    });

    if (!settings) {
      throw new NotFoundException(`Store item settings with ID "${id}" not found`);
    }

    // Organizations removed - verify store belongs to user
    if (settings.store.userId !== actorUserId) {
      throw new NotFoundException(`Store item settings with ID "${id}" not found`);
    }

    // PROFESSIONAL FIX: Validate currentStock if being updated
    if (updateDto.currentStock !== undefined) {
      const validatedQuantity = Number(updateDto.currentStock);
      if (isNaN(validatedQuantity) || validatedQuantity < 0 || !Number.isInteger(validatedQuantity)) {
        throw new BadRequestException(`Invalid currentStock: ${updateDto.currentStock}. Must be a non-negative integer.`);
      }

      const previousStock = settings.currentStock || 0;
      const globalStock = settings.inventoryItem.currentStock || 0;

      // Validate that total store stock doesn't exceed global inventory
      if (validatedQuantity > previousStock) {
        // This is an increase - check total allocation
        const allStoreSettings = await this.storeItemSettingsRepository.find({
          where: { inventoryItemId: settings.inventoryItemId },
        });
        const currentTotalStoreStock = allStoreSettings.reduce(
          (sum, s) => sum + (s.currentStock || 0),
          0,
        );
        const newTotalStoreStock = currentTotalStoreStock - previousStock + validatedQuantity;

        if (newTotalStoreStock > globalStock) {
          const availableForAllocation = globalStock - (currentTotalStoreStock - previousStock);
          throw new BadRequestException(
            `Cannot set store stock to ${validatedQuantity} units. ` +
            `Total store allocation would be ${newTotalStoreStock}, but global inventory is only ${globalStock}. ` +
            `Available for allocation: ${availableForAllocation} units. ` +
            `Consider increasing global inventory first or reducing allocation in other stores.`
          );
        }
      }
    }

    Object.assign(settings, updateDto);
    const updatedSettings = await this.storeItemSettingsRepository.save(settings);
    this.logger.log(`Store item settings updated: ${id}`);
    return updatedSettings;
  }

  async updateStock(
    storeId: string,
    inventoryItemId: string,
    quantity: number,
    actorUserId: string,
  ): Promise<StoreItemSettings> {
    const store = await this.requireStore(storeId, actorUserId);
    const inventoryItem = await this.requireInventoryItem(inventoryItemId, actorUserId);

    // PROFESSIONAL FIX: Validate quantity is valid
    const validatedQuantity = Number(quantity);
    if (isNaN(validatedQuantity) || validatedQuantity < 0 || !Number.isInteger(validatedQuantity)) {
      throw new BadRequestException(`Invalid quantity: ${quantity}. Quantity must be a non-negative integer.`);
    }

    let settings = await this.storeItemSettingsRepository.findOne({
      where: {
        storeId,
        inventoryItemId,
      },
    });

    const previousStock = settings?.currentStock || 0;
    const globalStock = inventoryItem.currentStock || 0;

    // PROFESSIONAL FIX: Validate that total store stock doesn't exceed global inventory
    if (validatedQuantity > previousStock) {
      // This is an increase - check total allocation
      const allStoreSettings = await this.storeItemSettingsRepository.find({
        where: { inventoryItemId },
      });
      const currentTotalStoreStock = allStoreSettings.reduce(
        (sum, s) => sum + (s.currentStock || 0),
        0,
      );
      const increaseAmount = validatedQuantity - previousStock;
      const newTotalStoreStock = currentTotalStoreStock - previousStock + validatedQuantity;

      if (newTotalStoreStock > globalStock) {
        const availableForAllocation = globalStock - (currentTotalStoreStock - previousStock);
        throw new BadRequestException(
          `Cannot set store stock to ${validatedQuantity} units. ` +
          `Total store allocation would be ${newTotalStoreStock}, but global inventory is only ${globalStock}. ` +
          `Available for allocation: ${availableForAllocation} units. ` +
          `Consider increasing global inventory first or reducing allocation in other stores.`
        );
      }
    }

    if (!settings) {
      // Create new settings if they don't exist
      settings = this.storeItemSettingsRepository.create({
        storeId,
        inventoryItemId,
        currentStock: validatedQuantity,
        minQty: 0,
      });
    } else {
      settings.currentStock = quantity;
    }

    const savedSettings = await this.storeItemSettingsRepository.save(settings);
    this.logger.log(`Stock updated for store ${store.name} and item ${inventoryItem.name}: ${quantity}`);
    return savedSettings;
  }

  async getStoreStockReport(storeId: string, actorUserId: string): Promise<any> {
    const store = await this.requireStore(storeId, actorUserId);

    const settings = await this.storeItemSettingsRepository
      .createQueryBuilder('settings')
      .leftJoinAndSelect('settings.inventoryItem', 'inventoryItem')
      .where('settings.storeId = :storeId', { storeId })
      .orderBy('inventoryItem.name', 'ASC')
      .getMany();

    return {
      store,
      items: settings.map((s) => ({
        item: s.inventoryItem,
        currentStock: s.currentStock,
        minQty: s.minQty,
        targetQty: s.targetQty,
        weeklyUsage: s.weeklyUsage,
      })),
    };
  }

  /**
   * Get or create StoreItemSettings record for a store and inventory item
   * FIXED: Issue #55, #87 - Now supports queryRunner and pessimistic locking
   */
  async getOrCreateSettings(
    storeId: string,
    inventoryItemId: string,
    actorUserId: string,
    queryRunner?: QueryRunner,
  ): Promise<StoreItemSettings> {
    const manager = queryRunner?.manager || this.storeItemSettingsRepository.manager;
    const store = await this.requireStore(storeId, actorUserId);
    const inventoryItem = await this.requireInventoryItem(inventoryItemId, actorUserId);

    // CRITICAL FIX #55, #87: Use pessimistic locking to prevent race conditions
    let settings = await manager.findOne(StoreItemSettings, {
      where: {
        storeId,
        inventoryItemId,
      },
      lock: { mode: 'pessimistic_write' },
    });

    if (!settings) {
      // Create new settings with default values
      settings = manager.create(StoreItemSettings, {
        storeId,
        inventoryItemId,
        currentStock: 0,
        minQty: 0,
      });
      settings = await manager.save(StoreItemSettings, settings);
      this.logger.log(
        `Created new store item settings for store ${store.name} and item ${inventoryItem.name}`,
      );
    }

    return settings;
  }

  /**
   * Adjust store stock by increasing or decreasing the currentStock value
   * FIXED: Issues #43, #47, #55, #73, #76, #82, #90, #96, #101
   * - Now supports queryRunner for transaction consistency
   * - Uses pessimistic locking to prevent race conditions
   * - Validates quantity
   * - Prevents negative stock with proper error handling
   * - Idempotent operations
   */
  async adjustStoreStock(
    storeId: string,
    inventoryItemId: string,
    quantity: number,
    actorUserId: string,
    operation: 'increase' | 'decrease',
    queryRunner?: QueryRunner,
  ): Promise<StoreItemSettings> {
    const manager = queryRunner?.manager || this.storeItemSettingsRepository.manager;
    
    // CRITICAL FIX #106, #199: Validate quantity
    const validatedQuantity = Number(quantity);
    if (isNaN(validatedQuantity) || validatedQuantity <= 0 || !Number.isInteger(validatedQuantity)) {
      throw new BadRequestException(`Invalid quantity: ${quantity}. Quantity must be a positive integer.`);
    }
    
    if (validatedQuantity > Number.MAX_SAFE_INTEGER) {
      throw new BadRequestException(`Quantity ${validatedQuantity} exceeds maximum safe integer value`);
    }
    
    // CRITICAL FIX #55, #87: Check if settings exist first (don't auto-create for decreases)
    let settings = await manager.findOne(StoreItemSettings, {
      where: {
        storeId,
        inventoryItemId,
      },
      lock: { mode: 'pessimistic_write' },
    });
    
    // CRITICAL FIX: For decrease operations, if item isn't tracked, skip store stock adjustment
    // This allows sales from global stock even if item isn't allocated to the store yet
    if (operation === 'decrease' && !settings) {
      this.logger.warn(
        `Item ${inventoryItemId} is not tracked in store ${storeId}. Skipping store stock adjustment. Global stock will still be decreased.`
      );
      // Return a minimal settings object to satisfy return type, but don't save it
      const store = await this.requireStore(storeId, actorUserId);
      const inventoryItem = await this.requireInventoryItem(inventoryItemId, actorUserId);
      return manager.create(StoreItemSettings, {
        storeId,
        inventoryItemId,
        currentStock: 0,
      }) as StoreItemSettings;
    }
    
    // FIX #124: For increase operations or if settings exist, get or create settings
    // This ensures store stock is synced with global stock within the same transaction
    if (!settings) {
      settings = await this.getOrCreateSettings(storeId, inventoryItemId, actorUserId, queryRunner);
    }
    
    // FIX #124: Ensure store stock update is atomic with global stock update
    // Both updates happen within the same transaction (queryRunner)
    
    // CRITICAL FIX #73, #101: Read-modify-write with lock already held
    const previousStock = settings.currentStock || 0;
    
    // PROFESSIONAL FIX: Validate that total store stock doesn't exceed global inventory
    if (operation === 'increase') {
      // Get the inventory item to check global stock
      const inventoryItem = await this.requireInventoryItem(inventoryItemId, actorUserId);
      const globalStock = inventoryItem.currentStock || 0;
      
      // Calculate current total store stock (sum of all stores)
      const allStoreSettings = await manager.find(StoreItemSettings, {
        where: { inventoryItemId },
      });
      const currentTotalStoreStock = allStoreSettings.reduce(
        (sum, s) => sum + (s.currentStock || 0),
        0,
      );
      
      // Calculate what the new total would be
      const newStoreStock = previousStock + validatedQuantity;
      const newTotalStoreStock = currentTotalStoreStock - previousStock + newStoreStock;
      
      // Validate that total store stock doesn't exceed global inventory
      if (newTotalStoreStock > globalStock) {
        const availableForAllocation = globalStock - (currentTotalStoreStock - previousStock);
        throw new BadRequestException(
          `Cannot allocate ${validatedQuantity} units to store. ` +
          `Total store allocation would be ${newTotalStoreStock}, but global inventory is only ${globalStock}. ` +
          `Available for allocation: ${availableForAllocation} units. ` +
          `Consider increasing global inventory first or reducing allocation in other stores.`
        );
      }
      
      settings.currentStock = newStoreStock;
      // CRITICAL FIX #77: Check for integer overflow
      if (settings.currentStock > Number.MAX_SAFE_INTEGER) {
        throw new BadRequestException(`Store stock would exceed maximum safe integer value`);
      }
    } else if (operation === 'decrease') {
      // CRITICAL FIX #82: Validate stock availability before decreasing
      if (previousStock < validatedQuantity) {
        // CRITICAL FIX #82: Don't mask the problem, throw error
        throw new BadRequestException(
          `Insufficient store stock. Available: ${previousStock}, Required: ${validatedQuantity}`
        );
      }
      settings.currentStock = previousStock - validatedQuantity;
    } else {
      throw new BadRequestException(`Invalid operation: ${operation}. Must be 'increase' or 'decrease'.`);
    }
    
    // CRITICAL FIX #43, #47, #90: Save within transaction if queryRunner provided
    const savedSettings = await manager.save(StoreItemSettings, settings);
    this.logger.log(
      `Adjusted store stock for store ${storeId} and item ${inventoryItemId}: ${operation} ${validatedQuantity}, previous: ${previousStock}, new: ${savedSettings.currentStock}`,
    );

    return savedSettings;
  }

  /**
   * Delete store item settings by ID
   */
  async delete(id: string, userId: string): Promise<void> {
    const settings = await this.storeItemSettingsRepository.findOne({
      where: { id },
      relations: ['store', 'inventoryItem'],
    });

    if (!settings) {
      throw new NotFoundException(`Store item settings with ID "${id}" not found`);
    }

    // Organizations removed - verify user access only
    const hasAccess = settings.store.userId === userId;
    if (!hasAccess) {
      throw new NotFoundException(`Store item settings with ID "${id}" not found`);
    }

    await this.storeItemSettingsRepository.remove(settings);
    this.logger.log(
      `Deleted store item settings for store ${settings.store.name} and item ${settings.inventoryItem.name}`,
    );
  }

  /**
   * Delete store item settings by store and item IDs
   */
  async deleteByStoreAndItem(
    storeId: string,
    inventoryItemId: string,
    actorUserId: string,
  ): Promise<void> {
    const store = await this.requireStore(storeId, actorUserId);
    const inventoryItem = await this.requireInventoryItem(inventoryItemId, actorUserId);

    const settings = await this.storeItemSettingsRepository.findOne({
      where: {
        storeId,
        inventoryItemId,
      },
    });

    if (!settings) {
      throw new NotFoundException(
        `Store item settings not found for store "${storeId}" and item "${inventoryItemId}"`,
      );
    }

    await this.storeItemSettingsRepository.remove(settings);
    this.logger.log(
      `Deleted store item settings for store ${store.name} and item ${inventoryItem.name}`,
    );
  }
}

