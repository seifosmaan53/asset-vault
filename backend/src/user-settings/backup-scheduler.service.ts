import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserSettings } from './entities/user-settings.entity';
import { UserSettingsService } from './user-settings.service';

@Injectable()
export class BackupSchedulerService {
  private readonly logger = new Logger(BackupSchedulerService.name);

  constructor(
    @InjectRepository(UserSettings)
    private settingsRepository: Repository<UserSettings>,
    private userSettingsService: UserSettingsService,
  ) {}

  /**
   * Check for scheduled backups every hour
   * NOTE: Backup scheduling has been removed - this method is disabled
   */
  @Cron(CronExpression.EVERY_HOUR)
  async handleScheduledBackups() {
    // Backup scheduling feature has been removed
    // This method is kept to avoid breaking the cron scheduler, but does nothing
    return;
  }

  /**
   * Determine if backup should run based on schedule
   */
  private shouldRunBackup(
    schedule: string,
    backupTime: string | null,
    currentHour: number,
    currentMinute: number,
    now: Date,
  ): boolean {
    if (!schedule || schedule === '') {
      return false;
    }

    // Parse backup time (format: HH:mm in 24-hour format)
    let targetHour = 2; // Default to 2 AM
    let targetMinute = 0;

    if (backupTime) {
      const [hour, minute] = backupTime.split(':').map(Number);
      if (!isNaN(hour) && hour >= 0 && hour < 24) {
        targetHour = hour;
      }
      if (!isNaN(minute) && minute >= 0 && minute < 60) {
        targetMinute = minute;
      }
    }

    switch (schedule) {
      case 'daily':
        // Run if current time matches backup time (within the hour window)
        return currentHour === targetHour && currentMinute >= targetMinute && currentMinute < targetMinute + 10;

      case 'weekly':
        // Run once per week on Sunday at the backup time
        const isSunday = now.getDay() === 0;
        return isSunday && currentHour === targetHour && currentMinute >= targetMinute && currentMinute < targetMinute + 10;

      case 'monthly':
        // Run on the 1st of each month at the backup time
        const isFirstOfMonth = now.getDate() === 1;
        return isFirstOfMonth && currentHour === targetHour && currentMinute >= targetMinute && currentMinute < targetMinute + 10;

      default:
        return false;
    }
  }
}

