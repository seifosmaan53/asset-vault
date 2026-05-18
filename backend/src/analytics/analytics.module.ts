import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { StoreReportPdfService } from './store-report-pdf.service';
import { Invoice } from '../invoices/entities/invoice.entity';
import { InvoiceItem } from '../invoices/entities/invoice-item.entity';
import { Client } from '../clients/entities/client.entity';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { Store } from '../inventory/entities/store.entity';
import { StoreItemSettings } from '../inventory/entities/store-item-settings.entity';
import { StockMovement } from '../inventory/entities/stock-movement.entity';
import { OrganizationsModule } from '../organizations/organizations.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Invoice,
      InvoiceItem,
      Client,
      InventoryItem,
      Store,
      StoreItemSettings,
      StockMovement,
    ]),
    OrganizationsModule,
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, StoreReportPdfService],
  exports: [AnalyticsService, StoreReportPdfService],
})
export class AnalyticsModule {}

