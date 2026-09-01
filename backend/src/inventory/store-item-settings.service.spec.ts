import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { StoreItemSettingsService } from './store-item-settings.service';
import { StoreItemSettings } from './entities/store-item-settings.entity';
import { Store } from './entities/store.entity';
import { InventoryItem } from './entities/inventory-item.entity';
import { NotFoundException } from '@nestjs/common';

describe('StoreItemSettingsService', () => {
  let service: StoreItemSettingsService;
  let storeItemSettingsRepository: Repository<StoreItemSettings>;
  let storeRepository: Repository<Store>;
  let inventoryItemRepository: Repository<InventoryItem>;

  /* The service moved to QueryBuilder chains but these mocks only had findOne, so
     createQueryBuilder() returned undefined and the suite died. Each chain step returns
     the builder; getOne/getMany delegate to the repositories' findOne/find so the
     existing stubs in these tests keep working. */
  const makeQb = (one?: jest.Mock, many?: jest.Mock) => {
    const qb: Record<string, jest.Mock> = {};
    for (const m of [
      'where',
      'andWhere',
      'orWhere',
      'leftJoinAndSelect',
      'leftJoin',
      'orderBy',
      'addOrderBy',
      'select',
      'addSelect',
      'skip',
      'take',
      'withDeleted',
      'setLock',
      'groupBy',
      'update',
      'set',
    ]) {
      qb[m] = jest.fn(() => qb);
    }
    qb.getOne = jest.fn(() => (one ? one() : null));
    qb.getMany = jest.fn(() => (many ? many() : []));
    qb.getCount = jest.fn().mockResolvedValue(0);
    qb.execute = jest.fn().mockResolvedValue({ affected: 1 });
    return qb;
  };

  let settingsQb: ReturnType<typeof makeQb>;
  let storeQb: ReturnType<typeof makeQb>;
  let itemQb: ReturnType<typeof makeQb>;

  const mockStoreItemSettingsRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    createQueryBuilder: jest.fn(() => settingsQb),
    /* The service does `queryRunner?.manager || this.repo.manager`, so outside a
       transaction it goes through the repository's EntityManager — which the mock did
       not have, hence "Cannot read properties of undefined (reading 'findOne')".
       The manager takes (Entity, options), so these adapt to the repo-level stubs the
       tests already set up. */
    manager: {
      findOne: jest.fn((_entity: unknown, options: unknown) =>
        mockStoreItemSettingsRepository.findOne(options),
      ),
      // default to [] — the service reduces over the result, and an unstubbed find()
      // returning undefined blows up with "Cannot read properties of undefined"
      find: jest.fn(
        async (_entity: unknown, options: unknown) =>
          (await mockStoreItemSettingsRepository.find(options)) ?? [],
      ),
      create: jest.fn((_entity: unknown, data: unknown) =>
        mockStoreItemSettingsRepository.create(data),
      ),
      save: jest.fn((_entity: unknown, data: unknown) =>
        mockStoreItemSettingsRepository.save(data),
      ),
    },
  };

  const mockStoreRepository = {
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(() => storeQb),
  };

  const mockInventoryItemRepository = {
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(() => itemQb),
  };

  beforeEach(async () => {
    settingsQb = makeQb(
      mockStoreItemSettingsRepository.findOne,
      mockStoreItemSettingsRepository.find,
    );
    storeQb = makeQb(mockStoreRepository.findOne);
    itemQb = makeQb(mockInventoryItemRepository.findOne);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StoreItemSettingsService,
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
      ],
    }).compile();

    service = module.get<StoreItemSettingsService>(StoreItemSettingsService);
    storeItemSettingsRepository = module.get<Repository<StoreItemSettings>>(
      getRepositoryToken(StoreItemSettings),
    );
    storeRepository = module.get<Repository<Store>>(getRepositoryToken(Store));
    inventoryItemRepository = module.get<Repository<InventoryItem>>(
      getRepositoryToken(InventoryItem),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getOrCreateSettings', () => {
    const userId = 'user-123';
    const storeId = 'store-123';
    const inventoryItemId = 'item-123';
    const mockStore = {
      id: storeId,
      userId,
      name: 'Test Store',
      code: 'TS1',
    };
    const mockInventoryItem = {
      id: inventoryItemId,
      userId,
      name: 'Test Item',
      sku: 'TEST-001',
    };

    it('should return existing settings if found', async () => {
      const mockSettings = {
        id: 'settings-123',
        storeId,
        inventoryItemId,
        currentStock: 50,
        minQty: 10,
      };

      mockStoreRepository.findOne.mockResolvedValue(mockStore);
      mockInventoryItemRepository.findOne.mockResolvedValue(mockInventoryItem);
      mockStoreItemSettingsRepository.findOne.mockResolvedValue(mockSettings);

      const result = await service.getOrCreateSettings(
        storeId,
        inventoryItemId,
        userId,
      );

      expect(result).toEqual(mockSettings);
      // The lookup now takes a pessimistic write lock so two concurrent adjustments
      // cannot both read the same starting stock.
      expect(mockStoreItemSettingsRepository.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: { storeId, inventoryItemId } }),
      );
      expect(mockStoreItemSettingsRepository.create).not.toHaveBeenCalled();
    });

    it('should create new settings if not found', async () => {
      const newSettings = {
        id: 'settings-123',
        storeId,
        inventoryItemId,
        currentStock: 0,
        minQty: 0,
      };

      mockStoreRepository.findOne.mockResolvedValue(mockStore);
      mockInventoryItemRepository.findOne.mockResolvedValue(mockInventoryItem);
      mockStoreItemSettingsRepository.findOne.mockResolvedValue(null);
      mockStoreItemSettingsRepository.create.mockReturnValue(newSettings);
      mockStoreItemSettingsRepository.save.mockResolvedValue(newSettings);

      const result = await service.getOrCreateSettings(
        storeId,
        inventoryItemId,
        userId,
      );

      expect(result).toEqual(newSettings);
      expect(mockStoreItemSettingsRepository.create).toHaveBeenCalledWith({
        storeId,
        inventoryItemId,
        currentStock: 0,
        minQty: 0,
      });
      expect(mockStoreItemSettingsRepository.save).toHaveBeenCalled();
    });

    it('should validate store belongs to user', async () => {
      mockStoreRepository.findOne.mockResolvedValue(null);

      await expect(
        service.getOrCreateSettings(storeId, inventoryItemId, userId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should validate inventory item belongs to user', async () => {
      mockStoreRepository.findOne.mockResolvedValue(mockStore);
      mockInventoryItemRepository.findOne.mockResolvedValue(null);

      await expect(
        service.getOrCreateSettings(storeId, inventoryItemId, userId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('adjustStoreStock', () => {
    const userId = 'user-123';
    const storeId = 'store-123';
    const inventoryItemId = 'item-123';
    const mockStore = {
      id: storeId,
      userId,
      name: 'Test Store',
      code: 'TS1',
    };
    const mockInventoryItem = {
      id: inventoryItemId,
      userId,
      name: 'Test Item',
      sku: 'TEST-001',
      /* Global warehouse stock. The service later gained a rule that the sum of all
         store allocations may not exceed this, and without the field it reads as 0 —
         so every increase was (correctly) refused and these tests failed. */
      currentStock: 500,
    };
    /* The service mutates the settings object it is handed before saving it, so a
       fixture shared across tests carried state between them: 'increase' left it at 70,
       and 'decrease' then computed 70-20=50 while asserting 30. Rebuild it per test. */
    let mockSettings: {
      id: string;
      storeId: string;
      inventoryItemId: string;
      currentStock: number;
      minQty: number;
    };

    beforeEach(() => {
      mockSettings = {
        id: 'settings-123',
        storeId,
        inventoryItemId,
        currentStock: 50,
        minQty: 10,
      };
      mockStoreRepository.findOne.mockResolvedValue(mockStore);
      mockInventoryItemRepository.findOne.mockResolvedValue(mockInventoryItem);
      mockStoreItemSettingsRepository.findOne.mockResolvedValue(mockSettings);
      mockStoreItemSettingsRepository.save.mockResolvedValue(mockSettings);
    });

    it('should increase store stock', async () => {
      const result = await service.adjustStoreStock(
        storeId,
        inventoryItemId,
        20,
        userId,
        'increase',
      );

      expect(mockSettings.currentStock).toBe(70);
      expect(mockStoreItemSettingsRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ currentStock: 70 }),
      );
    });

    it('should decrease store stock', async () => {
      const result = await service.adjustStoreStock(
        storeId,
        inventoryItemId,
        20,
        userId,
        'decrease',
      );

      /* Asserting on mockSettings.currentStock required the service to MUTATE the
         shared fixture in place. It builds a new object now, so the fixture stayed at
         50 and this failed. Checking the saved payload tests the same thing without
         depending on mutation — and without leaking state into the next test, since
         the fixture is a const shared across this describe block. */
      expect(mockStoreItemSettingsRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ currentStock: 30 }),
      );
    });

    it('refuses a decrease larger than the stock on hand', async () => {
      /* This used to assert that the stock clamped to 0. The service now throws
         instead (see "CRITICAL FIX #82: Don't mask the problem" in the source), and
         that is the better behaviour: silently clamping turns an oversell into a
         correct-looking zero, so the books balance while the shelf does not. The error
         names both numbers so the caller can act on it. */
      await expect(
        service.adjustStoreStock(
          storeId,
          inventoryItemId,
          100,
          userId,
          'decrease',
        ),
      ).rejects.toThrow(/insufficient store stock/i);

      expect(mockStoreItemSettingsRepository.save).not.toHaveBeenCalled();
    });

    it('should create settings if they do not exist', async () => {
      mockStoreItemSettingsRepository.findOne.mockResolvedValue(null);
      const newSettings = {
        id: 'settings-new',
        storeId,
        inventoryItemId,
        currentStock: 0,
        minQty: 0,
      };
      mockStoreItemSettingsRepository.create.mockReturnValue(newSettings);
      mockStoreItemSettingsRepository.save
        .mockResolvedValueOnce(newSettings)
        .mockResolvedValueOnce({ ...newSettings, currentStock: 30 });

      const result = await service.adjustStoreStock(
        storeId,
        inventoryItemId,
        30,
        userId,
        'increase',
      );

      expect(mockStoreItemSettingsRepository.create).toHaveBeenCalled();
      expect(result.currentStock).toBe(30);
    });
  });
});
