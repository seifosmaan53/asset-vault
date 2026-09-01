import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { StoreStockValidatorService } from './store-stock-validator.service';
import { StoreItemSettings } from './entities/store-item-settings.entity';
import { Store } from './entities/store.entity';
import { InventoryItem } from './entities/inventory-item.entity';
import { StoreItemSettingsService } from './store-item-settings.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('StoreStockValidatorService', () => {
  let service: StoreStockValidatorService;
  let storeItemSettingsRepository: Repository<StoreItemSettings>;
  let storeRepository: Repository<Store>;
  let inventoryItemRepository: Repository<InventoryItem>;
  let storeItemSettingsService: StoreItemSettingsService;

  const mockStoreItemSettingsRepository = {
    findOne: jest.fn(),
    find: jest.fn().mockResolvedValue([]),
    /* Outside a transaction the service uses `this.repo.manager`, which the mock did
       not have — hence "Cannot read properties of undefined (reading 'findOne')".
       The manager takes (Entity, options), so this adapts onto the repo-level stub. */
    manager: {
      findOne: jest.fn((_entity: unknown, options: unknown) =>
        mockStoreItemSettingsRepository.findOne(options),
      ),
      find: jest.fn(
        async () => (await mockStoreItemSettingsRepository.find()) ?? [],
      ),
      save: jest.fn((_entity: unknown, data: unknown) => Promise.resolve(data)),
      create: jest.fn((_entity: unknown, data: unknown) => data),
    },
  };

  /* The service moved from repository.findOne() to a QueryBuilder chain
     (.where().andWhere().setLock().getOne()) but these mocks were never updated, so
     every test in this file died on "createQueryBuilder is not a function" — 53 of
     them. Each builder method returns the builder so the chain composes; getOne()
     is what tests stub per-case. */
  const makeQueryBuilder = (delegate?: jest.Mock) => {
    const qb: Record<string, jest.Mock> = {};
    /* The builder accumulates the parameters passed to where()/andWhere() and hands
       them to the delegate, so a stub can answer based on WHICH row was asked for
       rather than on call order. That matters for the multi-item cases: the service
       does not guarantee one findOne per item, so a mockResolvedValueOnce sequence
       silently lines up against the wrong lookup. */
    const params: Record<string, unknown> = {};
    for (const method of [
      'where',
      'andWhere',
      'setLock',
      'leftJoinAndSelect',
      'select',
      'orderBy',
    ]) {
      qb[method] = jest.fn((_sql?: unknown, p?: Record<string, unknown>) => {
        if (p) Object.assign(params, p);
        return qb;
      });
    }
    qb.getOne = jest.fn(() =>
      delegate ? delegate({ where: { ...params } }) : undefined,
    );
    qb.getMany = jest.fn(() => []);
    return qb;
  };

  let storeQueryBuilder: ReturnType<typeof makeQueryBuilder>;
  let itemQueryBuilder: ReturnType<typeof makeQueryBuilder>;

  const mockStoreRepository = {
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(() => storeQueryBuilder),
  };

  const mockInventoryItemRepository = {
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(() => itemQueryBuilder),
  };

  const mockStoreItemSettingsService = {
    getOrCreateSettings: jest.fn(),
    adjustStoreStock: jest.fn(),
  };

  beforeEach(async () => {
    storeQueryBuilder = makeQueryBuilder(mockStoreRepository.findOne);
    itemQueryBuilder = makeQueryBuilder(mockInventoryItemRepository.findOne);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StoreStockValidatorService,
        {
          provide: getRepositoryToken(StoreItemSettings),
          useValue: mockStoreItemSettingsRepository,
        },
        {
          provide: getRepositoryToken(Store),
          useValue: mockStoreRepository,
        },
        {
          provide: getRepositoryToken(InventoryItem),
          useValue: mockInventoryItemRepository,
        },
        {
          provide: StoreItemSettingsService,
          useValue: mockStoreItemSettingsService,
        },
      ],
    }).compile();

    service = module.get<StoreStockValidatorService>(
      StoreStockValidatorService,
    );
    storeItemSettingsRepository = module.get<Repository<StoreItemSettings>>(
      getRepositoryToken(StoreItemSettings),
    );
    storeRepository = module.get<Repository<Store>>(getRepositoryToken(Store));
    inventoryItemRepository = module.get<Repository<InventoryItem>>(
      getRepositoryToken(InventoryItem),
    );
    storeItemSettingsService = module.get<StoreItemSettingsService>(
      StoreItemSettingsService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAvailableStoreStock', () => {
    const userId = 'user-123';
    const storeId = 'store-123';
    const inventoryItemId = 'item-123';

    it('should return stock from existing settings', async () => {
      const mockStore = { id: storeId, userId, name: 'Test Store' };
      const mockInventoryItem = {
        id: inventoryItemId,
        userId,
        name: 'Test Item',
        currentStock: 1000,
      };
      const mockSettings = { storeId, inventoryItemId, currentStock: 50 };

      mockStoreRepository.findOne.mockResolvedValue(mockStore);
      mockInventoryItemRepository.findOne.mockResolvedValue(mockInventoryItem);
      mockStoreItemSettingsRepository.findOne.mockResolvedValue(mockSettings);

      const result = await service.getAvailableStoreStock(
        storeId,
        inventoryItemId,
        userId,
      );

      expect(result).toBe(50);
      /* These used to assert findOne({ where: { id, userId } }). The lookup moved to a
         QueryBuilder, but the point of the assertion is unchanged and worth keeping:
         every read must be scoped by userId, or one tenant could read another's stock. */
      expect(storeQueryBuilder.where).toHaveBeenCalledWith(
        'store.userId = :userId',
        { userId },
      );
      expect(storeQueryBuilder.andWhere).toHaveBeenCalledWith(
        'store.id = :storeId',
        { storeId },
      );
      expect(itemQueryBuilder.where).toHaveBeenCalledWith(
        'item.userId = :userId',
        { userId },
      );
    });

    it('should return 0 when no settings exist', async () => {
      const mockStore = { id: storeId, userId, name: 'Test Store' };
      const mockInventoryItem = {
        id: inventoryItemId,
        userId,
        name: 'Test Item',
        currentStock: 1000,
      };

      mockStoreRepository.findOne.mockResolvedValue(mockStore);
      mockInventoryItemRepository.findOne.mockResolvedValue(mockInventoryItem);
      mockStoreItemSettingsRepository.findOne.mockResolvedValue(null);

      const result = await service.getAvailableStoreStock(
        storeId,
        inventoryItemId,
        userId,
      );

      expect(result).toBe(0);
    });

    it('should throw NotFoundException if store not found', async () => {
      mockStoreRepository.findOne.mockResolvedValue(null);

      await expect(
        service.getAvailableStoreStock(storeId, inventoryItemId, userId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if inventory item not found', async () => {
      const mockStore = { id: storeId, userId, name: 'Test Store' };

      mockStoreRepository.findOne.mockResolvedValue(mockStore);
      mockInventoryItemRepository.findOne.mockResolvedValue(null);

      await expect(
        service.getAvailableStoreStock(storeId, inventoryItemId, userId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return 0 when currentStock is null', async () => {
      const mockStore = { id: storeId, userId, name: 'Test Store' };
      const mockInventoryItem = {
        id: inventoryItemId,
        userId,
        name: 'Test Item',
        currentStock: 1000,
      };
      const mockSettings = { storeId, inventoryItemId, currentStock: null };

      mockStoreRepository.findOne.mockResolvedValue(mockStore);
      mockInventoryItemRepository.findOne.mockResolvedValue(mockInventoryItem);
      mockStoreItemSettingsRepository.findOne.mockResolvedValue(mockSettings);

      const result = await service.getAvailableStoreStock(
        storeId,
        inventoryItemId,
        userId,
      );

      expect(result).toBe(0);
    });
  });

  describe('validateStoreStockAvailability', () => {
    const userId = 'user-123';
    const storeId = 'store-123';
    const inventoryItemId = 'item-123';

    beforeEach(() => {
      const mockStore = { id: storeId, userId, name: 'Test Store' };
      const mockInventoryItem = {
        id: inventoryItemId,
        userId,
        name: 'Test Item',
        currentStock: 1000,
      };

      mockStoreRepository.findOne.mockResolvedValue(mockStore);
      mockInventoryItemRepository.findOne.mockResolvedValue(mockInventoryItem);
    });

    it('should validate successfully when stock is sufficient', async () => {
      const mockSettings = { storeId, inventoryItemId, currentStock: 100 };
      mockStoreItemSettingsRepository.findOne.mockResolvedValue(mockSettings);

      const result = await service.validateStoreStockAvailability(
        storeId,
        inventoryItemId,
        50,
        userId,
        'sale',
      );

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.availableStock).toBe(100);
    });

    it('should fail validation when stock is insufficient', async () => {
      const mockSettings = { storeId, inventoryItemId, currentStock: 30 };
      mockStoreItemSettingsRepository.findOne.mockResolvedValue(mockSettings);

      const result = await service.validateStoreStockAvailability(
        storeId,
        inventoryItemId,
        50,
        userId,
        'sale',
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Insufficient stock');
      expect(result.availableStock).toBe(30);
    });

    it('should add warning when stock equals required quantity', async () => {
      const mockSettings = { storeId, inventoryItemId, currentStock: 50 };
      mockStoreItemSettingsRepository.findOne.mockResolvedValue(mockSettings);

      const result = await service.validateStoreStockAvailability(
        storeId,
        inventoryItemId,
        50,
        userId,
        'sale',
      );

      expect(result.isValid).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain('exactly at required quantity');
    });

    it('should work for reserve operation', async () => {
      const mockSettings = { storeId, inventoryItemId, currentStock: 100 };
      mockStoreItemSettingsRepository.findOne.mockResolvedValue(mockSettings);

      const result = await service.validateStoreStockAvailability(
        storeId,
        inventoryItemId,
        50,
        userId,
        'reserve',
      );

      expect(result.isValid).toBe(true);
    });
  });

  describe('validateInvoiceItemsStoreStock', () => {
    const userId = 'user-123';
    const storeId = 'store-123';

    beforeEach(() => {
      const mockStore = { id: storeId, userId, name: 'Test Store' };
      mockStoreRepository.findOne.mockResolvedValue(mockStore);
    });

    it('should validate all items successfully', async () => {
      const item1 = {
        id: 'item-1',
        userId,
        name: 'Item 1',
        currentStock: 1000,
      };
      const item2 = {
        id: 'item-2',
        userId,
        name: 'Item 2',
        currentStock: 1000,
      };
      const settings1 = {
        storeId,
        inventoryItemId: 'item-1',
        currentStock: 100,
      };
      const settings2 = {
        storeId,
        inventoryItemId: 'item-2',
        currentStock: 50,
      };

      mockInventoryItemRepository.findOne
        .mockResolvedValueOnce(item1)
        .mockResolvedValueOnce(item2)
        .mockResolvedValueOnce(item1)
        .mockResolvedValueOnce(item2);
      mockStoreItemSettingsRepository.findOne
        .mockResolvedValueOnce(settings1)
        .mockResolvedValueOnce(settings2);

      const items = [
        { inventoryItemId: 'item-1', quantity: 50, description: 'Item 1' },
        { inventoryItemId: 'item-2', quantity: 30, description: 'Item 2' },
      ];

      const result = await service.validateInvoiceItemsStoreStock(
        storeId,
        items,
        userId,
        'sale',
      );

      expect(result.isValid).toBe(true);
      expect(result.itemValidations).toHaveLength(2);
      expect(result.itemValidations[0].isValid).toBe(true);
      expect(result.itemValidations[1].isValid).toBe(true);
    });

    it('should fail when any item has insufficient stock', async () => {
      const item1 = {
        id: 'item-1',
        userId,
        name: 'Item 1',
        currentStock: 1000,
      };
      const item2 = {
        id: 'item-2',
        userId,
        name: 'Item 2',
        currentStock: 1000,
      };
      const settings1 = {
        storeId,
        inventoryItemId: 'item-1',
        currentStock: 100,
      };
      const settings2 = {
        storeId,
        inventoryItemId: 'item-2',
        currentStock: 20,
      };

      mockInventoryItemRepository.findOne
        .mockResolvedValueOnce(item1)
        .mockResolvedValueOnce(item2)
        .mockResolvedValueOnce(item1)
        .mockResolvedValueOnce(item2);
      mockStoreItemSettingsRepository.findOne
        .mockResolvedValueOnce(settings1)
        .mockResolvedValueOnce(settings2);

      const items = [
        { inventoryItemId: 'item-1', quantity: 50, description: 'Item 1' },
        { inventoryItemId: 'item-2', quantity: 30, description: 'Item 2' },
      ];

      const result = await service.validateInvoiceItemsStoreStock(
        storeId,
        items,
        userId,
        'sale',
      );

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.itemValidations[1].isValid).toBe(false);
    });

    it('should skip items without inventoryItemId', async () => {
      const items = [
        { inventoryItemId: 'item-1', quantity: 50, description: 'Item 1' },
        { quantity: 30, description: 'Item without inventory' },
      ];

      const item1 = {
        id: 'item-1',
        userId,
        name: 'Item 1',
        currentStock: 1000,
      };
      const settings1 = {
        storeId,
        inventoryItemId: 'item-1',
        currentStock: 100,
      };

      mockInventoryItemRepository.findOne
        .mockResolvedValueOnce(item1)
        .mockResolvedValueOnce(item1);
      mockStoreItemSettingsRepository.findOne.mockResolvedValueOnce(settings1);

      const result = await service.validateInvoiceItemsStoreStock(
        storeId,
        items,
        userId,
        'sale',
      );

      expect(result.itemValidations).toHaveLength(1);
      expect(result.itemValidations[0].inventoryItemId).toBe('item-1');
    });

    it('should handle errors gracefully for individual items', async () => {
      const item1 = {
        id: 'item-1',
        userId,
        name: 'Item 1',
        currentStock: 1000,
      };
      const settings1 = {
        storeId,
        inventoryItemId: 'item-1',
        currentStock: 100,
      };

      // keyed on the requested id rather than call order — see makeQueryBuilder above
      mockInventoryItemRepository.findOne.mockImplementation(
        (opts?: { where?: { inventoryItemId?: string; id?: string } }) => {
          const wanted = opts?.where?.inventoryItemId ?? opts?.where?.id;
          return Promise.resolve(wanted === 'item-1' ? item1 : null);
        },
      );
      mockStoreItemSettingsRepository.findOne.mockResolvedValueOnce(settings1);

      const items = [
        { inventoryItemId: 'item-1', quantity: 50, description: 'Item 1' },
        { inventoryItemId: 'item-2', quantity: 30, description: 'Item 2' },
      ];

      const result = await service.validateInvoiceItemsStoreStock(
        storeId,
        items,
        userId,
        'sale',
      );

      expect(result.isValid).toBe(false);
      expect(result.itemValidations).toHaveLength(2);
      expect(result.itemValidations[1].isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('validateAndThrow', () => {
    const userId = 'user-123';
    const storeId = 'store-123';

    beforeEach(() => {
      const mockStore = { id: storeId, userId, name: 'Test Store' };
      mockStoreRepository.findOne.mockResolvedValue(mockStore);
    });

    it('should not throw when validation passes', async () => {
      const item = { id: 'item-1', userId, name: 'Item 1', currentStock: 1000 };
      const settings = {
        storeId,
        inventoryItemId: 'item-1',
        currentStock: 100,
      };

      mockInventoryItemRepository.findOne
        .mockResolvedValue(item)
        .mockResolvedValue(item);
      mockStoreItemSettingsRepository.findOne.mockResolvedValue(settings);

      const items = [
        { inventoryItemId: 'item-1', quantity: 50, description: 'Item 1' },
      ];

      await expect(
        service.validateAndThrow(storeId, items, userId, 'sale'),
      ).resolves.not.toThrow();
    });

    it('should throw BadRequestException when validation fails', async () => {
      const item = { id: 'item-1', userId, name: 'Item 1', currentStock: 1000 };
      const settings = { storeId, inventoryItemId: 'item-1', currentStock: 30 };

      mockInventoryItemRepository.findOne
        .mockResolvedValue(item)
        .mockResolvedValue(item);
      mockStoreItemSettingsRepository.findOne.mockResolvedValue(settings);

      const items = [
        { inventoryItemId: 'item-1', quantity: 50, description: 'Item 1' },
      ];

      await expect(
        service.validateAndThrow(storeId, items, userId, 'sale'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should include error details in exception message', async () => {
      const item = { id: 'item-1', userId, name: 'Item 1', currentStock: 1000 };
      const settings = { storeId, inventoryItemId: 'item-1', currentStock: 30 };

      mockInventoryItemRepository.findOne
        .mockResolvedValue(item)
        .mockResolvedValue(item);
      mockStoreItemSettingsRepository.findOne.mockResolvedValue(settings);

      const items = [
        { inventoryItemId: 'item-1', quantity: 50, description: 'Item 1' },
      ];

      try {
        await service.validateAndThrow(storeId, items, userId, 'sale');
        fail('Should have thrown BadRequestException');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toContain('Store stock validation failed');
        expect(error.message).toContain('Insufficient stock');
      }
    });
  });
});
