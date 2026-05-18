import { Test, TestingModule } from '@nestjs/testing';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { AuthGuard } from '@nestjs/passport';
import { ExecutionContext } from '@nestjs/common';

describe('InvoicesController', () => {
  let controller: InvoicesController;
  let service: InvoicesService;

  const mockInvoicesService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    getStats: jest.fn(),
    convertEstimateToInvoice: jest.fn(),
    sendEmail: jest.fn(),
    generatePdf: jest.fn(),
    backfillPaidAtDates: jest.fn(),
  };

  const mockAuthGuard = {
    canActivate: (context: ExecutionContext) => {
      const request = context.switchToHttp().getRequest();
      request.user = { userId: 'user-123' };
      return true;
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InvoicesController],
      providers: [
        {
          provide: InvoicesService,
          useValue: mockInvoicesService,
        },
      ],
    })
      .overrideGuard(AuthGuard('jwt'))
      .useValue(mockAuthGuard)
      .compile();

    controller = module.get<InvoicesController>(InvoicesController);
    service = module.get<InvoicesService>(InvoicesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return all invoices for user', async () => {
      const mockInvoices = [
        { id: 'invoice-1', number: 'INV-2024-0001' },
        { id: 'invoice-2', number: 'INV-2024-0002' },
      ];
      mockInvoicesService.findAll.mockResolvedValue(mockInvoices);

      const result = await controller.findAll(
        { user: { userId: 'user-123' } } as any,
        {},
      );

      expect(result).toEqual(mockInvoices);
      expect(service.findAll).toHaveBeenCalledWith('user-123', {});
    });

    it('should pass filters to service', async () => {
      const filters = { status: 'paid', type: 'invoice' };
      mockInvoicesService.findAll.mockResolvedValue([]);

      await controller.findAll(
        { user: { userId: 'user-123' } } as any,
        filters,
      );

      expect(service.findAll).toHaveBeenCalledWith('user-123', filters);
    });
  });

  describe('findOne', () => {
    it('should return single invoice', async () => {
      const mockInvoice = { id: 'invoice-1', number: 'INV-2024-0001' };
      mockInvoicesService.findOne.mockResolvedValue(mockInvoice);

      const result = await controller.findOne('invoice-1', {
        user: { userId: 'user-123' },
      } as any);

      expect(result).toEqual(mockInvoice);
      expect(service.findOne).toHaveBeenCalledWith('invoice-1', 'user-123');
    });
  });

  describe('create', () => {
    it('should create a new invoice', async () => {
      const createDto = {
        clientId: 'client-1',
        type: 'invoice' as const,
        items: [],
      };
      const mockInvoice = { id: 'invoice-1', ...createDto };
      mockInvoicesService.create.mockResolvedValue(mockInvoice);

      const result = await controller.create(createDto, {
        user: { userId: 'user-123' },
      } as any);

      expect(result).toEqual(mockInvoice);
      expect(service.create).toHaveBeenCalledWith('user-123', createDto);
    });
  });

  describe('update', () => {
    it('should update an invoice', async () => {
      const updateDto = { status: 'sent' };
      const mockInvoice = { id: 'invoice-1', ...updateDto };
      mockInvoicesService.update.mockResolvedValue(mockInvoice);

      const result = await controller.update('invoice-1', updateDto, {
        user: { userId: 'user-123' },
      } as any);

      expect(result).toEqual(mockInvoice);
      expect(service.update).toHaveBeenCalledWith('invoice-1', 'user-123', updateDto);
    });
  });

  describe('remove', () => {
    it('should delete an invoice', async () => {
      mockInvoicesService.remove.mockResolvedValue(undefined);

      await controller.remove('invoice-1', {
        user: { userId: 'user-123' },
      } as any);

      expect(service.remove).toHaveBeenCalledWith('invoice-1', 'user-123');
    });
  });

  describe('getStats', () => {
    it('should return invoice statistics', async () => {
      const mockStats = {
        totalAmount: 10000,
        unpaidAmount: 5000,
        overdueAmount: 2000,
      };
      mockInvoicesService.getStats.mockResolvedValue(mockStats);

      const result = await controller.getStats({
        user: { userId: 'user-123' },
      } as any);

      expect(result).toEqual(mockStats);
      expect(service.getStats).toHaveBeenCalledWith('user-123');
    });
  });

  describe('convert', () => {
    it('should convert estimate to invoice', async () => {
      const mockInvoice = { id: 'invoice-1', type: 'invoice' };
      mockInvoicesService.convertEstimateToInvoice.mockResolvedValue(mockInvoice);

      const result = await controller.convert('estimate-1', {
        user: { userId: 'user-123' },
      } as any);

      expect(result).toEqual(mockInvoice);
      expect(service.convertEstimateToInvoice).toHaveBeenCalledWith('estimate-1', 'user-123');
    });
  });

  describe('send', () => {
    it('should send invoice email', async () => {
      const mockResponse = { message: 'Email sent successfully' };
      mockInvoicesService.sendEmail.mockResolvedValue(mockResponse);

      const result = await controller.send('invoice-1', {
        user: { userId: 'user-123' },
      } as any);

      expect(result).toEqual(mockResponse);
      expect(service.sendEmail).toHaveBeenCalledWith('invoice-1', 'user-123');
    });
  });
});

