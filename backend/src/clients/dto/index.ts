import { IsString, IsOptional, IsEmail, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export * from './bulk-delete.dto';

export class CreateClientDto {
  @ApiProperty({ example: 'Acme Corporation', description: 'Client name', maxLength: 255 })
  @IsString()
  @MaxLength(255, { message: 'Name must not exceed 255 characters' })
  name: string;

  @ApiPropertyOptional({ example: 'contact@acme.com', description: 'Client email address', maxLength: 255 })
  @IsOptional()
  @IsEmail()
  @MaxLength(255, { message: 'Email must not exceed 255 characters' })
  email?: string;

  @ApiPropertyOptional({ example: '+201234567890', description: 'Client phone number', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50, { message: 'Phone must not exceed 50 characters' })
  phone?: string;

  @ApiPropertyOptional({ 
    example: { street: '123 Main St', city: 'New York', state: 'NY', zip: '10001', country: 'USA' },
    description: 'Client address object'
  })
  @IsOptional()
  addressJson?: {
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };

  @IsOptional()
  @IsString()
  @MaxLength(5000, { message: 'Notes must not exceed 5000 characters' })
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048, { message: 'Avatar URL must not exceed 2048 characters' })
  avatarUrl?: string;
}

export class UpdateClientDto {
  @ApiPropertyOptional({ example: 'Acme Corporation', description: 'Client name', maxLength: 255 })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'contact@acme.com', description: 'Client email address', maxLength: 255 })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '+201234567890', description: 'Client phone number', maxLength: 50 })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ 
    example: { street: '123 Main St', city: 'New York', state: 'NY', zip: '10001', country: 'USA' },
    description: 'Client address object'
  })
  @IsOptional()
  addressJson?: {
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };

  @ApiPropertyOptional({ example: 'Client notes', description: 'Additional notes about the client', maxLength: 5000 })
  @IsOptional()
  @IsString()
  @MaxLength(5000, { message: 'Notes must not exceed 5000 characters' })
  notes?: string;

  @ApiPropertyOptional({ example: 'https://example.com/avatar.jpg', description: 'Client avatar URL', maxLength: 2048 })
  @IsOptional()
  @IsString()
  @MaxLength(2048, { message: 'Avatar URL must not exceed 2048 characters' })
  avatarUrl?: string;
}

