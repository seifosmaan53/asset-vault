import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { User, UserRole } from '../users/entities/user.entity';

/* This file used to test login(), register(), validateUser() and refreshToken(). None
   of them exist: authentication moved to Clerk, and AuthService now only owns the Clerk
   webhook plus profile and password operations. The suite could not even compile, which
   is also why it had stopped catching anything.

   Rewritten against the real surface. The most valuable case is the updateProfile field
   whitelist — it is the thing standing between a caller and writing `role` on their own
   user record. */

const baseUser = (over: Partial<User> = {}): User =>
  ({
    id: 'user-1',
    email: 'someone@example.com',
    name: 'Someone',
    companyName: 'Acme',
    phone: undefined,
    address: undefined,
    timezone: undefined,
    bio: undefined,
    role: UserRole.STAFF,
    clerkUserId: 'clerk_123',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-02T00:00:00Z'),
    ...over,
  }) as unknown as User;

describe('AuthService', () => {
  let service: AuthService;

  const usersService = {
    findById: jest.fn(),
    update: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: OrganizationsService, useValue: {} },
        { provide: SubscriptionsService, useValue: {} },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue(undefined) } },
        { provide: getRepositoryToken(User), useValue: {} },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('is constructed', () => {
    expect(service).toBeDefined();
  });

  describe('getProfile', () => {
    it('returns the profile for a known user', async () => {
      usersService.findById.mockResolvedValue(baseUser());

      const profile = await service.getProfile('user-1');

      expect(profile.id).toBe('user-1');
      expect(profile.email).toBe('someone@example.com');
      expect(profile.role).toBe(UserRole.STAFF);
    });

    it('serialises dates as ISO strings, not Date objects', async () => {
      usersService.findById.mockResolvedValue(baseUser());

      const profile = await service.getProfile('user-1');

      expect(typeof profile.createdAt).toBe('string');
      expect(profile.createdAt).toBe('2026-01-01T00:00:00.000Z');
    });

    it('normalises absent optional fields to null rather than undefined', async () => {
      // undefined disappears from JSON entirely; null keeps the key present so the
      // client sees "no phone" instead of "no such field".
      usersService.findById.mockResolvedValue(baseUser({ phone: undefined, bio: undefined }));

      const profile = await service.getProfile('user-1');

      expect(profile.phone).toBeNull();
      expect(profile.bio).toBeNull();
    });

    it('rejects an unknown user', async () => {
      usersService.findById.mockResolvedValue(null);

      await expect(service.getProfile('nope')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('updateProfile', () => {
    it('passes through the whitelisted fields', async () => {
      usersService.update.mockResolvedValue(baseUser({ name: 'New Name' }));

      await service.updateProfile('user-1', { name: 'New Name', bio: 'hi' });

      expect(usersService.update).toHaveBeenCalledWith('user-1', {
        name: 'New Name',
        bio: 'hi',
      });
    });

    it('drops fields that are not on the whitelist', async () => {
      usersService.update.mockResolvedValue(baseUser());

      await service.updateProfile('user-1', {
        name: 'New Name',
        // a caller trying to escalate themselves, or edit identity fields directly
        role: UserRole.OWNER,
        email: 'attacker@example.com',
        id: 'someone-else',
      } as never);

      const [, patch] = usersService.update.mock.calls[0];
      expect(patch).toEqual({ name: 'New Name' });
      expect(patch).not.toHaveProperty('role');
      expect(patch).not.toHaveProperty('email');
      expect(patch).not.toHaveProperty('id');
    });

    it('distinguishes an omitted field from one explicitly cleared', async () => {
      usersService.update.mockResolvedValue(baseUser());

      await service.updateProfile('user-1', { phone: '' });

      // '' is a real value the user chose; only `undefined` means "leave it alone".
      expect(usersService.update.mock.calls[0][1]).toEqual({ phone: '' });
    });

    it('sends nothing when given nothing', async () => {
      usersService.update.mockResolvedValue(baseUser());

      await service.updateProfile('user-1', {});

      expect(usersService.update).toHaveBeenCalledWith('user-1', {});
    });
  });

  describe('changePassword', () => {
    const dto = { currentPassword: 'old', newPassword: 'new-password-1' };

    it('rejects an unknown user', async () => {
      usersService.findById.mockResolvedValue(null);

      await expect(service.changePassword('nope', dto)).rejects.toThrow(UnauthorizedException);
    });

    it('rejects a user with no linked Clerk account', async () => {
      usersService.findById.mockResolvedValue(baseUser({ clerkUserId: undefined }));

      await expect(service.changePassword('user-1', dto)).rejects.toThrow(BadRequestException);
    });

    it('rejects when Clerk is not configured', async () => {
      // ConfigService returns undefined for CLERK_SECRET_KEY in this module, so the
      // client is never constructed — the service must say so rather than throw a
      // TypeError on an undefined client.
      usersService.findById.mockResolvedValue(baseUser());

      await expect(service.changePassword('user-1', dto)).rejects.toThrow(
        /Clerk is not configured/i,
      );
    });
  });
});
