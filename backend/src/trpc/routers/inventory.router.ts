// Copyright (c) 2025 Asset Vault. All rights reserved.

import { z } from 'zod';
import { TrpcService } from '../trpc.service';
import { TRPCError } from '@trpc/server';
import { Injectable } from '@nestjs/common';
import { InventoryService } from '../../inventory/inventory.service';

@Injectable()
export class InventoryRouter {
  constructor(private readonly inventoryService: InventoryService) {}

  createRouter(trpc: TrpcService) {
    return trpc.router({
      list: trpc.protectedProcedure.query(async ({ ctx }) => {
        return await this.inventoryService.findAll(ctx.user.id);
      }),

      get: trpc.protectedProcedure
        .input(z.object({ id: z.string().uuid() }))
        .query(async ({ input, ctx }) => {
          try {
            return await this.inventoryService.findOne(input.id, ctx.user.id);
          } catch (error: any) {
            if (error.status === 404) {
              throw new TRPCError({
                code: 'NOT_FOUND',
                message: 'Inventory item not found',
              });
            }
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: error.message || 'Failed to fetch inventory item',
            });
          }
        }),
    });
  }
}

export function inventoryRouter(trpc: TrpcService, inventoryService: InventoryService) {
  const router = new InventoryRouter(inventoryService);
  return router.createRouter(trpc);
}
