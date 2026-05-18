import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsUUID, ArrayMinSize } from 'class-validator';

export class BulkDeleteInventoryDto {
  @ApiProperty({
    description: 'Array of inventory item IDs to delete',
    type: [String],
    example: ['uuid1', 'uuid2', 'uuid3'],
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one inventory item ID is required' })
  @IsUUID('4', { each: true, message: 'Each inventory item ID must be a valid UUID' })
  @IsNotEmpty({ message: 'Inventory item IDs array cannot be empty' })
  ids: string[];
}
