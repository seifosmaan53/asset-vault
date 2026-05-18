import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserSettingsController } from './user-settings.controller';
import { UserSettingsService } from './user-settings.service';
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
import { BackupSchedulerService } from './backup-scheduler.service';
import { TwoFactorService } from './two-factor.service';
import { MailModule } from '../mail/mail.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      UserSettings,
      Client,
      Invoice,
      InvoiceItem,
      InventoryItem,
      StockMovement,
      // RecurringInvoice, // Removed
      // InvoiceTemplate, // Removed
      Store,
      StoreItemSettings,
    ]),
    MailModule,
    UsersModule,
  ],
  controllers: [UserSettingsController],
  providers: [UserSettingsService, BackupSchedulerService, TwoFactorService],
  exports: [UserSettingsService, TwoFactorService],
})
export class UserSettingsModule {}

