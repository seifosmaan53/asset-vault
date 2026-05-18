import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { InvoicePdfService } from './invoice-pdf.service';
import { InvoiceRemindersService } from './invoice-reminders.service';
import { Invoice } from './entities/invoice.entity';
import { InvoiceItem } from './entities/invoice-item.entity';
import { InvoiceStatusHistory } from './entities/invoice-status-history.entity';
import { InventoryModule } from '../inventory/inventory.module';
import { MailModule } from '../mail/mail.module';
import { UserSettingsModule } from '../user-settings/user-settings.module';
import { CurrencyModule } from '../currency/currency.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Invoice, InvoiceItem, InvoiceStatusHistory]),
    InventoryModule, // Exports StoreStockValidatorService
    MailModule,
    UserSettingsModule,
    CurrencyModule,
    OrganizationsModule, // For OrganizationsService to get default organization
    SubscriptionsModule, // For UsageService and quota checking
  ],
  controllers: [InvoicesController],
  providers: [InvoicesService, InvoicePdfService, InvoiceRemindersService],
  exports: [InvoicesService],
})
export class InvoicesModule {}

