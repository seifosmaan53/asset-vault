import { IsString, IsNumber, IsOptional, IsUUID, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateStoreItemSettingsDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000', description: 'UUID of the store' })
  @IsUUID()
  storeId: string;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174001', description: 'UUID of the inventory item' })
  @IsUUID()
  inventoryItemId: string;

  @ApiPropertyOptional({ example: 100, description: 'Current stock quantity for this item at this store', minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  currentStock?: number;

  @ApiPropertyOptional({ example: 10, description: 'Minimum quantity threshold for low stock alerts', minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minQty?: number;

  @ApiPropertyOptional({ example: 200, description: 'Target stock quantity for this item at this store', minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  targetQty?: number;

  @ApiPropertyOptional({ example: 25, description: 'Average weekly usage of this item at this store', minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  weeklyUsage?: number;
}

export class UpdateStoreItemSettingsDto {
  @ApiPropertyOptional({ example: 100, description: 'Current stock quantity for this item at this store', minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  currentStock?: number;

  @ApiPropertyOptional({ example: 10, description: 'Minimum quantity threshold for low stock alerts', minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minQty?: number;

  @ApiPropertyOptional({ example: 200, description: 'Target stock quantity for this item at this store', minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  targetQty?: number;

  @ApiPropertyOptional({ example: 25, description: 'Average weekly usage of this item at this store', minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  weeklyUsage?: number;
}

export class UpdateStockDto {
  @ApiProperty({ example: 150, description: 'New stock quantity', minimum: 0 })
  @IsNumber()
  @Min(0)
  quantity: number;
}

