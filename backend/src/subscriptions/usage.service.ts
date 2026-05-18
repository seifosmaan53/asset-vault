// Copyright (c) 2025 Asset Vault. All rights reserved.

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Usage, UsageMetric } from './entities/usage.entity';
import { startOfMonth, endOfMonth } from 'date-fns';

// Re-export UsageMetric for convenience
export { UsageMetric };

@Injectable()
export class UsageService {
  private readonly logger = new Logger(UsageService.name);

  constructor(
    @InjectRepository(Usage)
    private usageRepository: Repository<Usage>,
  ) {}

  async trackUsage(userId: string, metric: UsageMetric, amount: number = 1): Promise<Usage> {
    const now = new Date();
    const periodStart = startOfMonth(now);
    const periodEnd = endOfMonth(now);

    let usage = await this.usageRepository.findOne({
      where: {
        userId,
        metric,
        periodStart,
      },
    });

    if (usage) {
      usage.count += amount;
    } else {
      usage = this.usageRepository.create({
        userId,
        metric,
        count: amount,
        periodStart,
        periodEnd,
      });
    }

    return this.usageRepository.save(usage);
  }

  async getUsage(userId: string, metric: UsageMetric, period?: Date): Promise<number> {
    const targetDate = period || new Date();
    const periodStart = startOfMonth(targetDate);

    const usage = await this.usageRepository.findOne({
      where: {
        userId,
        metric,
        periodStart,
      },
    });

    return usage?.count || 0;
  }

  async checkQuota(userId: string, metric: UsageMetric, limit: number | null): Promise<boolean> {
    // If limit is null, it means unlimited
    if (limit === null) {
      return true;
    }

    const currentUsage = await this.getUsage(userId, metric);
    return currentUsage < limit;
  }

  async resetUsage(userId: string, period: Date): Promise<void> {
    const periodStart = startOfMonth(period);

    await this.usageRepository.delete({
      userId,
      periodStart,
    });

    this.logger.log(`Reset usage for user ${userId} for period ${periodStart.toISOString()}`);
  }

  async getAllUsage(userId: string, period?: Date): Promise<Record<UsageMetric, number>> {
    const targetDate = period || new Date();
    const periodStart = startOfMonth(targetDate);

    const usageRecords = await this.usageRepository.find({
      where: {
        userId,
        periodStart,
      },
    });

    const usageMap: Record<UsageMetric, number> = {
      [UsageMetric.INVOICES_CREATED]: 0,
      [UsageMetric.CLIENTS_CREATED]: 0,
      [UsageMetric.INVENTORY_ITEMS_CREATED]: 0,
      [UsageMetric.STORAGE_USED_MB]: 0,
      [UsageMetric.API_REQUESTS]: 0,
    };

    usageRecords.forEach((record) => {
      usageMap[record.metric] = record.count;
    });

    return usageMap;
  }
}

