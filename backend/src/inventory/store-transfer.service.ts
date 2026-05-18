import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Store } from './entities/store.entity';
import { InventoryItem } from './entities/inventory-item.entity';
import { StoreItemSettings } from './entities/store-item-settings.entity';
import { StockMovement } from './entities/stock-movement.entity';
import { StoreItemSettingsService } from './store-item-settings.service';
import { InventoryService } from './inventory.service';
import { CreateStoreTransferDto } from './dto/store-transfer.dto';
// Organizations removed - buildOrgScopedWhere no longer needed

@Injectable()
export class StoreTransferService {
  private readonly logger = new Logger(StoreTransferService.name);

  constructor(
    @InjectRepository(Store)
    private storeRepository: Repository<Store>,
    @InjectRepository(InventoryItem)
    private inventoryItemRepository: Repository<InventoryItem>,
    @InjectRepository(StockMovement)
    private stockMovementRepository: Repository<StockMovement>,
    private storeItemSettingsService: StoreItemSettingsService,
    private inventoryService: InventoryService,
    private dataSource: DataSource,
  ) {}

  /**
   * Transfer stock from one store to another
   * Creates two stock movements atomically (decrease at source, increase at destination)
   */
  async transferStock(
    userId: string,
    transferData: CreateStoreTransferDto,
  ): Promise<{ success: boolean; fromMovement: StockMovement; toMovement: StockMovement }> {
    const { fromStoreId, toStoreId, inventoryItemId, quantity, note } = transferData;

    // Validate stores are different
    if (fromStoreId === toStoreId) {
      throw new BadRequestException('Source and destination stores must be different');
    }

    // Organizations removed - validate stores belong to user and are not deleted
    const fromStore = await this.storeRepository
      .createQueryBuilder('store')
      .where('store.id = :fromStoreId', { fromStoreId })
      .andWhere('store.userId = :userId', { userId })
      .andWhere('store.deletedAt IS NULL') // CRITICAL: Exclude soft-deleted stores
      .getOne();

    if (!fromStore) {
      throw new NotFoundException(`Source store with ID "${fromStoreId}" not found or has been deleted`);
    }

    const toStore = await this.storeRepository
      .createQueryBuilder('store')
      .where('store.id = :toStoreId', { toStoreId })
      .andWhere('store.userId = :userId', { userId })
      .andWhere('store.deletedAt IS NULL') // CRITICAL: Exclude soft-deleted stores
      .getOne();

    if (!toStore) {
      throw new NotFoundException(`Destination store with ID "${toStoreId}" not found or has been deleted`);
    }

    // Organizations removed - validate inventory item belongs to user
    const inventoryItem = await this.inventoryItemRepository
      .createQueryBuilder('item')
      .where('item.id = :inventoryItemId', { inventoryItemId })
      .andWhere('item.userId = :userId', { userId })
      .getOne();

    if (!inventoryItem) {
      throw new NotFoundException(`Inventory item with ID "${inventoryItemId}" not found`);
    }

    // Check available stock at source store
    const sourceSettings = await this.storeItemSettingsService.getOrCreateSettings(
      fromStoreId,
      inventoryItemId,
      userId,
      // Organizations removed - no organizationId needed
    );

    if ((sourceSettings.currentStock || 0) < quantity) {
      throw new BadRequestException(
        `Insufficient stock at source store. Available: ${sourceSettings.currentStock || 0}, Required: ${quantity}`,
      );
    }

    // Use transaction to ensure atomicity
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Decrease stock at source store
      await this.storeItemSettingsService.adjustStoreStock(
        fromStoreId,
        inventoryItemId,
        quantity,
        userId,
        'decrease',
      );

      // Create stock movement for source (decrease)
      const fromMovement = this.stockMovementRepository.create({
        inventoryItemId,
        userId,
        storeId: fromStoreId,
        type: 'adjustment',
        quantity: -quantity,
        sourceType: 'manual',
        sourceId: `transfer-${Date.now()}`,
        note: note || `Transfer to ${toStore.name} (${toStore.code})`,
      });
      const savedFromMovement = await queryRunner.manager.save(StockMovement, fromMovement);

      // Increase stock at destination store
      await this.storeItemSettingsService.adjustStoreStock(
        toStoreId,
        inventoryItemId,
        quantity,
        userId,
        'increase',
      );

      // Create stock movement for destination (increase)
      const toMovement = this.stockMovementRepository.create({
        inventoryItemId,
        userId,
        storeId: toStoreId,
        type: 'adjustment',
        quantity,
        sourceType: 'manual',
        sourceId: `transfer-${Date.now()}`,
        note: note || `Transfer from ${fromStore.name} (${fromStore.code})`,
      });
      const savedToMovement = await queryRunner.manager.save(StockMovement, toMovement);

      // Commit transaction
      await queryRunner.commitTransaction();

      this.logger.log(
        `Stock transfer completed: ${quantity} units of ${inventoryItem.name} from ${fromStore.name} to ${toStore.name}`,
      );

      return {
        success: true,
        fromMovement: savedFromMovement,
        toMovement: savedToMovement,
      };
    } catch (error) {
      // Rollback transaction on error
      await queryRunner.rollbackTransaction();
      this.logger.error(`Stock transfer failed: ${error.message}`, error);
      throw error;
    } finally {
      // Release query runner
      await queryRunner.release();
    }
  }
}

