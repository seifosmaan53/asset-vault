// Copyright (c) 2025 Asset Vault. All rights reserved.

import { ApiProperty } from '@nestjs/swagger';
import { Invoice } from '../entities/invoice.entity';

/**
 * Invoice Response DTO
 * Issue #36: Response Serialization with DTOs
 * Issue #62: Success messages and structured responses
 */
export class InvoiceResponseDto {
  @ApiProperty({ description: 'Invoice data', type: Invoice })
  data: Invoice;

  @ApiProperty({
    description: 'Success message',
    example: 'Invoice retrieved successfully',
    required: false,
  })
  message?: string;
}

export class InvoiceListResponseDto {
  @ApiProperty({ description: 'List of invoices', type: [Invoice] })
  data: Invoice[];

  @ApiProperty({
    description: 'Success message',
    example: 'Invoices retrieved successfully',
    required: false,
  })
  message?: string;
}

export class CreateInvoiceResponseDto {
  @ApiProperty({ description: 'Created invoice', type: Invoice })
  data: Invoice;

  @ApiProperty({
    description: 'Success message',
    example: 'Invoice created successfully',
  })
  message: string;
}

export class UpdateInvoiceResponseDto {
  @ApiProperty({ description: 'Updated invoice', type: Invoice })
  data: Invoice;

  @ApiProperty({
    description: 'Success message',
    example: 'Invoice updated successfully',
  })
  message: string;
}

export class DeleteInvoiceResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Invoice deleted successfully',
  })
  message: string;
}

