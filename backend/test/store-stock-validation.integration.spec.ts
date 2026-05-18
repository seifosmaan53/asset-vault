import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StoreStockValidatorService } from '../src/inventory/store-stock-validator.service';
import { InvoicesService } from '../src/invoices/invoices.service';
import { StoreItemSettings } from '../src/inventory/entities/store-item-settings.entity';
import { Store } from '../src/inventory/entities/store.entity';
import { InventoryItem } from '../src/inventory/entities/inventory-item.entity';
import { Invoice } from '../src/invoices/entities/invoice.entity';
import { InvoiceItem } from '../src/invoices/entities/invoice-item.entity';
import { StoreItemSettingsService } from '../src/inventory/store-item-settings.service';
import { StoreService } from '../src/inventory/store.service';
import { InventoryService } from '../src/inventory/inventory.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

/**
 * Integration tests for store stock validation in invoice workflows
 */
describe('Store Stock Validation Integration', () => {
  let storeStockValidator: StoreStockValidatorService;
  let invoicesService: InvoicesService;
  let storeItemSettingsService: StoreItemSettingsService;
  let storeService: StoreService;
  let inventoryService: InventoryService;

  let storeRepository: Repository<Store>;
  let inventoryRepository: Repository<InventoryItem>;
  let storeItemSettingsRepository: Repository<StoreItemSettings>;
  let invoiceRepository: Repository<Invoice>;

  const userId = 'user-123';
  const storeId = 'store-123';
  const inventoryItemId = 'item-123';
  const clientId = 'client-123';

  function createMockRepository() {
    return {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      remove: jest.fn(),
      count: jest.fn(),
      createQueryBuilder: jest.fn(() => ({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
        getRawMany: jest.fn().mockResolvedValue([]),
      })),
      manager: {
        connection: {
          createQueryRunner: jest.fn(() => ({
            connect: jest.fn().mockResolvedValue(undefined),
            startTransaction: jest.fn().mockResolvedValue(undefined),
            commitTransaction: jest.fn().mockResolvedValue(undefined),
            rollbackTransaction: jest.fn().mockResolvedValue(undefined),
            release: jest.fn().mockResolvedValue(undefined),
            manager: {
              save: jest.fn(),
            },
            query: jest.fn().mockResolvedValue(undefined),
          })),
        },
      },
    };
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StoreStockValidatorService,
        InvoicesService,
        StoreItemSettingsService,
        StoreService,
        InventoryService,
        {
          provide: getRepositoryToken(Store),
          useValue: createMockRepository(),
        },
        {
          provide: getRepositoryToken(InventoryItem),
          useValue: createMockRepository(),
        },
        {
          provide: getRepositoryToken(StoreItemSettings),
          useValue: createMockRepository(),
        },
        {
          provide: getRepositoryToken(Invoice),
          useValue: createMockRepository(),
        },
        {
          provide: getRepositoryToken(InvoiceItem),
          useValue: createMockRepository(),
        },
        {
          provide: getRepositoryToken(require('../src/inventory/entities/stock-movement.entity').StockMovement),
          useValue: createMockRepository(),
        },
        {
          provide: require('../src/user-settings/user-settings.service').UserSettingsService,
          useValue: {
            getSettings: jest.fn().mockResolvedValue({}),
          },
        },
        {
          provide: require('../src/mail/mail.service').MailService,
          useValue: {
            sendMail: jest.fn(),
          },
        },
        {
          provide: require('../src/invoices/invoice-pdf.service').InvoicePdfService,
          useValue: {
            generateInvoicePdf: jest.fn(),
          },
        },
      ],
    }).compile();

    storeStockValidator = module.get<StoreStockValidatorService>(StoreStockValidatorService);
    invoicesService = module.get<InvoicesService>(InvoicesService);
    storeItemSettingsService = module.get<StoreItemSettingsService>(StoreItemSettingsService);
    storeService = module.get<StoreService>(StoreService);
    inventoryService = module.get<InventoryService>(InventoryService);

    storeRepository = module.get<Repository<Store>>(getRepositoryToken(Store));
    inventoryRepository = module.get<Repository<InventoryItem>>(getRepositoryToken(InventoryItem));
    storeItemSettingsRepository = module.get<Repository<StoreItemSettings>>(
      getRepositoryToken(StoreItemSettings),
    );
    invoiceRepository = module.get<Repository<Invoice>>(getRepositoryToken(Invoice));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Invoice Creation with Store Stock Validation', () => {
    it('should prevent invoice creation when store stock is insufficient', async () => {
      const mockStore = { id: storeId, userId, name: 'Test Store', active: true };
      const mockInventoryItem = {
        id: inventoryItemId,
        userId,
        name: 'Test Item',
        currentStock: 100,
      };
      const mockSettings = {
        id: 'settings-1',
        storeId,
        inventoryItemId,
        currentStock: 5, // Only 5 available
      };

      (storeRepository.findOne as jest.Mock).mockResolvedValue(mockStore);
      (inventoryRepository.findOne as jest.Mock).mockResolvedValue(mockInventoryItem);
      (storeItemSettingsRepository.findOne as jest.Mock).mockResolvedValue(mockSettings);

      const invoiceData = {
        clientId,
        storeId,
        type: 'invoice',
        status: 'draft',
        issueDate: new Date().toISOString(),
        currency: 'USD',
        items: [
          {
            inventoryItemId,
            description: 'Test Item',
            quantity: 10, // More than available (5)
            unitPrice: 100,
            taxRate: 0,
            discountRate: 0,
          },
        ],
      };

      // Mock the service dependencies
      (storeService.findOne as jest.Mock).mockResolvedValue(mockStore);
      (invoiceRepository.count as jest.Mock).mockResolvedValue(0);

      await expect(invoicesService.create(userId, invoiceData)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should allow invoice creation when store stock is sufficient', async () => {
      const mockStore = { id: storeId, userId, name: 'Test Store', active: true };
      const mockInventoryItem = {
        id: inventoryItemId,
        userId,
        name: 'Test Item',
        currentStock: 100,
      };
      const mockSettings = {
        id: 'settings-1',
        storeId,
        inventoryItemId,
        currentStock: 50, // Sufficient stock
      };

      (storeRepository.findOne as jest.Mock).mockResolvedValue(mockStore);
      (inventoryRepository.findOne as jest.Mock).mockResolvedValue(mockInventoryItem);
      (storeItemSettingsRepository.findOne as jest.Mock).mockResolvedValue(mockSettings);

      const invoiceData = {
        clientId,
        storeId,
        type: 'invoice',
        status: 'draft',
        issueDate: new Date().toISOString(),
        currency: 'USD',
        items: [
          {
            inventoryItemId,
            description: 'Test Item',
            quantity: 10, // Less than available (50)
            unitPrice: 100,
            taxRate: 0,
            discountRate: 0,
          },
        ],
      };

      (storeService.findOne as jest.Mock).mockResolvedValue(mockStore);
      (invoiceRepository.count as jest.Mock).mockResolvedValue(0);
      (invoiceRepository.manager.connection.createQueryRunner as jest.Mock).mockReturnValue({
        connect: jest.fn().mockResolvedValue(undefined),
        startTransaction: jest.fn().mockResolvedValue(undefined),
        commitTransaction: jest.fn().mockResolvedValue(undefined),
        release: jest.fn().mockResolvedValue(undefined),
        manager: {
          save: jest.fn().mockResolvedValue({
            id: 'invoice-123',
            ...invoiceData,
          }),
        },
        query: jest.fn().mockResolvedValue(undefined),
      });

      // Should not throw
      await expect(invoicesService.create(userId, invoiceData)).resolves.toBeDefined();
    });
  });

  describe('Store Stock Validation Edge Cases', () => {
    it('should handle zero stock correctly', async () => {
      const mockStore = { id: storeId, userId, name: 'Test Store' };
      const mockInventoryItem = { id: inventoryItemId, userId, name: 'Test Item' };
      const mockSettings = {
        storeId,
        inventoryItemId,
        currentStock: 0,
      };

      (storeRepository.findOne as jest.Mock).mockResolvedValue(mockStore);
      (inventoryItemRepository.findOne as jest.Mock).mockResolvedValue(mockInventoryItem);
      (storeItemSettingsRepository.findOne as jest.Mock).mockResolvedValue(mockSettings);

      const result = await storeStockValidator.validateStoreStockAvailability(
        storeId,
        inventoryItemId,
        1,
        userId,
        'sale',
      );

      expect(result.isValid).toBe(false);
      expect(result.availableStock).toBe(0);
    });

    it('should handle missing store item settings (defaults to 0)', async () => {
      const mockStore = { id: storeId, userId, name: 'Test Store' };
      const mockInventoryItem = { id: inventoryItemId, userId, name: 'Test Item' };

      (storeRepository.findOne as jest.Mock).mockResolvedValue(mockStore);
      (inventoryItemRepository.findOne as jest.Mock).mockResolvedValue(mockInventoryItem);
      (storeItemSettingsRepository.findOne as jest.Mock).mockResolvedValue(null);

      const availableStock = await storeStockValidator.getAvailableStoreStock(
        storeId,
        inventoryItemId,
        userId,
      );

      expect(availableStock).toBe(0);
    });
  });
});

