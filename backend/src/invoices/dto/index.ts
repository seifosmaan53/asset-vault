import { IsString, IsNumber, IsOptional, IsEnum, IsArray, ValidateNested, IsDateString, MaxLength, Min, Max, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class InvoiceItemDto {
  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174000', description: 'Inventory item UUID', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  inventoryItemId?: string;

  @ApiProperty({ example: 'Product description', description: 'Item description', maxLength: 1000 })
  @IsString()
  @MaxLength(1000, { message: 'Description must not exceed 1000 characters' })
  description: string;

  @ApiProperty({ example: 5, description: 'Quantity of items', minimum: 0 })
  @IsNumber()
  @Min(0, { message: 'Quantity must be greater than or equal to 0' })
  quantity: number;

  @ApiProperty({ example: 19.99, description: 'Unit price', minimum: 0 })
  @IsNumber()
  @Min(0, { message: 'Unit price must be greater than or equal to 0' })
  unitPrice: number;

  @ApiProperty({ example: 15, description: 'Tax rate percentage (0-100)', minimum: 0, maximum: 100 })
  @IsNumber()
  @Min(0, { message: 'Tax rate cannot be negative' })
  @Max(100, { message: 'Tax rate cannot exceed 100%' })
  taxRate: number;

  @ApiProperty({ example: 10, description: 'Discount rate percentage (0-100)', minimum: 0, maximum: 100 })
  @IsNumber()
  @Min(0, { message: 'Discount rate cannot be negative' })
  @Max(100, { message: 'Discount rate cannot exceed 100%' })
  discountRate: number;

  // Line total (optional, calculated by backend - included to prevent validation errors)
  @ApiPropertyOptional({ example: 100.00, description: 'Line total (calculated by backend)' })
  @IsOptional()
  @IsNumber()
  lineTotal?: number;
}

export class CreateInvoiceDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000', description: 'Client UUID' })
  @IsString()
  clientId: string;

  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174001', description: 'Store UUID (optional)' })
  @IsOptional()
  @IsString()
  storeId?: string;

  @ApiProperty({ example: 'invoice', enum: ['invoice', 'estimate'], description: 'Invoice type' })
  @IsEnum(['invoice', 'estimate'])
  type: 'invoice' | 'estimate';

  @ApiProperty({ example: '2024-01-15', description: 'Invoice issue date (ISO date string)' })
  @IsDateString()
  issueDate: string;

  @ApiPropertyOptional({ example: '2024-02-15', description: 'Invoice due date (ISO date string)' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiProperty({ example: 'USD', description: 'Currency code (e.g., USD, EUR)' })
  @IsString()
  currency: string;

  @ApiPropertyOptional({ example: 'Payment terms: Net 30', description: 'Additional notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ description: 'Invoice line items', type: [InvoiceItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemDto)
  items: InvoiceItemDto[];
}

export class UpdateInvoiceDto {
  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174000', description: 'Client UUID' })
  @IsOptional()
  @IsString()
  clientId?: string;

  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174001', description: 'Store UUID' })
  @IsOptional()
  @IsString()
  storeId?: string;

  @ApiPropertyOptional({ example: 'INV-2024-0001', description: 'Invoice number (auto-generated if not provided)' })
  @IsOptional()
  @IsString()
  number?: string;

  @ApiPropertyOptional({ example: 'invoice', enum: ['invoice', 'estimate'], description: 'Invoice type' })
  @IsOptional()
  @IsEnum(['invoice', 'estimate'])
  type?: 'invoice' | 'estimate';

  @ApiPropertyOptional({ example: '2024-01-15', description: 'Invoice issue date (ISO date string)' })
  @IsOptional()
  @IsDateString({}, { message: 'Issue date must be a valid date string in ISO format (YYYY-MM-DD)' })
  issueDate?: string;

  @ApiPropertyOptional({ example: '2024-02-15', description: 'Invoice due date (ISO date string)' })
  @IsOptional()
  @IsDateString({}, { message: 'Due date must be a valid date string in ISO format (YYYY-MM-DD)' })
  dueDate?: string;

  @ApiPropertyOptional({ example: 'USD', description: 'Currency code (e.g., USD, EUR)' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ example: 'Payment terms: Net 30', description: 'Additional notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ example: 'paid', enum: ['draft', 'sent', 'paid', 'overdue', 'cancelled'], description: 'Invoice status' })
  @IsOptional()
  @IsEnum(['draft', 'sent', 'paid', 'overdue', 'cancelled'])
  status?: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';

  @ApiPropertyOptional({ example: '2024-01-20T10:00:00Z', description: 'Payment date (ISO date string)' })
  @IsOptional()
  @IsDateString()
  paidAt?: string;

  @ApiPropertyOptional({ example: 'Paid via bank transfer', description: 'Payment method notes' })
  @IsOptional()
  @IsString()
  paymentMethodNote?: string;

  @ApiPropertyOptional({ description: 'Invoice line items', type: [InvoiceItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemDto)
  items?: InvoiceItemDto[];
}

