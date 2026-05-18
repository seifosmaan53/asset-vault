import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { StoreService } from './store.service';
import { StoreTransferService } from './store-transfer.service';
import { CreateStoreDto, UpdateStoreDto } from './dto/store.dto';
import { CreateStoreTransferDto } from './dto/store-transfer.dto';
// Organizations removed - OrganizationId decorator no longer needed
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

@ApiTags('stores')
@Controller('inventory/stores')
@UseGuards(ClerkAuthGuard)
@ApiBearerAuth('JWT-auth')
export class StoreController {
  constructor(
    private readonly storeService: StoreService,
    private readonly storeTransferService: StoreTransferService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new store', description: 'Create a new store/location for the authenticated user' })
  @ApiResponse({ status: 201, description: 'Store created successfully' })
  @ApiResponse({ status: 409, description: 'Store with this code already exists' })
  create(@Body() createStoreDto: CreateStoreDto, @Request() req) {
    try {
      // Organizations removed - data is user-scoped
      const result = this.storeService.create(req.user.userId, createStoreDto);
      return result;
    } catch (error: any) {
      throw error;
    }
  }

  @Get()
  @ApiOperation({ summary: 'Get all stores', description: 'Retrieve all stores for the authenticated user' })
  @ApiQuery({ name: 'activeOnly', required: false, type: Boolean, description: 'Filter to show only active stores' })
  @ApiResponse({ status: 200, description: 'List of stores' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findAll(@Request() req, @Query('activeOnly') activeOnly?: string) {
    // Organizations removed - data is user-scoped
    const activeOnlyBool = activeOnly === 'true';
    return this.storeService.findAll(req.user.userId, activeOnlyBool);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a store', description: 'Retrieve a specific store by ID' })
  @ApiParam({ name: 'id', description: 'Store UUID' })
  @ApiResponse({ status: 200, description: 'Store details' })
  @ApiResponse({ status: 404, description: 'Store not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findOne(@Param('id') id: string, @Request() req) {
    // Organizations removed - data is user-scoped
    return this.storeService.findOne(id, req.user.userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a store', description: 'Update store information' })
  @ApiParam({ name: 'id', description: 'Store UUID' })
  @ApiResponse({ status: 200, description: 'Store updated successfully' })
  @ApiResponse({ status: 404, description: 'Store not found' })
  @ApiResponse({ status: 409, description: 'Store with this code already exists' })
  @ApiResponse({ status: 400, description: 'Bad request - validation failed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  update(@Param('id') id: string, @Body() updateStoreDto: UpdateStoreDto, @Request() req) {
    try {
      // Organizations removed - data is user-scoped
      const result = this.storeService.update(id, req.user.userId, updateStoreDto);
      return result;
    } catch (error: any) {
      throw error;
    }
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  @ApiOperation({ summary: 'Delete a store', description: 'Soft delete a store. Admin/Owner only.' })
  @ApiParam({ name: 'id', description: 'Store UUID' })
  @ApiResponse({ status: 200, description: 'Store deleted successfully' })
  @ApiResponse({ status: 404, description: 'Store not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin/Owner access required' })
  remove(@Param('id') id: string, @Request() req) {
    // Organizations removed - data is user-scoped
    return this.storeService.remove(id, req.user.userId);
  }

  @Post('transfer')
  @ApiOperation({
    summary: 'Transfer stock between stores',
    description: 'Transfer inventory items from one store to another. Creates two stock movements atomically.',
  })
  @ApiResponse({ status: 201, description: 'Stock transferred successfully' })
  @ApiResponse({ status: 400, description: 'Invalid transfer data or insufficient stock' })
  @ApiResponse({ status: 404, description: 'Store or inventory item not found' })
  async transferStock(@Body() transferDto: CreateStoreTransferDto, @Request() req) {
    try {
      // Organizations removed - data is user-scoped
      const result = await this.storeTransferService.transferStock(req.user.userId, transferDto);
      return result;
    } catch (error: any) {
      throw error;
    }
  }
}

