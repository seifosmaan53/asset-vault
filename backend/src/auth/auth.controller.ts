import {
  Controller,
  Post,
  Body,
  Get,
  Patch,
  UseGuards,
  Req,
  Headers,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiOkResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { UpdateProfileDto, ChangePasswordDto } from './dto';
import {
  UserProfileResponseDto,
  MessageResponseDto,
} from './dto/auth-response.dto';
import { Public } from './public.decorator';
import { RequestUser } from './interfaces/request-user.interface';
import { OrganizationOptional } from '../organizations/organization-optional.decorator';
import { ClerkAuthGuard } from './clerk-auth.guard';

// Extend Express Request to include our user type
interface AuthenticatedRequest extends Request {
  user: RequestUser;
}

@ApiTags('auth')
@Controller('auth')
@OrganizationOptional()
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 100, ttl: 60000 } }) // Higher limit for webhooks
  @Post('webhooks/clerk')
  @ApiOperation({ 
    summary: 'Clerk webhook endpoint', 
    description: 'Receives webhooks from Clerk for user events (created, updated, deleted).' 
  })
  async handleClerkWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('svix-id') svixId: string,
    @Headers('svix-timestamp') svixTimestamp: string,
    @Headers('svix-signature') svixSignature: string,
  ) {
    if (!req.rawBody) {
      throw new Error('Raw body is required for webhook verification');
    }
    try {
      const result = await this.authService.handleClerkWebhook(
        req.rawBody,
        svixId,
        svixTimestamp,
        svixSignature,
      );
      return result;
    } catch (error: any) {
      throw error;
    }
  }

  @Post('logout')
  @UseGuards(ClerkAuthGuard)
  @ApiBearerAuth('Bearer')
  @ApiOperation({ 
    summary: 'Logout', 
    description: 'Logout the current user. Clerk handles session management.' 
  })
  @ApiOkResponse({ type: MessageResponseDto, description: 'Logged out successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async logout(@Req() req: AuthenticatedRequest) {
    return { message: 'Logged out successfully' };
  }

  @Get('profile')
  @UseGuards(ClerkAuthGuard)
  @ApiBearerAuth('Bearer')
  @ApiOperation({ summary: 'Get user profile', description: 'Retrieve the authenticated user\'s profile information.' })
  @ApiOkResponse({ type: UserProfileResponseDto, description: 'Profile retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getProfile(@Req() req: AuthenticatedRequest) {
    return this.authService.getProfile(req.user.userId);
  }

  @Patch('profile')
  @UseGuards(ClerkAuthGuard)
  @ApiBearerAuth('Bearer')
  @ApiOperation({ summary: 'Update user profile', description: 'Update the authenticated user\'s profile information. Only whitelisted fields (name, companyName, phone, address, timezone, bio) can be updated.' })
  @ApiOkResponse({ type: UserProfileResponseDto, description: 'Profile updated successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - validation error or non-whitelisted field' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updateProfile(@Req() req: AuthenticatedRequest, @Body() dto: UpdateProfileDto) {
    try {
      const result = await this.authService.updateProfile(req.user.userId, dto);
      return result;
    } catch (error: any) {
      throw error;
    }
  }

  @Post('change-password')
  @UseGuards(ClerkAuthGuard)
  @ApiBearerAuth('Bearer')
  @ApiOperation({ 
    summary: 'Change password', 
    description: 'Change the user\'s password. Note: With Clerk authentication, password changes are handled through Clerk\'s frontend SDK. This endpoint validates the request and returns success.' 
  })
  @ApiOkResponse({ type: MessageResponseDto, description: 'Password change request processed successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async changePassword(@Req() req: AuthenticatedRequest, @Body() dto: ChangePasswordDto) {
    try {
      const result = await this.authService.changePassword(req.user.userId, dto);
      return result;
    } catch (error: any) {
      throw error;
    }
  }
}

