// Copyright (c) 2025 Asset Vault. All rights reserved.

import { ApiProperty } from '@nestjs/swagger';

/**
 * Invoice Statistics Response DTO
 * Issue #36: Response Serialization with DTOs
 * Issue #62: Success messages and structured responses
 * Updated to match frontend expected format
 */
export class InvoiceStatsResponseDto {
  @ApiProperty({ description: 'Total number of invoices', example: 150 })
  totalCount: number;

  @ApiProperty({ description: 'Number of unpaid invoices (sent status)', example: 25 })
  unpaidCount: number;

  @ApiProperty({ description: 'Total amount of unpaid invoices', example: 15000.00 })
  unpaidAmount: number;

  @ApiProperty({ description: 'Number of overdue invoices', example: 10 })
  overdueCount: number;

  @ApiProperty({ description: 'Total amount of overdue invoices', example: 5000.00 })
  overdueAmount: number;

  @ApiProperty({ description: 'Total revenue from paid invoices in current month', example: 12000.00 })
  monthlyTotal: number;

  @ApiProperty({ description: 'Total revenue from all invoices', example: 70000.00 })
  totalAmount: number;

  @ApiProperty({
    description: 'Success message',
    example: 'Invoice statistics retrieved successfully',
    required: false,
  })
  message?: string;
}

