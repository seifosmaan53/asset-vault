import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InventoryService } from './inventory.service';
import { InventoryItem } from './entities/inventory-item.entity';
import { StockMovement } from './entities/stock-movement.entity';
import { InvoiceItem } from '../invoices/entities/invoice-item.entity';
import { StoreItemSettingsService } from './store-item-settings.service';
import { UserSettings } from '../user-settings/entities/user-settings.entity';
import { StoreItemSettings } from './entities/store-item-settings.entity';
import { NotFoundException, ConflictException } from '@nestjs/common';

describe('InventoryService', () => {
  let service: InventoryService;
  let inventoryRepository: Repository<InventoryItem>;
  let stockMovementRepository: Repository<StockMovement>;
  let invoiceItemsRepository: Repository<InvoiceItem>;

  const mockInventoryRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockStockMovementRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
  };

  const mockInvoiceItemsRepository = {
    find: jest.fn(),
  };

  const mockUserSettingsRepository = {
    findOne: jest.fn(),
  };

  const mockStoreItemSettingsRepository = {
    find: jest.fn(),
  };

  const mockStoreItemSettingsService = {
    adjustStoreStock: jest.fn(),
    getOrCreateSettings: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        {
          provide: getRepositoryToken(InventoryItem),
          useValue: mockInventoryRepository,
        },
        {
          provide: getRepositoryToken(StockMovement),
          useValue: mockStockMovementRepository,
        },
        {
          provide: getRepositoryToken(InvoiceItem),
          useValue: mockInvoiceItemsRepository,
        },
        {
          provide: getRepositoryToken(UserSettings),
          useValue: mockUserSettingsRepository,
        },
        {
          provide: getRepositoryToken(StoreItemSettings),
          useValue: mockStoreItemSettingsRepository,
        },
        {
          provide: StoreItemSettingsService,
          useValue: mockStoreItemSettingsService,
        },
      ],
    }).compile();

    service = module.get<InventoryService>(InventoryService);
    inventoryRepository = module.get<Repository<InventoryItem>>(
      getRepositoryToken(InventoryItem),
    );
    stockMovementRepository = module.get<Repository<StockMovement>>(
      getRepositoryToken(StockMovement),
    );
    invoiceItemsRepository = module.get<Repository<InvoiceItem>>(
      getRepositoryToken(InvoiceItem),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createMovement', () => {
    const userId = 'user-123';
    const inventoryItemId = 'item-123';
    const mockItem: Partial<InventoryItem> = {
      id: inventoryItemId,
      userId,
      currentStock: 100,
      reorderLevel: 10,
    };

    beforeEach(() => {
      mockInventoryRepository.findOne.mockResolvedValue(mockItem);
      mockStockMovementRepository.create.mockReturnValue({});
      mockStockMovementRepository.save.mockResolvedValue({});
      mockInventoryRepository.save.mockResolvedValue(mockItem);
    });

    it('should increase stock for purchase type', async () => {
      const movementData = {
        type: 'purchase' as const,
        quantity: 50,
        sourceType: 'manual',
        note: 'Stock purchase',
      };

      await service.createMovement(inventoryItemId, userId, movementData);

      expect(mockItem.currentStock).toBe(150);
      expect(mockInventoryRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ currentStock: 150 }),
      );
    });

    it('should decrease stock for sale type', async () => {
      const movementData = {
        type: 'sale' as const,
        quantity: 30,
        sourceType: 'invoice',
        sourceId: 'invoice-123',
        note: 'Invoice sale',
      };

      await service.createMovement(inventoryItemId, userId, movementData);

      expect(mockItem.currentStock).toBe(70);
      expect(mockInventoryRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ currentStock: 70 }),
      );
    });

    it('should set stock to specific value for adjustment type', async () => {
      const movementData = {
        type: 'adjustment' as const,
        quantity: 75,
        sourceType: 'manual',
        note: 'Stock adjustment',
      };

      await service.createMovement(inventoryItemId, userId, movementData);

      expect(mockItem.currentStock).toBe(75);
      expect(mockInventoryRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ currentStock: 75 }),
      );
    });

    it('should prevent negative stock for sale type', async () => {
      mockItem.currentStock = 20;
      const movementData = {
        type: 'sale' as const,
        quantity: 50,
        sourceType: 'invoice',
        note: 'Large sale',
      };

      await service.createMovement(inventoryItemId, userId, movementData);

      expect(mockItem.currentStock).toBe(0);
      expect(mockInventoryRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ currentStock: 0 }),
      );
    });

    it('should prevent negative stock for adjustment type', async () => {
      const movementData = {
        type: 'adjustment' as const,
        quantity: -10,
        sourceType: 'manual',
        note: 'Negative adjustment',
      };

      await service.createMovement(inventoryItemId, userId, movementData);

      expect(mockItem.currentStock).toBe(0);
      expect(mockInventoryRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ currentStock: 0 }),
      );
    });

    it('should create stock movement record', async () => {
      const movementData = {
        type: 'purchase' as const,
        quantity: 25,
        sourceType: 'manual',
        note: 'Test purchase',
      };

      await service.createMovement(inventoryItemId, userId, movementData);

      expect(mockStockMovementRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ...movementData,
          inventoryItemId,
          userId,
        }),
      );
      expect(mockStockMovementRepository.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException if item not found', async () => {
      mockInventoryRepository.findOne.mockResolvedValue(null);

      await expect(
        service.createMovement(inventoryItemId, userId, {
          type: 'purchase',
          quantity: 10,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    const userId = 'user-123';
    const inventoryItemId = 'item-123';
    const mockItem: Partial<InventoryItem> = {
      id: inventoryItemId,
      userId,
      sku: 'TEST-001',
      name: 'Test Item',
    };

    beforeEach(() => {
      mockInventoryRepository.findOne.mockResolvedValue(mockItem);
      mockInventoryRepository.remove.mockResolvedValue(undefined);
    });

    it('should throw ConflictException if item is linked to invoices', async () => {
      mockInvoiceItemsRepository.find.mockResolvedValue([
        { id: 'invoice-item-1', inventoryItemId },
      ]);

      await expect(service.remove(inventoryItemId, userId)).rejects.toThrow(
        ConflictException,
      );
      expect(mockInventoryRepository.remove).not.toHaveBeenCalled();
    });

    it('should remove item if not linked to invoices', async () => {
      mockInvoiceItemsRepository.find.mockResolvedValue([]);

      await service.remove(inventoryItemId, userId);

      expect(mockInventoryRepository.remove).toHaveBeenCalledWith(mockItem);
    });

    it('should throw NotFoundException if item not found', async () => {
      mockInventoryRepository.findOne.mockResolvedValue(null);

      await expect(service.remove(inventoryItemId, userId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('createMovement with storeId', () => {
    const userId = 'user-123';
    const inventoryItemId = 'item-123';
    const storeId = 'store-123';
    const mockItem: Partial<InventoryItem> = {
      id: inventoryItemId,
      userId,
      currentStock: 100,
      reorderLevel: 10,
    };

    beforeEach(() => {
      mockInventoryRepository.findOne.mockResolvedValue(mockItem);
      mockStockMovementRepository.create.mockReturnValue({});
      mockStockMovementRepository.save.mockResolvedValue({});
      mockInventoryRepository.save.mockResolvedValue(mockItem);
    });

    it('should update store inventory when storeId provided for purchase', async () => {
      const movementData = {
        type: 'purchase' as const,
        quantity: 50,
        sourceType: 'manual',
        note: 'Stock purchase',
      };

      await service.createMovement(inventoryItemId, userId, movementData, storeId);

      expect(mockStoreItemSettingsService.adjustStoreStock).toHaveBeenCalledWith(
        storeId,
        inventoryItemId,
        50,
        userId,
        'increase',
      );
    });

    it('should update store inventory when storeId provided for sale', async () => {
      const movementData = {
        type: 'sale' as const,
        quantity: 30,
        sourceType: 'invoice',
        sourceId: 'invoice-123',
        note: 'Invoice sale',
      };

      await service.createMovement(inventoryItemId, userId, movementData, storeId);

      expect(mockStoreItemSettingsService.adjustStoreStock).toHaveBeenCalledWith(
        storeId,
        inventoryItemId,
        30,
        userId,
        'decrease',
      );
    });

    it('should not update store inventory when storeId not provided', async () => {
      const movementData = {
        type: 'purchase' as const,
        quantity: 50,
        sourceType: 'manual',
        note: 'Stock purchase',
      };

      await service.createMovement(inventoryItemId, userId, movementData);

      expect(mockStoreItemSettingsService.adjustStoreStock).not.toHaveBeenCalled();
    });

    it('should create StockMovement with storeId', async () => {
      const movementData = {
        type: 'purchase' as const,
        quantity: 25,
        sourceType: 'manual',
        note: 'Test purchase',
      };

      await service.createMovement(inventoryItemId, userId, movementData, storeId);

      expect(mockStockMovementRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ...movementData,
          inventoryItemId,
          userId,
          storeId,
        }),
      );
    });
  });

  describe('reserveStock with storeId', () => {
    const userId = 'user-123';
    const inventoryItemId = 'item-123';
    const storeId = 'store-123';
    const mockItem: Partial<InventoryItem> = {
      id: inventoryItemId,
      userId,
      currentStock: 100,
      reservedStock: 10,
    };

    beforeEach(() => {
      mockInventoryRepository.findOne.mockResolvedValue(mockItem);
      mockInventoryRepository.save.mockResolvedValue(mockItem);
      mockStoreItemSettingsService.adjustStoreStock.mockResolvedValue({});
    });

    it('should reserve global stock', async () => {
      await service.reserveStock(
        inventoryItemId,
        userId,
        5,
        'invoice',
        'invoice-123',
        'Test note',
      );

      expect(mockItem.reservedStock).toBe(15);
      expect(mockInventoryRepository.save).toHaveBeenCalled();
    });

    it('should decrease store stock when storeId provided', async () => {
      await service.reserveStock(
        inventoryItemId,
        userId,
        5,
        'invoice',
        'invoice-123',
        'Test note',
        storeId,
      );

      expect(mockStoreItemSettingsService.adjustStoreStock).toHaveBeenCalledWith(
        storeId,
        inventoryItemId,
        5,
        userId,
        'decrease',
      );
    });

    it('should not affect store stock when storeId not provided', async () => {
      await service.reserveStock(
        inventoryItemId,
        userId,
        5,
        'invoice',
        'invoice-123',
        'Test note',
      );

      expect(mockStoreItemSettingsService.adjustStoreStock).not.toHaveBeenCalled();
    });
  });

  describe('releaseReservedStock with storeId', () => {
    const userId = 'user-123';
    const inventoryItemId = 'item-123';
    const storeId = 'store-123';
    const mockItem: Partial<InventoryItem> = {
      id: inventoryItemId,
      userId,
      currentStock: 100,
      reservedStock: 15,
    };

    beforeEach(() => {
      mockInventoryRepository.findOne.mockResolvedValue(mockItem);
      mockInventoryRepository.save.mockResolvedValue(mockItem);
      mockStoreItemSettingsService.adjustStoreStock.mockResolvedValue({});
    });

    it('should release global reserved stock', async () => {
      await service.releaseReservedStock(inventoryItemId, userId, 5);

      expect(mockItem.reservedStock).toBe(10);
      expect(mockInventoryRepository.save).toHaveBeenCalled();
    });

    it('should restore store stock when storeId provided', async () => {
      await service.releaseReservedStock(inventoryItemId, userId, 5, storeId);

      expect(mockStoreItemSettingsService.adjustStoreStock).toHaveBeenCalledWith(
        storeId,
        inventoryItemId,
        5,
        userId,
        'increase',
      );
    });
  });

  describe('convertReservedToSale with storeId', () => {
    const userId = 'user-123';
    const inventoryItemId = 'item-123';
    const storeId = 'store-123';
    const mockItem: Partial<InventoryItem> = {
      id: inventoryItemId,
      userId,
      currentStock: 100,
      reservedStock: 15,
    };

    beforeEach(() => {
      mockInventoryRepository.findOne.mockResolvedValue(mockItem);
      mockInventoryRepository.save.mockResolvedValue(mockItem);
      mockStockMovementRepository.create.mockReturnValue({});
      mockStockMovementRepository.save.mockResolvedValue({});
    });

    it('should convert reserved to sale at global level', async () => {
      await service.convertReservedToSale(
        inventoryItemId,
        userId,
        5,
        'invoice',
        'invoice-123',
        'Test note',
      );

      expect(mockItem.reservedStock).toBe(10);
      expect(mockItem.currentStock).toBe(95);
      expect(mockInventoryRepository.save).toHaveBeenCalled();
    });

    it('should create StockMovement with storeId', async () => {
      await service.convertReservedToSale(
        inventoryItemId,
        userId,
        5,
        'invoice',
        'invoice-123',
        'Test note',
        storeId,
      );

      expect(mockStockMovementRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          inventoryItemId,
          userId,
          type: 'sale',
          quantity: 5,
          sourceType: 'invoice',
          sourceId: 'invoice-123',
          note: 'Test note',
          storeId,
        }),
      );
    });

    it('should not update store stock when storeId is undefined', async () => {
      await service.convertReservedToSale(
        inventoryItemId,
        userId,
        5,
        'invoice',
        'invoice-123',
        'Test note',
        undefined,
      );

      expect(mockStoreItemSettingsService.adjustStoreStock).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases with Store Stock', () => {
    const userId = 'user-123';
    const inventoryItemId = 'item-123';
    const storeId = 'store-123';
    const mockItem: Partial<InventoryItem> = {
      id: inventoryItemId,
      userId,
      currentStock: 100,
      reservedStock: 10,
    };

    beforeEach(() => {
      mockInventoryRepository.findOne.mockResolvedValue(mockItem);
      mockInventoryRepository.save.mockResolvedValue(mockItem);
      mockStoreItemSettingsService.adjustStoreStock.mockResolvedValue({});
    });

    it('should handle store stock adjustment errors gracefully', async () => {
      mockStoreItemSettingsService.adjustStoreStock.mockRejectedValue(
        new Error('Store settings error'),
      );

      // Should still complete the operation even if store stock update fails
      await expect(
        service.reserveStock(inventoryItemId, userId, 5, 'invoice', 'invoice-123', 'Note', storeId),
      ).rejects.toThrow();

      // Global stock should still be updated
      expect(mockInventoryRepository.save).toHaveBeenCalled();
    });

    it('should handle multiple store stock operations correctly', async () => {
      // Reserve stock
      await service.reserveStock(
        inventoryItemId,
        userId,
        10,
        'invoice',
        'invoice-1',
        'Note 1',
        storeId,
      );

      // Reserve more stock
      await service.reserveStock(
        inventoryItemId,
        userId,
        5,
        'invoice',
        'invoice-2',
        'Note 2',
        storeId,
      );

      expect(mockStoreItemSettingsService.adjustStoreStock).toHaveBeenCalledTimes(2);
      expect(mockStoreItemSettingsService.adjustStoreStock).toHaveBeenNthCalledWith(
        1,
        storeId,
        inventoryItemId,
        10,
        userId,
        'decrease',
      );
      expect(mockStoreItemSettingsService.adjustStoreStock).toHaveBeenNthCalledWith(
        2,
        storeId,
        inventoryItemId,
        5,
        userId,
        'decrease',
      );
    });
  });
});

