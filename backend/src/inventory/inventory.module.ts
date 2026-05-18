import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { StoreController } from './store.controller';
import { StoreService } from './store.service';
import { StoreItemSettingsController } from './store-item-settings.controller';
import { StoreAlertsController } from './store-alerts.controller';
import { StoreItemSettingsService } from './store-item-settings.service';
import { StoreStockValidatorService } from './store-stock-validator.service';
import { StoreTransferService } from './store-transfer.service';
import { StoreAlertsService } from './store-alerts.service';
import { InventoryItem } from './entities/inventory-item.entity';
import { StockMovement } from './entities/stock-movement.entity';
import { Store } from './entities/store.entity';
import { StoreItemSettings } from './entities/store-item-settings.entity';
import { StoreAlert } from './entities/store-alert.entity';
import { InvoiceItem } from '../invoices/entities/invoice-item.entity';
import { Invoice } from '../invoices/entities/invoice.entity';
import { UserSettings } from '../user-settings/entities/user-settings.entity';
import { User } from '../users/entities/user.entity';
import { Client } from '../clients/entities/client.entity';
import { MailModule } from '../mail/mail.module';
import { UserSettingsModule } from '../user-settings/user-settings.module';
import { OrganizationsModule } from '../organizations/organizations.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([InventoryItem, StockMovement, Store, StoreItemSettings, StoreAlert, InvoiceItem, Invoice, UserSettings, User, Client]),
    MailModule,
    UserSettingsModule,
    OrganizationsModule,
  ],
  controllers: [InventoryController, StoreController, StoreItemSettingsController, StoreAlertsController],
  providers: [
    InventoryService,
    StoreService,
    StoreItemSettingsService,
    StoreStockValidatorService,
    StoreTransferService,
    StoreAlertsService,
  ],
  exports: [
    InventoryService,
    StoreService,
    StoreItemSettingsService,
    StoreStockValidatorService,
    StoreTransferService,
    StoreAlertsService,
  ],
})
export class InventoryModule {}

