import { IsString, IsNumber, IsOptional, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateStoreTransferDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000', description: 'UUID of the source store' })
  @IsString()
  fromStoreId: string;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174001', description: 'UUID of the destination store' })
  @IsString()
  toStoreId: string;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174002', description: 'UUID of the inventory item to transfer' })
  @IsString()
  inventoryItemId: string;

  @ApiProperty({ example: 50, description: 'Quantity to transfer', minimum: 1 })
  @IsNumber()
  @Min(1)
  quantity: number;

  @ApiPropertyOptional({ example: 'Transfer to main warehouse', description: 'Notes about the transfer' })
  @IsOptional()
  @IsString()
  note?: string;
}

