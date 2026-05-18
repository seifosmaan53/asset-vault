import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, DataSource, QueryRunner } from 'typeorm';
import { Client } from './entities/client.entity';
import { Invoice } from '../invoices/entities/invoice.entity';
import { Store } from '../inventory/entities/store.entity';
import { sanitizeObject, sanitizeString, sanitizeEmail, sanitizeUrl, sanitizeStringArray } from '../common/utils/security.util';
import { ImportService } from '../common/services/import.service';

@Injectable()
export class ClientsService {
  private readonly logger = new Logger(ClientsService.name);

  constructor(
    @InjectRepository(Client)
    private clientsRepository: Repository<Client>,
    private readonly dataSource: DataSource,
    private readonly importService: ImportService,
  ) {}

  async findAll(
    actorUserId: string,
    filters?: {
      search?: string;
      createdAtFrom?: string;
      createdAtTo?: string;
      updatedAtFrom?: string;
      updatedAtTo?: string;
    },
  ): Promise<Client[]> {
    // DIAGNOSTIC: Log the query parameters
    this.logger.log(`[DIAGNOSTIC] ClientsService.findAll called with actorUserId: ${actorUserId}`);
    
    // Fix Issue #1: Use query builder instead of 'as any' type assertion
    // Organizations removed - filter by userId only (user-scoped data)
    const queryBuilder = this.clientsRepository
      .createQueryBuilder('client')
      .where('client.deletedAt IS NULL') // CRITICAL: Exclude soft-deleted clients - must use .where() first
      .andWhere('client.userId = :actorUserId', { actorUserId });

    // Apply search filter
    if (filters?.search) {
      queryBuilder.andWhere(
        '(client.name ILIKE :search OR client.email ILIKE :search OR client.phone ILIKE :search OR client.notes ILIKE :search)',
        { search: `%${filters.search}%` },
      );
    }

    // Date range filters
    if (filters?.createdAtFrom) {
      queryBuilder.andWhere('client.createdAt >= :createdAtFrom', { createdAtFrom: filters.createdAtFrom });
    }
    if (filters?.createdAtTo) {
      queryBuilder.andWhere('client.createdAt <= :createdAtTo', { createdAtTo: filters.createdAtTo });
    }
    if (filters?.updatedAtFrom) {
      queryBuilder.andWhere('client.updatedAt >= :updatedAtFrom', { updatedAtFrom: filters.updatedAtFrom });
    }
    if (filters?.updatedAtTo) {
      queryBuilder.andWhere('client.updatedAt <= :updatedAtTo', { updatedAtTo: filters.updatedAtTo });
    }

    queryBuilder.orderBy('client.createdAt', 'DESC');

    const clients = await queryBuilder.getMany();
    
    // DIAGNOSTIC: Log the results
    this.logger.log(`[DIAGNOSTIC] ClientsService.findAll returned ${clients.length} clients for userId: ${actorUserId}`);
    if (clients.length > 0) {
        this.logger.log(`[DIAGNOSTIC] First client: id=${clients[0].id}, name=${clients[0].name}, userId=${clients[0].userId}`);
    } else {
      // Check if there are any clients for this user at all (including deleted)
      const allClients = await this.clientsRepository
        .createQueryBuilder('client')
        .withDeleted()
        .where('client.userId = :actorUserId', { actorUserId })
        .getMany();
      this.logger.warn(`[DIAGNOSTIC] No active clients found, but found ${allClients.length} total clients (including deleted) for userId: ${actorUserId}`);
      if (allClients.length > 0) {
        this.logger.warn(`[DIAGNOSTIC] Sample client: id=${allClients[0].id}, userId=${allClients[0].userId}, deletedAt=${allClients[0].deletedAt}`);
      }
    }
    
    this.logger.debug(`findAll: Returning ${clients.length} clients (excluding soft-deleted)`);
    return clients;
  }

  async findOne(id: string, actorUserId: string): Promise<Client> {
    this.logger.debug(`findOne called: id=${id}, actorUserId=${actorUserId}`);
    
    // First, check if client exists at all (including soft-deleted) to provide better error messages
    const anyClient = await this.clientsRepository
      .createQueryBuilder('client')
      .withDeleted()
      .where('client.id = :id', { id })
      .getOne();
    
    if (!anyClient) {
      this.logger.warn(`Client ${id} does not exist at all`);
      throw new NotFoundException('Client not found');
    }
    
    // Check if client is soft-deleted
    if (anyClient.deletedAt) {
      this.logger.warn(`Client ${id} is soft-deleted (deletedAt=${anyClient.deletedAt})`);
      throw new NotFoundException('Client not found (may have been deleted)');
    }
    
    // Organizations removed - check access by userId only
    const hasAccess = anyClient.userId === actorUserId;
    
    this.logger.debug(
      `Access check for client ${id}: hasAccess=${hasAccess}, client.userId=${anyClient.userId}, req.userId=${actorUserId}`,
    );
    
    if (!hasAccess) {
      this.logger.warn(
        `Client ${id} exists but access denied: client.userId=${anyClient.userId}, actorUserId=${actorUserId}`,
      );
      throw new NotFoundException('Client not found or access denied');
    }
    
    // Client exists and user has access - load with relations
    const client = await this.clientsRepository
      .createQueryBuilder('client')
      .leftJoinAndSelect('client.stores', 'stores', 'stores.deletedAt IS NULL')
      .where('client.id = :id', { id })
      .andWhere('client.deletedAt IS NULL')
      .getOne();
    
    if (!client) {
      // This shouldn't happen since we already checked, but handle it anyway
      this.logger.error(`Client ${id} was found but query failed - this should not happen`);
      throw new NotFoundException('Client not found');
    }
    
    this.logger.debug(`Client ${id} found and accessible`);
    return client;
  }

  async create(actorUserId: string, data: Partial<Client>): Promise<Client> {
    // Sanitize all text inputs to prevent XSS
    const sanitizedData: Partial<Client> = {
      name: sanitizeString(data.name),
      phone: data.phone ? sanitizeString(data.phone, 50) : data.phone,
      notes: data.notes ? sanitizeString(data.notes, 5000) : data.notes,
      addressJson: data.addressJson ? {
        street: data.addressJson.street ? sanitizeString(data.addressJson.street, 255) : data.addressJson.street,
        city: data.addressJson.city ? sanitizeString(data.addressJson.city, 100) : data.addressJson.city,
        state: data.addressJson.state ? sanitizeString(data.addressJson.state, 100) : data.addressJson.state,
        zip: data.addressJson.zip ? sanitizeString(data.addressJson.zip, 20) : data.addressJson.zip,
        country: data.addressJson.country ? sanitizeString(data.addressJson.country, 100) : data.addressJson.country,
      } : data.addressJson,
    };
    
    // Handle email - convert null to undefined
    if (data.email !== undefined && data.email !== null) {
      const sanitizedEmail = sanitizeEmail(data.email);
      sanitizedData.email = sanitizedEmail || undefined;
    } else if (data.email === null) {
      sanitizedData.email = undefined;
    }
    
    // Handle avatarUrl - convert null to undefined
    if (data.avatarUrl !== undefined && data.avatarUrl !== null) {
      const sanitizedUrl = sanitizeUrl(data.avatarUrl);
      sanitizedData.avatarUrl = sanitizedUrl || undefined;
    } else if (data.avatarUrl === null) {
      sanitizedData.avatarUrl = undefined;
    }
    
    const client = this.clientsRepository.create({
      ...sanitizedData,
      userId: actorUserId,
    });
    return this.clientsRepository.save(client);
  }

  async update(id: string, actorUserId: string, data: Partial<Client>): Promise<Client> {
    await this.findOne(id, actorUserId);
    
    // Sanitize all text inputs to prevent XSS
    const sanitizedData: Partial<Client> = {};
    if (data.name !== undefined) sanitizedData.name = sanitizeString(data.name);
    if (data.phone !== undefined) sanitizedData.phone = data.phone ? sanitizeString(data.phone, 50) : data.phone;
    if (data.notes !== undefined) sanitizedData.notes = data.notes ? sanitizeString(data.notes, 5000) : data.notes;
    
    // Handle email - convert null to undefined
    if (data.email !== undefined) {
      if (data.email !== null) {
        const sanitizedEmail = sanitizeEmail(data.email);
        sanitizedData.email = sanitizedEmail || undefined;
      } else {
        sanitizedData.email = undefined;
      }
    }
    
    // Handle avatarUrl - convert null to undefined
    if (data.avatarUrl !== undefined) {
      if (data.avatarUrl !== null) {
        const sanitizedUrl = sanitizeUrl(data.avatarUrl);
        sanitizedData.avatarUrl = sanitizedUrl || undefined;
      } else {
        sanitizedData.avatarUrl = undefined;
      }
    }
    
    if (data.addressJson !== undefined) {
      sanitizedData.addressJson = data.addressJson ? {
        street: data.addressJson.street ? sanitizeString(data.addressJson.street, 255) : data.addressJson.street,
        city: data.addressJson.city ? sanitizeString(data.addressJson.city, 100) : data.addressJson.city,
        state: data.addressJson.state ? sanitizeString(data.addressJson.state, 100) : data.addressJson.state,
        zip: data.addressJson.zip ? sanitizeString(data.addressJson.zip, 20) : data.addressJson.zip,
        country: data.addressJson.country ? sanitizeString(data.addressJson.country, 100) : data.addressJson.country,
      } : data.addressJson;
    }
    
    // Fix Issue #1: Use query builder instead of 'as any' type assertion
    const client = await this.findOne(id, actorUserId);
    const updateQuery = this.clientsRepository
      .createQueryBuilder()
      .update(Client)
      .set(sanitizedData)
      .where('id = :id', { id })
      .andWhere('userId = :actorUserId', { actorUserId });
    
    await updateQuery.execute();
    return this.findOne(id, actorUserId);
  }

  async remove(id: string, actorUserId: string): Promise<void> {
    this.logger.debug(`remove: Starting deletion for client ${id}, actorUserId=${actorUserId}`);
    
    // Validate input
    if (!id || typeof id !== 'string' || id.trim() === '') {
      this.logger.warn(`remove: Invalid client ID provided: ${id}`);
      throw new NotFoundException('Invalid client ID');
    }
    
    // CRITICAL: Use transaction with pessimistic locking to prevent race conditions
    const queryRunner = this.dataSource.createQueryRunner();
    let transactionStarted = false;
    
    try {
      await queryRunner.connect();
      await queryRunner.startTransaction();
      transactionStarted = true;
      // First, check if client exists (including soft-deleted) for idempotent deletion
      const anyClient = await queryRunner.manager
        .createQueryBuilder(Client, 'client')
        .withDeleted()
        .where('client.id = :id', { id })
        .getOne();
      
      if (!anyClient) {
        if (transactionStarted) {
          await queryRunner.rollbackTransaction();
        }
        this.logger.warn(`remove: Client ${id} does not exist`);
        throw new NotFoundException('Client not found');
      }
      
      // If already soft-deleted, return early (idempotent operation)
      if (anyClient.deletedAt) {
        if (transactionStarted) {
          await queryRunner.rollbackTransaction();
        }
        this.logger.debug(`remove: Client ${id} is already soft-deleted (deletedAt=${anyClient.deletedAt}), returning early`);
        return; // Idempotent - already deleted, success
      }
      
      // Check access permissions
      // User can delete client if:
      // Organizations removed - check access by userId only
      const hasAccess = anyClient.userId === actorUserId;
      
      if (!hasAccess) {
        if (transactionStarted) {
          await queryRunner.rollbackTransaction();
        }
        this.logger.warn(
          `remove: Cannot delete client ${id}: access denied - client.userId=${anyClient.userId}, actorUserId=${actorUserId}`,
        );
        throw new NotFoundException('Client not found or access denied');
      }
      
      // Lock the client row with pessimistic write lock to prevent concurrent modifications
      // Use findOne with lock (like invoice service does) - more reliable
      // TypeORM's findOne automatically excludes soft-deleted records when using @DeleteDateColumn
      const client = await queryRunner.manager.findOne(Client, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      
      if (!client) {
        // Client was deleted between our check and lock, or doesn't exist, or no access
        // Since findOne excludes soft-deleted, if it returns null, client is either:
        // 1. Already soft-deleted (idempotent - success)
        // 2. Doesn't exist (should have been caught earlier)
        // 3. Access denied (should have been caught earlier)
        if (transactionStarted) {
          await queryRunner.rollbackTransaction();
        }
        this.logger.debug(`remove: Client ${id} not found with lock - may have been deleted concurrently`);
        return; // Idempotent - treat as success if already deleted
      }
      
      // Double-check not already deleted (shouldn't happen since findOne excludes soft-deleted)
      if (client.deletedAt) {
        if (transactionStarted) {
          await queryRunner.rollbackTransaction();
        }
        this.logger.debug(`remove: Client ${id} is already soft-deleted (deletedAt=${client.deletedAt}), returning early`);
        return; // Idempotent - already deleted, success
      }
      
      // FIX Issue #12: Check for active invoices before deletion
      // Use entity class instead of string for proper TypeORM query building
      const activeInvoices = await queryRunner.manager
        .createQueryBuilder(Invoice, 'invoice')
        .where('invoice.clientId = :clientId', { clientId: id })
        .andWhere('invoice.deletedAt IS NULL')
        .andWhere('invoice.status != :cancelledStatus', { cancelledStatus: 'cancelled' })
        .getCount();
      
      if (activeInvoices > 0) {
        if (transactionStarted) {
          await queryRunner.rollbackTransaction();
        }
        this.logger.warn(`remove: Cannot delete client ${id}: has ${activeInvoices} active invoice(s)`);
        throw new BadRequestException(
          `Cannot delete client: has ${activeInvoices} active invoice(s). Please cancel or delete the invoices first.`
        );
      }
      
      // FIX Issue #13: Check for active stores before deletion
      // Use entity class instead of string for proper TypeORM query building
      const activeStores = await queryRunner.manager
        .createQueryBuilder(Store, 'store')
        .where('store.clientId = :clientId', { clientId: id })
        .andWhere('store.active = :active', { active: true })
        .andWhere('store.deletedAt IS NULL') // Also exclude soft-deleted stores
        .getCount();
      
      if (activeStores > 0) {
        if (transactionStarted) {
          await queryRunner.rollbackTransaction();
        }
        this.logger.warn(`remove: Cannot delete client ${id}: has ${activeStores} active store(s)`);
        throw new BadRequestException(
          `Cannot delete client: has ${activeStores} active store(s). Please deactivate or delete the stores first.`
        );
      }
      
      // CRITICAL FIX: Use direct UPDATE query instead of softRemove
      // softRemove with queryRunner.manager may not be persisting correctly
      // Direct UPDATE ensures the deletion is actually saved to the database
      const updateResult = await queryRunner.manager
        .createQueryBuilder()
        .update(Client)
        .set({ 
          deletedAt: () => 'CURRENT_TIMESTAMP' 
        })
        .where('id = :id', { id })
        .andWhere('deletedAt IS NULL') // Ensure not already deleted
        .execute();
      
      if (updateResult.affected === 0) {
        this.logger.error(`remove: CRITICAL - UPDATE query affected 0 rows for client ${id}!`);
        if (transactionStarted) {
          await queryRunner.rollbackTransaction();
        }
        throw new Error('Failed to soft-delete client: UPDATE query did not affect any rows');
      }
      
      this.logger.debug(`remove: UPDATE query executed for client ${id}, affected rows: ${updateResult.affected}`);
      
      // CRITICAL: Verify the deletion was actually saved to the database BEFORE commit
      // Query the database directly within the transaction to ensure deletedAt is set
      const verifyDeleted = await queryRunner.manager
        .createQueryBuilder(Client, 'client')
        .withDeleted()
        .where('client.id = :id', { id })
        .getOne();
      
      if (!verifyDeleted) {
        this.logger.error(`remove: CRITICAL - Client ${id} not found after UPDATE!`);
        if (transactionStarted) {
          await queryRunner.rollbackTransaction();
        }
        throw new Error('Failed to soft-delete client: client not found after deletion');
      }
      
      if (!verifyDeleted.deletedAt) {
        this.logger.error(`remove: CRITICAL - Client ${id} was not actually soft-deleted! deletedAt is null after UPDATE`);
        if (transactionStarted) {
          await queryRunner.rollbackTransaction();
        }
        throw new Error('Failed to soft-delete client: deletedAt was not set');
      }
      
      this.logger.debug(`remove: Verified client ${id} has deletedAt=${verifyDeleted.deletedAt} in database before commit`);
      
      // Commit transaction
      await queryRunner.commitTransaction();
      
      this.logger.debug(`remove: Client ${id} soft-deleted successfully using direct UPDATE query`);
      
      // FIXED Issue #3: Verify deletion after commit
      // Use repository (normal connection) with small delay to ensure transaction is visible
      // This is safer than using queryRunner after commit
      // NOTE: Verification is non-critical and runs asynchronously - deletion is already complete
      // We don't track this timeout as it's fire-and-forget for logging purposes only
      setImmediate(async () => {
        try {
          // Small delay to ensure transaction is committed and visible
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // Verify using findAll to ensure it's excluded from normal queries
          const verifyClients = await this.findAll(actorUserId);
          const stillExists = verifyClients.some(c => c.id === id);
          if (stillExists) {
            this.logger.warn(`remove: Client ${id} was soft-deleted but still appears in findAll results. This may be due to connection pooling or replication lag.`);
          } else {
            this.logger.debug(`remove: Verified - Client ${id} confirmed removed from findAll results`);
          }
        } catch (verifyError) {
          // Don't fail deletion if verification fails - it's just for logging
          this.logger.warn(`remove: Could not verify deletion via findAll`, verifyError);
        }
      });
    } catch (error) {
      // Rollback transaction on any error, but only if transaction was started
      if (transactionStarted) {
        try {
          await queryRunner.rollbackTransaction();
        } catch (rollbackError) {
          this.logger.error(`remove: Error rolling back transaction for client ${id}`, rollbackError);
        }
      }
      
      // Re-throw NotFoundException as-is
      if (error instanceof NotFoundException) {
        throw error;
      }
      
      // Handle database errors
      this.logger.error(`remove: Error deleting client ${id}`, error);
      if (error.code === '23503') { // Foreign key constraint violation
        throw new NotFoundException('Cannot delete client: has associated records');
      }
      
      // Re-throw other errors
      throw error;
    } finally {
      // Always release the query runner
      try {
        await queryRunner.release();
      } catch (releaseError) {
        this.logger.error(`remove: Error releasing query runner for client ${id}`, releaseError);
      }
    }
  }

  async bulkRemove(ids: string[], actorUserId: string): Promise<{ deleted: number; failed: Array<{ id: string; reason: string }> }> {
    this.logger.debug(`bulkRemove: Starting bulk deletion for ${ids.length} clients, actorUserId=${actorUserId}`);
    
    const failed: Array<{ id: string; reason: string }> = [];
    let deleted = 0;

    // Process deletions sequentially to avoid race conditions and provide detailed error reporting
    for (const id of ids) {
      try {
        await this.remove(id, actorUserId);
        deleted++;
      } catch (error: any) {
        this.logger.warn(`bulkRemove: Failed to delete client ${id}: ${error.message}`);
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
    actorUserId: string,
  ): Promise<{ created: number; failed: Array<{ row: number; data: any; errors: string[] }> }> {
    this.logger.debug(`importFromFile: Starting import for user ${actorUserId}`);
    
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

    // Process imports in batches to avoid overwhelming the database
    const BATCH_SIZE = 50;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      
      for (const row of batch) {
        try {
          // Map common column names to client fields
          const clientData: Partial<Client> = {
            name: row.name || row.Name || row['Client Name'] || '',
            email: row.email || row.Email || row['Email Address'] || undefined,
            phone: row.phone || row.Phone || row['Phone Number'] || undefined,
            notes: row.notes || row.Notes || row['Additional Notes'] || undefined,
            addressJson: {
              street: row.street || row.Street || row['Street Address'] || '',
              city: row.city || row.City || '',
              state: row.state || row.State || '',
              zip: row.zip || row.ZIP || row['Zip Code'] || '',
              country: row.country || row.Country || '',
            },
          };

          // Validate required fields
          if (!clientData.name || clientData.name.trim() === '') {
            failed.push({
              row: i + batch.indexOf(row) + 2, // +2 for header and 0-based index
              data: row,
              errors: ['Name is required'],
            });
            continue;
          }

          // Create client
          await this.create(actorUserId, clientData);
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

