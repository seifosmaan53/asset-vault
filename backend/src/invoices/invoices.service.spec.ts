import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InvoicesService } from './invoices.service';
import { Invoice } from './entities/invoice.entity';
import { InvoiceItem } from './entities/invoice-item.entity';
import { InventoryService } from '../inventory/inventory.service';
import { StoreService } from '../inventory/store.service';
import { StoreStockValidatorService } from '../inventory/store-stock-validator.service';
import { MailService } from '../mail/mail.service';
import { InvoicePdfService } from './invoice-pdf.service';
import { UserSettingsService } from '../user-settings/user-settings.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('InvoicesService', () => {
  let service: InvoicesService;
  let invoicesRepository: Repository<Invoice>;
  let invoiceItemsRepository: Repository<InvoiceItem>;
  let inventoryService: InventoryService;
  let storeService: StoreService;

  const mockInvoicesRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
    softRemove: jest.fn(),
    createQueryBuilder: jest.fn(),
    manager: {
      connection: {
        createQueryRunner: jest.fn(),
      },
    },
  };

  const mockInvoiceItemsRepository = {
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };

  const mockInventoryService = {
    createMovement: jest.fn(),
    reserveStock: jest.fn(),
    releaseReservedStock: jest.fn(),
    convertReservedToSale: jest.fn(),
    deleteMovementsBySource: jest.fn(),
  };

  const mockStoreService = {
    findOne: jest.fn(),
  };

  const mockStoreStockValidator = {
    validateAndThrow: jest.fn(),
    validateStoreStockAvailability: jest.fn(),
    validateInvoiceItemsStoreStock: jest.fn(),
    getAvailableStoreStock: jest.fn(),
  };

  const mockMailService = {
    sendMail: jest.fn(),
  };

  const mockInvoicePdfService = {
    generateInvoicePdf: jest.fn(),
  };

  const mockUserSettingsService = {
    getSettings: jest.fn(),
  };

  const mockQueryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {
      save: jest.fn(),
    },
    query: jest.fn(),
  };

  beforeEach(async () => {
    mockInvoicesRepository.manager.connection.createQueryRunner.mockReturnValue(mockQueryRunner);
    mockQueryRunner.connect.mockResolvedValue(undefined);
    mockQueryRunner.startTransaction.mockResolvedValue(undefined);
    mockQueryRunner.commitTransaction.mockResolvedValue(undefined);
    mockQueryRunner.rollbackTransaction.mockResolvedValue(undefined);
    mockQueryRunner.release.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoicesService,
        {
          provide: getRepositoryToken(Invoice),
          useValue: mockInvoicesRepository,
        },
        {
          provide: getRepositoryToken(InvoiceItem),
          useValue: mockInvoiceItemsRepository,
        },
        {
          provide: InventoryService,
          useValue: mockInventoryService,
        },
        {
          provide: StoreService,
          useValue: mockStoreService,
        },
        {
          provide: StoreStockValidatorService,
          useValue: mockStoreStockValidator,
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

    service = module.get<InvoicesService>(InvoicesService);
    invoicesRepository = module.get<Repository<Invoice>>(
      getRepositoryToken(Invoice),
    );
    invoiceItemsRepository = module.get<Repository<InvoiceItem>>(
      getRepositoryToken(InvoiceItem),
    );
    inventoryService = module.get<InventoryService>(InventoryService);
    storeService = module.get<StoreService>(StoreService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateTotals', () => {
    it('should calculate totals correctly with single item', () => {
      const items = [
        {
          quantity: 2,
          unitPrice: 100,
          taxRate: 10,
          discountRate: 5,
        },
      ];

      // Access private method via type casting
      const result = (service as any).calculateTotals(items);

      expect(result.subtotal).toBe(200); // 2 * 100
      expect(result.discountTotal).toBe(10); // 200 * 0.05
      expect(result.taxTotal).toBe(19); // (200 - 10) * 0.10
      expect(result.total).toBe(209); // 200 - 10 + 19
    });

    it('should calculate totals correctly with multiple items', () => {
      const items = [
        {
          quantity: 2,
          unitPrice: 100,
          taxRate: 10,
          discountRate: 5,
        },
        {
          quantity: 3,
          unitPrice: 50,
          taxRate: 8,
          discountRate: 0,
        },
      ];

      const result = (service as any).calculateTotals(items);

      expect(result.subtotal).toBe(350); // (2 * 100) + (3 * 50)
      expect(result.discountTotal).toBe(10); // 200 * 0.05
      expect(result.taxTotal).toBe(28.4); // (190 * 0.10) + (150 * 0.08)
      expect(result.total).toBe(368.4); // 350 - 10 + 28.4
    });

    it('should handle zero tax and discount', () => {
      const items = [
        {
          quantity: 1,
          unitPrice: 100,
          taxRate: 0,
          discountRate: 0,
        },
      ];

      const result = (service as any).calculateTotals(items);

      expect(result.subtotal).toBe(100);
      expect(result.discountTotal).toBe(0);
      expect(result.taxTotal).toBe(0);
      expect(result.total).toBe(100);
    });

    it('should round totals to 2 decimal places', () => {
      const items = [
        {
          quantity: 3,
          unitPrice: 33.333,
          taxRate: 7.5,
          discountRate: 2.5,
        },
      ];

      const result = (service as any).calculateTotals(items);

      expect(result.subtotal).toBeCloseTo(99.999, 2);
      expect(result.total).toBeCloseTo(104.24, 2);
    });
  });

  describe('generateInvoiceNumber', () => {
    it('should generate invoice number with correct format', async () => {
      const userId = 'user-123';
      const year = new Date().getFullYear();
      mockInvoicesRepository.count.mockResolvedValue(5);

      const result = await (service as any).generateInvoiceNumber(
        userId,
        'invoice',
      );

      expect(result).toBe(`INV-${year}-0006`);
      expect(mockInvoicesRepository.count).toHaveBeenCalledWith({
        where: { userId, type: 'invoice' },
      });
    });

    it('should generate estimate number with EST prefix', async () => {
      const userId = 'user-123';
      const year = new Date().getFullYear();
      mockInvoicesRepository.count.mockResolvedValue(0);

      const result = await (service as any).generateInvoiceNumber(
        userId,
        'estimate',
      );

      expect(result).toBe(`EST-${year}-0001`);
    });

    it('should pad number with zeros', async () => {
      const userId = 'user-123';
      const year = new Date().getFullYear();
      mockInvoicesRepository.count.mockResolvedValue(99);

      const result = await (service as any).generateInvoiceNumber(
        userId,
        'invoice',
      );

      expect(result).toBe(`INV-${year}-0100`);
    });
  });

  describe('convertEstimateToInvoice', () => {
    it('should convert estimate to invoice', async () => {
      const userId = 'user-123';
      const invoiceId = 'invoice-123';
      const mockEstimate: Partial<Invoice> = {
        id: invoiceId,
        userId,
        type: 'estimate',
        status: 'draft',
        number: 'EST-2024-0001',
      };

      mockInvoicesRepository.findOne.mockResolvedValue(mockEstimate);
      mockInvoicesRepository.count.mockResolvedValue(10);
      mockInvoicesRepository.save.mockResolvedValue({
        ...mockEstimate,
        type: 'invoice',
        number: 'INV-2024-0011',
      });

      const result = await service.convertEstimateToInvoice(
        invoiceId,
        userId,
      );

      expect(result.type).toBe('invoice');
      expect(result.status).toBe('draft');
      expect(result.number).toBe('INV-2024-0011');
    });

    it('should throw BadRequestException if not an estimate', async () => {
      const userId = 'user-123';
      const invoiceId = 'invoice-123';
      const mockInvoice: Partial<Invoice> = {
        id: invoiceId,
        userId,
        type: 'invoice',
        status: 'draft',
      };

      mockInvoicesRepository.findOne.mockResolvedValue(mockInvoice);

      await expect(
        service.convertEstimateToInvoice(invoiceId, userId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('create() with storeId', () => {
    const userId = 'user-123';
    const storeId = 'store-123';
    const clientId = 'client-123';
    const mockStore = { id: storeId, userId, name: 'Test Store', code: 'TS1' };

    beforeEach(() => {
      mockUserSettingsService.getSettings.mockResolvedValue({});
      mockInvoicesRepository.count.mockResolvedValue(0);
      mockQueryRunner.manager.save.mockResolvedValue({
        id: 'invoice-123',
        userId,
        storeId,
        clientId,
        type: 'invoice',
        status: 'draft',
        number: 'INV-2024-0001',
      });
      mockQueryRunner.query.mockResolvedValue(undefined);
    });

    it('should create invoice with valid storeId', async () => {
      mockStoreService.findOne.mockResolvedValue(mockStore);

      const invoiceData = {
        clientId,
        storeId,
        type: 'invoice',
        status: 'draft',
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

      await service.create(userId, invoiceData);

      expect(mockStoreService.findOne).toHaveBeenCalledWith(storeId, userId);
      expect(mockQueryRunner.manager.save).toHaveBeenCalled();
    });

    it('should reject invoice with invalid storeId', async () => {
      mockStoreService.findOne.mockRejectedValue(new NotFoundException('Store not found'));

      const invoiceData = {
        clientId,
        storeId: 'invalid-store',
        type: 'invoice',
        issueDate: new Date().toISOString(),
        currency: 'USD',
        items: [{ description: 'Test', quantity: 1, unitPrice: 100, taxRate: 0, discountRate: 0 }],
      };

      await expect(service.create(userId, invoiceData)).rejects.toThrow(BadRequestException);
    });

    it('should reject invoice with storeId from different user', async () => {
      mockStoreService.findOne.mockRejectedValue(new NotFoundException('Store not found'));

      const invoiceData = {
        clientId,
        storeId: 'other-user-store',
        type: 'invoice',
        issueDate: new Date().toISOString(),
        currency: 'USD',
        items: [{ description: 'Test', quantity: 1, unitPrice: 100, taxRate: 0, discountRate: 0 }],
      };

      await expect(service.create(userId, invoiceData)).rejects.toThrow(BadRequestException);
    });

    it('should handle empty string storeId (convert to undefined)', async () => {
      const invoiceData = {
        clientId,
        storeId: '',
        type: 'invoice',
        issueDate: new Date().toISOString(),
        currency: 'USD',
        items: [{ description: 'Test', quantity: 1, unitPrice: 100, taxRate: 0, discountRate: 0 }],
      };

      await service.create(userId, invoiceData);

      expect(mockStoreService.findOne).not.toHaveBeenCalled();
    });

    it('should update global and store inventory for draft invoices', async () => {
      mockStoreService.findOne.mockResolvedValue(mockStore);
      const savedInvoice = {
        id: 'invoice-123',
        userId,
        storeId,
        clientId,
        type: 'invoice',
        status: 'draft',
        number: 'INV-2024-0001',
      };
      mockQueryRunner.manager.save.mockResolvedValue(savedInvoice);

      const invoiceData = {
        clientId,
        storeId,
        type: 'invoice',
        status: 'draft',
        issueDate: new Date().toISOString(),
        currency: 'USD',
        items: [
          {
            inventoryItemId: 'item-123',
            description: 'Test Item',
            quantity: 5,
            unitPrice: 100,
            taxRate: 0,
            discountRate: 0,
          },
        ],
      };

      await service.create(userId, invoiceData);

      expect(mockInventoryService.reserveStock).toHaveBeenCalledWith(
        'item-123',
        userId,
        5,
        'invoice',
        'invoice-123',
        expect.any(String),
        storeId,
      );
    });

    it('should update global and store inventory for sent/paid invoices', async () => {
      mockStoreService.findOne.mockResolvedValue(mockStore);
      const savedInvoice = {
        id: 'invoice-123',
        userId,
        storeId,
        clientId,
        type: 'invoice',
        status: 'sent',
        number: 'INV-2024-0001',
      };
      mockQueryRunner.manager.save.mockResolvedValue(savedInvoice);

      const invoiceData = {
        clientId,
        storeId,
        type: 'invoice',
        status: 'sent',
        issueDate: new Date().toISOString(),
        currency: 'USD',
        items: [
          {
            inventoryItemId: 'item-123',
            description: 'Test Item',
            quantity: 5,
            unitPrice: 100,
            taxRate: 0,
            discountRate: 0,
          },
        ],
      };

      await service.create(userId, invoiceData);

      expect(mockInventoryService.createMovement).toHaveBeenCalledWith(
        'item-123',
        userId,
        expect.objectContaining({
          type: 'sale',
          quantity: 5,
          sourceType: 'invoice',
          sourceId: 'invoice-123',
        }),
        storeId,
      );
    });

    it('should not update inventory for estimates', async () => {
      mockStoreService.findOne.mockResolvedValue(mockStore);
      const savedInvoice = {
        id: 'invoice-123',
        userId,
        storeId,
        clientId,
        type: 'estimate',
        status: 'draft',
        number: 'EST-2024-0001',
      };
      mockQueryRunner.manager.save.mockResolvedValue(savedInvoice);

      const invoiceData = {
        clientId,
        storeId,
        type: 'estimate',
        status: 'draft',
        issueDate: new Date().toISOString(),
        currency: 'USD',
        items: [
          {
            inventoryItemId: 'item-123',
            description: 'Test Item',
            quantity: 5,
            unitPrice: 100,
            taxRate: 0,
            discountRate: 0,
          },
        ],
      };

      await service.create(userId, invoiceData);

      expect(mockInventoryService.reserveStock).not.toHaveBeenCalled();
      expect(mockInventoryService.createMovement).not.toHaveBeenCalled();
    });

    it('should validate store stock before creating invoice with inventory items', async () => {
      mockStoreService.findOne.mockResolvedValue(mockStore);
      mockStoreStockValidator.validateAndThrow.mockResolvedValue(undefined);
      const savedInvoice = {
        id: 'invoice-123',
        userId,
        storeId,
        clientId,
        type: 'invoice',
        status: 'draft',
        number: 'INV-2024-0001',
      };
      mockQueryRunner.manager.save.mockResolvedValue(savedInvoice);

      const invoiceData = {
        clientId,
        storeId,
        type: 'invoice',
        status: 'draft',
        issueDate: new Date().toISOString(),
        currency: 'USD',
        items: [
          {
            inventoryItemId: 'item-123',
            description: 'Test Item',
            quantity: 5,
            unitPrice: 100,
            taxRate: 0,
            discountRate: 0,
          },
        ],
      };

      await service.create(userId, invoiceData);

      expect(mockStoreStockValidator.validateAndThrow).toHaveBeenCalledWith(
        storeId,
        invoiceData.items,
        userId,
        'reserve',
      );
    });

    it('should reject invoice creation when store stock validation fails', async () => {
      mockStoreService.findOne.mockResolvedValue(mockStore);
      mockStoreStockValidator.validateAndThrow.mockRejectedValue(
        new BadRequestException('Insufficient stock'),
      );

      const invoiceData = {
        clientId,
        storeId,
        type: 'invoice',
        status: 'draft',
        issueDate: new Date().toISOString(),
        currency: 'USD',
        items: [
          {
            inventoryItemId: 'item-123',
            description: 'Test Item',
            quantity: 100, // More than available
            unitPrice: 100,
            taxRate: 0,
            discountRate: 0,
          },
        ],
      };

      await expect(service.create(userId, invoiceData)).rejects.toThrow(BadRequestException);
      expect(mockStoreStockValidator.validateAndThrow).toHaveBeenCalled();
    });

    it('should not validate store stock for items without inventoryItemId', async () => {
      mockStoreService.findOne.mockResolvedValue(mockStore);
      const savedInvoice = {
        id: 'invoice-123',
        userId,
        storeId,
        clientId,
        type: 'invoice',
        status: 'draft',
        number: 'INV-2024-0001',
      };
      mockQueryRunner.manager.save.mockResolvedValue(savedInvoice);

      const invoiceData = {
        clientId,
        storeId,
        type: 'invoice',
        status: 'draft',
        issueDate: new Date().toISOString(),
        currency: 'USD',
        items: [
          {
            description: 'Service Item (no inventory)',
            quantity: 1,
            unitPrice: 100,
            taxRate: 0,
            discountRate: 0,
          },
        ],
      };

      await service.create(userId, invoiceData);

      // Should not call validator for items without inventoryItemId
      expect(mockStoreStockValidator.validateAndThrow).not.toHaveBeenCalled();
    });

    it('should validate store stock for sent status (sale operation)', async () => {
      mockStoreService.findOne.mockResolvedValue(mockStore);
      mockStoreStockValidator.validateAndThrow.mockResolvedValue(undefined);
      const savedInvoice = {
        id: 'invoice-123',
        userId,
        storeId,
        clientId,
        type: 'invoice',
        status: 'sent',
        number: 'INV-2024-0001',
      };
      mockQueryRunner.manager.save.mockResolvedValue(savedInvoice);

      const invoiceData = {
        clientId,
        storeId,
        type: 'invoice',
        status: 'sent',
        issueDate: new Date().toISOString(),
        currency: 'USD',
        items: [
          {
            inventoryItemId: 'item-123',
            description: 'Test Item',
            quantity: 5,
            unitPrice: 100,
            taxRate: 0,
            discountRate: 0,
          },
        ],
      };

      await service.create(userId, invoiceData);

      expect(mockStoreStockValidator.validateAndThrow).toHaveBeenCalledWith(
        storeId,
        invoiceData.items,
        userId,
        'sale',
      );
    });
  });

  describe('update() with storeId', () => {
    const userId = 'user-123';
    const invoiceId = 'invoice-123';
    const oldStoreId = 'store-old';
    const newStoreId = 'store-new';
    const mockStore = { id: newStoreId, userId, name: 'New Store', code: 'NS1' };

    beforeEach(() => {
      mockInvoicesRepository.findOne.mockResolvedValue({
        id: invoiceId,
        userId,
        storeId: oldStoreId,
        status: 'draft',
        type: 'invoice',
        items: [],
      });
      mockInvoicesRepository.update.mockResolvedValue(undefined);
      mockInvoiceItemsRepository.delete.mockResolvedValue(undefined);
      mockInvoiceItemsRepository.save.mockResolvedValue([]);
    });

    it('should update invoice storeId', async () => {
      mockStoreService.findOne.mockResolvedValue(mockStore);
      mockInvoicesRepository.findOne
        .mockResolvedValueOnce({
          id: invoiceId,
          userId,
          storeId: oldStoreId,
          status: 'draft',
          type: 'invoice',
          items: [],
        })
        .mockResolvedValueOnce({
          id: invoiceId,
          userId,
          storeId: newStoreId,
          status: 'draft',
          type: 'invoice',
          items: [],
        });

      await service.update(invoiceId, userId, { storeId: newStoreId });

      expect(mockStoreService.findOne).toHaveBeenCalledWith(newStoreId, userId);
      expect(mockInvoicesRepository.update).toHaveBeenCalledWith(
        { id: invoiceId, userId },
        { storeId: newStoreId },
      );
    });

    it('should validate new storeId belongs to user', async () => {
      mockStoreService.findOne.mockRejectedValue(new NotFoundException('Store not found'));

      await expect(
        service.update(invoiceId, userId, { storeId: 'invalid-store' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle empty string storeId (convert to undefined)', async () => {
      mockInvoicesRepository.findOne
        .mockResolvedValueOnce({
          id: invoiceId,
          userId,
          storeId: oldStoreId,
          status: 'draft',
          type: 'invoice',
          items: [],
        })
        .mockResolvedValueOnce({
          id: invoiceId,
          userId,
          storeId: undefined,
          status: 'draft',
          type: 'invoice',
          items: [],
        });

      await service.update(invoiceId, userId, { storeId: '' });

      expect(mockStoreService.findOne).not.toHaveBeenCalled();
    });

    it('should validate store stock when changing storeId with inventory items', async () => {
      mockStoreService.findOne.mockResolvedValue(mockStore);
      mockStoreStockValidator.validateAndThrow.mockResolvedValue(undefined);
      const existingInvoice = {
        id: invoiceId,
        userId,
        storeId: oldStoreId,
        status: 'draft',
        type: 'invoice',
        items: [
          {
            id: 'item-1',
            inventoryItemId: 'item-123',
            quantity: 5,
            description: 'Test Item',
          },
        ],
      };

      mockInvoicesRepository.findOne
        .mockResolvedValueOnce(existingInvoice)
        .mockResolvedValueOnce({
          ...existingInvoice,
          storeId: newStoreId,
        });

      await service.update(invoiceId, userId, { storeId: newStoreId });

      expect(mockStoreStockValidator.validateAndThrow).toHaveBeenCalledWith(
        newStoreId,
        expect.arrayContaining([
          expect.objectContaining({
            inventoryItemId: 'item-123',
            quantity: 5,
          }),
        ]),
        userId,
        'reserve',
      );
    });

    it('should reject update when store stock validation fails', async () => {
      mockStoreService.findOne.mockResolvedValue(mockStore);
      mockStoreStockValidator.validateAndThrow.mockRejectedValue(
        new BadRequestException('Insufficient stock'),
      );

      const existingInvoice = {
        id: invoiceId,
        userId,
        storeId: oldStoreId,
        status: 'draft',
        type: 'invoice',
        items: [
          {
            id: 'item-1',
            inventoryItemId: 'item-123',
            quantity: 100,
            description: 'Test Item',
          },
        ],
      };

      mockInvoicesRepository.findOne.mockResolvedValueOnce(existingInvoice);

      await expect(service.update(invoiceId, userId, { storeId: newStoreId })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should validate store stock when updating status from draft to sent', async () => {
      mockStoreService.findOne.mockResolvedValue(mockStore);
      mockStoreStockValidator.validateAndThrow.mockResolvedValue(undefined);
      const existingInvoice = {
        id: invoiceId,
        userId,
        storeId: oldStoreId,
        status: 'draft',
        type: 'invoice',
        items: [
          {
            id: 'item-1',
            inventoryItemId: 'item-123',
            quantity: 5,
            description: 'Test Item',
          },
        ],
      };

      mockInvoicesRepository.findOne
        .mockResolvedValueOnce(existingInvoice)
        .mockResolvedValueOnce({
          ...existingInvoice,
          status: 'sent',
        });

      await service.update(invoiceId, userId, { status: 'sent' });

      // Should validate for 'sale' operation when status changes to sent
      expect(mockStoreStockValidator.validateAndThrow).toHaveBeenCalledWith(
        oldStoreId,
        expect.arrayContaining([
          expect.objectContaining({
            inventoryItemId: 'item-123',
            quantity: 5,
          }),
        ]),
        userId,
        'sale',
      );
    });
  });

  describe('findOne() and findAll() with store', () => {
    const userId = 'user-123';
    const invoiceId = 'invoice-123';
    const storeId = 'store-123';

    it('should include store relation in findOne', async () => {
      const mockInvoice = {
        id: invoiceId,
        userId,
        storeId,
        store: { id: storeId, name: 'Test Store' },
        client: { id: 'client-123', name: 'Test Client' },
        items: [],
      };

      mockInvoicesRepository.findOne.mockResolvedValue(mockInvoice);

      const result = await service.findOne(invoiceId, userId);

      expect(result).toEqual(mockInvoice);
      expect(mockInvoicesRepository.findOne).toHaveBeenCalledWith({
        where: { id: invoiceId, userId },
        relations: ['client', 'store', 'items', 'items.inventoryItem'],
      });
    });

    it('should include store relation in findAll', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      mockInvoicesRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.findAll(userId);

      expect(mockQueryBuilder.leftJoinAndSelect).toHaveBeenCalledWith('invoice.store', 'store');
    });

    it('should filter by storeId when provided', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      mockInvoicesRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.findAll(userId, { storeId });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('invoice.storeId = :storeId', { storeId });
    });
  });
});

