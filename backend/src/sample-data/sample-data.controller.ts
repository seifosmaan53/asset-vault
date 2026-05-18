// Copyright (c) 2025 Asset Vault. All rights reserved.

import { Controller, Post, Delete, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { SampleDataService } from './sample-data.service';
import { RequestUser } from '../auth/interfaces/request-user.interface';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

interface AuthenticatedRequest extends Request {
  user: RequestUser;
}

@ApiTags('sample-data')
@Controller('sample-data')
@UseGuards(ClerkAuthGuard)
@ApiBearerAuth('Bearer')
export class SampleDataController {
  constructor(private readonly sampleDataService: SampleDataService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.OWNER) // FIX Issue #44: Only ADMIN/OWNER can add sample data
  @ApiOperation({
    summary: 'Add sample data for current user',
    description: 'Adds sample clients, inventory items, and invoices to the authenticated user\'s account',
  })
  @ApiResponse({
    status: 201,
    description: 'Sample data added successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Sample data added successfully' },
        data: {
          type: 'object',
          properties: {
            clients: { type: 'number', example: 50 },
            stores: { type: 'number', example: 100 },
            inventory: { type: 'number', example: 300 },
            invoices: { type: 'number', example: 200 },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin/Owner role required' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async addSampleData(@Request() req: AuthenticatedRequest) {
    try {
      const result = await this.sampleDataService.addSampleData(req.user.userId);
      return {
        message: 'Sample data added successfully',
        data: result,
      };
    } catch (error: any) {
      throw error;
    }
  }

  @Delete()
  @Roles(UserRole.ADMIN, UserRole.OWNER) // FIX Issue #44: Only ADMIN/OWNER can delete sample data
  @ApiOperation({
    summary: 'Delete sample data for current user',
    description: 'Deletes sample clients, stores, inventory items, and invoices that were created by the sample data feature',
  })
  @ApiResponse({
    status: 200,
    description: 'Sample data deleted successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Sample data deleted successfully' },
        data: {
          type: 'object',
          properties: {
            deleted: {
              type: 'object',
              properties: {
                clients: { type: 'number', example: 50 },
                stores: { type: 'number', example: 100 },
                inventory: { type: 'number', example: 300 },
                invoices: { type: 'number', example: 200 },
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin/Owner role required' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async deleteSampleData(@Request() req: AuthenticatedRequest) {
    const result = await this.sampleDataService.deleteSampleData(req.user.userId);
    return {
      message: 'Sample data deleted successfully',
      data: result,
    };
  }
}

