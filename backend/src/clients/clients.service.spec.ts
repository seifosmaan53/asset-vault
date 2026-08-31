import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { ClientsService } from './clients.service';
import { Client } from './entities/client.entity';
import { ImportService } from '../common/services/import.service';

/* Rewritten. The previous version could not be constructed at all — ClientsService
   gained a DataSource and an ImportService and the spec still provided only a
   repository, so Nest failed to resolve it and every test in the file died before
   running. The assertions were stale on top of that: they expected
   findOne({ where: { id, userId } }), while the service now goes through QueryBuilder.

   What is worth testing here is tenant isolation. findOne deliberately looks a client up
   by ID ALONE first, then compares ownership — so the interesting cases are the three
   ways it must refuse: missing, soft-deleted, and belonging to somebody else. */

const makeClient = (over: Partial<Client> = {}): Client =>
  ({
    id: 'client-1',
    userId: 'user-1',
    name: 'Acme Ltd',
    email: 'billing@acme.test',
    deletedAt: null,
    ...over,
  }) as unknown as Client;

describe('ClientsService', () => {
  let service: ClientsService;

  const makeQueryBuilder = () => {
    const qb: Record<string, jest.Mock> = {};
    for (const m of [
      'select', 'addSelect', 'from', 'leftJoin', 'leftJoinAndSelect', 'innerJoin',
      'where', 'andWhere', 'orWhere', 'orderBy', 'addOrderBy', 'groupBy', 'having',
      'skip', 'take', 'limit', 'offset', 'withDeleted', 'update', 'set', 'delete',
      'softDelete', 'setLock', 'relation', 'of',
    ]) {
      qb[m] = jest.fn(() => qb);
    }
    qb.getOne = jest.fn().mockResolvedValue(null);
    qb.getMany = jest.fn().mockResolvedValue([]);
    qb.getManyAndCount = jest.fn().mockResolvedValue([[], 0]);
    qb.getCount = jest.fn().mockResolvedValue(0);
    qb.getRawOne = jest.fn().mockResolvedValue(undefined);
    qb.getRawMany = jest.fn().mockResolvedValue([]);
    qb.execute = jest.fn().mockResolvedValue({ affected: 1 });
    return qb;
  };

  let qb: ReturnType<typeof makeQueryBuilder>;
  let managerQb: ReturnType<typeof makeQueryBuilder>;

  const repo = {
    create: jest.fn((x) => x),
    save: jest.fn((x) => Promise.resolve({ id: 'client-new', ...x })),
    findOne: jest.fn(),
    find: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(() => qb),
  };

  const manager = {
    findOne: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(() => managerQb),
  };

  const queryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager,
  };

  const dataSource = {
    createQueryRunner: jest.fn(() => queryRunner),
    transaction: jest.fn((cb: (m: unknown) => unknown) => cb(manager)),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    qb = makeQueryBuilder();
    managerQb = makeQueryBuilder();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClientsService,
        { provide: getRepositoryToken(Client), useValue: repo },
        { provide: DataSource, useValue: dataSource },
        { provide: ImportService, useValue: { parseCsv: jest.fn(), importRows: jest.fn() } },
      ],
    }).compile();

    service = module.get<ClientsService>(ClientsService);
  });

  it('is constructed with all three of its dependencies', () => {
    expect(service).toBeDefined();
  });

  describe('findOne — tenant isolation', () => {
    it('returns a client the actor owns', async () => {
      qb.getOne.mockResolvedValue(makeClient({ userId: 'user-1' }));

      const result = await service.findOne('client-1', 'user-1');

      expect(result.id).toBe('client-1');
    });

    it('refuses a client owned by a different user', async () => {
      // The lookup is by id alone, so ownership is enforced here and nowhere else.
      qb.getOne.mockResolvedValue(makeClient({ userId: 'someone-else' }));

      await expect(service.findOne('client-1', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('does not reveal that a client exists when it belongs to someone else', async () => {
      // "Not found" rather than "forbidden": a 403 would confirm the id is real.
      qb.getOne.mockResolvedValue(makeClient({ userId: 'someone-else' }));

      await expect(service.findOne('client-1', 'user-1')).rejects.toThrow(/not found/i);
    });

    it('refuses a client that does not exist', async () => {
      qb.getOne.mockResolvedValue(null);

      await expect(service.findOne('missing', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('refuses a soft-deleted client even though the row is still there', async () => {
      qb.getOne.mockResolvedValue(makeClient({ deletedAt: new Date() }));

      await expect(service.findOne('client-1', 'user-1')).rejects.toThrow(/deleted/i);
    });

    it('includes soft-deleted rows in the lookup so it can tell them apart from missing ones', async () => {
      qb.getOne.mockResolvedValue(makeClient());

      await service.findOne('client-1', 'user-1');

      expect(qb.withDeleted).toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('sanitises the name before persisting', async () => {
      await service.create('user-1', { name: '  <script>alert(1)</script>Acme  ' } as Partial<Client>);

      const [saved] = repo.save.mock.calls[0];
      expect(saved.name).not.toContain('<script>');
    });

    it('normalises a null email to undefined so the column is left unset', async () => {
      await service.create('user-1', { name: 'Acme', email: null } as unknown as Partial<Client>);

      const [saved] = repo.save.mock.calls[0];
      expect(saved.email).toBeUndefined();
    });

    it('stamps the client with the acting user', async () => {
      await service.create('user-1', { name: 'Acme' } as Partial<Client>);

      const [saved] = repo.save.mock.calls[0];
      expect(saved.userId).toBe('user-1');
    });
  });

  describe('remove', () => {
    it('rejects an empty id without opening a transaction', async () => {
      await expect(service.remove('', 'user-1')).rejects.toThrow(NotFoundException);
      expect(dataSource.createQueryRunner).not.toHaveBeenCalled();
    });

    it('rejects a whitespace-only id', async () => {
      await expect(service.remove('   ', 'user-1')).rejects.toThrow(NotFoundException);
    });
  });
});
