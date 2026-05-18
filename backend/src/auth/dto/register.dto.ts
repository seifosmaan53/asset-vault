import { IsEmail, IsString, MinLength, MaxLength, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsStrongPassword } from '../validators/password.validator';
import { Transform } from 'class-transformer';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com', description: 'User email address' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @Transform(({ value }) => value?.toLowerCase()?.trim())
  email: string;

  @ApiProperty({ 
    example: 'SecurePassword123!', 
    description: 'User password (8-128 characters with uppercase, lowercase, and number)' 
  })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @MaxLength(128, { message: 'Password must not exceed 128 characters' })
  @IsStrongPassword()
  password: string;

  @ApiProperty({ example: 'John Doe', description: 'User full name' })
  @IsString()
  @MinLength(1, { message: 'Name is required' })
  @MaxLength(255, { message: 'Name must not exceed 255 characters' })
  name: string;

  @ApiPropertyOptional({ example: 'Acme Corp', description: 'Company name' })
  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'Company name must not exceed 255 characters' })
  companyName?: string;

  @ApiPropertyOptional({ 
    example: 'create', 
    description: 'Organization action: "create" to create new organization (as admin), "join" to join existing organization, or omit for personal account',
    enum: ['create', 'join'],
  })
  @IsOptional()
  @IsString()
  organizationAction?: 'create' | 'join';

  @ApiPropertyOptional({ 
    example: 'My Company', 
    description: 'Organization name (required if organizationAction is "create")' 
  })
  @IsOptional()
  @IsString()
  organizationName?: string;

  @ApiPropertyOptional({ 
    example: 'org-uuid-here', 
    description: 'Organization ID to join (required if organizationAction is "join")' 
  })
  @IsOptional()
  @IsString()
  organizationId?: string;
}

