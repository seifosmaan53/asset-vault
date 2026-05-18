import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsUUID, ArrayMinSize } from 'class-validator';

export class BulkDeleteClientsDto {
  @ApiProperty({
    description: 'Array of client IDs to delete',
    type: [String],
    example: ['uuid1', 'uuid2', 'uuid3'],
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one client ID is required' })
  @IsUUID('4', { each: true, message: 'Each client ID must be a valid UUID' })
  @IsNotEmpty({ message: 'Client IDs array cannot be empty' })
  ids: string[];
}
