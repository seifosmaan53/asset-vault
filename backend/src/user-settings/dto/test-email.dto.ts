import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Body of POST /user-settings/test-email. The connection test uses exactly these values.
 *
 * Password rule: `smtpPassword` must be the real password for this test. Omitted, empty, or
 * equal to the placeholder that settings responses return for a stored password
 * (`***ENCRYPTED***`) is a 400 — whatever host and username are submitted. A stored SMTP password
 * is never reused for a test: the values in that column were written one-way (bcrypt) by an
 * earlier version and new ones are no longer stored at all, so a stored value can never
 * authenticate, and sending it would only hand a stored secret to whichever server was named.
 */
export class TestEmailConnectionDto {
  @ApiProperty({
    description: 'SMTP server host name',
    example: 'smtp.mailgun.org',
  })
  @IsString()
  @Length(1, 255, { message: 'SMTP host must be between 1 and 255 characters' })
  smtpHost: string;

  @ApiPropertyOptional({ description: 'SMTP port (default 587)', default: 587 })
  @IsOptional()
  @IsInt({ message: 'SMTP port must be an integer' })
  @Min(1, { message: 'SMTP port must be between 1 and 65535' })
  @Max(65535, { message: 'SMTP port must be between 1 and 65535' })
  smtpPort?: number;

  @ApiPropertyOptional({
    description: 'Implicit TLS. Defaults to true only for port 465.',
  })
  @IsOptional()
  @IsBoolean()
  smtpSecure?: boolean;

  @ApiProperty({ description: 'SMTP username' })
  @IsString()
  @Length(1, 255, { message: 'SMTP user must be between 1 and 255 characters' })
  smtpUser: string;

  @ApiPropertyOptional({
    description:
      'SMTP password for this test. Required in practice: omitted, empty or the stored-password placeholder ("***ENCRYPTED***") returns 400, because a stored password is never reused for a test.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'SMTP password must be at most 500 characters' })
  smtpPassword?: string;

  @ApiPropertyOptional({
    description: 'Accepted for compatibility; no email is sent by the test.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  emailFromAddress?: string;

  @ApiPropertyOptional({
    description: 'Accepted for compatibility; no email is sent by the test.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  emailFromName?: string;
}
