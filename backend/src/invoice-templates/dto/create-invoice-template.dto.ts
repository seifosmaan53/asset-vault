import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import type { TemplateData } from '../entities/invoice-template.entity';

export class CreateInvoiceTemplateDto {
  @ApiProperty({ example: 'Professional Template', description: 'Template name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'A professional invoice template', description: 'Template description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Template data including header, footer, styles, and sections' })
  @IsObject()
  @ValidateNested()
  @Type(() => Object)
  templateData: TemplateData;

  @ApiPropertyOptional({ example: false, description: 'Set as default template' })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
