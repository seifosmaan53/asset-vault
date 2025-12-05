import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InvoicesService } from './invoices.service';
import { Invoice } from './entities/invoice.entity';
import { InvoiceItem } from './entities/invoice-item.entity';
import { InventoryService } from '../inventory/inventory.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('InvoicesService', () => {
  let service: InvoicesService;
  let invoicesRepository: Repository<Invoice>;
  let invoiceItemsRepository: Repository<InvoiceItem>;
  let inventoryService: InventoryService;

  const mockInvoicesRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
    softRemove: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockInvoiceItemsRepository = {
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockInventoryService = {
    createMovement: jest.fn(),
  };

  beforeEach(async () => {
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
});

