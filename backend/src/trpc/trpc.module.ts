// Copyright (c) 2025 Asset Vault. All rights reserved.

import { Module } from '@nestjs/common';
import { TrpcService } from './trpc.service';
import { TrpcRouter } from './trpc.router';
import { TrpcController } from './trpc.controller';
import { InvoicesModule } from '../invoices/invoices.module';
import { ClientsModule } from '../clients/clients.module';
import { InventoryModule } from '../inventory/inventory.module';
import { AnalyticsModule } from '../analytics/analytics.module';

@Module({
  imports: [
    InvoicesModule, // Exports InvoicesService
    ClientsModule, // Exports ClientsService
    InventoryModule, // Exports InventoryService
    AnalyticsModule, // Exports AnalyticsService
  ],
  providers: [TrpcService, TrpcRouter],
  controllers: [TrpcController],
  exports: [TrpcService, TrpcRouter],
})
export class TrpcModule {}
