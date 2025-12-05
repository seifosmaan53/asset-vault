import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiKey } from './entities/api-key.entity';

@Injectable()
export class ApiKeysService {
  constructor(
    @InjectRepository(ApiKey)
    private apiKeysRepository: Repository<ApiKey>,
  ) {}

  async findAll(userId: string): Promise<Omit<ApiKey, 'keyHash'>[]> {
    const keys = await this.apiKeysRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
    return keys.map(({ keyHash, ...rest }) => rest);
  }

  async findOne(id: string, userId: string): Promise<Omit<ApiKey, 'keyHash'>> {
    const key = await this.apiKeysRepository.findOne({
      where: { id, userId },
    });
    if (!key) {
      throw new NotFoundException('API key not found');
    }
    const { keyHash, ...rest } = key;
    return rest;
  }

  async create(userId: string, data: Partial<ApiKey>): Promise<ApiKey & { key: string }> {
    const key = ApiKey.generateKey();
    const keyHash = ApiKey.hashKey(key);

    const apiKey = this.apiKeysRepository.create({
      ...data,
      userId,
      keyHash,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
    });

    const saved = await this.apiKeysRepository.save(apiKey);
    return { ...saved, key };
  }

  async update(id: string, userId: string, data: Partial<ApiKey>): Promise<Omit<ApiKey, 'keyHash'>> {
    await this.findOne(id, userId);
    if (data.expiresAt) {
      data.expiresAt = new Date(data.expiresAt);
    }
    await this.apiKeysRepository.update({ id, userId }, data);
    return this.findOne(id, userId);
  }

  async remove(id: string, userId: string): Promise<void> {
    const key = await this.findOne(id, userId);
    await this.apiKeysRepository.remove(key as ApiKey);
  }

  async recordUsage(keyHash: string): Promise<void> {
    await this.apiKeysRepository.update(
      { keyHash },
      { lastUsedAt: new Date() },
    );
  }
}

