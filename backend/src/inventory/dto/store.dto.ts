import { IsString, IsOptional, IsBoolean, MinLength, IsEmail, MaxLength, Matches, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateStoreDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000', description: 'UUID of the client that owns this store' })
  @IsString()
  @IsUUID('4', { message: 'Client ID must be a valid UUID' })
  clientId: string;

  @ApiProperty({ example: 'Downtown Store', description: 'Store name', minLength: 1, maxLength: 100 })
  @IsString()
  @MinLength(1, { message: 'Store name is required' })
  @MaxLength(100, { message: 'Store name must be 100 characters or less' })
  name: string;

  @ApiProperty({ example: 'DT-001', description: 'Unique store code (letters, numbers, underscores, hyphens only)', minLength: 2, maxLength: 20 })
  @IsString()
  @MinLength(2, { message: 'Store code must be at least 2 characters' })
  @MaxLength(20, { message: 'Store code must be 20 characters or less' })
  @Matches(/^[A-Za-z0-9_-]+$/, {
    message: 'Store code can only contain letters, numbers, underscores, and hyphens',
  })
  code: string;

  @ApiPropertyOptional({ example: '123 Main St', description: 'Store address' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: '+201234567890', description: 'Store phone number in international format', pattern: '^\\+\\d{7,15}$' })
  @IsOptional()
  @IsString()
  @Matches(/^\+\d{7,15}$/, {
    message: 'Phone must be in international format like +201234567890',
  })
  phone?: string;

  @ApiPropertyOptional({ example: 'store@example.com', description: 'Store email address' })
  @IsOptional()
  @IsEmail({}, { message: 'Invalid email format' })
  email?: string;

  @ApiPropertyOptional({ example: 'New York', description: 'City' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ example: 'NY', description: 'State or province' })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional({ example: '10001', description: 'ZIP or postal code' })
  @IsOptional()
  @IsString()
  zip?: string;

  @ApiPropertyOptional({ example: 'USA', description: 'Country' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ example: 'Store notes', description: 'Additional notes about the store' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ example: true, description: 'Whether the store is active', default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateStoreDto {
  @IsOptional()
  @IsString()
  @IsUUID('4', { message: 'Client ID must be a valid UUID' })
  clientId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'Store name cannot be empty' })
  @MaxLength(100, { message: 'Store name must be 100 characters or less' })
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'Store code cannot be empty' })
  @MaxLength(20, { message: 'Store code must be 20 characters or less' })
  @Matches(/^[A-Za-z0-9_-]+$/, {
    message: 'Store code can only contain letters, numbers, underscores, and hyphens',
  })
  code?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+\d{7,15}$/, {
    message: 'Phone must be in international format like +201234567890',
  })
  phone?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Invalid email format' })
  email?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  zip?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

