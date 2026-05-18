import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { InvoicesService } from '../src/invoices/invoices.service';
import { InventoryService } from '../src/inventory/inventory.service';
import { StoreService } from '../src/inventory/store.service';
import { StoreItemSettingsService } from '../src/inventory/store-item-settings.service';
import { StoreStockValidatorService } from '../src/inventory/store-stock-validator.service';
import { Invoice } from '../src/invoices/entities/invoice.entity';
import { InvoiceItem } from '../src/invoices/entities/invoice-item.entity';
import { InventoryItem } from '../src/inventory/entities/inventory-item.entity';
import { Store } from '../src/inventory/entities/store.entity';
import { StoreItemSettings } from '../src/inventory/entities/store-item-settings.entity';
import { StockMovement } from '../src/inventory/entities/stock-movement.entity';
import { Client } from '../src/clients/entities/client.entity';
import { User } from '../src/users/entities/user.entity';
import { UserSettings } from '../src/user-settings/entities/user-settings.entity';
import { MailService } from '../src/mail/mail.service';
import { InvoicePdfService } from '../src/invoices/invoice-pdf.service';
import { UserSettingsService } from '../src/user-settings/user-settings.service';

/**
 * Integration tests for store-invoice functionality
 * These tests verify the full flow of invoice creation, updates, and stock tracking with stores
 */
describe('Invoices-Store Integration', () => {
  let invoicesService: InvoicesService;
  let inventoryService: InventoryService;
  let storeService: StoreService;
  let storeItemSettingsService: StoreItemSettingsService;
  let invoiceRepository: Repository<Invoice>;
  let invoiceItemsRepository: Repository<InvoiceItem>;
  let inventoryRepository: Repository<InventoryItem>;
  let storeRepository: Repository<Store>;
  let storeItemSettingsRepository: Repository<StoreItemSettings>;
  let stockMovementRepository: Repository<StockMovement>;
  let clientRepository: Repository<Client>;
  let userRepository: Repository<User>;

  let testUser: User;
  let testClient: Client;
  let testStore: Store;
  let testInventoryItem: InventoryItem;

  const mockMailService = {
    sendMail: jest.fn(),
  };

  const mockInvoicePdfService = {
    generateInvoicePdf: jest.fn(),
  };

  const mockUserSettingsService = {
    getSettings: jest.fn().mockResolvedValue({}),
  };

  beforeEach(async () => {
    // Note: In a real integration test, you would use a test database
    // For now, we'll use mocks but structure it like integration tests
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoicesService,
        InventoryService,
        StoreService,
        StoreItemSettingsService,
        {
          provide: getRepositoryToken(Invoice),
          useValue: createMockRepository(),
        },
        {
          provide: getRepositoryToken(InvoiceItem),
          useValue: createMockRepository(),
        },
        {
          provide: getRepositoryToken(InventoryItem),
          useValue: createMockRepository(),
        },
        {
          provide: getRepositoryToken(Store),
          useValue: createMockRepository(),
        },
        {
          provide: getRepositoryToken(StoreItemSettings),
          useValue: createMockRepository(),
        },
        {
          provide: getRepositoryToken(StockMovement),
          useValue: createMockRepository(),
        },
        {
          provide: getRepositoryToken(Client),
          useValue: createMockRepository(),
        },
        {
          provide: getRepositoryToken(User),
          useValue: createMockRepository(),
        },
        {
          provide: getRepositoryToken(UserSettings),
          useValue: createMockRepository(),
        },
        {
          provide: MailService,
          useValue: mockMailService,
        },
        {
          provide: InvoicePdfService,
          useValue: mockInvoicePdfService,
        },
        {
          provide: UserSettingsService,
          useValue: mockUserSettingsService,
        },
      ],
    }).compile();

    invoicesService = module.get<InvoicesService>(InvoicesService);
    inventoryService = module.get<InventoryService>(InventoryService);
    storeService = module.get<StoreService>(StoreService);
    storeItemSettingsService = module.get<StoreItemSettingsService>(StoreItemSettingsService);

    invoiceRepository = module.get<Repository<Invoice>>(getRepositoryToken(Invoice));
    invoiceItemsRepository = module.get<Repository<InvoiceItem>>(getRepositoryToken(InvoiceItem));
    inventoryRepository = module.get<Repository<InventoryItem>>(getRepositoryToken(InventoryItem));
    storeRepository = module.get<Repository<Store>>(getRepositoryToken(Store));
    storeItemSettingsRepository = module.get<Repository<StoreItemSettings>>(
      getRepositoryToken(StoreItemSettings),
    );
    stockMovementRepository = module.get<Repository<StockMovement>>(
      getRepositoryToken(StockMovement),
    );
    clientRepository = module.get<Repository<Client>>(getRepositoryToken(Client));
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));

    // Setup test data
    testUser = { id: 'user-123', email: 'test@example.com' } as User;
    testClient = { id: 'client-123', userId: testUser.id, name: 'Test Client' } as Client;
    testStore = {
      id: 'store-123',
      userId: testUser.id,
      name: 'Test Store',
      code: 'TS1',
      active: true,
    } as Store;
    testInventoryItem = {
      id: 'item-123',
      userId: testUser.id,
      name: 'Test Item',
      sku: 'TEST-001',
      currentStock: 100,
      reservedStock: 0,
    } as InventoryItem;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

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

  describe('Full Invoice Lifecycle with Store', () => {
    it('should create draft invoice with storeId and reserve stock', async () => {
      const invoiceId = 'invoice-123';
      const savedInvoice = {
        id: invoiceId,
        userId: testUser.id,
        storeId: testStore.id,
        clientId: testClient.id,
        type: 'invoice',
        status: 'draft',
        number: 'INV-2024-0001',
      } as Invoice;

      // Mock store validation
      (storeRepository.findOne as jest.Mock).mockResolvedValue(testStore);
      (invoiceRepository.manager.connection.createQueryRunner as jest.Mock).mockReturnValue({
        connect: jest.fn().mockResolvedValue(undefined),
        startTransaction: jest.fn().mockResolvedValue(undefined),
        commitTransaction: jest.fn().mockResolvedValue(undefined),
        release: jest.fn().mockResolvedValue(undefined),
        manager: {
          save: jest.fn().mockResolvedValue(savedInvoice),
        },
        query: jest.fn().mockResolvedValue(undefined),
      });
      (invoiceRepository.count as jest.Mock).mockResolvedValue(0);
      (inventoryRepository.findOne as jest.Mock).mockResolvedValue(testInventoryItem);
      (inventoryRepository.save as jest.Mock).mockResolvedValue(testInventoryItem);
      (storeItemSettingsRepository.findOne as jest.Mock).mockResolvedValue(null);
      (storeItemSettingsRepository.create as jest.Mock).mockReturnValue({
        storeId: testStore.id,
        inventoryItemId: testInventoryItem.id,
        currentStock: 0,
      });
      (storeItemSettingsRepository.save as jest.Mock).mockResolvedValue({
        id: 'settings-123',
        storeId: testStore.id,
        inventoryItemId: testInventoryItem.id,
        currentStock: 95,
      });

      const invoiceData = {
        clientId: testClient.id,
        storeId: testStore.id,
        type: 'invoice',
        status: 'draft',
        issueDate: new Date().toISOString(),
        currency: 'USD',
        items: [
          {
            inventoryItemId: testInventoryItem.id,
            description: 'Test Item',
            quantity: 5,
            unitPrice: 100,
            taxRate: 0,
            discountRate: 0,
          },
        ],
      };

      await invoicesService.create(testUser.id, invoiceData);

      // Verify store stock was decreased (reserved)
      expect(storeItemSettingsRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ currentStock: 95 }),
      );
    });

    it('should update invoice from draft to sent and convert reserved to sale', async () => {
      const invoiceId = 'invoice-123';
      const existingInvoice = {
        id: invoiceId,
        userId: testUser.id,
        storeId: testStore.id,
        clientId: testClient.id,
        type: 'invoice',
        status: 'draft',
        number: 'INV-2024-0001',
        items: [
          {
            id: 'item-1',
            inventoryItemId: testInventoryItem.id,
            quantity: 5,
          },
        ],
      } as Invoice;

      (invoiceRepository.findOne as jest.Mock)
        .mockResolvedValueOnce(existingInvoice)
        .mockResolvedValueOnce({
          ...existingInvoice,
          status: 'sent',
        });
      (invoiceRepository.update as jest.Mock).mockResolvedValue(undefined);
      (invoiceItemsRepository.delete as jest.Mock).mockResolvedValue(undefined);
      (invoiceItemsRepository.save as jest.Mock).mockResolvedValue([]);
      (inventoryRepository.findOne as jest.Mock).mockResolvedValue({
        ...testInventoryItem,
        reservedStock: 5,
      });
      (inventoryRepository.save as jest.Mock).mockResolvedValue(testInventoryItem);
      (stockMovementRepository.create as jest.Mock).mockReturnValue({});
      (stockMovementRepository.save as jest.Mock).mockResolvedValue({});

      await invoicesService.update(invoiceId, testUser.id, { status: 'sent' });

      // Verify convertReservedToSale was called (through inventory service)
      expect(inventoryRepository.save).toHaveBeenCalled();
    });
  });

  describe('Store Stock Tracking', () => {
    it('should update store stock when invoice created with storeId', async () => {
      const invoiceId = 'invoice-123';
      const savedInvoice = {
        id: invoiceId,
        userId: testUser.id,
        storeId: testStore.id,
        clientId: testClient.id,
        type: 'invoice',
        status: 'sent',
        number: 'INV-2024-0001',
      } as Invoice;

      (storeRepository.findOne as jest.Mock).mockResolvedValue(testStore);
      (invoiceRepository.manager.connection.createQueryRunner as jest.Mock).mockReturnValue({
        connect: jest.fn().mockResolvedValue(undefined),
        startTransaction: jest.fn().mockResolvedValue(undefined),
        commitTransaction: jest.fn().mockResolvedValue(undefined),
        release: jest.fn().mockResolvedValue(undefined),
        manager: {
          save: jest.fn().mockResolvedValue(savedInvoice),
        },
        query: jest.fn().mockResolvedValue(undefined),
      });
      (invoiceRepository.count as jest.Mock).mockResolvedValue(0);
      (inventoryRepository.findOne as jest.Mock).mockResolvedValue(testInventoryItem);
      (inventoryRepository.save as jest.Mock).mockResolvedValue(testInventoryItem);
      (stockMovementRepository.create as jest.Mock).mockReturnValue({});
      (stockMovementRepository.save as jest.Mock).mockResolvedValue({});
      (storeItemSettingsRepository.findOne as jest.Mock).mockResolvedValue(null);
      (storeItemSettingsRepository.create as jest.Mock).mockReturnValue({
        storeId: testStore.id,
        inventoryItemId: testInventoryItem.id,
        currentStock: 0,
      });
      (storeItemSettingsRepository.save as jest.Mock).mockResolvedValue({
        id: 'settings-123',
        storeId: testStore.id,
        inventoryItemId: testInventoryItem.id,
        currentStock: 95,
      });

      const invoiceData = {
        clientId: testClient.id,
        storeId: testStore.id,
        type: 'invoice',
        status: 'sent',
        issueDate: new Date().toISOString(),
        currency: 'USD',
        items: [
          {
            inventoryItemId: testInventoryItem.id,
            description: 'Test Item',
            quantity: 5,
            unitPrice: 100,
            taxRate: 0,
            discountRate: 0,
          },
        ],
      };

      await invoicesService.create(testUser.id, invoiceData);

      // Verify store stock was decreased
      expect(storeItemSettingsRepository.save).toHaveBeenCalled();
    });

    it('should only update global stock when invoice created without storeId', async () => {
      const invoiceId = 'invoice-123';
      const savedInvoice = {
        id: invoiceId,
        userId: testUser.id,
        storeId: null,
        clientId: testClient.id,
        type: 'invoice',
        status: 'sent',
        number: 'INV-2024-0001',
      } as Invoice;

      (invoiceRepository.manager.connection.createQueryRunner as jest.Mock).mockReturnValue({
        connect: jest.fn().mockResolvedValue(undefined),
        startTransaction: jest.fn().mockResolvedValue(undefined),
        commitTransaction: jest.fn().mockResolvedValue(undefined),
        release: jest.fn().mockResolvedValue(undefined),
        manager: {
          save: jest.fn().mockResolvedValue(savedInvoice),
        },
        query: jest.fn().mockResolvedValue(undefined),
      });
      (invoiceRepository.count as jest.Mock).mockResolvedValue(0);
      (inventoryRepository.findOne as jest.Mock).mockResolvedValue(testInventoryItem);
      (inventoryRepository.save as jest.Mock).mockResolvedValue(testInventoryItem);
      (stockMovementRepository.create as jest.Mock).mockReturnValue({});
      (stockMovementRepository.save as jest.Mock).mockResolvedValue({});

      const invoiceData = {
        clientId: testClient.id,
        type: 'invoice',
        status: 'sent',
        issueDate: new Date().toISOString(),
        currency: 'USD',
        items: [
          {
            inventoryItemId: testInventoryItem.id,
            description: 'Test Item',
            quantity: 5,
            unitPrice: 100,
            taxRate: 0,
            discountRate: 0,
          },
        ],
      };

      await invoicesService.create(testUser.id, invoiceData);

      // Verify store stock was NOT updated
      expect(storeItemSettingsRepository.save).not.toHaveBeenCalled();
      // Verify global stock was updated
      expect(inventoryRepository.save).toHaveBeenCalled();
    });
  });

  describe('Store Validation', () => {
    it('should reject invoice creation with non-existent storeId', async () => {
      (storeRepository.findOne as jest.Mock).mockResolvedValue(null);

      const invoiceData = {
        clientId: testClient.id,
        storeId: 'non-existent-store',
        type: 'invoice',
        issueDate: new Date().toISOString(),
        currency: 'USD',
        items: [
          {
            description: 'Test Item',
            quantity: 1,
            unitPrice: 100,
            taxRate: 0,
            discountRate: 0,
          },
        ],
      };

      await expect(invoicesService.create(testUser.id, invoiceData)).rejects.toThrow();
    });

    it('should reject invoice creation with storeId from different user', async () => {
      const otherUserStore = {
        id: 'store-other',
        userId: 'other-user',
        name: 'Other Store',
      } as Store;

      (storeRepository.findOne as jest.Mock).mockResolvedValue(otherUserStore);
      // StoreService.findOne will throw NotFoundException if userId doesn't match
      (storeService.findOne as jest.Mock).mockRejectedValue(
        new NotFoundException('Store not found'),
      );

      const invoiceData = {
        clientId: testClient.id,
        storeId: 'store-other',
        type: 'invoice',
        issueDate: new Date().toISOString(),
        currency: 'USD',
        items: [
          {
            description: 'Test Item',
            quantity: 1,
            unitPrice: 100,
            taxRate: 0,
            discountRate: 0,
          },
        ],
      };

      await expect(invoicesService.create(testUser.id, invoiceData)).rejects.toThrow();
    });
  });
});

