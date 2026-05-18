import { ApiProperty } from '@nestjs/swagger';

export class LoginResponseDto {
  @ApiProperty({ 
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...', 
    description: 'JWT access token' 
  })
  accessToken: string;

  @ApiProperty({ 
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...', 
    description: 'JWT refresh token' 
  })
  refreshToken: string;

  @ApiProperty({ 
    description: 'User information',
    example: {
      id: 'uuid-here',
      email: 'user@example.com',
      name: 'John Doe',
      companyName: 'Acme Corp',
      role: 'admin',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    }
  })
  user: {
    id: string;
    email: string;
    name: string;
    companyName?: string;
    role: string;
    createdAt: string;
    updatedAt: string;
  };

  @ApiProperty({ 
    description: 'Organization information (if created/joined during registration)',
    required: false,
    example: {
      id: 'org-uuid-here',
      name: 'My Company',
      companyName: 'My Company Inc',
    }
  })
  organization?: {
    id: string;
    name: string;
    companyName?: string;
  };
}

export class RefreshTokenResponseDto {
  @ApiProperty({ 
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...', 
    description: 'New JWT access token' 
  })
  accessToken: string;
}

export class UserProfileResponseDto {
  @ApiProperty({ example: 'uuid-here' })
  id: string;

  @ApiProperty({ example: 'user@example.com' })
  email: string;

  @ApiProperty({ example: 'John Doe' })
  name: string;

  @ApiProperty({ example: 'Acme Corp', required: false })
  companyName?: string;

  @ApiProperty({ example: '+1234567890', required: false })
  phone?: string;

  @ApiProperty({ example: '123 Main St', required: false })
  address?: string;

  @ApiProperty({ example: 'America/New_York', required: false })
  timezone?: string;

  @ApiProperty({ example: 'Software developer', required: false })
  bio?: string;

  @ApiProperty({ example: 'admin', enum: ['owner', 'admin', 'staff'] })
  role: string;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  updatedAt: Date;
}

export class LogoutResponseDto {
  @ApiProperty({ example: 'Logged out successfully' })
  message: string;
}

export class MessageResponseDto {
  @ApiProperty({ example: 'Operation completed successfully' })
  message: string;
}

