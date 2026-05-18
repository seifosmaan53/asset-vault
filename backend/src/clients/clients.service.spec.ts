import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClientsService } from './clients.service';
import { Client } from './entities/client.entity';
import { NotFoundException, ConflictException } from '@nestjs/common';

describe('ClientsService', () => {
  let service: ClientsService;
  let repository: Repository<Client>;

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClientsService,
        {
          provide: getRepositoryToken(Client),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<ClientsService>(ClientsService);
    repository = module.get<Repository<Client>>(getRepositoryToken(Client));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a client successfully', async () => {
      const userId = 'user-123';
      const createDto = {
        name: 'Test Client',
        email: 'test@example.com',
        phone: '123-456-7890',
        street: '123 Main St',
        city: 'New York',
        state: 'NY',
        zip: '10001',
        country: 'USA',
      };

      const mockClient = { id: 'client-123', userId, ...createDto };
      mockRepository.create.mockReturnValue(mockClient);
      mockRepository.save.mockResolvedValue(mockClient);

      const result = await service.create(userId, createDto);

      expect(result).toEqual(mockClient);
      expect(mockRepository.create).toHaveBeenCalledWith({
        userId,
        ...createDto,
        addressJson: {
          street: createDto.street,
          city: createDto.city,
          state: createDto.state,
          zip: createDto.zip,
          country: createDto.country,
        },
      });
      expect(mockRepository.save).toHaveBeenCalledWith(mockClient);
    });

    it('should create a client without address', async () => {
      const userId = 'user-123';
      const createDto = {
        name: 'Test Client',
        email: 'test@example.com',
      };

      const mockClient = { id: 'client-123', userId, ...createDto };
      mockRepository.create.mockReturnValue(mockClient);
      mockRepository.save.mockResolvedValue(mockClient);

      const result = await service.create(userId, createDto);

      expect(result).toEqual(mockClient);
      expect(mockRepository.create).toHaveBeenCalledWith({
        userId,
        ...createDto,
        addressJson: null,
      });
    });
  });

  describe('findAll', () => {
    it('should return all clients for a user', async () => {
      const userId = 'user-123';
      const mockClients = [
        { id: 'client-1', userId, name: 'Client 1' },
        { id: 'client-2', userId, name: 'Client 2' },
      ];

      mockRepository.find.mockResolvedValue(mockClients);

      const result = await service.findAll(userId);

      expect(result).toEqual(mockClients);
      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { userId },
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('findOne', () => {
    it('should return a client by id', async () => {
      const userId = 'user-123';
      const clientId = 'client-123';
      const mockClient = { id: clientId, userId, name: 'Test Client' };

      mockRepository.findOne.mockResolvedValue(mockClient);

      const result = await service.findOne(clientId, userId);

      expect(result).toEqual(mockClient);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: clientId, userId },
      });
    });

    it('should throw NotFoundException if client not found', async () => {
      const userId = 'user-123';
      const clientId = 'client-123';

      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne(clientId, userId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a client successfully', async () => {
      const userId = 'user-123';
      const clientId = 'client-123';
      const updateDto = { name: 'Updated Client' };
      const existingClient = { id: clientId, userId, name: 'Test Client' };
      const updatedClient = { ...existingClient, ...updateDto };

      mockRepository.findOne.mockResolvedValue(existingClient);
      mockRepository.save.mockResolvedValue(updatedClient);

      const result = await service.update(clientId, userId, updateDto);

      expect(result).toEqual(updatedClient);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: clientId, userId },
      });
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException if client not found', async () => {
      const userId = 'user-123';
      const clientId = 'client-123';
      const updateDto = { name: 'Updated Client' };

      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.update(clientId, userId, updateDto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete a client successfully', async () => {
      const userId = 'user-123';
      const clientId = 'client-123';
      const mockClient = { id: clientId, userId, name: 'Test Client' };

      mockRepository.findOne.mockResolvedValue(mockClient);
      mockRepository.delete.mockResolvedValue({ affected: 1 });

      await service.remove(clientId, userId);

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: clientId, userId },
        relations: ['invoices'],
      });
      expect(mockRepository.delete).toHaveBeenCalledWith({ id: clientId, userId });
    });

    it('should throw NotFoundException if client not found', async () => {
      const userId = 'user-123';
      const clientId = 'client-123';

      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.remove(clientId, userId)).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if client has invoices', async () => {
      const userId = 'user-123';
      const clientId = 'client-123';
      const mockClient = {
        id: clientId,
        userId,
        name: 'Test Client',
        invoices: [{ id: 'invoice-1' }],
      };

      mockRepository.findOne.mockResolvedValue(mockClient);

      await expect(service.remove(clientId, userId)).rejects.toThrow(ConflictException);
    });
  });
});

