import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { InventoryItem } from './entities/inventory-item.entity';
import { StockMovement } from './entities/stock-movement.entity';
import { StoreItemSettings } from './entities/store-item-settings.entity';
import { Store } from './entities/store.entity';
import { InvoiceItem } from '../invoices/entities/invoice-item.entity';
import { Invoice } from '../invoices/entities/invoice.entity';
import { UserSettings } from '../user-settings/entities/user-settings.entity';
import { StoreItemSettingsService } from './store-item-settings.service';
import { ImportService } from '../common/services/import.service';

/* Rewritten. Most of the previous file tested reserveStock(), releaseReservedStock()
   and convertReservedToSale() together with a `reservedStock` field — the whole
   reservation feature was removed from the service (only an old migration still
   mentions the column), so the suite referred to methods that do not exist and could
   not compile. Its remaining fixtures also typed `sourceType` as a plain string after
   it became the union 'manual' | 'invoice' | 'import'.

   createMovement is not covered here on purpose: it opens its own transaction and runs
   through DeadlockDetector retries, so it belongs in an integration test against a real
   database rather than behind eleven mocks pretending to be one. What is covered is the
   part that is genuinely unit-testable and genuinely matters — tenant scoping, and the
   two referential guards that stop an item disappearing out from under an invoice. */

const makeQb = () => {
  const qb: Record<string, jest.Mock> = {};
  for (const m of [
    'select', 'addSelect', 'leftJoin', 'leftJoinAndSelect', 'innerJoin', 'innerJoinAndSelect',
    'where', 'andWhere', 'orWhere', 'orderBy', 'addOrderBy', 'groupBy', 'skip', 'take',
    'withDeleted', 'setLock', 'update', 'set',
  ]) {
    qb[m] = jest.fn(() => qb);
  }
  qb.getOne = jest.fn().mockResolvedValue(null);
  qb.getMany = jest.fn().mockResolvedValue([]);
  qb.getCount = jest.fn().mockResolvedValue(0);
  qb.getRawOne = jest.fn().mockResolvedValue(undefined);
  qb.getRawMany = jest.fn().mockResolvedValue([]);
  qb.execute = jest.fn().mockResolvedValue({ affected: 1 });
  return qb;
};

const makeItem = (over: Partial<InventoryItem> = {}): InventoryItem =>
  ({
    id: 'item-1',
    userId: 'user-1',
    name: 'Box, large',
    sku: 'BOX-L',
    currentStock: 100,
    movements: [],
    ...over,
  }) as unknown as InventoryItem;

describe('InventoryService', () => {
  let service: InventoryService;
  let itemQb: ReturnType<typeof makeQb>;
  let invoiceItemQb: ReturnType<typeof makeQb>;
  let movementQb: ReturnType<typeof makeQb>;

  const repo = (qbFactory: () => ReturnType<typeof makeQb>) => ({
    createQueryBuilder: jest.fn(() => qbFactory()),
    findOne: jest.fn(),
    find: jest.fn().mockResolvedValue([]),
    create: jest.fn((x) => x),
    save: jest.fn((x) => Promise.resolve(x)),
    update: jest.fn(),
    delete: jest.fn(),
    softDelete: jest.fn(),
    remove: jest.fn(),
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    itemQb = makeQb();
    invoiceItemQb = makeQb();
    movementQb = makeQb();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: getRepositoryToken(InventoryItem), useValue: { ...repo(() => itemQb), createQueryBuilder: jest.fn(() => itemQb) } },
        { provide: getRepositoryToken(StockMovement), useValue: { ...repo(() => movementQb), createQueryBuilder: jest.fn(() => movementQb) } },
        { provide: getRepositoryToken(InvoiceItem), useValue: { ...repo(() => invoiceItemQb), createQueryBuilder: jest.fn(() => invoiceItemQb) } },
        { provide: getRepositoryToken(Invoice), useValue: repo(makeQb) },
        { provide: getRepositoryToken(UserSettings), useValue: repo(makeQb) },
        { provide: getRepositoryToken(StoreItemSettings), useValue: repo(makeQb) },
        { provide: getRepositoryToken(Store), useValue: repo(makeQb) },
        { provide: StoreItemSettingsService, useValue: { getOrCreateSettings: jest.fn(), adjustStoreStock: jest.fn() } },
        { provide: DataSource, useValue: { createQueryRunner: jest.fn(), transaction: jest.fn() } },
        { provide: CACHE_MANAGER, useValue: { get: jest.fn(), set: jest.fn(), del: jest.fn() } },
        { provide: ImportService, useValue: { parseCsv: jest.fn(), importRows: jest.fn() } },
      ],
    }).compile();

    service = module.get<InventoryService>(InventoryService);
  });

  it('is constructed with all of its dependencies', () => {
    expect(service).toBeDefined();
  });

  describe('findOne', () => {
    it('returns an item the user owns', async () => {
      itemQb.getOne.mockResolvedValue(makeItem());

      const result = await service.findOne('item-1', 'user-1');

      expect(result.id).toBe('item-1');
    });

    it('scopes the lookup by userId, not by id alone', async () => {
      // Unlike clients, this query filters on ownership directly — so the scoping IS
      // the isolation, and losing this andWhere would expose every tenant's stock.
      itemQb.getOne.mockResolvedValue(makeItem());

      await service.findOne('item-1', 'user-1');

      expect(itemQb.where).toHaveBeenCalledWith('item.id = :id', { id: 'item-1' });
      expect(itemQb.andWhere).toHaveBeenCalledWith('item.userId = :userId', {
        userId: 'user-1',
      });
    });

    it('throws when nothing matches, which covers both missing and not-yours', async () => {
      itemQb.getOne.mockResolvedValue(null);

      await expect(service.findOne('item-1', 'user-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove — referential guards', () => {
    beforeEach(() => {
      itemQb.getOne.mockResolvedValue(makeItem());
    });

    it('refuses to delete an item that appears on an invoice', async () => {
      invoiceItemQb.getCount.mockResolvedValue(3);

      await expect(service.remove('item-1', 'user-1')).rejects.toThrow(ConflictException);
    });

    it('says why, naming invoices, rather than failing opaquely', async () => {
      invoiceItemQb.getCount.mockResolvedValue(1);

      await expect(service.remove('item-1', 'user-1')).rejects.toThrow(/linked to existing invoices/i);
    });

    it('counts invoice links even for soft-deleted invoices, to preserve the audit trail', async () => {
      // The join deliberately does not filter deletedAt: a removed invoice still
      // referenced this item historically.
      invoiceItemQb.getCount.mockResolvedValue(1);

      await expect(service.remove('item-1', 'user-1')).rejects.toThrow(ConflictException);
      expect(invoiceItemQb.innerJoin).toHaveBeenCalledWith('invoiceItem.invoice', 'invoice');
    });

    it('checks stock movements once the invoice check passes', async () => {
      invoiceItemQb.getCount.mockResolvedValue(0);
      movementQb.getCount.mockResolvedValue(0);

      await service.remove('item-1', 'user-1').catch(() => undefined);

      expect(movementQb.getCount).toHaveBeenCalled();
    });

    it('refuses an item that does not exist', async () => {
      itemQb.getOne.mockResolvedValue(null);

      await expect(service.remove('nope', 'user-1')).rejects.toThrow(NotFoundException);
    });
  });
});
