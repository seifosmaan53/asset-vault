import { Injectable, NotFoundException, ConflictException, Logger, Inject, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, DataSource } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { Store } from './entities/store.entity';
import { Client } from '../clients/entities/client.entity';
import { Invoice } from '../invoices/entities/invoice.entity';
import { StoreItemSettings } from './entities/store-item-settings.entity';
import { CreateStoreDto, UpdateStoreDto } from './dto/store.dto';
import { sanitizeEmail, sanitizeString } from '../common/utils/security.util';

@Injectable()
export class StoreService {
  private readonly logger = new Logger(StoreService.name);

  private normalizeCode(code: string): string {
    return sanitizeString(code, 20).toUpperCase();
  }

  private normalizeName(name: string): string {
    return sanitizeString(name, 100);
  }

  constructor(
    @InjectRepository(Store)
    private storeRepository: Repository<Store>,
    @InjectRepository(Client)
    private clientRepository: Repository<Client>,
    @InjectRepository(Invoice)
    private invoiceRepository: Repository<Invoice>,
    @InjectRepository(StoreItemSettings)
    private storeItemSettingsRepository: Repository<StoreItemSettings>,
    @Inject(CACHE_MANAGER)
    private cacheManager: Cache,
    private readonly dataSource: DataSource,
  ) {}

  async create(userId: string, createStoreDto: CreateStoreDto): Promise<Store> {
    // Fix Issue #1: Use query builder instead of 'as any' type assertion
    // Org-shared: validate client exists in org.
    // Safe legacy: allow organizationId IS NULL client only if created by current user.
    const client = await this.clientRepository
      .createQueryBuilder('client')
      .where('client.id = :clientId', { clientId: createStoreDto.clientId })
      .andWhere('client.userId = :userId', { userId })
      .getOne();

    if (!client) {
      throw new NotFoundException(`Client with ID "${createStoreDto.clientId}" not found`);
    }

    const phoneTrimmed = typeof createStoreDto.phone === 'string' ? createStoreDto.phone.trim() : createStoreDto.phone;
    const emailTrimmed = typeof createStoreDto.email === 'string' ? createStoreDto.email.trim() : createStoreDto.email;
    const normalized = {
      ...createStoreDto,
      name: this.normalizeName(createStoreDto.name),
      code: this.normalizeCode(createStoreDto.code),
      phone: phoneTrimmed ? sanitizeString(phoneTrimmed, 50) : undefined,
      email: emailTrimmed ? sanitizeEmail(emailTrimmed) ?? undefined : undefined,
      address: createStoreDto.address ? sanitizeString(createStoreDto.address, 500) : createStoreDto.address,
      city: createStoreDto.city ? sanitizeString(createStoreDto.city, 100) : createStoreDto.city,
      state: createStoreDto.state ? sanitizeString(createStoreDto.state, 100) : createStoreDto.state,
      zip: createStoreDto.zip ? sanitizeString(createStoreDto.zip, 30) : createStoreDto.zip,
      country: createStoreDto.country ? sanitizeString(createStoreDto.country, 100) : createStoreDto.country,
      notes: createStoreDto.notes ? sanitizeString(createStoreDto.notes, 5000) : createStoreDto.notes,
      active: true, // Always active - status toggle removed
    };

    // FIX Issue #10: Use database constraint instead of pre-check to avoid race condition
    // The Store entity has unique indexes: UX_stores_org_code and UX_stores_user_code_legacy
    // We still do a pre-check as an optimization, but rely on database constraint for correctness
    const existingStore = await this.storeRepository
      .createQueryBuilder('store')
      .where('store.code = :code', { code: normalized.code })
      .andWhere('store.deletedAt IS NULL') // Exclude soft-deleted stores
      .andWhere('store.userId = :userId', { userId })
      .getOne();

    if (existingStore) {
      throw new ConflictException(`Store with code "${normalized.code}" already exists`);
    }

    const store = this.storeRepository.create({
      ...normalized,
      userId,
      clientId: createStoreDto.clientId,
    });

    try {
      const savedStore = await this.storeRepository.save(store) as Store;
      this.logger.log(`Store created: ${savedStore.name} (${savedStore.code}) for user ${userId}`);
      
      // Invalidate stores analytics cache
      await this.cacheManager.del('stores-analytics');
      
      return savedStore;
    } catch (error: any) {
      // FIX Issue #10: Handle database constraint violation gracefully
      // This catches race conditions where two requests try to create store with same code
      if (error.code === '23505') {
        // PostgreSQL unique constraint violation
        const constraintName = error.constraint || 'unknown';
        if (constraintName.includes('UX_stores_org_code') || constraintName.includes('UX_stores_user_code_legacy')) {
          throw new ConflictException(
            `Store with code "${normalized.code}" already exists. ` +
            `This may have been created by another request. Please try again with a different code.`
          );
        }
      }
      // Re-throw other errors
      throw error;
    }
  }

  async findAll(userId: string, activeOnly: boolean | undefined): Promise<Store[]> {
    // Fix Issue #1: Use query builder instead of 'as any' type assertion
    // Org-shared visibility + safe legacy.
    // activeOnly parameter is ignored - all stores are always active now
    const query = this.storeRepository
      .createQueryBuilder('store')
      .leftJoinAndSelect('store.client', 'client')
      .where('store.userId = :userId', { userId })
      // CRITICAL: Exclude soft-deleted stores (TypeORM @DeleteDateColumn doesn't auto-filter in query builder)
      .andWhere('store.deletedAt IS NULL');
    
    // All stores are always active - no need to filter by active status
    
    return query.orderBy('store.name', 'ASC').getMany();
  }

  async findOne(id: string, userId: string): Promise<Store> {
    // Fix Issue #1: Use query builder instead of 'as any' type assertion
    const store = await this.storeRepository
      .createQueryBuilder('store')
      .leftJoinAndSelect('store.client', 'client')
      .leftJoinAndSelect('store.itemSettings', 'itemSettings')
      .leftJoinAndSelect('itemSettings.inventoryItem', 'inventoryItem')
      .where('store.id = :id', { id })
      .andWhere('store.userId = :userId', { userId })
      // CRITICAL: Exclude soft-deleted stores (TypeORM @DeleteDateColumn doesn't auto-filter in query builder)
      .andWhere('store.deletedAt IS NULL')
      .getOne();

    if (!store) {
      throw new NotFoundException(`Store with ID "${id}" not found`);
    }

    return store;
  }

  async update(id: string, userId: string, updateStoreDto: UpdateStoreDto): Promise<Store> {
    const store = await this.findOne(id, userId);

    // Validate client if being updated
    if (updateStoreDto.clientId && updateStoreDto.clientId !== store.clientId) {
      // Fix Issue #1: Use query builder instead of 'as any' type assertion
      const client = await this.clientRepository
        .createQueryBuilder('client')
        .where('client.id = :clientId', { clientId: updateStoreDto.clientId })
        .andWhere('client.userId = :userId', { userId })
        .getOne();

      if (!client) {
        throw new NotFoundException(`Client with ID "${updateStoreDto.clientId}" not found`);
      }
    }

    const normalizedUpdate: UpdateStoreDto = { ...updateStoreDto };
    if (normalizedUpdate.name !== undefined) {
      normalizedUpdate.name = normalizedUpdate.name ? this.normalizeName(normalizedUpdate.name) : normalizedUpdate.name;
    }
    if (normalizedUpdate.code !== undefined) {
      normalizedUpdate.code = normalizedUpdate.code ? this.normalizeCode(normalizedUpdate.code) : normalizedUpdate.code;
    }
    if (normalizedUpdate.phone !== undefined) {
      const phoneTrimmed =
        typeof normalizedUpdate.phone === 'string' ? normalizedUpdate.phone.trim() : normalizedUpdate.phone;
      normalizedUpdate.phone = phoneTrimmed ? sanitizeString(phoneTrimmed, 50) : undefined;
    }
    if (normalizedUpdate.email !== undefined) {
      const emailTrimmed =
        typeof normalizedUpdate.email === 'string' ? normalizedUpdate.email.trim() : normalizedUpdate.email;
      normalizedUpdate.email = emailTrimmed ? sanitizeEmail(emailTrimmed) ?? undefined : undefined;
    }
    if (normalizedUpdate.address !== undefined) {
      normalizedUpdate.address = normalizedUpdate.address ? sanitizeString(normalizedUpdate.address, 500) : normalizedUpdate.address;
    }
    if (normalizedUpdate.city !== undefined) {
      normalizedUpdate.city = normalizedUpdate.city ? sanitizeString(normalizedUpdate.city, 100) : normalizedUpdate.city;
    }
    if (normalizedUpdate.state !== undefined) {
      normalizedUpdate.state = normalizedUpdate.state ? sanitizeString(normalizedUpdate.state, 100) : normalizedUpdate.state;
    }
    if (normalizedUpdate.zip !== undefined) {
      normalizedUpdate.zip = normalizedUpdate.zip ? sanitizeString(normalizedUpdate.zip, 30) : normalizedUpdate.zip;
    }
    if (normalizedUpdate.country !== undefined) {
      normalizedUpdate.country = normalizedUpdate.country ? sanitizeString(normalizedUpdate.country, 100) : normalizedUpdate.country;
    }
    if (normalizedUpdate.notes !== undefined) {
      normalizedUpdate.notes = normalizedUpdate.notes ? sanitizeString(normalizedUpdate.notes, 5000) : normalizedUpdate.notes;
    }
    
    // active field is ignored - all stores are always active
    // Remove active from update if present
    if ('active' in normalizedUpdate) {
      delete normalizedUpdate.active;
    }

    // Check if code is being updated and if it conflicts with another store
    if (normalizedUpdate.code && normalizedUpdate.code !== store.code) {
      // Fix Issue #1: Use query builder instead of 'as any' type assertion
      // Organizations removed - filter by userId only (user-scoped data)
      const existingStore = await this.storeRepository
        .createQueryBuilder('store')
        .where('store.code = :code', { code: normalizedUpdate.code })
        .andWhere('store.id != :id', { id })
        .andWhere('store.userId = :userId', { userId })
        .andWhere('store.deletedAt IS NULL')
        .getOne();

      if (existingStore && existingStore.id !== id) {
        throw new ConflictException(`Store with code "${normalizedUpdate.code}" already exists`);
      }
    }

    // Apply all updates (active is always true, so we don't update it)
    Object.assign(store, normalizedUpdate);
    
    // Ensure active is always true (status toggle removed)
    store.active = true;
    const updatedStore = await this.storeRepository.save(store);
    this.logger.log(`Store updated: ${updatedStore.name} (${updatedStore.code}) for user ${userId}`);
    
    // Invalidate stores analytics cache when store is updated (especially active status)
    // This will force fresh data on next request
    await this.cacheManager.del('stores-analytics');
    
    return updatedStore;
  }

  async remove(id: string, userId: string): Promise<void> {
    this.logger.debug(`remove: Starting deletion for store ${id}, userId=${userId}`);
    
    // Validate input
    if (!id || typeof id !== 'string' || id.trim() === '') {
      this.logger.warn(`remove: Invalid store ID provided: ${id}`);
      throw new NotFoundException('Invalid store ID');
    }
    
    // CRITICAL FIX: Use transaction with pessimistic locking to prevent race conditions
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    
    try {
      // First, check if store exists (including soft-deleted) for idempotent deletion
      const anyStore = await queryRunner.manager
        .createQueryBuilder(Store, 'store')
        .withDeleted()
        .where('store.id = :id', { id })
        .getOne();
      
      if (!anyStore) {
        await queryRunner.rollbackTransaction();
        this.logger.warn(`remove: Store ${id} does not exist`);
        throw new NotFoundException('Store not found');
      }
      
      // If already soft-deleted, return early (idempotent operation)
      if (anyStore.deletedAt) {
        await queryRunner.rollbackTransaction();
        this.logger.debug(`remove: Store ${id} is already soft-deleted (deletedAt=${anyStore.deletedAt}), returning early`);
        return; // Idempotent - already deleted, success
      }
      
      // Check access permissions
      if (anyStore.userId !== userId) {
        await queryRunner.rollbackTransaction();
        this.logger.warn(
          `remove: Cannot delete store ${id}: access denied - store.userId=${anyStore.userId}, userId=${userId}`,
        );
        throw new NotFoundException('Store not found or access denied');
      }
      
      // Lock the store row with pessimistic write lock to prevent concurrent modifications
      const store = await queryRunner.manager.findOne(Store, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      
      if (!store) {
        // Store was deleted between our check and lock, or doesn't exist
        await queryRunner.rollbackTransaction();
        this.logger.debug(`remove: Store ${id} not found with lock - may have been deleted concurrently`);
        return; // Idempotent - treat as success if already deleted
      }
      
      // Double-check not already deleted
      if (store.deletedAt) {
        await queryRunner.rollbackTransaction();
        this.logger.debug(`remove: Store ${id} is already soft-deleted (deletedAt=${store.deletedAt}), returning early`);
        return; // Idempotent - already deleted, success
      }
      
      // CRITICAL FIX: Check for active invoices before deletion
      const activeInvoices = await queryRunner.manager
        .createQueryBuilder(Invoice, 'invoice')
        .where('invoice.storeId = :storeId', { storeId: id })
        .andWhere('invoice.deletedAt IS NULL')
        .andWhere('invoice.status != :cancelledStatus', { cancelledStatus: 'cancelled' })
        .getCount();
      
      if (activeInvoices > 0) {
        await queryRunner.rollbackTransaction();
        this.logger.warn(`remove: Cannot delete store ${id}: has ${activeInvoices} active invoice(s)`);
        throw new BadRequestException(
          `Cannot delete store: has ${activeInvoices} active invoice(s). Please cancel or delete the invoices first.`
        );
      }
      
      // CRITICAL FIX: Check for inventory items with stock in this store
      const itemsWithStock = await queryRunner.manager
        .createQueryBuilder(StoreItemSettings, 'settings')
        .where('settings.storeId = :storeId', { storeId: id })
        .andWhere('settings.currentStock > :zero', { zero: 0 })
        .getCount();
      
      if (itemsWithStock > 0) {
        await queryRunner.rollbackTransaction();
        this.logger.warn(`remove: Cannot delete store ${id}: has ${itemsWithStock} inventory item(s) with stock`);
        throw new BadRequestException(
          `Cannot delete store: has ${itemsWithStock} inventory item(s) with stock. Please transfer or remove the stock first.`
        );
      }
      
      // CRITICAL FIX: Use direct UPDATE query instead of softRemove for consistency
      const updateResult = await queryRunner.manager
        .createQueryBuilder()
        .update(Store)
        .set({ 
          deletedAt: () => 'CURRENT_TIMESTAMP' 
        })
        .where('id = :id', { id })
        .andWhere('deletedAt IS NULL') // Ensure not already deleted
        .execute();
      
      if (updateResult.affected === 0) {
        this.logger.error(`remove: CRITICAL - UPDATE query affected 0 rows for store ${id}!`);
        await queryRunner.rollbackTransaction();
        throw new Error('Failed to soft-delete store: UPDATE query did not affect any rows');
      }
      
      this.logger.debug(`remove: UPDATE query executed for store ${id}, affected rows: ${updateResult.affected}`);
      
      // CRITICAL: Verify the deletion was actually saved to the database BEFORE commit
      const verifyDeleted = await queryRunner.manager
        .createQueryBuilder(Store, 'store')
        .withDeleted()
        .where('store.id = :id', { id })
        .getOne();
      
      if (!verifyDeleted) {
        this.logger.error(`remove: CRITICAL - Store ${id} not found after UPDATE!`);
        await queryRunner.rollbackTransaction();
        throw new Error('Failed to soft-delete store: store not found after deletion');
      }
      
      if (!verifyDeleted.deletedAt) {
        this.logger.error(`remove: CRITICAL - Store ${id} was not actually soft-deleted! deletedAt is null after UPDATE`);
        await queryRunner.rollbackTransaction();
        throw new Error('Failed to soft-delete store: deletedAt was not set');
      }
      
      this.logger.debug(`remove: Verified store ${id} has deletedAt=${verifyDeleted.deletedAt} in database before commit`);
      
      // CRITICAL FIX: Since stores use soft delete, CASCADE won't trigger automatically
      // We need to explicitly handle StoreItemSettings cleanup
      // Note: We don't delete them, but we could mark them as inactive or leave them
      // For now, we leave them - they'll be filtered out by queries that check store.deletedAt
      // But we log a warning if there are settings
      const settingsCount = await queryRunner.manager
        .createQueryBuilder(StoreItemSettings, 'settings')
        .where('settings.storeId = :storeId', { storeId: id })
        .getCount();
      
      if (settingsCount > 0) {
        this.logger.warn(
          `Store ${id} has ${settingsCount} store item settings that will remain (store uses soft delete, CASCADE only works on hard delete)`
        );
        // Note: Settings will be orphaned but queries should filter by store.deletedAt
        // This is acceptable since we're using soft delete
      }
      
      // Commit transaction
      await queryRunner.commitTransaction();
      
      this.logger.debug(`remove: Store ${id} soft-deleted successfully using direct UPDATE query`);
    
    // Invalidate stores analytics cache when store is deleted
    await this.cacheManager.del('stores-analytics');
      
    } catch (error) {
      // Rollback transaction on any error
      await queryRunner.rollbackTransaction();
      
      // Re-throw NotFoundException and BadRequestException as-is
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      
      // Handle database errors
      this.logger.error(`remove: Error deleting store ${id}`, error);
      if (error.code === '23503') { // Foreign key constraint violation
        throw new NotFoundException('Cannot delete store: has associated records');
      }
      
      // Re-throw other errors
      throw error;
    } finally {
      // Always release the query runner
      await queryRunner.release();
    }
  }
}

