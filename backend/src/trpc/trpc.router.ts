// Copyright (c) 2025 Asset Vault. All rights reserved.

import { Injectable, Inject } from '@nestjs/common';
import { TrpcService } from './trpc.service';
import { invoicesRouter } from './routers/invoices.router';
import { clientsRouter } from './routers/clients.router';
import { inventoryRouter } from './routers/inventory.router';
import { analyticsRouter } from './routers/analytics.router';
import { InvoicesService } from '../invoices/invoices.service';
import { ClientsService } from '../clients/clients.service';
import { InventoryService } from '../inventory/inventory.service';
import { AnalyticsService } from '../analytics/analytics.service';

@Injectable()
export class TrpcRouter {
  appRouter: ReturnType<TrpcService['router']>;

  constructor(
    private readonly trpc: TrpcService,
    private readonly invoicesService: InvoicesService,
    private readonly clientsService: ClientsService,
    private readonly inventoryService: InventoryService,
    private readonly analyticsService: AnalyticsService,
  ) {
    this.appRouter = this.trpc.router({
      invoices: invoicesRouter(this.trpc, this.invoicesService),
      clients: clientsRouter(this.trpc, this.clientsService),
      inventory: inventoryRouter(this.trpc, this.inventoryService),
      analytics: analyticsRouter(this.trpc, this.analyticsService),
    });
  }
}

export type AppRouter = TrpcRouter['appRouter'];
