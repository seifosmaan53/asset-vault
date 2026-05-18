import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEmail } from 'class-validator';

export class SendInvoiceEmailDto {
  @ApiPropertyOptional({ description: 'Custom email subject. If not provided, default subject will be used.' })
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiPropertyOptional({ description: 'Custom email message/body. If not provided, default template will be used.' })
  @IsOptional()
  @IsString()
  message?: string;

  @ApiPropertyOptional({ description: 'Recipient email address. If not provided, client email will be used.' })
  @IsOptional()
  @IsEmail()
  to?: string;

  @ApiPropertyOptional({ description: 'Include PDF attachment', default: true })
  @IsOptional()
  includePdf?: boolean;
}
