import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { User } from '../users/entities/user.entity';
import { UserSettings } from './entities/user-settings.entity';
import { Client } from '../clients/entities/client.entity';
import { Invoice } from '../invoices/entities/invoice.entity';
import { InvoiceItem } from '../invoices/entities/invoice-item.entity';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { StockMovement } from '../inventory/entities/stock-movement.entity';
// Recurring invoices and invoice templates removed
import { Store } from '../inventory/entities/store.entity';
import { StoreItemSettings } from '../inventory/entities/store-item-settings.entity';
import { createExcelWorkbook } from '../common/utils/excel-export.util';
import { PuppeteerService } from '../common/services/puppeteer.service';
import { sanitizeString, sanitizeEmail, sanitizeUrl } from '../common/utils/security.util';

const execAsync = promisify(exec);

interface ExportData extends Record<string, unknown> {
  exportInfo?: {
    version: string;
    timestamp: string;
    userId: string;
    exportedAt: string;
  };
  user?: {
    id: string;
    email: string;
    name?: string;
    companyName?: string;
    createdAt?: Date;
    updatedAt?: Date;
  } | null;
  settings?: Record<string, unknown> | null;
  clients: Client[];
  stores: Array<Store & {
    itemSettings?: Array<Omit<StoreItemSettings, 'store'>>;
    client?: { id: string; name: string; email: string } | null;
  }>;
  storeItemSettings: Array<StoreItemSettings & {
    store?: { id: string; name: string; code: string } | null;
    inventoryItem?: { id: string; name: string; sku: string } | null;
  }>;
  invoices: Array<Invoice & {
    items: Array<InvoiceItem & {
      inventoryItem?: { id: string; name: string; sku: string } | null;
    }>;
    client?: { id: string; name: string; email: string } | null;
  }>;
  inventory: Array<InventoryItem & {
    movements?: Array<Omit<StockMovement, 'inventoryItem'>>;
  }>;
  stockMovements: Array<StockMovement & {
    inventoryItem?: { id: string; name: string; sku: string } | null;
  }>;
  // recurringInvoices: Array<RecurringInvoice & {
  //   client?: { id: string; name: string; email: string } | null;
  // }>; // Removed
  // invoiceTemplates: InvoiceTemplate[]; // Removed
}

@Injectable()
export class UserSettingsService {
  private readonly logger = new Logger(UserSettingsService.name);

  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(UserSettings)
    private settingsRepository: Repository<UserSettings>,
    @InjectRepository(Client)
    private clientsRepository: Repository<Client>,
    @InjectRepository(Invoice)
    private invoicesRepository: Repository<Invoice>,
    @InjectRepository(InvoiceItem)
    private invoiceItemsRepository: Repository<InvoiceItem>,
    @InjectRepository(InventoryItem)
    private inventoryRepository: Repository<InventoryItem>,
    @InjectRepository(StockMovement)
    private stockMovementsRepository: Repository<StockMovement>,
    // @InjectRepository(RecurringInvoice) // Removed
    // private recurringInvoicesRepository: Repository<RecurringInvoice>, // Removed
    // @InjectRepository(InvoiceTemplate) // Removed
    // private invoiceTemplatesRepository: Repository<InvoiceTemplate>, // Removed
    @InjectRepository(Store)
    private storeRepository: Repository<Store>,
    @InjectRepository(StoreItemSettings)
    private storeItemSettingsRepository: Repository<StoreItemSettings>,
    private dataSource: DataSource,
    private puppeteerService: PuppeteerService,
  ) {}

  async getSettings(userId: string) {
    // Fix Issue #1: Use query builder instead of 'as any' type assertion
    // Org-shared: visibility boundary is organizationId.
    // Safe legacy: include org NULL rows only if created by the current user.
    let settings = await this.settingsRepository
      .createQueryBuilder('settings')
      .where('settings.userId = :userId', { userId })
      // Organizations removed - filter by userId only (user-scoped data)
      .getOne();

    // If settings don't exist, create default settings
    if (!settings) {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
      if (!user) {
        throw new NotFoundException('User not found');
      }

      settings = this.settingsRepository.create({
        userId,
        // Organizations removed - no organizationId needed
      invoiceNumberFormat: 'INV-{YYYY}-{####}',
      defaultCurrency: 'USD',
      defaultTaxRate: 0,
        companyName: user.companyName || '',
      companyAddress: '',
      companyPhone: '',
        companyEmail: user.email || '',
      });
      settings = await this.settingsRepository.save(settings);
    }

    return this.serializeSettings(settings);
  }

  /**
   * Get raw settings entity (not serialized) for internal use
   * This is needed when we need access to sensitive fields like twoFactorSecret
   */
  async getRawSettings(userId: string, organizationId: string | null): Promise<UserSettings | null> {
    let settings = await this.settingsRepository
      .createQueryBuilder('settings')
      .where('settings.userId = :userId', { userId })
      // Organizations removed - filter by userId only (user-scoped data)
      .orderBy('settings.organizationId', 'DESC') // Prefer org-specific settings
      .getOne();

    if (!settings) {
      // Create default settings if they don't exist
      const user = await this.dataSource.getRepository(User).findOne({ where: { id: userId } });
      if (!user) {
        return null;
      }

      settings = this.settingsRepository.create({
        userId,
        // Organizations removed - no organizationId needed
        invoiceNumberFormat: 'INV-{YYYY}-{####}',
        defaultCurrency: 'USD',
        defaultTaxRate: 0,
        companyName: user.companyName || '',
        companyAddress: '',
        companyPhone: '',
        companyEmail: user.email || '',
      });
      settings = await this.settingsRepository.save(settings);
    }

    return settings;
  }

  async updateSettings(userId: string, data: Partial<UserSettings>, organizationId: string | null): Promise<Record<string, unknown>> {
    // Create query runner for transaction
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Fix Issue #1: Use query builder instead of 'as any' type assertion
      // Get existing settings to track changes for audit
      // Organizations removed - filter by userId only (user-scoped data)
      const existingSettings = await queryRunner.manager
        .createQueryBuilder(UserSettings, 'settings')
        .where('settings.userId = :userId', { userId })
        .getOne();

      // Sanitize text fields to prevent XSS
      const sanitizedData = this.sanitizeInput(data);

      // Encrypt SMTP password if provided and not already encrypted
      // Fix Issue #1: Use proper bcrypt validation - bcrypt hashes have format: $2[abxy]$[cost]$[22 char salt][31 char hash]
      if (sanitizedData.smtpPassword && sanitizedData.smtpPassword.trim() !== '') {
        // Proper bcrypt hash validation: $2[abxy]$[cost]$[22 char salt][31 char hash] = 60 chars total
        // Cost is 2 digits (04-31), salt is base64 encoded (22 chars), hash is base64 encoded (31 chars)
        const isValidBcryptHash = /^\$2[abxy]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(sanitizedData.smtpPassword);
        if (!isValidBcryptHash) {
          sanitizedData.smtpPassword = await bcrypt.hash(sanitizedData.smtpPassword, 10);
          // Fix Issue #5: Remove password-related logging for security
        } else {
          // Password is already hashed, don't hash again
        }
      } else if (sanitizedData.smtpPassword === '') {
        // Empty string means don't update password
        delete sanitizedData.smtpPassword;
      }

      let settings: UserSettings;

      if (!existingSettings) {
        const user = await queryRunner.manager.findOne(User, { where: { id: userId } });
        if (!user) {
          throw new NotFoundException('User not found');
        }

        settings = queryRunner.manager.create(UserSettings, {
          userId,
          organizationId: organizationId || undefined,
          ...sanitizedData,
          invoiceNumberFormat: sanitizedData.invoiceNumberFormat || 'INV-{YYYY}-{####}',
          defaultCurrency: sanitizedData.defaultCurrency || 'USD',
          defaultTaxRate: sanitizedData.defaultTaxRate ?? 0,
          companyName: sanitizedData.companyName || user.companyName || '',
          companyAddress: sanitizedData.companyAddress || '',
          companyPhone: sanitizedData.companyPhone || '',
          companyEmail: sanitizedData.companyEmail || user.email || '',
        });
      } else {
        settings = existingSettings;
        // Update existing settings - only update fields that are provided and exist in the entity
        const validFields = Object.keys(this.settingsRepository.metadata.propertiesMap);
        Object.keys(sanitizedData).forEach((key) => {
          if (sanitizedData[key] !== undefined && validFields.includes(key)) {
            settings[key] = sanitizedData[key];
          }
        });
      }

      // Save within transaction
      settings = await queryRunner.manager.save(UserSettings, settings);

      // Log audit trail
      this.logAuditTrail(userId, existingSettings, settings);

      // Commit transaction
      await queryRunner.commitTransaction();

      return this.serializeSettings(settings);
    } catch (error: unknown) {
      // Fix Issue #2: Proper transaction rollback - ensure all operations are rolled back
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to update settings for user ${userId}:`, error);
      
      // Fix Issue #2: Don't attempt fallback save outside transaction - this causes data inconsistency
      // If transaction fails, all changes must be rolled back completely
      throw error;
    } finally {
      // Release query runner
      await queryRunner.release();
    }
  }

  /**
   * Sanitize input to prevent XSS attacks
   */
  private sanitizeInput(data: Partial<UserSettings>): Partial<UserSettings> {
    // Issue #48: Improved type safety - use proper import instead of require
    const sanitized = { ...data };
    
    // Fix Issue #20: Sanitize all text fields including missing ones
    const textFields: Array<{ field: string; maxLength: number }> = [
      { field: 'companyName', maxLength: 255 },
      { field: 'companyAddress', maxLength: 1000 },
      { field: 'companyPhone', maxLength: 50 },
      { field: 'companyEmail', maxLength: 255 },
      { field: 'companyWebsite', maxLength: 2048 },
      { field: 'companyLogo', maxLength: 2048 },
      { field: 'companyTaxId', maxLength: 100 },
      { field: 'companyRegistrationNumber', maxLength: 100 },
      { field: 'companyVatNumber', maxLength: 100 },
      { field: 'defaultInvoiceNotes', maxLength: 10000 },
      { field: 'defaultInvoiceTerms', maxLength: 5000 },
      { field: 'invoiceFooterText', maxLength: 2000 },
      { field: 'taxRegistrationNumber', maxLength: 100 },
      { field: 'smtpHost', maxLength: 255 },
      { field: 'smtpUser', maxLength: 255 },
      { field: 'emailFromName', maxLength: 255 },
      { field: 'emailFromAddress', maxLength: 255 },
      // Fix Issue #20: Add missing fields
      { field: 'invoiceNumberFormat', maxLength: 100 },
      { field: 'primaryColor', maxLength: 7 },
      { field: 'secondaryColor', maxLength: 7 },
    ];

    textFields.forEach(({ field, maxLength }) => {
      if (sanitized[field] && typeof sanitized[field] === 'string') {
        // Special handling for URLs and emails
        if (field === 'companyWebsite' || field === 'companyLogo') {
          sanitized[field] = sanitizeUrl(sanitized[field] as string) || sanitizeString(sanitized[field] as string, maxLength);
        } else if (field === 'companyEmail' || field === 'emailFromAddress') {
          sanitized[field] = sanitizeEmail(sanitized[field] as string) || sanitizeString(sanitized[field] as string, maxLength);
        } else {
          sanitized[field] = sanitizeString(sanitized[field] as string, maxLength);
        }
      }
    });

    return sanitized;
  }

  /**
   * Log audit trail for settings changes
   * Fix Issue #16: Track all sensitive field changes including SMTP password changes
   */
  private logAuditTrail(userId: string, oldSettings: UserSettings | null, newSettings: UserSettings): void {
    if (!oldSettings) {
      this.logger.log(`Settings created for user ${userId}`);
      return;
    }

    const changes: string[] = [];
    // Fix Issue #16: Track all fields including sensitive ones (but mask sensitive values)
    const fieldsToTrack = [
      'companyName', 'companyAddress', 'companyPhone', 'companyEmail',
      'defaultCurrency', 'defaultTaxRate', 'dateFormat', 'timeFormat',
      'timezone', 'smtpHost', 'smtpPort', 'smtpUser', 'smtpSecure',
      'emailFromAddress', 'emailFromName', 'theme', 'language',
    ];
    
    // Sensitive fields that should be masked in logs
    const sensitiveFields = ['smtpPassword'];

    fieldsToTrack.forEach((field) => {
      const oldValue = oldSettings[field];
      const newValue = newSettings[field];
      if (oldValue !== newValue) {
        changes.push(`${field}: "${oldValue}" → "${newValue}"`);
      }
    });
    
    // Track sensitive field changes (but don't log values)
    sensitiveFields.forEach((field) => {
      const oldValue = oldSettings[field];
      const newValue = newSettings[field];
      if (oldValue !== newValue) {
        changes.push(`${field}: [CHANGED]`);
      }
    });

    if (changes.length > 0) {
      this.logger.log(`Settings updated for user ${userId}: ${changes.join(', ')}`);
    }
  }

  private serializeSettings(settings: UserSettings): Record<string, unknown> {
    return {
      invoiceNumberFormat: settings.invoiceNumberFormat || 'INV-{YYYY}-{####}',
      defaultCurrency: settings.defaultCurrency || 'USD',
      defaultTaxRate: settings.defaultTaxRate || 0,
      companyName: settings.companyName || '',
      companyAddress: settings.companyAddress || '',
      companyPhone: settings.companyPhone || '',
      companyEmail: settings.companyEmail || '',
      companyWebsite: settings.companyWebsite || '',
      companyLogo: settings.companyLogo || '',
      companyTaxId: settings.companyTaxId || '',
      companyRegistrationNumber: settings.companyRegistrationNumber || '',
      companyVatNumber: settings.companyVatNumber || '',
      defaultPaymentTermsDays: settings.defaultPaymentTermsDays ?? 30,
      defaultInvoiceNotes: settings.defaultInvoiceNotes || '',
      defaultInvoiceTerms: settings.defaultInvoiceTerms || '',
      autoGenerateInvoiceNumber: settings.autoGenerateInvoiceNumber ?? true,
      showInvoiceNumberOnPDF: settings.showInvoiceNumberOnPDF ?? true,
      showPaymentInstructions: settings.showPaymentInstructions ?? true,
      invoiceFooterText: settings.invoiceFooterText || '',
      dateFormat: settings.dateFormat || 'MM/DD/YYYY',
      timeFormat: settings.timeFormat || '12',
      timezone: settings.timezone || 'America/New_York',
      decimalSeparator: settings.decimalSeparator || '.',
      thousandsSeparator: settings.thousandsSeparator || ',',
      currencySymbolPosition: settings.currencySymbolPosition || 'left',
      showCurrencySymbol: settings.showCurrencySymbol ?? true,
      taxInclusive: settings.taxInclusive ?? false,
      taxRegistrationNumber: settings.taxRegistrationNumber || '',
      defaultReorderLevel: settings.defaultReorderLevel ?? 0,
      defaultInventoryUnit: settings.defaultInventoryUnit || '',
      trackInventory: settings.trackInventory ?? true,
      allowNegativeStock: settings.allowNegativeStock ?? true,
      autoReorderEnabled: settings.autoReorderEnabled ?? false,
      stockAlertThreshold: settings.stockAlertThreshold ?? 10,
      smtpHost: settings.smtpHost || '',
      smtpPort: settings.smtpPort || null,
      smtpSecure: settings.smtpSecure ?? false,
      smtpUser: settings.smtpUser || '',
      // Never return password in serialized settings for security
      smtpPassword: settings.smtpPassword ? '***ENCRYPTED***' : '',
      emailFromName: settings.emailFromName || '',
      emailFromAddress: settings.emailFromAddress || '',
      emailInvoiceSent: settings.emailInvoiceSent ?? true,
      emailInvoicePaid: settings.emailInvoicePaid ?? true,
      emailInvoiceOverdue: settings.emailInvoiceOverdue ?? true,
      emailLowStockAlert: settings.emailLowStockAlert ?? true,
      emailInvoiceReminder: settings.emailInvoiceReminder ?? true,
      emailWeeklyReport: settings.emailWeeklyReport ?? true,
      emailMonthlyReport: settings.emailMonthlyReport ?? true,
      theme: settings.theme || 'light',
      itemsPerPage: settings.itemsPerPage ?? 10,
      language: settings.language || 'en',
      primaryColor: settings.primaryColor || '',
      secondaryColor: settings.secondaryColor || '',
    };
  }

  /**
   * Export all user data as JSON including stores and store item settings
   * Fix Issue #3, #18: Add organizationId parameter for proper organization scoping
   */
  async exportUserData(userId: string, organizationId?: string | null): Promise<{
    data: ExportData;
    timestamp: string;
    backupId: string;
  }> {
    try {
      this.logger.log(`Exporting user data for user ${userId}`);

      // Get all user data including stores
      const [
        user,
        settings,
        clients,
        stores,
        storeItemSettings,
        invoices,
        inventoryItems,
        stockMovements,
        // recurringInvoices, // Removed
        // invoiceTemplates, // Removed
      ] = await Promise.all([
        this.usersRepository.findOne({ where: { id: userId } }),
        this.settingsRepository.findOne({ where: { userId } }),
        this.clientsRepository.find({ where: { userId }, order: { createdAt: 'DESC' } }),
        this.storeRepository.find({
          where: { userId },
          relations: ['client'],
          order: { createdAt: 'DESC' },
        }),
        this.storeItemSettingsRepository
          .createQueryBuilder('settings')
          .leftJoinAndSelect('settings.store', 'store')
          .leftJoinAndSelect('settings.inventoryItem', 'inventoryItem')
          .where('store.userId = :userId', { userId })
          .orderBy('settings.createdAt', 'DESC')
          .getMany(),
        this.invoicesRepository.find({
          where: { userId },
          relations: ['client', 'items'],
          order: { createdAt: 'DESC' },
        }),
        this.inventoryRepository.find({ where: { userId }, order: { createdAt: 'DESC' } }),
        this.stockMovementsRepository.find({
          where: { userId },
          relations: ['inventoryItem'],
          order: { createdAt: 'DESC' },
        }),
        // this.recurringInvoicesRepository.find({ // Removed
        //   where: { userId },
        //   relations: ['client'],
        //   order: { createdAt: 'DESC' },
        // }),
        // this.invoiceTemplatesRepository.find({ where: { userId }, order: { createdAt: 'DESC' } }), // Removed
        Promise.resolve([]), // Placeholder for recurringInvoices
        Promise.resolve([]), // Placeholder for invoiceTemplates
      ]);

      // Get invoice items separately to ensure we have all data
      const invoiceIds = invoices.map((inv) => inv.id);
      let allInvoiceItems: InvoiceItem[] = [];
      if (invoiceIds.length > 0) {
        allInvoiceItems = await this.invoiceItemsRepository
          .createQueryBuilder('item')
          .where('item.invoiceId IN (:...ids)', { ids: invoiceIds })
          .leftJoinAndSelect('item.inventoryItem', 'inventoryItem')
          .getMany();
      }

      // Sanitize sensitive data from user and settings
      const userData = user
        ? {
            id: user.id,
            email: user.email,
            name: user.name,
            companyName: user.companyName,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
          }
        : null;

      const settingsData = settings ? this.serializeSettings(settings) : null;

      // Prepare export data with stores
      const exportData: ExportData = {
        exportInfo: {
          version: '1.0.0',
          timestamp: new Date().toISOString(),
          userId,
          exportedAt: new Date().toISOString(),
        },
        user: userData,
        settings: settingsData,
        clients: clients.map((c) => ({
          ...c,
          // Remove sensitive fields if any
        })),
        stores: stores.map((store) => ({
          ...store,
          itemSettings: storeItemSettings
            .filter((setting) => setting.storeId === store.id)
            .map((setting) => ({
              id: setting.id,
              storeId: setting.storeId,
              inventoryItemId: setting.inventoryItemId,
              currentStock: setting.currentStock,
              minQty: setting.minQty,
              targetQty: setting.targetQty,
              weeklyUsage: setting.weeklyUsage,
              createdAt: setting.createdAt,
              updatedAt: setting.updatedAt,
            })),
          client: store.client ? { id: store.client.id, name: store.client.name, email: store.client.email } : null,
        })) as ExportData['stores'],
        storeItemSettings: storeItemSettings.map((setting) => ({
          ...setting,
          store: setting.store ? { id: setting.store.id, name: setting.store.name, code: setting.store.code } : null,
          inventoryItem: setting.inventoryItem ? { 
            id: setting.inventoryItem.id, 
            name: setting.inventoryItem.name, 
            sku: setting.inventoryItem.sku 
          } : null,
        })) as ExportData['storeItemSettings'],
        invoices: invoices.map((inv) => {
          // Use items from relation if available, otherwise use the separately loaded items
          const invoiceItems = inv.items && inv.items.length > 0 
            ? inv.items 
            : allInvoiceItems.filter((item) => item.invoiceId === inv.id);
          
          return {
            ...inv,
            items: invoiceItems.map((item: InvoiceItem) => ({
              id: item.id,
              invoiceId: item.invoiceId || inv.id,
              inventoryItemId: item.inventoryItemId,
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              taxRate: item.taxRate,
              discountRate: item.discountRate,
              lineTotal: item.lineTotal,
              createdAt: item.createdAt,
              inventoryItem: item.inventoryItem ? { 
                id: item.inventoryItem.id, 
                name: item.inventoryItem.name, 
                sku: item.inventoryItem.sku 
              } : null,
            })),
            client: inv.client ? { id: inv.client.id, name: inv.client.name, email: inv.client.email } : null,
          };
        }) as ExportData['invoices'],
        inventory: inventoryItems.map((item) => ({
          ...item,
          movements: stockMovements
            .filter((mov) => mov.inventoryItemId === item.id)
            .map((mov) => {
              const { inventoryItem, ...movementWithoutItem } = mov;
              return movementWithoutItem;
            }),
        })) as ExportData['inventory'],
        stockMovements: stockMovements.map((mov) => ({
          ...mov,
          inventoryItem: mov.inventoryItem ? { id: mov.inventoryItem.id, name: mov.inventoryItem.name, sku: mov.inventoryItem.sku } : null,
        })) as ExportData['stockMovements'],
        // recurringInvoices: recurringInvoices.map((rec) => ({ // Removed
        //   ...rec,
        //   client: rec.client ? { id: rec.client.id, name: rec.client.name, email: rec.client.email } : null,
        // })) as ExportData['recurringInvoices'],
        // invoiceTemplates, // Removed
      };

      const timestamp = new Date().toISOString();
      const backupId = `backup_${Date.now()}`;

      return {
        data: exportData,
        timestamp,
        backupId,
      };
    } catch (error: unknown) {
      this.logger.error(`Failed to export user data for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Generate SQL database backup using pg_dump
   */
  async generateSqlBackup(): Promise<{
    filePath: string;
    fileName: string;
    timestamp: string;
  }> {
    try {
      const dbHost = process.env.DB_HOST || 'localhost';
      const dbPort = process.env.DB_PORT || '5432';
      const dbUser = process.env.DB_USERNAME || 'postgres';
      const dbPassword = process.env.DB_PASSWORD || 'postgres';
      const dbName = process.env.DB_DATABASE || 'invoiceme';

      // Create backup directory if it doesn't exist
      const backupDir = path.join(process.cwd(), 'backups');
      await fs.mkdir(backupDir, { recursive: true });

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `invoiceme_backup_${timestamp}.sql`;
      const filePath = path.join(backupDir, fileName);

      // Build pg_dump command
      const pgDumpCommand = `PGPASSWORD="${dbPassword}" pg_dump -h "${dbHost}" -p "${dbPort}" -U "${dbUser}" -d "${dbName}" -F p -f "${filePath}"`;

      this.logger.log(`Starting SQL backup to ${filePath}`);

      try {
        await execAsync(pgDumpCommand);
        this.logger.log(`SQL backup completed: ${filePath}`);
      } catch (execError: unknown) {
        // If pg_dump fails, try without compression
        const errorMessage = execError instanceof Error ? execError.message : String(execError);
        this.logger.warn(`pg_dump failed, trying alternative method: ${errorMessage}`);
        throw new Error(`Failed to create SQL backup: ${errorMessage}`);
      }

      return {
        filePath,
        fileName,
        timestamp: new Date().toISOString(),
      };
    } catch (error: unknown) {
      this.logger.error(`Failed to generate SQL backup:`, error);
      throw error;
    }
  }

  /**
   * Create a manual backup of user data
   * Returns export data that can be downloaded as JSON
   * Fix Issue #3, #18: Add organizationId parameter
   */
  async createBackup(
    userId: string,
    options?: { includeSqlBackup?: boolean },
    organizationId?: string | null,
  ): Promise<{
    message: string;
    timestamp: string;
    backupId: string;
    data?: Record<string, unknown>;
    sqlBackupPath?: string;
  }> {
    try {
      const timestamp = new Date().toISOString();
      const backupId = `backup_${Date.now()}`;

      this.logger.log(`Manual backup requested by user ${userId} at ${timestamp}`);

      // Export user data as JSON
      const exportResult = await this.exportUserData(userId, organizationId);

      let sqlBackupPath: string | undefined;

      // Optionally generate SQL backup
      if (options?.includeSqlBackup) {
        try {
          const sqlBackup = await this.generateSqlBackup();
          sqlBackupPath = sqlBackup.filePath;
          this.logger.log(`SQL backup created: ${sqlBackupPath}`);
        } catch (sqlError: unknown) {
          const errorMessage = sqlError instanceof Error ? sqlError.message : String(sqlError);
          this.logger.warn(`SQL backup failed, continuing with JSON export only: ${errorMessage}`);
        }
      }

      return {
        message: sqlBackupPath
          ? 'Backup created successfully. Data exported and SQL backup generated.'
          : 'Backup created successfully. Data exported.',
        timestamp,
        backupId,
        data: exportResult.data,
        sqlBackupPath,
      };
    } catch (error: unknown) {
      this.logger.error(`Failed to create backup for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Test email connection - Email functionality has been removed
   */
  async testEmailConnection(
    userId: string,
    credentials?: {
      smtpHost?: string;
      smtpPort?: number;
      smtpSecure?: boolean;
      smtpUser?: string;
      smtpPassword?: string;
      emailFromAddress?: string;
      emailFromName?: string;
    },
  ): Promise<{ success: boolean; message: string }> {
    this.logger.warn(`Email test connection requested by user ${userId} - email functionality has been disabled`);
    return {
      success: false,
      message: 'Email functionality has been disabled',
    };
  }

  /**
   * Export user data as CSV
   * Fix Issue #3, #18: Add organizationId parameter
   */
  async exportUserDataAsCsv(userId: string, organizationId?: string | null): Promise<string> {
    try {
      this.logger.log(`Exporting user data as CSV for user ${userId}`);
      const exportResult = await this.exportUserData(userId, organizationId);
      const data = exportResult.data as ExportData;

      // Build CSV content
      const csvLines: string[] = [];
      
      // Add metadata header
      csvLines.push('InvoiceMe Data Export');
      csvLines.push(`Export Date: ${new Date().toISOString()}`);
      csvLines.push(`User: ${data.user?.name || data.user?.email || 'Unknown'}`);
      csvLines.push('');

      // Export Clients
      if (data.clients && data.clients.length > 0) {
        csvLines.push('=== CLIENTS ===');
        csvLines.push('Name,Email,Phone,Address,Created At');
        data.clients.forEach((client: Client) => {
          csvLines.push([
            this.escapeCsvValue(client.name || ''),
            this.escapeCsvValue(client.email || ''),
            this.escapeCsvValue(client.phone || ''),
            this.escapeCsvValue(client.addressJson ? `${client.addressJson.street || ''}, ${client.addressJson.city || ''}, ${client.addressJson.state || ''} ${client.addressJson.zip || ''}`.trim() : ''),
            client.createdAt || '',
          ].join(','));
        });
        csvLines.push('');
      }

      // Export Invoices
      if (data.invoices && data.invoices.length > 0) {
        csvLines.push('=== INVOICES ===');
        csvLines.push('Invoice Number,Client,Status,Issue Date,Due Date,Subtotal,Tax,Total,Currency');
        data.invoices.forEach((invoice: Invoice) => {
          csvLines.push([
            this.escapeCsvValue(invoice.number || ''),
            this.escapeCsvValue(invoice.client?.name || ''),
            this.escapeCsvValue(invoice.status || ''),
            invoice.issueDate || '',
            invoice.dueDate || '',
            invoice.subtotal || 0,
            invoice.taxTotal || 0,
            invoice.total || 0,
            this.escapeCsvValue(invoice.currency || 'USD'),
          ].join(','));
        });
        csvLines.push('');
      }

      // Export Inventory
      if (data.inventory && data.inventory.length > 0) {
        csvLines.push('=== INVENTORY ===');
        csvLines.push('Name,SKU,Quantity,Unit Price,Reorder Level,Status');
        data.inventory.forEach((item: InventoryItem) => {
          csvLines.push([
            this.escapeCsvValue(item.name || ''),
            this.escapeCsvValue(item.sku || ''),
            item.currentStock || 0,
            item.defaultUnitPrice || 0,
            item.reorderLevel || 0,
            this.escapeCsvValue(item.status || ''),
          ].join(','));
        });
        csvLines.push('');
      }

      return csvLines.join('\r\n');
    } catch (error: unknown) {
      this.logger.error(`Failed to export user data as CSV for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Escape CSV value
   */
  private escapeCsvValue(value: unknown): string {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  /**
   * Export user data as Excel
   * Fix Issue #3, #18: Add organizationId parameter
   */
  async exportUserDataAsExcel(userId: string, organizationId?: string | null): Promise<Buffer> {
    try {
      this.logger.log(`Exporting user data as Excel for user ${userId}`);
      const exportResult = await this.exportUserData(userId, organizationId);
      const data = exportResult.data as ExportData;

      interface ExcelSheet {
        name: string;
        headers?: string[];
        data: unknown[][];
      }
      const sheets: ExcelSheet[] = [];

      // Clients sheet
      if (data.clients && data.clients.length > 0) {
        sheets.push({
          name: 'Clients',
          headers: ['Name', 'Email', 'Phone', 'Address', 'Created At'],
          data: data.clients.map((client: Client) => [
            client.name || '',
            client.email || '',
            client.phone || '',
            client.addressJson ? `${client.addressJson.street || ''}, ${client.addressJson.city || ''}, ${client.addressJson.state || ''} ${client.addressJson.zip || ''}`.trim() : '',
            client.createdAt ? new Date(client.createdAt).toLocaleDateString() : '',
          ]),
        });
      }

      // Invoices sheet
      if (data.invoices && data.invoices.length > 0) {
        sheets.push({
          name: 'Invoices',
          headers: ['Invoice Number', 'Client', 'Status', 'Issue Date', 'Due Date', 'Subtotal', 'Tax', 'Total', 'Currency'],
          data: data.invoices.map((invoice: Invoice) => [
            invoice.number || '',
            invoice.client?.name || '',
            invoice.status || '',
            invoice.issueDate ? new Date(invoice.issueDate).toLocaleDateString() : '',
            invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : '',
            invoice.subtotal || 0,
            invoice.taxTotal || 0,
            invoice.total || 0,
            invoice.currency || 'USD',
          ]),
        });
      }

      // Inventory sheet
      if (data.inventory && data.inventory.length > 0) {
        sheets.push({
          name: 'Inventory',
          headers: ['Name', 'SKU', 'Quantity', 'Unit Price', 'Reorder Level', 'Status'],
          data: data.inventory.map((item: InventoryItem) => [
            item.name || '',
            item.sku || '',
            item.currentStock || 0,
            item.defaultUnitPrice || 0,
            item.reorderLevel || 0,
            item.status || '',
          ]),
        });
      }

      // Stock Movements sheet
      if (data.stockMovements && data.stockMovements.length > 0) {
        sheets.push({
          name: 'Stock Movements',
          headers: ['Item', 'Type', 'Quantity', 'Date', 'Notes'],
          data: data.stockMovements.map((movement: StockMovement) => [
            movement.inventoryItem?.name || '',
            movement.type || '',
            movement.quantity || 0,
            movement.createdAt ? new Date(movement.createdAt).toLocaleDateString() : '',
            movement.note || '',
          ]),
        });
      }

      // Stores sheet
      if (data.stores && data.stores.length > 0) {
        sheets.push({
          name: 'Stores',
          headers: ['Name', 'Code', 'Client', 'Address', 'Phone', 'Email', 'City', 'State', 'Zip', 'Country', 'Active', 'Created At'],
          data: data.stores.map((store: Store) => [
            store.name || '',
            store.code || '',
            store.client?.name || '',
            store.address || '',
            store.phone || '',
            store.email || '',
            store.city || '',
            store.state || '',
            store.zip || '',
            store.country || '',
            store.active ? 'Yes' : 'No',
            store.createdAt ? new Date(store.createdAt).toLocaleDateString() : '',
          ]),
        });
      }

      // Store Item Settings sheet
      if (data.storeItemSettings && data.storeItemSettings.length > 0) {
        sheets.push({
          name: 'Store Item Settings',
          headers: ['Store', 'Store Code', 'Inventory Item', 'SKU', 'Current Stock', 'Min Qty', 'Target Qty', 'Weekly Usage', 'Updated At'],
          data: data.storeItemSettings.map((setting: StoreItemSettings) => [
            setting.store?.name || '',
            setting.store?.code || '',
            setting.inventoryItem?.name || '',
            setting.inventoryItem?.sku || '',
            setting.currentStock || 0,
            setting.minQty || 0,
            setting.targetQty || '',
            setting.weeklyUsage || '',
            setting.updatedAt ? new Date(setting.updatedAt).toLocaleDateString() : '',
          ]),
        });
      }

      if (sheets.length === 0) {
        // Create empty sheet if no data
        sheets.push({
          name: 'Data',
          headers: ['No Data'],
          data: [['No data available for export']],
        });
      }

      return await createExcelWorkbook({ sheets });
    } catch (error: unknown) {
      this.logger.error(`Failed to export user data as Excel for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Export user data as PDF
   * Fix Issue #3, #18: Add organizationId parameter
   * Fix Issue #19: Improved error handling
   */
  async exportUserDataAsPdf(userId: string, organizationId?: string | null): Promise<Buffer> {
    try {
      this.logger.log(`Exporting user data as PDF for user ${userId}`);
      const exportResult = await this.exportUserData(userId, organizationId);
      const data = exportResult.data as ExportData;
      // For PDF export, get first available settings or use defaults
      // This is a user-level operation, so we get the first org's settings
      const firstSettings = await this.settingsRepository.findOne({ 
        where: { userId },
        order: { createdAt: 'ASC' },
      });
      const settings = firstSettings ? this.serializeSettings(firstSettings) : {};

      // Build HTML for PDF
      const html = this.buildExportPdfHtml(data, settings);
      
      this.logger.log(`Generated HTML for PDF export (${html.length} characters)`);

      // Generate PDF with error handling
      try {
        const pdfBuffer = await this.puppeteerService.generatePdfFromHtml(html);
        this.logger.log(`PDF generated successfully (${pdfBuffer.length} bytes)`);
        return pdfBuffer;
      } catch (puppeteerError: unknown) {
        const errorMessage = puppeteerError instanceof Error ? puppeteerError.message : String(puppeteerError);
        this.logger.error(`Puppeteer PDF generation failed: ${errorMessage}`);
        throw new Error(`Failed to generate PDF: ${errorMessage}. Please ensure Puppeteer is properly installed and configured.`);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to export user data as PDF for user ${userId}:`, errorMessage);
      throw error;
    }
  }

  /**
   * Build HTML for PDF export
   */
  private buildExportPdfHtml(data: ExportData, settings: Record<string, unknown>): string {
    try {
      const exportData = data;
      const companyName = (settings?.companyName as string) || 'InvoiceMe';
      const exportDate = new Date().toISOString().split('T')[0];

      let html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @page {
      size: A4;
      margin: 15mm;
      @bottom-center {
        content: "Page " counter(page) " of " counter(pages);
        font-size: 10px;
        color: #666;
      }
    }
    body {
      font-family: Arial, sans-serif;
      margin: 0;
      padding: 0;
      color: #333;
      font-size: 9px;
      line-height: 1.4;
    }
    h1 {
      color: #1976d2;
      border-bottom: 2px solid #1976d2;
      padding-bottom: 10px;
      margin-top: 0;
      page-break-after: avoid;
      font-size: 18px;
    }
    h2 {
      color: #555;
      margin-top: 25px;
      margin-bottom: 10px;
      border-bottom: 1px solid #ddd;
      padding-bottom: 5px;
      page-break-after: avoid;
      font-size: 14px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 15px 0;
      font-size: 8px;
      page-break-inside: auto;
    }
    thead {
      display: table-header-group;
    }
    tbody {
      display: table-row-group;
    }
    tr {
      page-break-inside: avoid;
      page-break-after: auto;
    }
    th, td {
      border: 1px solid #ddd;
      padding: 5px 4px;
      text-align: left;
      word-wrap: break-word;
      max-width: 150px;
    }
    th {
      background-color: #f5f5f5;
      font-weight: bold;
      font-size: 8px;
      position: sticky;
      top: 0;
    }
    td {
      font-size: 7.5px;
    }
    .summary {
      background-color: #f9f9f9;
      padding: 12px;
      border-radius: 5px;
      margin: 15px 0;
      page-break-inside: avoid;
      font-size: 10px;
    }
    .meta {
      color: #666;
      font-size: 10px;
      margin-bottom: 20px;
      page-break-after: avoid;
    }
    .meta ul {
      margin: 5px 0;
      padding-left: 20px;
    }
    .meta li {
      margin: 3px 0;
    }
    .section-break {
      page-break-before: always;
    }
    .no-break {
      page-break-inside: avoid;
    }
    @media print {
      table {
        page-break-inside: auto;
      }
      tr {
        page-break-inside: avoid;
        page-break-after: auto;
      }
      thead {
        display: table-header-group;
      }
      tfoot {
        display: table-footer-group;
      }
    }
  </style>
</head>
<body>
  <h1>${this.escapeHtml(companyName)} - Data Export</h1>
  <div class="meta">
    <p><strong>Export Date:</strong> ${exportDate}</p>
    <p><strong>User:</strong> ${this.escapeHtml(exportData.user?.name || exportData.user?.email || 'Unknown')}</p>
    <p><strong>Data Summary:</strong></p>
    <ul>
      <li>Clients: ${exportData.clients?.length || 0}</li>
      <li>Stores: ${exportData.stores?.length || 0}</li>
      <li>Store Item Settings: ${exportData.storeItemSettings?.length || 0}</li>
      <li>Inventory Items: ${exportData.inventory?.length || 0}</li>
      <li>Invoices: ${exportData.invoices?.length || 0}</li>
      <li>Stock Movements: ${exportData.stockMovements?.length || 0}</li>
      <!-- Recurring Invoices and Invoice Templates removed -->
    </ul>
  </div>
`;

    // Clients section
    if (exportData.clients && exportData.clients.length > 0) {
      html += `
  <h2>Clients (${exportData.clients.length})</h2>
  <table>
    <thead>
      <tr>
        <th>Name</th>
        <th>Email</th>
        <th>Phone</th>
        <th>Address</th>
      </tr>
    </thead>
    <tbody>
`;
      exportData.clients.forEach((client: any) => {
        const addressJson = client.addressJson || {};
        const address = `${addressJson.street || ''}, ${addressJson.city || ''}, ${addressJson.state || ''} ${addressJson.zip || ''}`.trim();
        html += `
      <tr>
        <td>${this.escapeHtml(client.name || '')}</td>
        <td>${this.escapeHtml(client.email || '')}</td>
        <td>${this.escapeHtml(client.phone || '')}</td>
        <td>${this.escapeHtml(address)}</td>
      </tr>
`;
      });
      html += `
    </tbody>
  </table>
`;
    }

    // Invoices section
    if (exportData.invoices && exportData.invoices.length > 0) {
      const totalRevenue = exportData.invoices.reduce((sum: number, inv: any) => {
        const total = Number(inv.total) || 0;
        return sum + total;
      }, 0);
      const firstInvoice = exportData.invoices[0] as any;
      html += `
  <h2>Invoices (${exportData.invoices.length})</h2>
  <div class="summary no-break">
    <strong>Total Revenue:</strong> ${totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${this.escapeHtml(firstInvoice?.currency || 'USD')}
  </div>
  <table>
    <thead>
      <tr>
        <th style="width: 12%;">Invoice #</th>
        <th style="width: 20%;">Client</th>
        <th style="width: 10%;">Status</th>
        <th style="width: 12%;">Issue Date</th>
        <th style="width: 12%;">Due Date</th>
        <th style="width: 15%;">Total</th>
      </tr>
    </thead>
    <tbody>
`;
      // Ensure ALL invoices are included - no limits
      exportData.invoices.forEach((invoice: any) => {
        html += `
      <tr>
        <td>${this.escapeHtml(invoice.number || '')}</td>
        <td>${this.escapeHtml(invoice.client?.name || '')}</td>
        <td>${this.escapeHtml(invoice.status || '')}</td>
        <td>${invoice.issueDate ? new Date(invoice.issueDate).toLocaleDateString() : ''}</td>
        <td>${invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : ''}</td>
        <td>${(Number(invoice.total) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${this.escapeHtml(invoice.currency || 'USD')}</td>
      </tr>
`;
      });
      html += `
    </tbody>
  </table>
`;
    }

    // Inventory section
    if (exportData.inventory && exportData.inventory.length > 0) {
      html += `
  <h2>Inventory (${exportData.inventory.length} items)</h2>
  <table>
    <thead>
      <tr>
        <th>Name</th>
        <th>SKU</th>
        <th>Quantity</th>
        <th>Unit Price</th>
        <th>Reorder Level</th>
      </tr>
    </thead>
    <tbody>
`;
      exportData.inventory.forEach((item: any) => {
        html += `
      <tr>
        <td>${this.escapeHtml(item.name || '')}</td>
        <td>${this.escapeHtml(item.sku || '')}</td>
        <td>${item.currentStock || 0}</td>
        <td>${(Number(item.defaultUnitPrice) || 0).toFixed(2)}</td>
        <td>${item.reorderLevel || 0}</td>
      </tr>
`;
      });
      html += `
    </tbody>
  </table>
`;
    }

    // Stores section
    if (exportData.stores && exportData.stores.length > 0) {
      html += `
  <h2>Stores (${exportData.stores.length})</h2>
  <table>
    <thead>
      <tr>
        <th>Name</th>
        <th>Code</th>
        <th>Client</th>
        <th>Address</th>
        <th>Phone</th>
        <th>Email</th>
        <th>Active</th>
      </tr>
    </thead>
    <tbody>
`;
      exportData.stores.forEach((store: any) => {
        html += `
      <tr>
        <td>${this.escapeHtml(store.name || '')}</td>
        <td>${this.escapeHtml(store.code || '')}</td>
        <td>${this.escapeHtml(store.client?.name || '')}</td>
        <td>${this.escapeHtml(store.address || '')}</td>
        <td>${this.escapeHtml(store.phone || '')}</td>
        <td>${this.escapeHtml(store.email || '')}</td>
        <td>${store.active ? 'Yes' : 'No'}</td>
      </tr>
`;
      });
      html += `
    </tbody>
  </table>
`;
    }

    // Store Item Settings section
    if (exportData.storeItemSettings && exportData.storeItemSettings.length > 0) {
      html += `
  <h2>Store Item Settings (${exportData.storeItemSettings.length})</h2>
  <table>
    <thead>
      <tr>
        <th style="width: 18%;">Store</th>
        <th style="width: 22%;">Inventory Item</th>
        <th style="width: 12%;">SKU</th>
        <th style="width: 10%;">Current Stock</th>
        <th style="width: 8%;">Min Qty</th>
        <th style="width: 10%;">Target Qty</th>
        <th style="width: 10%;">Weekly Usage</th>
      </tr>
    </thead>
    <tbody>
`;
      // Ensure ALL store item settings are included - no limits
      exportData.storeItemSettings.forEach((setting: any) => {
        html += `
      <tr>
        <td>${this.escapeHtml(setting.store?.name || '')}</td>
        <td>${this.escapeHtml(setting.inventoryItem?.name || '')}</td>
        <td>${this.escapeHtml(setting.inventoryItem?.sku || '')}</td>
        <td>${setting.currentStock || 0}</td>
        <td>${setting.minQty || 0}</td>
        <td>${setting.targetQty ?? ''}</td>
        <td>${setting.weeklyUsage ?? ''}</td>
      </tr>
`;
      });
      html += `
    </tbody>
  </table>
`;
    }

    // Stock Movements section
    if (exportData.stockMovements && exportData.stockMovements.length > 0) {
      html += `
  <h2>Stock Movements (${exportData.stockMovements.length})</h2>
  <table>
    <thead>
      <tr>
        <th style="width: 25%;">Item</th>
        <th style="width: 10%;">Type</th>
        <th style="width: 8%;">Quantity</th>
        <th style="width: 12%;">Date</th>
        <th style="width: 45%;">Notes</th>
      </tr>
    </thead>
    <tbody>
`;
      // Ensure ALL stock movements are included - no limits
      exportData.stockMovements.forEach((movement: any) => {
        html += `
      <tr>
        <td>${this.escapeHtml(movement.inventoryItem?.name || '')}</td>
        <td>${this.escapeHtml(movement.type || '')}</td>
        <td>${movement.quantity || 0}</td>
        <td>${movement.createdAt ? new Date(movement.createdAt).toLocaleDateString() : ''}</td>
        <td>${this.escapeHtml(movement.note || '')}</td>
      </tr>
`;
      });
      html += `
    </tbody>
  </table>
`;
    }

    // Recurring Invoices and Invoice Templates sections removed

    html += `
</body>
</html>
`;

      return html;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error building PDF HTML: ${errorMessage}`, error);
      throw new Error(`Failed to build PDF HTML: ${errorMessage}`);
    }
  }

  /**
   * Escape HTML special characters
   */
  private escapeHtml(text: string | number | null | undefined): string {
    if (text === null || text === undefined) return '';
    const textStr = String(text);
    if (!textStr) return '';
    const map: { [key: string]: string } = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return textStr.replace(/[&<>"']/g, (m) => map[m]);
  }
}

