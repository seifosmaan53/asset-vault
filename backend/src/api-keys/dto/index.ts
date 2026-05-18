import { IsString, IsOptional, IsArray, IsBoolean, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateApiKeyDto {
  @ApiProperty({ example: 'My API Key', description: 'API key name' })
  @IsString()
  name: string;

  @ApiProperty({ example: ['read:invoices', 'write:invoices'], description: 'List of permissions', type: [String] })
  @IsArray()
  @IsString({ each: true })
  permissions: string[];

  @ApiPropertyOptional({ example: '2024-12-31T23:59:59Z', description: 'Expiration date (ISO date string)' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional({ example: true, description: 'Whether the API key is active', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateApiKeyDto {
  @ApiPropertyOptional({ example: 'Updated API Key Name', description: 'API key name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: ['read:invoices'], description: 'List of permissions', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];

  @ApiPropertyOptional({ example: '2024-12-31T23:59:59Z', description: 'Expiration date (ISO date string)' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional({ example: false, description: 'Whether the API key is active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

