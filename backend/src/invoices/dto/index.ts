import { IsString, IsNumber, IsOptional, IsEnum, IsArray, ValidateNested, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export class InvoiceItemDto {
  @IsOptional()
  @IsString()
  inventoryItemId?: string;

  @IsString()
  description: string;

  @IsNumber()
  quantity: number;

  @IsNumber()
  unitPrice: number;

  @IsNumber()
  taxRate: number;

  @IsNumber()
  discountRate: number;
}

export class CreateInvoiceDto {
  @IsString()
  clientId: string;

  @IsEnum(['invoice', 'estimate'])
  type: 'invoice' | 'estimate';

  @IsDateString()
  issueDate: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsString()
  currency: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemDto)
  items: InvoiceItemDto[];
}

export class UpdateInvoiceDto {
  @IsOptional()
  @IsString()
  clientId?: string;

  @IsOptional()
  @IsEnum(['invoice', 'estimate'])
  type?: 'invoice' | 'estimate';

  @IsOptional()
  @IsDateString()
  issueDate?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsEnum(['draft', 'sent', 'paid', 'overdue', 'cancelled'])
  status?: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';

  @IsOptional()
  @IsDateString()
  paidAt?: string;

  @IsOptional()
  @IsString()
  paymentMethodNote?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemDto)
  items?: InvoiceItemDto[];
}

