// Copyright (c) 2025 Asset Vault. All rights reserved.

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SampleDataController } from './sample-data.controller';
import { SampleDataService } from './sample-data.service';
import { User } from '../users/entities/user.entity';
import { Client } from '../clients/entities/client.entity';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { Invoice } from '../invoices/entities/invoice.entity';
import { InvoiceItem } from '../invoices/entities/invoice-item.entity';
import { Organization } from '../organizations/entities/organization.entity';
import { UserOrganization } from '../organizations/entities/user-organization.entity';
import { Store } from '../inventory/entities/store.entity';
import { OrganizationsModule } from '../organizations/organizations.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Client,
      InventoryItem,
      Invoice,
      InvoiceItem,
      Organization,
      UserOrganization,
      Store,
    ]),
    OrganizationsModule,
  ],
  controllers: [SampleDataController],
  providers: [SampleDataService],
  exports: [SampleDataService],
})
export class SampleDataModule {}

