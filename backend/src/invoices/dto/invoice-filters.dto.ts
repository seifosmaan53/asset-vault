import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsDateString, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class InvoiceFiltersDto {
  @ApiPropertyOptional({ description: 'Filter by invoice status' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Filter by invoice type (invoice or estimate)' })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ description: 'Search by invoice number, client name, email, etc.' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by store ID' })
  @IsOptional()
  @IsString()
  storeId?: string;

  @ApiPropertyOptional({ description: 'Filter by issue date from (ISO date string)' })
  @IsOptional()
  @IsDateString()
  issueDateFrom?: string;

  @ApiPropertyOptional({ description: 'Filter by issue date to (ISO date string)' })
  @IsOptional()
  @IsDateString()
  issueDateTo?: string;

  @ApiPropertyOptional({ description: 'Filter by due date from (ISO date string)' })
  @IsOptional()
  @IsDateString()
  dueDateFrom?: string;

  @ApiPropertyOptional({ description: 'Filter by due date to (ISO date string)' })
  @IsOptional()
  @IsDateString()
  dueDateTo?: string;

  @ApiPropertyOptional({ description: 'Filter by paid date from (ISO date string)' })
  @IsOptional()
  @IsDateString()
  paidDateFrom?: string;

  @ApiPropertyOptional({ description: 'Filter by paid date to (ISO date string)' })
  @IsOptional()
  @IsDateString()
  paidDateTo?: string;

  @ApiPropertyOptional({ description: 'Filter by created date from (ISO date string)' })
  @IsOptional()
  @IsDateString()
  createdAtFrom?: string;

  @ApiPropertyOptional({ description: 'Filter by created date to (ISO date string)' })
  @IsOptional()
  @IsDateString()
  createdAtTo?: string;

  @ApiPropertyOptional({ description: 'Filter by minimum total amount' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  totalMin?: number;

  @ApiPropertyOptional({ description: 'Filter by maximum total amount' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  totalMax?: number;

  @ApiPropertyOptional({ description: 'Filter by minimum subtotal amount' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  subtotalMin?: number;

  @ApiPropertyOptional({ description: 'Filter by maximum subtotal amount' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  subtotalMax?: number;
}
