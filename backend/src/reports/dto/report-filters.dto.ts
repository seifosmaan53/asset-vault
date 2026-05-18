import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsDateString, IsString, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

export enum ReportType {
  PROFIT_LOSS = 'profit_loss',
  SALES_TRENDS = 'sales_trends',
  CLIENT_SALES = 'client_sales',
  INVENTORY_VALUATION = 'inventory_valuation',
  INVOICE_AGING = 'invoice_aging',
  PAYMENT_COLLECTION = 'payment_collection',
}

export enum PeriodType {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  YEARLY = 'yearly',
  CUSTOM = 'custom',
}

export class ReportFiltersDto {
  @ApiPropertyOptional({ enum: ReportType, description: 'Type of report to generate' })
  @IsOptional()
  @IsEnum(ReportType)
  reportType?: ReportType;

  @ApiPropertyOptional({ enum: PeriodType, description: 'Time period grouping' })
  @IsOptional()
  @IsEnum(PeriodType)
  periodType?: PeriodType;

  @ApiPropertyOptional({ description: 'Start date (ISO date string)' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date (ISO date string)' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Filter by client ID' })
  @IsOptional()
  @IsString()
  clientId?: string;

  @ApiPropertyOptional({ description: 'Filter by store ID' })
  @IsOptional()
  @IsString()
  storeId?: string;

  @ApiPropertyOptional({ description: 'Include cancelled invoices', default: false })
  @IsOptional()
  @Type(() => Boolean)
  includeCancelled?: boolean;
}
