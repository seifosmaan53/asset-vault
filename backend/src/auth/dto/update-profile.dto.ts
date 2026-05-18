import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProfileDto {
  @ApiPropertyOptional({ 
    example: 'John Doe', 
    description: 'User full name',
    maxLength: 80,
  })
  @IsOptional()
  @IsString()
  @MaxLength(80, { message: 'Name must not exceed 80 characters' })
  name?: string;

  @ApiPropertyOptional({ 
    example: 'Acme Corp', 
    description: 'Company name',
    maxLength: 120,
  })
  @IsOptional()
  @IsString()
  @MaxLength(120, { message: 'Company name must not exceed 120 characters' })
  companyName?: string;

  @ApiPropertyOptional({ 
    example: '+1234567890', 
    description: 'Phone number',
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50, { message: 'Phone must not exceed 50 characters' })
  phone?: string;

  @ApiPropertyOptional({ 
    example: '123 Main St, City, State 12345', 
    description: 'Address',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Address must not exceed 500 characters' })
  address?: string;

  @ApiPropertyOptional({ 
    example: 'America/New_York', 
    description: 'Timezone',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'Timezone must not exceed 100 characters' })
  timezone?: string;

  @ApiPropertyOptional({ 
    example: 'Software developer with 10 years of experience', 
    description: 'Bio',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'Bio must not exceed 1000 characters' })
  bio?: string;
}

