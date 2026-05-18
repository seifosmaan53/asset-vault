import { Injectable, NotFoundException, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, LessThan } from 'typeorm';
import { ApiKey } from './entities/api-key.entity';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CreateApiKeyDto, UpdateApiKeyDto } from './dto';

@Injectable()
export class ApiKeysService {
  private readonly logger = new Logger(ApiKeysService.name);

  constructor(
    @InjectRepository(ApiKey)
    private apiKeysRepository: Repository<ApiKey>,
  ) {}

  async findAll(userId: string): Promise<Omit<ApiKey, 'keyHash'>[]> {
    // Fix Issue #1: Use query builder instead of 'as any' type assertion
    const keys = await this.apiKeysRepository
      .createQueryBuilder('key')
      .where('key.userId = :userId', { userId })
      .orderBy('key.createdAt', 'DESC')
      .getMany();
    return keys.map(({ keyHash, ...rest }) => rest);
  }

  async findOne(id: string, userId: string): Promise<Omit<ApiKey, 'keyHash'>> {
    // Fix Issue #1: Use query builder instead of 'as any' type assertion
    // Organizations removed - filter by userId only (user-scoped data)
    const key = await this.apiKeysRepository
      .createQueryBuilder('key')
      .where('key.id = :id', { id })
      .andWhere('key.userId = :userId', { userId })
      .getOne();
    if (!key) {
      throw new NotFoundException('API key not found');
    }
    const { keyHash, ...rest } = key;
    return rest;
  }

  private parseDate(input?: string | Date): Date | undefined {
    if (!input) return undefined;
    return input instanceof Date ? input : new Date(input);
  }

  async create(userId: string, data: CreateApiKeyDto): Promise<ApiKey & { key: string }> {
    const key = ApiKey.generateKey();
    const keyHash = ApiKey.hashKey(key);

    const expiresAt = this.parseDate(data.expiresAt);

    const apiKey = this.apiKeysRepository.create({
      name: data.name,
      permissions: data.permissions,
      isActive: data.isActive ?? true,
      userId,
      keyHash,
      expiresAt,
    });

    const saved = await this.apiKeysRepository.save(apiKey) as ApiKey;
    return { ...saved, key } as ApiKey & { key: string };
  }

  async update(id: string, userId: string, data: UpdateApiKeyDto): Promise<Omit<ApiKey, 'keyHash'>> {
    // Organizations removed - filter by userId only (user-scoped data)
    const existing = await this.apiKeysRepository
      .createQueryBuilder('key')
      .where('key.id = :id', { id })
      .andWhere('key.userId = :userId', { userId })
      .getOne();
    if (!existing) {
      throw new NotFoundException('API key not found');
    }
    
    const expiresAt = this.parseDate(data.expiresAt);
    const updateData: Partial<ApiKey> = {};
    
    if (data.name !== undefined) updateData.name = data.name;
    if (data.permissions !== undefined) updateData.permissions = data.permissions;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (expiresAt !== undefined) updateData.expiresAt = expiresAt;
    
    const updateQuery = this.apiKeysRepository
      .createQueryBuilder()
      .update(ApiKey)
      .set(updateData)
      .where('id = :id', { id });
    
    // Organizations removed - filter by userId only
    updateQuery.andWhere('userId = :userId', { userId });
    
    await updateQuery.execute();
    return this.findOne(id, userId);
  }

  async remove(id: string, userId: string): Promise<void> {
    // Fix Issue #1: Use query builder instead of 'as any' type assertion
    // Organizations removed - filter by userId only (user-scoped data)
    const key = await this.apiKeysRepository
      .createQueryBuilder('key')
      .where('key.id = :id', { id })
      .andWhere('key.userId = :userId', { userId })
      .getOne();
    if (!key) {
      throw new NotFoundException('API key not found');
    }
    await this.apiKeysRepository.remove(key);
  }

  async recordUsage(keyHash: string): Promise<void> {
    await this.apiKeysRepository.update(
      { keyHash },
      { lastUsedAt: new Date() },
    );
  }

  /**
   * Issue #7: API Key Rotation and Expiration Enforcement
   * Automatically deactivate expired API keys
   */
  @Cron(CronExpression.EVERY_HOUR) // Run every hour
  async deactivateExpiredKeys(): Promise<void> {
    const now = new Date();
    const result = await this.apiKeysRepository.update(
      {
        expiresAt: LessThan(now),
        isActive: true,
      },
      {
        isActive: false,
      },
    );

    if (result.affected && result.affected > 0) {
      this.logger.log(`Deactivated ${result.affected} expired API key(s)`);
    }
  }

  /**
   * Issue #7: Rotate an API key (create new, optionally deactivate old)
   */
  async rotateKey(
    id: string,
    userId: string,
    deactivateOld: boolean = true,
  ): Promise<ApiKey & { key: string }> {
    const oldKey = await this.findOne(id, userId);

    // Create new key with same permissions
    const newKey = await this.create(userId, {
      name: `${oldKey.name} (rotated)`,
      permissions: oldKey.permissions,
      expiresAt: oldKey.expiresAt ? oldKey.expiresAt.toISOString() : undefined,
    });

    // Optionally deactivate old key
    if (deactivateOld) {
      await this.update(id, userId, { isActive: false });
      this.logger.log(`Rotated API key ${id} for user ${userId}`);
    }

    return newKey;
  }

  /**
   * Issue #7: Check if API key is expired
   */
  isKeyExpired(key: ApiKey): boolean {
    if (!key.expiresAt) {
      return false; // Keys without expiration never expire
    }
    return new Date() > key.expiresAt;
  }

  /**
   * Issue #7: Validate API key is active and not expired
   */
  async validateKey(keyHash: string): Promise<ApiKey | null> {
    const key = await this.apiKeysRepository.findOne({
      where: { keyHash },
    });

    if (!key) {
      return null;
    }

    if (!key.isActive) {
      throw new BadRequestException('API key is inactive');
    }

    if (this.isKeyExpired(key)) {
      // Auto-deactivate expired key
      await this.apiKeysRepository.update(
        { keyHash },
        { isActive: false },
      );
      throw new BadRequestException('API key has expired');
    }

    return key;
  }
}

