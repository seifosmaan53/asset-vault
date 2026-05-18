import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsersService } from './users.service';
import { User, UserRole } from './entities/user.entity';
import * as bcrypt from 'bcryptjs';

describe('UsersService', () => {
  let service: UsersService;
  let repository: Repository<User>;

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    repository = module.get<Repository<User>>(getRepositoryToken(User));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new user with hashed password', async () => {
      const email = 'test@example.com';
      const password = 'password123';
      const name = 'Test User';
      const companyName = 'Test Company';

      const mockUser: User = {
        id: 'user-123',
        email: email.toLowerCase(),
        password: 'hashed-password',
        name: 'Test User',
        companyName: 'Test Company',
        role: UserRole.ADMIN,
        failedLoginAttempts: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as User;

      mockRepository.create.mockReturnValue(mockUser);
      mockRepository.save.mockResolvedValue(mockUser);

      const result = await service.create(email, password, name, companyName);

      expect(mockRepository.create).toHaveBeenCalled();
      expect(mockRepository.save).toHaveBeenCalled();
      expect(result.email).toBe(email.toLowerCase());
      expect(result.name).toBe('Test User');
      expect(result.companyName).toBe('Test Company');
      expect(result.failedLoginAttempts).toBe(0);
    });

    it('should normalize email to lowercase', async () => {
      const mockUser: User = {
        id: 'user-123',
        email: 'test@example.com',
        password: 'hashed',
        name: 'Test',
        role: UserRole.ADMIN,
        failedLoginAttempts: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as User;

      mockRepository.create.mockReturnValue(mockUser);
      mockRepository.save.mockResolvedValue(mockUser);

      await service.create('TEST@EXAMPLE.COM', 'password', 'Test');

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@example.com',
        }),
      );
    });

    it('should trim name and companyName', async () => {
      const mockUser: User = {
        id: 'user-123',
        email: 'test@example.com',
        password: 'hashed',
        name: 'Test User',
        companyName: 'Test Company',
        role: UserRole.ADMIN,
        failedLoginAttempts: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as User;

      mockRepository.create.mockReturnValue(mockUser);
      mockRepository.save.mockResolvedValue(mockUser);

      await service.create('test@example.com', 'password', '  Test User  ', '  Test Company  ');

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test User',
          companyName: 'Test Company',
        }),
      );
    });
  });

  describe('findByEmail', () => {
    it('should find user by email', async () => {
      const mockUser: User = {
        id: 'user-123',
        email: 'test@example.com',
        password: 'hashed',
        name: 'Test',
        role: UserRole.ADMIN,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as User;

      mockRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.findByEmail('test@example.com');

      expect(result).toEqual(mockUser);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
    });

    it('should normalize email to lowercase', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await service.findByEmail('TEST@EXAMPLE.COM');

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
    });

    it('should return null if user not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.findByEmail('nonexistent@example.com');

      expect(result).toBeNull();
    });
  });

  describe('findById', () => {
    it('should find user by id', async () => {
      const mockUser: User = {
        id: 'user-123',
        email: 'test@example.com',
        password: 'hashed',
        name: 'Test',
        role: UserRole.ADMIN,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as User;

      mockRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.findById('user-123');

      expect(result).toEqual(mockUser);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'user-123' },
      });
    });

    it('should return null if user not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.findById('nonexistent-id');

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update user and return updated user', async () => {
      const existingUser: User = {
        id: 'user-123',
        email: 'test@example.com',
        password: 'hashed',
        name: 'Old Name',
        role: UserRole.ADMIN,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as User;

      const updatedUser: User = {
        ...existingUser,
        name: 'New Name',
      };

      mockRepository.update.mockResolvedValue({ affected: 1 });
      mockRepository.findOne.mockResolvedValue(updatedUser);

      const result = await service.update('user-123', { name: 'New Name' });

      expect(mockRepository.update).toHaveBeenCalledWith('user-123', { name: 'New Name' });
      expect(result.name).toBe('New Name');
    });

    it('should throw error if user not found after update', async () => {
      mockRepository.update.mockResolvedValue({ affected: 1 });
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.update('nonexistent-id', { name: 'New Name' })).rejects.toThrow();
    });
  });

  describe('validatePassword', () => {
    it('should return true for valid password', async () => {
      const password = 'password123';
      const hashedPassword = await bcrypt.hash(password, 10);
      const user: User = {
        id: 'user-123',
        email: 'test@example.com',
        password: hashedPassword,
        name: 'Test',
        role: UserRole.ADMIN,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as User;

      const result = await service.validatePassword(user, password);

      expect(result).toBe(true);
    });

    it('should return false for invalid password', async () => {
      const password = 'password123';
      const hashedPassword = await bcrypt.hash(password, 10);
      const user: User = {
        id: 'user-123',
        email: 'test@example.com',
        password: hashedPassword,
        name: 'Test',
        role: UserRole.ADMIN,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as User;

      const result = await service.validatePassword(user, 'wrong-password');

      expect(result).toBe(false);
    });
  });

  describe('findAll', () => {
    it('should return all users', async () => {
      const mockUsers: User[] = [
        {
          id: 'user-1',
          email: 'user1@example.com',
          password: 'hashed1',
          name: 'User 1',
          role: UserRole.ADMIN,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'user-2',
          email: 'user2@example.com',
          password: 'hashed2',
          name: 'User 2',
          role: UserRole.STAFF,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ] as User[];

      mockRepository.find.mockResolvedValue(mockUsers);

      const result = await service.findAll();

      expect(result).toEqual(mockUsers);
      expect(mockRepository.find).toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should delete user', async () => {
      mockRepository.delete.mockResolvedValue({ affected: 1 });

      await service.delete('user-123');

      expect(mockRepository.delete).toHaveBeenCalledWith('user-123');
    });
  });
});

