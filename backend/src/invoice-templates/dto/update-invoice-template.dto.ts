import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import type { TemplateData } from '../entities/invoice-template.entity';

export class UpdateInvoiceTemplateDto {
  @ApiPropertyOptional({ example: 'Professional Template', description: 'Template name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'A professional invoice template', description: 'Template description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Template data including header, footer, styles, and sections' })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => Object)
  templateData?: TemplateData;

  @ApiPropertyOptional({ example: false, description: 'Set as default template' })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
