// Copyright (c) 2025 Asset Vault. All rights reserved.

import { z } from 'zod';
import { TrpcService } from '../trpc.service';
import { TRPCError } from '@trpc/server';
import { Injectable } from '@nestjs/common';
import { InvoicesService } from '../../invoices/invoices.service';

// Zod schemas matching DTOs
const InvoiceItemSchema = z.object({
  inventoryItemId: z.string().uuid().optional(),
  description: z.string().max(1000),
  quantity: z.number().min(0),
  unitPrice: z.number().min(0),
  taxRate: z.number().min(0).max(100),
  discountRate: z.number().min(0).max(100),
  lineTotal: z.number().optional(),
});

const CreateInvoiceSchema = z.object({
  clientId: z.string().uuid(),
  storeId: z.string().uuid().optional(),
  type: z.enum(['invoice', 'estimate']),
  issueDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  dueDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  currency: z.string(),
  notes: z.string().optional(),
  items: z.array(InvoiceItemSchema).min(1),
});

const UpdateInvoiceSchema = z.object({
  clientId: z.string().uuid().optional(),
  storeId: z.string().uuid().optional(),
  number: z.string().optional(),
  type: z.enum(['invoice', 'estimate']).optional(),
  issueDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  dueDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  currency: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(['draft', 'sent', 'paid', 'overdue', 'cancelled']).optional(),
  paidAt: z.string().datetime().optional(),
  paymentMethodNote: z.string().optional(),
  items: z.array(InvoiceItemSchema).optional(),
});

/**
 * tRPC Router for Invoices
 * Provides type-safe invoice operations
 */
@Injectable()
export class InvoicesRouter {
  constructor(private readonly invoicesService: InvoicesService) {}

  createRouter(trpc: TrpcService) {
    return trpc.router({
      // Get all invoices (with filters)
      list: trpc.protectedProcedure
        .input(
          z.object({
            status: z.string().optional(),
            type: z.string().optional(),
            search: z.string().optional(),
            storeId: z.string().uuid().optional(),
          }),
        )
        .query(async ({ input, ctx }) => {
          return await this.invoicesService.findAll(ctx.user.id, input);
        }),

      // Get paged invoices
      paged: trpc.protectedProcedure
        .input(
          z.object({
            page: z.number().min(1).default(1),
            limit: z.number().min(1).max(200).default(20),
            status: z.string().optional(),
            type: z.string().optional(),
            search: z.string().optional(),
            storeId: z.string().uuid().optional(),
          }),
        )
        .query(async ({ input, ctx }) => {
          return await this.invoicesService.findPaged(ctx.user.id, input);
        }),

      // Get single invoice
      get: trpc.protectedProcedure
        .input(z.object({ id: z.string().uuid() }))
        .query(async ({ input, ctx }) => {
          try {
            return await this.invoicesService.findOne(input.id, ctx.user.id);
          } catch (error: any) {
            if (error.status === 404) {
              throw new TRPCError({
                code: 'NOT_FOUND',
                message: 'Invoice not found',
              });
            }
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: error.message || 'Failed to fetch invoice',
            });
          }
        }),

      // Create invoice
      create: trpc.protectedProcedure
        .input(CreateInvoiceSchema)
        .mutation(async ({ input, ctx }) => {
          try {
            return await this.invoicesService.create(ctx.user.id, input);
          } catch (error: any) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: error.message || 'Failed to create invoice',
            });
          }
        }),

      // Update invoice
      update: trpc.protectedProcedure
        .input(
          z.object({
            id: z.string().uuid(),
            data: UpdateInvoiceSchema,
          }),
        )
        .mutation(async ({ input, ctx }) => {
          try {
            return await this.invoicesService.update(input.id, ctx.user.id, input.data);
          } catch (error: any) {
            if (error.status === 404) {
              throw new TRPCError({
                code: 'NOT_FOUND',
                message: 'Invoice not found',
              });
            }
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: error.message || 'Failed to update invoice',
            });
          }
        }),

      // Delete invoice
      delete: trpc.protectedProcedure
        .input(z.object({ id: z.string().uuid() }))
        .mutation(async ({ input, ctx }) => {
          try {
            await this.invoicesService.remove(input.id, ctx.user.id);
            return { success: true };
          } catch (error: any) {
            if (error.status === 404) {
              throw new TRPCError({
                code: 'NOT_FOUND',
                message: 'Invoice not found',
              });
            }
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: error.message || 'Failed to delete invoice',
            });
          }
        }),

      // Get invoice stats
      stats: trpc.protectedProcedure.query(async ({ ctx }) => {
        return await this.invoicesService.getStats(ctx.user.id);
      }),

      // Duplicate invoice
      duplicate: trpc.protectedProcedure
        .input(z.object({ id: z.string().uuid() }))
        .mutation(async ({ input, ctx }) => {
          try {
            return await this.invoicesService.duplicateInvoice(input.id, ctx.user.id);
          } catch (error: any) {
            if (error.status === 404) {
              throw new TRPCError({
                code: 'NOT_FOUND',
                message: 'Invoice not found',
              });
            }
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: error.message || 'Failed to duplicate invoice',
            });
          }
        }),
    });
  }
}

// Export function for backward compatibility
export function invoicesRouter(trpc: TrpcService, invoicesService: InvoicesService) {
  const router = new InvoicesRouter(invoicesService);
  return router.createRouter(trpc);
}
