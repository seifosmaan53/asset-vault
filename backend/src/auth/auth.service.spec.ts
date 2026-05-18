import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { User, UserRole } from '../users/entities/user.entity';
import * as bcrypt from 'bcryptjs';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: UsersService;
  let jwtService: JwtService;
  let configService: ConfigService;
  let usersRepository: Repository<User>;
  let mailService: MailService;

  const mockUsersRepository = {
    save: jest.fn(),
    findOne: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
  };

  const mockUsersService = {
    findByEmail: jest.fn(),
    validatePassword: jest.fn(),
    create: jest.fn(),
    findById: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn(),
    verify: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'JWT_REFRESH_SECRET') return 'refresh-secret';
      if (key === 'JWT_REFRESH_EXPIRES_IN') return '7d';
      return 'test-secret';
    }),
  };

  const mockMailService = {
    sendPasswordResetEmail: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: MailService,
          useValue: mockMailService,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUsersRepository,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get<UsersService>(UsersService);
    jwtService = module.get<JwtService>(JwtService);
    configService = module.get<ConfigService>(ConfigService);
    usersRepository = module.get<Repository<User>>(getRepositoryToken(User));
    mailService = module.get<MailService>(MailService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validateUser', () => {
    const mockUser: User = {
      id: 'user-123',
      email: 'test@example.com',
      password: 'hashed-password',
      name: 'Test User',
      companyName: 'Test Company',
      role: UserRole.ADMIN,
      failedLoginAttempts: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as User;

    it('should return user without password on valid credentials', async () => {
      mockUsersService.findByEmail.mockResolvedValue(mockUser);
      mockUsersService.validatePassword.mockResolvedValue(true);
      mockUsersRepository.save.mockResolvedValue(mockUser);

      const result = await service.validateUser('test@example.com', 'password123');

      expect(result).toBeDefined();
      expect(result?.password).toBeUndefined();
      expect(result?.email).toBe('test@example.com');
      expect(mockUsersService.findByEmail).toHaveBeenCalledWith('test@example.com');
      expect(mockUsersService.validatePassword).toHaveBeenCalledWith(mockUser, 'password123');
    });

    it('should return null for non-existent user', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);

      const result = await service.validateUser('nonexistent@example.com', 'password123');

      expect(result).toBeNull();
      expect(mockUsersService.validatePassword).not.toHaveBeenCalled();
    });

    it('should return null for invalid password', async () => {
      mockUsersService.findByEmail.mockResolvedValue(mockUser);
      mockUsersService.validatePassword.mockResolvedValue(false);
      mockUsersRepository.save.mockResolvedValue(mockUser);

      const result = await service.validateUser('test@example.com', 'wrong-password');

      expect(result).toBeNull();
      expect(mockUsersRepository.save).toHaveBeenCalled();
      expect(mockUser.failedLoginAttempts).toBe(1);
    });

    it('should lock account after 5 failed attempts', async () => {
      const lockedUser = { ...mockUser, failedLoginAttempts: 4 };
      mockUsersService.findByEmail.mockResolvedValue(lockedUser);
      mockUsersService.validatePassword.mockResolvedValue(false);
      mockUsersRepository.save.mockResolvedValue(lockedUser);

      await service.validateUser('test@example.com', 'wrong-password');

      expect(lockedUser.failedLoginAttempts).toBe(5);
      expect(lockedUser.lockedUntil).toBeDefined();
    });

    it('should throw UnauthorizedException for locked account', async () => {
      const lockedUser = {
        ...mockUser,
        lockedUntil: new Date(Date.now() + 30 * 60 * 1000),
      };
      mockUsersService.findByEmail.mockResolvedValue(lockedUser);

      await expect(
        service.validateUser('test@example.com', 'password123'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should reset failed attempts on successful login', async () => {
      const userWithAttempts = { ...mockUser, failedLoginAttempts: 3 };
      mockUsersService.findByEmail.mockResolvedValue(userWithAttempts);
      mockUsersService.validatePassword.mockResolvedValue(true);
      mockUsersRepository.save.mockResolvedValue(userWithAttempts);

      await service.validateUser('test@example.com', 'password123');

      expect(userWithAttempts.failedLoginAttempts).toBe(0);
      expect(userWithAttempts.lockedUntil).toBeUndefined();
    });

    it('should normalize email to lowercase', async () => {
      mockUsersService.findByEmail.mockResolvedValue(mockUser);
      mockUsersService.validatePassword.mockResolvedValue(true);
      mockUsersRepository.save.mockResolvedValue(mockUser);

      await service.validateUser('TEST@EXAMPLE.COM', 'password123');

      expect(mockUsersService.findByEmail).toHaveBeenCalledWith('test@example.com');
    });
  });

  describe('login', () => {
    const mockUser: Omit<User, 'password'> = {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      companyName: 'Test Company',
      role: UserRole.ADMIN,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Omit<User, 'password'>;

    it('should return access and refresh tokens', async () => {
      mockJwtService.sign.mockReturnValueOnce('access-token').mockReturnValueOnce('refresh-token');

      const result = await service.login(mockUser);

      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
      expect(result.user.email).toBe('test@example.com');
      expect(mockJwtService.sign).toHaveBeenCalledTimes(2);
    });

    it('should include user information in response', async () => {
      mockJwtService.sign.mockReturnValue('token');

      const result = await service.login(mockUser);

      expect(result.user.id).toBe('user-123');
      expect(result.user.email).toBe('test@example.com');
      expect(result.user.name).toBe('Test User');
      expect(result.user.role).toBe(UserRole.ADMIN);
    });
  });

  describe('register', () => {
    it('should create new user and return tokens', async () => {
      const newUser: User = {
        id: 'user-456',
        email: 'newuser@example.com',
        password: 'hashed-password',
        name: 'New User',
        companyName: 'New Company',
        role: UserRole.ADMIN,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as User;

      mockUsersService.findByEmail.mockResolvedValue(null);
      mockUsersRepository.count.mockResolvedValue(1);
      mockUsersService.create.mockResolvedValue(newUser);
      mockJwtService.sign.mockReturnValue('token');

      const result = await service.register(
        'newuser@example.com',
        'password123',
        'New User',
        'New Company',
      );

      expect(mockUsersService.create).toHaveBeenCalledWith(
        'newuser@example.com',
        'password123',
        'New User',
        'New Company',
      );
      expect(result.accessToken).toBeDefined();
      expect(result.user.email).toBe('newuser@example.com');
    });

    it('should throw BadRequestException if email already exists', async () => {
      const existingUser: User = {
        id: 'user-789',
        email: 'existing@example.com',
        password: 'hashed',
        name: 'Existing',
        role: UserRole.ADMIN,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as User;

      mockUsersService.findByEmail.mockResolvedValue(existingUser);

      await expect(
        service.register('existing@example.com', 'password123', 'Existing User'),
      ).rejects.toThrow(BadRequestException);
      expect(mockUsersService.create).not.toHaveBeenCalled();
    });

    it('should assign OWNER role to first user', async () => {
      const firstUser: User = {
        id: 'user-001',
        email: 'first@example.com',
        password: 'hashed',
        name: 'First User',
        role: UserRole.ADMIN,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as User;

      mockUsersService.findByEmail.mockResolvedValue(null);
      mockUsersRepository.count.mockResolvedValue(0);
      mockUsersService.create.mockResolvedValue(firstUser);
      mockUsersRepository.update.mockResolvedValue({ affected: 1 });
      mockJwtService.sign.mockReturnValue('token');

      await service.register('first@example.com', 'password123', 'First User');

      expect(mockUsersRepository.update).toHaveBeenCalledWith('user-001', {
        role: UserRole.OWNER,
      });
    });

    it('should throw BadRequestException if password contains email', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);

      await expect(
        service.register('test@example.com', 'test@example.com123', 'Test User'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('refreshToken', () => {
    it('should return new access token for valid refresh token', async () => {
      const mockUser: User = {
        id: 'user-123',
        email: 'test@example.com',
        password: 'hashed',
        name: 'Test',
        role: UserRole.ADMIN,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as User;

      mockJwtService.verify.mockReturnValue({ sub: 'user-123', email: 'test@example.com' });
      mockUsersService.findById.mockResolvedValue(mockUser);
      mockJwtService.sign.mockReturnValue('new-access-token');

      const result = await service.refreshToken('valid-refresh-token');

      expect(result.accessToken).toBe('new-access-token');
      expect(mockJwtService.verify).toHaveBeenCalledWith('valid-refresh-token', {
        secret: 'refresh-secret',
      });
    });

    it('should throw UnauthorizedException for invalid refresh token', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(service.refreshToken('invalid-token')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if user not found', async () => {
      mockJwtService.verify.mockReturnValue({ sub: 'nonexistent-id', email: 'test@example.com' });
      mockUsersService.findById.mockResolvedValue(null);

      await expect(service.refreshToken('valid-token')).rejects.toThrow(UnauthorizedException);
    });
  });
});

