import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

  const mockStoreItemSettingsRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockStoreRepository = {
    findOne: jest.fn(),
  };

  const mockInventoryItemRepository = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
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

      const result = await service.getOrCreateSettings(storeId, inventoryItemId, userId);

      expect(result).toEqual(mockSettings);
      expect(mockStoreItemSettingsRepository.findOne).toHaveBeenCalledWith({
        where: { storeId, inventoryItemId },
      });
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

      const result = await service.getOrCreateSettings(storeId, inventoryItemId, userId);

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
    };
    const mockSettings = {
      id: 'settings-123',
      storeId,
      inventoryItemId,
      currentStock: 50,
      minQty: 10,
    };

    beforeEach(() => {
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

      expect(mockSettings.currentStock).toBe(30);
      expect(mockStoreItemSettingsRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ currentStock: 30 }),
      );
    });

    it('should prevent negative stock', async () => {
      const result = await service.adjustStoreStock(
        storeId,
        inventoryItemId,
        100,
        userId,
        'decrease',
      );

      expect(mockSettings.currentStock).toBe(0);
      expect(mockStoreItemSettingsRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ currentStock: 0 }),
      );
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

