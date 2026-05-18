// Copyright (c) 2025 Asset Vault. All rights reserved.

import { z } from 'zod';
import { TrpcService } from '../trpc.service';
import { TRPCError } from '@trpc/server';
import { Injectable } from '@nestjs/common';
import { AnalyticsService } from '../../analytics/analytics.service';

@Injectable()
export class AnalyticsRouter {
  constructor(private readonly analyticsService: AnalyticsService) {}

  createRouter(trpc: TrpcService) {
    return trpc.router({
      stats: trpc.protectedProcedure.query(async ({ ctx }) => {
        // Get invoice stats (similar to dashboard stats)
        const invoicesByStatus = await this.analyticsService.getInvoicesByStatus(ctx.user.id);
        return { invoicesByStatus };
      }),

      topItems: trpc.protectedProcedure
        .input(
          z.object({
            limit: z.number().min(1).max(100).default(10),
          }),
        )
        .query(async ({ input, ctx }) => {
          return await this.analyticsService.getTopItems(ctx.user.id, input.limit, 0);
        }),

      topClients: trpc.protectedProcedure
        .input(
          z.object({
            limit: z.number().min(1).max(100).default(10),
          }),
        )
        .query(async ({ input, ctx }) => {
          return await this.analyticsService.getTopClients(ctx.user.id, input.limit, 0);
        }),
    });
  }
}

export function analyticsRouter(trpc: TrpcService, analyticsService: AnalyticsService) {
  const router = new AnalyticsRouter(analyticsService);
  return router.createRouter(trpc);
}
