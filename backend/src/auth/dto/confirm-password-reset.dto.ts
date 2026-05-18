import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IsStrongPassword } from '../validators/password.validator';
import { Transform } from 'class-transformer';

export class ConfirmPasswordResetDto {
  @ApiProperty({ example: 'user@example.com', description: 'User email address' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @Transform(({ value }) => value?.toLowerCase()?.trim())
  email: string;

  @ApiProperty({ example: 'reset-token-12345', description: 'Password reset token' })
  @IsString()
  @MinLength(1, { message: 'Reset token is required' })
  token: string;

  @ApiProperty({ 
    example: 'NewPassword123!', 
    description: 'New password (8-128 characters with uppercase, lowercase, and number)' 
  })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @MaxLength(128, { message: 'Password must not exceed 128 characters' })
  @IsStrongPassword()
  password: string;
}

