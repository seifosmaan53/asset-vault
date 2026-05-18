import { IsString, IsNumber, IsOptional, IsEnum, IsArray, ValidateNested, Min, Max, MaxLength, MinLength, ArrayMaxSize } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateInventoryItemDto {
  @ApiProperty({ example: 'SKU-001', description: 'Stock Keeping Unit identifier' })
  @IsString()
  @MinLength(1, { message: 'SKU is required' })
  @MaxLength(100, { message: 'SKU must not exceed 100 characters' })
  sku: string;

  @ApiProperty({ example: 'Product Name', description: 'Name of the inventory item' })
  @IsString()
  @MinLength(1, { message: 'Name is required' })
  @MaxLength(255, { message: 'Name must not exceed 255 characters' })
  name: string;

  @ApiPropertyOptional({ example: 'Product description', description: 'Detailed description of the item' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 'pcs', description: 'Unit of measurement (e.g., pcs, kg, m)' })
  @IsString()
  unit: string;

  @ApiPropertyOptional({ example: '1234567890123', description: 'Barcode number' })
  @IsOptional()
  @IsString()
  barcode?: string;

  @ApiPropertyOptional({ example: 10.50, description: 'Cost price per unit' })
  @IsOptional()
  @IsNumber()
  costPrice?: number;

  @ApiProperty({ example: 19.99, description: 'Default selling price per unit' })
  @IsNumber({}, { message: 'Default unit price must be a number' })
  @Min(0, { message: 'Default unit price must be non-negative' })
  @Max(999999.99, { message: 'Default unit price must not exceed 999999.99' })
  defaultUnitPrice: number;

  @ApiPropertyOptional({ example: 0.15, description: 'Default tax rate (e.g., 0.15 for 15%)' })
  @IsOptional()
  @IsNumber()
  defaultTaxRate?: number;

  @ApiProperty({ example: 100, description: 'Current stock quantity' })
  @IsNumber({}, { message: 'Current stock must be a number' })
  @Min(0, { message: 'Current stock must be non-negative' })
  currentStock: number;

  @ApiPropertyOptional({ example: 20, description: 'Reorder level threshold' })
  @IsOptional()
  @IsNumber()
  reorderLevel: number;

  @ApiPropertyOptional({ example: 500, description: 'Maximum stock level' })
  @IsOptional()
  @IsNumber()
  maxStockLevel?: number;

  @ApiProperty({ example: 'active', enum: ['active', 'inactive'], description: 'Item status' })
  @IsEnum(['active', 'inactive'])
  status: 'active' | 'inactive';

  // Bundle / Pack Information
  @IsOptional()
  @IsNumber()
  bundleSize?: number;

  @IsOptional()
  @IsString()
  bundleUnit?: string;

  // Space / Container Planning
  @IsOptional()
  @IsNumber()
  spacePerBundle?: number;

  @IsOptional()
  @IsNumber()
  bundlesPerContainer?: number;

  @IsOptional()
  @IsNumber()
  targetBundles?: number;

  // Pack Size
  @IsOptional()
  @IsNumber()
  packSize?: number;

  // Container Planning
  @IsOptional()
  @IsNumber()
  unitsPerContainer?: number;

  // Planning Fields
  @IsOptional()
  @IsNumber()
  weeksSupplyTargetOverride?: number;

  @IsOptional()
  @IsNumber()
  averageWeeklyUsage?: number;
}

export class UpdateInventoryItemDto {
  @ApiPropertyOptional({ example: 'SKU-001', description: 'Stock Keeping Unit identifier' })
  @IsOptional()
  @IsString()
  sku?: string;

  @ApiPropertyOptional({ example: 'Product Name', description: 'Name of the inventory item' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'Product description', description: 'Detailed description of the item' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'pcs', description: 'Unit of measurement (e.g., pcs, kg, m)' })
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiPropertyOptional({ example: '1234567890123', description: 'Barcode number' })
  @IsOptional()
  @IsString()
  barcode?: string;

  @ApiPropertyOptional({ example: 10.50, description: 'Cost price per unit' })
  @IsOptional()
  @IsNumber()
  costPrice?: number;

  @ApiPropertyOptional({ example: 19.99, description: 'Default selling price per unit' })
  @IsOptional()
  @IsNumber()
  defaultUnitPrice?: number;

  @ApiPropertyOptional({ example: 0.15, description: 'Default tax rate (e.g., 0.15 for 15%)' })
  @IsOptional()
  @IsNumber()
  defaultTaxRate?: number;

  @ApiPropertyOptional({ example: 100, description: 'Current stock quantity' })
  @IsOptional()
  @IsNumber()
  currentStock?: number;

  @ApiPropertyOptional({ example: 20, description: 'Reorder level threshold' })
  @IsOptional()
  @IsNumber()
  reorderLevel?: number;

  @ApiPropertyOptional({ example: 500, description: 'Maximum stock level' })
  @IsOptional()
  @IsNumber()
  maxStockLevel?: number;

  @ApiPropertyOptional({ example: 'active', enum: ['active', 'inactive'], description: 'Item status' })
  @IsOptional()
  @IsEnum(['active', 'inactive'])
  status?: 'active' | 'inactive';

  // Bundle / Pack Information
  @IsOptional()
  @IsNumber()
  bundleSize?: number;

  @IsOptional()
  @IsString()
  bundleUnit?: string;

  // Space / Container Planning
  @IsOptional()
  @IsNumber()
  spacePerBundle?: number;

  @IsOptional()
  @IsNumber()
  bundlesPerContainer?: number;

  @IsOptional()
  @IsNumber()
  targetBundles?: number;

  // Pack Size
  @IsOptional()
  @IsNumber()
  packSize?: number;

  // Container Planning
  @IsOptional()
  @IsNumber()
  unitsPerContainer?: number;

  // Planning Fields
  @IsOptional()
  @IsNumber()
  weeksSupplyTargetOverride?: number;

  @IsOptional()
  @IsNumber()
  averageWeeklyUsage?: number;
}

export class CreateStockMovementDto {
  @ApiProperty({ example: 'purchase', enum: ['purchase', 'sale', 'adjustment'], description: 'Type of stock movement' })
  @IsEnum(['purchase', 'sale', 'adjustment'])
  type: 'purchase' | 'sale' | 'adjustment';

  @ApiProperty({ example: 50, description: 'Quantity of items moved (positive for purchase, negative for sale)' })
  @IsNumber()
  quantity: number;

  @ApiProperty({ example: 'manual', enum: ['invoice', 'manual', 'import'], description: 'Source of the movement' })
  @IsEnum(['invoice', 'manual', 'import'])
  sourceType: 'invoice' | 'manual' | 'import';

  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174000', description: 'ID of the source (e.g., invoice ID)' })
  @IsOptional()
  @IsString()
  sourceId?: string;

  @ApiPropertyOptional({ example: 'Manual stock adjustment', description: 'Notes about the movement' })
  @IsOptional()
  @IsString()
  note?: string;
}

export class BulkCreateInventoryItemsDto {
  @ApiProperty({ 
    type: [CreateInventoryItemDto], 
    description: 'Array of inventory items to create in bulk',
    example: [
      { sku: 'SKU-001', name: 'Product 1', unit: 'pcs', defaultUnitPrice: 10.00, currentStock: 100, status: 'active' },
      { sku: 'SKU-002', name: 'Product 2', unit: 'pcs', defaultUnitPrice: 20.00, currentStock: 50, status: 'active' }
    ]
  })
  @IsArray({ message: 'Items must be an array' })
  @ArrayMaxSize(100, { message: 'Cannot create more than 100 items at once' })
  @ValidateNested({ each: true })
  @Type(() => CreateInventoryItemDto)
  items: CreateInventoryItemDto[];
}

export * from './bulk-delete.dto';

