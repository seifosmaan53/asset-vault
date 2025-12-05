import { IsString, IsNumber, IsOptional, IsEnum } from 'class-validator';

export class CreateInventoryItemDto {
  @IsString()
  sku: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsString()
  unit: string;

  @IsOptional()
  @IsString()
  barcode?: string;

  @IsOptional()
  @IsNumber()
  costPrice?: number;

  @IsNumber()
  defaultUnitPrice: number;

  @IsOptional()
  @IsNumber()
  defaultTaxRate?: number;

  @IsNumber()
  currentStock: number;

  @IsNumber()
  reorderLevel: number;

  @IsOptional()
  @IsNumber()
  maxStockLevel?: number;

  @IsEnum(['active', 'inactive'])
  status: 'active' | 'inactive';
}

export class UpdateInventoryItemDto {
  @IsOptional()
  @IsString()
  sku?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsString()
  barcode?: string;

  @IsOptional()
  @IsNumber()
  costPrice?: number;

  @IsOptional()
  @IsNumber()
  defaultUnitPrice?: number;

  @IsOptional()
  @IsNumber()
  defaultTaxRate?: number;

  @IsOptional()
  @IsNumber()
  currentStock?: number;

  @IsOptional()
  @IsNumber()
  reorderLevel?: number;

  @IsOptional()
  @IsNumber()
  maxStockLevel?: number;

  @IsOptional()
  @IsEnum(['active', 'inactive'])
  status?: 'active' | 'inactive';
}

export class CreateStockMovementDto {
  @IsEnum(['purchase', 'sale', 'adjustment'])
  type: 'purchase' | 'sale' | 'adjustment';

  @IsNumber()
  quantity: number;

  @IsEnum(['invoice', 'manual', 'import'])
  sourceType: 'invoice' | 'manual' | 'import';

  @IsOptional()
  @IsString()
  sourceId?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

