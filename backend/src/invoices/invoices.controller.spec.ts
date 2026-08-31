import { Test, TestingModule } from '@nestjs/testing';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { QuotaGuard } from '../subscriptions/quota.guard';
import { ExecutionContext } from '@nestjs/common';

/* The override targeted AuthGuard('jwt') — the Passport guard this controller used
   before authentication moved to Clerk. Nest therefore tried to construct the REAL
   ClerkAuthGuard, which needs UsersService, OrganizationsService and ConfigService, and
   failed to resolve them. Overriding the guard the controller actually declares keeps
   this a controller unit test rather than an auth-stack integration test. */
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
      .overrideGuard(ClerkAuthGuard)
      .useValue(mockAuthGuard)
      // The controller also carries QuotaGuard (plan usage limits), which pulls in
      // UsageService and SubscriptionsService. Not what a controller unit test is for.
      .overrideGuard(QuotaGuard)
      .useValue({ canActivate: () => true })
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
      // CreateInvoiceDto requires issueDate and currency; the fixture predates both.
      const createDto = {
        clientId: 'client-1',
        type: 'invoice' as const,
        issueDate: '2026-01-15',
        currency: 'USD',
        items: [],
      };
      const mockInvoice = { id: 'invoice-1', ...createDto };
      mockInvoicesService.create.mockResolvedValue(mockInvoice);

      const result = await controller.create(createDto, {
        user: { userId: 'user-123' },
      } as any);

      /* create/update now return an envelope — { data, message } — rather than the
         bare entity. Asserting on result.data keeps the test about the payload while
         still proving the wrapper is there. */
      expect(result.data).toEqual(mockInvoice);
      expect(result.message).toMatch(/created/i);
      expect(service.create).toHaveBeenCalledWith('user-123', createDto);
    });
  });

  describe('update', () => {
    it('should update an invoice', async () => {
      // status is a union type ('draft' | 'sent' | ...), so the literal needs narrowing.
      const updateDto = { status: 'sent' as const };
      const mockInvoice = { id: 'invoice-1', ...updateDto };
      mockInvoicesService.update.mockResolvedValue(mockInvoice);

      const result = await controller.update('invoice-1', updateDto, {
        user: { userId: 'user-123' },
      } as any);

      expect(result.data).toEqual(mockInvoice);
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

      // getStats spreads the figures and adds a message alongside them.
      expect(result).toEqual(expect.objectContaining(mockStats));
      expect(result.message).toMatch(/statistics/i);
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

      // send() gained an emailOptions body parameter between the id and the request.
      const emailOptions = { to: 'client@example.test' };
      const result = await controller.send('invoice-1', emailOptions, {
        user: { userId: 'user-123' },
      } as any);

      expect(result).toEqual(mockResponse);
      expect(service.sendEmail).toHaveBeenCalledWith('invoice-1', 'user-123', emailOptions);
    });
  });
});

