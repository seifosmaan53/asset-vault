import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class OptionalRefreshTokenDto {
  @ApiPropertyOptional({ 
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...', 
    description: 'Optional refresh token for future revocation support (currently stateless JWTs)' 
  })
  @IsOptional()
  @IsString()
  refreshToken?: string;
}

