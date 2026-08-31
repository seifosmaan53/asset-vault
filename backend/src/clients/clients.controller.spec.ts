import { Test, TestingModule } from '@nestjs/testing';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { ExecutionContext } from '@nestjs/common';

/* The override targeted AuthGuard('jwt') — the Passport guard this controller used
   before authentication moved to Clerk. Nest therefore tried to construct the REAL
   ClerkAuthGuard, which needs UsersService, OrganizationsService and ConfigService, and
   failed to resolve them. Overriding the guard the controller actually declares keeps
   this a controller unit test rather than an auth-stack integration test. */
describe('ClientsController', () => {
  let controller: ClientsController;
  let service: ClientsService;

  const mockClientsService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
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
      controllers: [ClientsController],
      providers: [
        {
          provide: ClientsService,
          useValue: mockClientsService,
        },
      ],
    })
      .overrideGuard(ClerkAuthGuard)
      .useValue(mockAuthGuard)
      .compile();

    controller = module.get<ClientsController>(ClientsController);
    service = module.get<ClientsService>(ClientsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return all clients for user', async () => {
      const mockClients = [
        { id: 'client-1', name: 'Client 1' },
        { id: 'client-2', name: 'Client 2' },
      ];
      mockClientsService.findAll.mockResolvedValue(mockClients);

      const result = await controller.findAll({
        user: { userId: 'user-123' },
      } as any);

      expect(result).toEqual(mockClients);
      // findAll gained a second `filters` argument (search / date range); it is
      // undefined when the request carries no query parameters.
      expect(service.findAll).toHaveBeenCalledWith('user-123', undefined);
    });
  });

  describe('findOne', () => {
    it('should return a single client', async () => {
      const mockClient = { id: 'client-1', name: 'Client 1' };
      mockClientsService.findOne.mockResolvedValue(mockClient);

      const result = await controller.findOne('client-1', {
        user: { userId: 'user-123' },
      } as any);

      expect(result).toEqual(mockClient);
      expect(service.findOne).toHaveBeenCalledWith('client-1', 'user-123');
    });
  });

  describe('create', () => {
    it('should create a new client', async () => {
      const createDto = { name: 'New Client', email: 'client@example.com' };
      const mockClient = { id: 'client-1', ...createDto };
      mockClientsService.create.mockResolvedValue(mockClient);

      const result = await controller.create(createDto, {
        user: { userId: 'user-123' },
      } as any);

      expect(result).toEqual(mockClient);
      expect(service.create).toHaveBeenCalledWith('user-123', createDto);
    });
  });

  describe('update', () => {
    it('should update a client', async () => {
      const updateDto = { name: 'Updated Client' };
      const mockClient = { id: 'client-1', ...updateDto };
      mockClientsService.update.mockResolvedValue(mockClient);

      const result = await controller.update('client-1', updateDto, {
        user: { userId: 'user-123' },
      } as any);

      expect(result).toEqual(mockClient);
      expect(service.update).toHaveBeenCalledWith('client-1', 'user-123', updateDto);
    });
  });

  describe('remove', () => {
    it('should delete a client', async () => {
      mockClientsService.remove.mockResolvedValue(undefined);

      await controller.remove('client-1', {
        user: { userId: 'user-123' },
      } as any);

      expect(service.remove).toHaveBeenCalledWith('client-1', 'user-123');
    });
  });
});

