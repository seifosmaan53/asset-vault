import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InventoryService } from './inventory.service';
import { InventoryItem } from './entities/inventory-item.entity';
import { StockMovement } from './entities/stock-movement.entity';
import { InvoiceItem } from '../invoices/entities/invoice-item.entity';
import { NotFoundException } from '@nestjs/common';

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
});

