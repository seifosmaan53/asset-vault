import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsDateString } from 'class-validator';

export class ClientFiltersDto {
  @ApiPropertyOptional({ description: 'Search by client name, email, phone, etc.' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by created date from (ISO date string)' })
  @IsOptional()
  @IsDateString()
  createdAtFrom?: string;

  @ApiPropertyOptional({ description: 'Filter by created date to (ISO date string)' })
  @IsOptional()
  @IsDateString()
  createdAtTo?: string;

  @ApiPropertyOptional({ description: 'Filter by updated date from (ISO date string)' })
  @IsOptional()
  @IsDateString()
  updatedAtFrom?: string;

  @ApiPropertyOptional({ description: 'Filter by updated date to (ISO date string)' })
  @IsOptional()
  @IsDateString()
  updatedAtTo?: string;
}
