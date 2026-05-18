// Copyright (c) 2025 Asset Vault. All rights reserved.

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Usage } from './entities/usage.entity';
import { startOfMonth } from 'date-fns';

@Injectable()
export class UsageResetScheduler {
  private readonly logger = new Logger(UsageResetScheduler.name);

  constructor(
    @InjectRepository(Usage)
    private usageRepository: Repository<Usage>,
  ) {}

  // Run on the 1st of each month at midnight
  @Cron('0 0 1 * *')
  async resetMonthlyUsage() {
    this.logger.log('Starting monthly usage reset...');

    try {
      const now = new Date();
      const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const previousMonthStart = startOfMonth(previousMonth);

      // Delete all usage records from the previous month
      const result = await this.usageRepository.delete({
        periodStart: previousMonthStart,
      });

      this.logger.log(`Reset usage for ${result.affected || 0} records from ${previousMonthStart.toISOString()}`);
    } catch (error: any) {
      this.logger.error(`Failed to reset monthly usage: ${error.message}`, error.stack);
    }
  }
}

