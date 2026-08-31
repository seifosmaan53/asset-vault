import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsersService } from './users.service';
import { User, UserRole } from './entities/user.entity';

/* This file used to test create() and validatePassword(). Neither exists: user creation
   is driven by the Clerk webhook via createFromClerk(), and passwords are Clerk's
   problem now. The suite failed to compile, so it had stopped protecting anything.

   Rewritten against the real surface. The cases worth having are the ones around email
   identity — normalisation, and the three ways an account can already exist when Clerk
   says to create one. Getting those wrong either duplicates a user or attaches a Clerk
   identity to somebody else's row. */

const makeUser = (over: Partial<User> = {}): User =>
  ({
    id: 'user-1',
    email: 'someone@example.com',
    name: 'Someone',
    role: UserRole.OWNER,
    clerkUserId: 'clerk_123',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  }) as unknown as User;

describe('UsersService', () => {
  let service: UsersService;
  let repo: jest.Mocked<Partial<Repository<User>>>;

  beforeEach(async () => {
    repo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn((x) => x as User),
      save: jest.fn((x) => Promise.resolve(x as User)),
      update: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<Partial<Repository<User>>>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersService, { provide: getRepositoryToken(User), useValue: repo }],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  describe('findByEmail', () => {
    it('lower-cases and trims before looking up', async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(null);

      await service.findByEmail('  Someone@EXAMPLE.com  ');

      expect(repo.findOne).toHaveBeenCalledWith({
        where: { email: 'someone@example.com' },
      });
    });
  });

  describe('createFromClerk', () => {
    const payload = {
      clerkUserId: 'clerk_new',
      email: '  NewUser@Example.COM ',
      name: '  New User  ',
      companyName: '  Acme  ',
    };

    it('normalises the email and trims the names', async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(null);

      await service.createFromClerk(payload);

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'newuser@example.com',
          name: 'New User',
          companyName: 'Acme',
        }),
      );
    });

    it('marks the email verified and grants owner, since Clerk already verified it', async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(null);

      await service.createFromClerk(payload);

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ emailVerified: true, role: UserRole.OWNER }),
      );
    });

    it('links Clerk to an existing account that has no Clerk id yet', async () => {
      // Someone who predates Clerk signing in for the first time: adopt the row rather
      // than creating a second account on the same email.
      const existing = makeUser({ clerkUserId: undefined });
      (repo.findOne as jest.Mock).mockResolvedValue(existing);

      const result = await service.createFromClerk(payload);

      expect(repo.create).not.toHaveBeenCalled();
      expect(result.clerkUserId).toBe('clerk_new');
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ clerkUserId: 'clerk_new' }),
      );
    });

    it('refuses to re-point an account that already belongs to a different Clerk id', async () => {
      // Silently overwriting here would hand one person's data to another identity.
      (repo.findOne as jest.Mock).mockResolvedValue(makeUser({ clerkUserId: 'clerk_someone_else' }));

      await expect(service.createFromClerk(payload)).rejects.toThrow(
        /already exists with different Clerk ID/i,
      );
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('recovers from a duplicate-email race by linking instead of failing', async () => {
      // Two webhook deliveries at once: the pre-check finds nothing, then the insert
      // loses the race. Re-read and link rather than surfacing a 500.
      const dup = Object.assign(new Error('duplicate key'), {
        code: '23505',
        constraint: 'UQ_users_email',
      });
      (repo.findOne as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(makeUser({ clerkUserId: undefined }));
      (repo.save as jest.Mock).mockRejectedValueOnce(dup).mockImplementationOnce((x) => x);

      const result = await service.createFromClerk(payload);

      expect(result.clerkUserId).toBe('clerk_new');
    });

    it('rethrows database errors that are not the duplicate-email constraint', async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(null);
      (repo.save as jest.Mock).mockRejectedValueOnce(
        Object.assign(new Error('connection lost'), { code: '08006' }),
      );

      await expect(service.createFromClerk(payload)).rejects.toThrow(/connection lost/i);
    });
  });

  describe('linkToClerk', () => {
    it('sets the Clerk id on an existing user', async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(makeUser({ clerkUserId: undefined }));

      const result = await service.linkToClerk('user-1', 'clerk_abc');

      expect(result.clerkUserId).toBe('clerk_abc');
    });

    it('throws for an unknown user', async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.linkToClerk('nope', 'clerk_abc')).rejects.toThrow(/not found/i);
    });
  });

  describe('update', () => {
    it('re-reads the row so the caller gets the persisted state', async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(makeUser({ name: 'Updated' }));

      const result = await service.update('user-1', { name: 'Updated' });

      expect(repo.update).toHaveBeenCalledWith('user-1', { name: 'Updated' });
      expect(result.name).toBe('Updated');
    });

    it('throws if the row vanished between the write and the read', async () => {
      (repo.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.update('user-1', { name: 'x' })).rejects.toThrow(/not found/i);
    });
  });

  describe('findAll / delete', () => {
    it('returns every user', async () => {
      (repo.find as jest.Mock).mockResolvedValue([makeUser(), makeUser({ id: 'user-2' })]);

      expect(await service.findAll()).toHaveLength(2);
    });

    it('deletes by id', async () => {
      await service.delete('user-1');

      expect(repo.delete).toHaveBeenCalledWith('user-1');
    });
  });
});
