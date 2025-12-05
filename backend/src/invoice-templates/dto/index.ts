import { IsString, IsOptional, IsBoolean, IsObject } from 'class-validator';

export class CreateInvoiceTemplateDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsObject()
  templateData: {
    header?: any;
    footer?: any;
    styles?: any;
    fields?: any;
  };

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateInvoiceTemplateDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsObject()
  templateData?: {
    header?: any;
    footer?: any;
    styles?: any;
    fields?: any;
  };

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

