import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { StoreAlert } from './entities/store-alert.entity';
import { StoreItemSettings } from './entities/store-item-settings.entity';
import { Store } from './entities/store.entity';
import { InventoryItem } from './entities/inventory-item.entity';
import { UserSettingsService } from '../user-settings/user-settings.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { User } from '../users/entities/user.entity';

@Injectable()
export class StoreAlertsService {
  private readonly logger = new Logger(StoreAlertsService.name);

  constructor(
    @InjectRepository(StoreAlert)
    private storeAlertRepository: Repository<StoreAlert>,
    @InjectRepository(StoreItemSettings)
    private storeItemSettingsRepository: Repository<StoreItemSettings>,
    @InjectRepository(Store)
    private storeRepository: Repository<Store>,
    @InjectRepository(InventoryItem)
    private inventoryItemRepository: Repository<InventoryItem>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private userSettingsService: UserSettingsService,
    private organizationsService: OrganizationsService,
  ) {}

  /**
   * Check all stores for items below reorder point and create alerts
   */
  @Cron('0 9 * * *') // Run daily at 9 AM
  async checkReorderAlerts(): Promise<void> {
    this.logger.log('Starting daily reorder alert check...');

    // Get all active stores
    const stores = await this.storeRepository.find({
      where: { active: true },
      relations: ['user'],
    });

    for (const store of stores) {
      try {
        await this.checkStoreAlerts(store.userId);
      } catch (error) {
        this.logger.error(`Error checking alerts for store ${store.id}: ${error.message}`, error);
      }
    }

    this.logger.log('Completed daily reorder alert check');
  }

  /**
   * Check alerts for a specific user's stores
   */
  async checkStoreAlerts(userId: string): Promise<StoreAlert[]> {
    // Get all store item settings for this user's stores
    const storeSettings = await this.storeItemSettingsRepository
      .createQueryBuilder('settings')
      .leftJoinAndSelect('settings.store', 'store')
      .leftJoinAndSelect('settings.inventoryItem', 'inventoryItem')
      .where('store.userId = :userId', { userId })
      .andWhere('store.active = :active', { active: true })
      .andWhere('settings.minQty > 0') // Only check items with reorder points set
      .getMany();

    const newAlerts: StoreAlert[] = [];

    for (const setting of storeSettings) {
      const currentStock = setting.currentStock || 0;
      const minQty = setting.minQty || 0;

      // Check if stock is below minimum
      if (currentStock <= minQty) {
        // Check if alert already exists and is unresolved
        const existingAlert = await this.storeAlertRepository.findOne({
          where: {
            userId,
            storeId: setting.storeId,
            inventoryItemId: setting.inventoryItemId,
            resolved: false,
          },
        });

        if (!existingAlert) {
          // Create new alert
          const alertType = currentStock === 0 ? 'out_of_stock' : 'low_stock';
          const alert = this.storeAlertRepository.create({
            userId,
            storeId: setting.storeId,
            inventoryItemId: setting.inventoryItemId,
            alertType,
            currentStock,
            minQty,
            resolved: false,
          });

          const savedAlert = await this.storeAlertRepository.save(alert);
          newAlerts.push(savedAlert);

          this.logger.log(
            `Created ${alertType} alert for item ${setting.inventoryItem.name} at store ${setting.store.name}`,
          );
        } else {
          // Update existing alert if stock changed
          if (existingAlert.currentStock !== currentStock) {
            existingAlert.currentStock = currentStock;
            existingAlert.alertType = currentStock === 0 ? 'out_of_stock' : 'low_stock';
            await this.storeAlertRepository.save(existingAlert);
          }
        }
      } else {
        // Stock is above minimum, resolve any existing alerts
        const existingAlert = await this.storeAlertRepository.findOne({
          where: {
            userId,
            storeId: setting.storeId,
            inventoryItemId: setting.inventoryItemId,
            resolved: false,
          },
        });

        if (existingAlert) {
          existingAlert.resolved = true;
          existingAlert.resolvedAt = new Date();
          await this.storeAlertRepository.save(existingAlert);
        }
      }
    }

    // Send email notifications for new alerts
    if (newAlerts.length > 0) {
      await this.sendAlertNotifications(userId, newAlerts);
    }

    return newAlerts;
  }

  /**
   * Get all alerts for a user
   * FIX Issue #43: Filter by organization context
   */
  async getAlerts(userId: string, storeId?: string, resolved?: boolean, organizationId?: string | null): Promise<StoreAlert[]> {
    // FIX Issue #43: Use query builder to filter by organization through store relationship
    const query = this.storeAlertRepository
      .createQueryBuilder('alert')
      .leftJoinAndSelect('alert.store', 'store')
      .leftJoinAndSelect('alert.inventoryItem', 'inventoryItem')
      .where('alert.userId = :userId', { userId });
    
    // Organizations removed - filter by userId only (user-scoped data)
    query.andWhere('store.userId = :userId', { userId });
    
    if (storeId) {
      query.andWhere('alert.storeId = :storeId', { storeId });
    }
    
    if (resolved !== undefined) {
      query.andWhere('alert.resolved = :resolved', { resolved });
    }
    
    return query.orderBy('alert.createdAt', 'DESC').getMany();
  }

  /**
   * Get alerts for a specific store
   * FIX Issue #43: Validate organization access
   */
  async getStoreAlerts(storeId: string, userId: string, organizationId?: string | null): Promise<StoreAlert[]> {
    // FIX Issue #43: Verify store belongs to organization before querying alerts
    if (organizationId) {
      const store = await this.storeRepository.findOne({
        where: { id: storeId },
      });
      if (!store) {
        throw new NotFoundException(`Store with ID "${storeId}" not found`);
      }
      // Verify organization access
      // Organizations removed - verify user access only
      if (store.userId !== userId) {
        throw new NotFoundException(`Store with ID "${storeId}" not found`);
      }
    }
    
    return this.storeAlertRepository.find({
      where: {
        storeId,
        userId,
        resolved: false,
      },
      relations: ['inventoryItem'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Mark alert as resolved
   */
  async markAlertResolved(alertId: string, userId: string): Promise<StoreAlert> {
    const alert = await this.storeAlertRepository.findOne({
      where: { id: alertId, userId },
    });

    if (!alert) {
      throw new Error(`Alert with ID "${alertId}" not found`);
    }

    alert.resolved = true;
    alert.resolvedAt = new Date();

    return this.storeAlertRepository.save(alert);
  }

  /**
   * Send email notifications for alerts
   */
  private async sendAlertNotifications(userId: string, alerts: StoreAlert[]): Promise<void> {
    try {
      // Get user's first organization for settings (alerts are user-level notifications)
      // For email notifications, we use the first org's settings
      const userOrgs = await this.organizationsService.getUserOrganizations(userId);
      let userSettings: any = {};
      
      if (userOrgs.length > 0) {
        try {
          userSettings = await this.userSettingsService.getSettings(userId);
        } catch (error) {
          // If settings don't exist for this org, use defaults
          this.logger.warn(`No settings found for user ${userId}, using defaults`);
        }
      } else {
        // User has no orgs - use default settings
        this.logger.warn(`User ${userId} has no organizations, using default email settings`);
      }

      // Check if email notifications are enabled (default to true if not set)
      if (userSettings?.emailNotifications === false) {
        this.logger.log(`Email notifications disabled for user ${userId}`);
        return;
      }

      // Group alerts by store
      const alertsByStore = new Map<string, StoreAlert[]>();
      for (const alert of alerts) {
        if (!alertsByStore.has(alert.storeId)) {
          alertsByStore.set(alert.storeId, []);
        }
        alertsByStore.get(alert.storeId)!.push(alert);
      }

      // Load store and inventory item details
      for (const [storeId, storeAlerts] of alertsByStore) {
        const store = await this.storeRepository.findOne({ where: { id: storeId } });
        if (!store) continue;

        const alertDetails = await Promise.all(
          storeAlerts.map(async (alert) => {
            const item = await this.inventoryItemRepository.findOne({
              where: { id: alert.inventoryItemId },
            });
            return {
              itemName: item?.name || 'Unknown Item',
              currentStock: alert.currentStock,
              minQty: alert.minQty,
              alertType: alert.alertType,
            };
          }),
        );

        // Get user email
        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (!user || !user.email) {
          this.logger.warn(`User ${userId} not found or has no email address`);
          continue;
        }

        // Email functionality removed - just log the alert
        this.logger.log(`Store alert: ${storeAlerts.length} item(s) need attention at ${store.name} (email functionality disabled)`);
      }
    } catch (error) {
      this.logger.error(`Error sending alert notifications: ${error.message}`, error);
    }
  }

  /**
   * Build HTML email template for alerts
   */
  private buildAlertEmailHtml(storeName: string, alertDetails: Array<{ itemName: string; currentStock: number; minQty: number; alertType: string }>): string {
    const itemsHtml = alertDetails
      .map(
        (alert) => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${alert.itemName}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${alert.currentStock}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${alert.minQty}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">
          <span style="background-color: ${alert.alertType === 'out_of_stock' ? '#f44336' : '#ff9800'}; color: white; padding: 4px 8px; border-radius: 4px;">
            ${alert.alertType === 'out_of_stock' ? 'Out of Stock' : 'Low Stock'}
          </span>
        </td>
      </tr>
    `,
      )
      .join('');

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th { background-color: #f5f5f5; padding: 12px; text-align: left; font-weight: 600; }
            .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <h2>Store Reorder Alert</h2>
            <p>Store: <strong>${storeName}</strong></p>
            <p>The following items are below their reorder point:</p>
            <table>
              <thead>
                <tr>
                  <th>Item Name</th>
                  <th style="text-align: center;">Current Stock</th>
                  <th style="text-align: center;">Min Quantity</th>
                  <th style="text-align: center;">Status</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
            </table>
            <div class="footer">
              <p>This is an automated alert from InvoiceMe. Please review and restock as needed.</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }
}

