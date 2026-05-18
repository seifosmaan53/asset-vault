// Copyright (c) 2025 Asset Vault. All rights reserved.

import { z } from 'zod';
import { TrpcService } from '../trpc.service';
import { TRPCError } from '@trpc/server';
import { Injectable } from '@nestjs/common';
import { ClientsService } from '../../clients/clients.service';

@Injectable()
export class ClientsRouter {
  constructor(private readonly clientsService: ClientsService) {}

  createRouter(trpc: TrpcService) {
    return trpc.router({
      list: trpc.protectedProcedure.query(async ({ ctx }) => {
        return await this.clientsService.findAll(ctx.user.id);
      }),

      get: trpc.protectedProcedure
        .input(z.object({ id: z.string().uuid() }))
        .query(async ({ input, ctx }) => {
          try {
            return await this.clientsService.findOne(input.id, ctx.user.id);
          } catch (error: any) {
            if (error.status === 404) {
              throw new TRPCError({
                code: 'NOT_FOUND',
                message: 'Client not found',
              });
            }
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: error.message || 'Failed to fetch client',
            });
          }
        }),
    });
  }
}

export function clientsRouter(trpc: TrpcService, clientsService: ClientsService) {
  const router = new ClientsRouter(clientsService);
  return router.createRouter(trpc);
}
