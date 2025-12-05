import { IsString, IsNumber, IsOptional, IsEnum, IsArray, IsBoolean, IsDateString } from 'class-validator';

export class RecurringInvoiceItemDto {
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

export class CreateRecurringInvoiceDto {
  @IsString()
  clientId: string;

  @IsString()
  name: string;

  @IsEnum(['daily', 'weekly', 'monthly', 'quarterly', 'yearly'])
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

  @IsNumber()
  interval: number;

  @IsDateString()
  startDate: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsDateString()
  nextRunDate: string;

  @IsString()
  currency: string;

  @IsArray()
  items: RecurringInvoiceItemDto[];

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateRecurringInvoiceDto {
  @IsOptional()
  @IsString()
  clientId?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(['daily', 'weekly', 'monthly', 'quarterly', 'yearly'])
  frequency?: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

  @IsOptional()
  @IsNumber()
  interval?: number;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsDateString()
  nextRunDate?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsArray()
  items?: RecurringInvoiceItemDto[];

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

