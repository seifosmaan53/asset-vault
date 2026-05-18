import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Delete,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { StoreItemSettingsService } from './store-item-settings.service';
import { CreateStoreItemSettingsDto, UpdateStoreItemSettingsDto, UpdateStockDto } from './dto/store-item-settings.dto';
// Organizations removed - OrganizationId decorator no longer needed
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

@ApiTags('store-item-settings')
@Controller('inventory/store-item-settings')
@UseGuards(ClerkAuthGuard)
@ApiBearerAuth('JWT-auth')
export class StoreItemSettingsController {
  constructor(private readonly storeItemSettingsService: StoreItemSettingsService) {}

  @Post()
  @ApiOperation({ summary: 'Create or update store item settings', description: 'Create or update settings for an item at a specific store' })
  @ApiResponse({ status: 201, description: 'Settings created/updated successfully' })
  @ApiResponse({ status: 404, description: 'Store or inventory item not found' })
  createOrUpdate(@Body() createDto: CreateStoreItemSettingsDto, @Request() req) {
    try {
      // Organizations removed - data is user-scoped
      const result = this.storeItemSettingsService.createOrUpdate(req.user.userId, createDto);
      return result;
    } catch (error: any) {
      throw error;
    }
  }

  @Get('store/:storeId')
  @ApiOperation({ summary: 'Get all items for a store', description: 'Retrieve all item settings for a specific store' })
  @ApiResponse({ status: 200, description: 'List of item settings for the store' })
  @ApiResponse({ status: 404, description: 'Store not found' })
  findByStore(
    @Param('storeId') storeId: string, 
    @Request() req,
  ) {
    // Organizations removed - data is user-scoped
    return this.storeItemSettingsService.findByStore(storeId, req.user.userId);
  }

  @Get('item/:itemId')
  @ApiOperation({ summary: 'Get all stores for an item', description: 'Retrieve all store settings for a specific inventory item' })
  @ApiResponse({ status: 200, description: 'List of store settings for the item' })
  @ApiResponse({ status: 404, description: 'Inventory item not found' })
  findByItem(
    @Param('itemId') itemId: string, 
    @Request() req,
  ) {
    // Organizations removed - data is user-scoped
    return this.storeItemSettingsService.findByItem(itemId, req.user.userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update store item settings', description: 'Update settings for a specific store-item combination' })
  @ApiResponse({ status: 200, description: 'Settings updated successfully' })
  @ApiResponse({ status: 404, description: 'Settings not found' })
  update(@Param('id') id: string, @Body() updateDto: UpdateStoreItemSettingsDto, @Request() req) {
    try {
      // Organizations removed - data is user-scoped
      const result = this.storeItemSettingsService.update(id, req.user.userId, updateDto);
      return result;
    } catch (error: any) {
      throw error;
    }
  }

  @Post(':id/stock')
  @ApiOperation({ summary: 'Update stock quantity', description: 'Update the current stock quantity for a store-item combination' })
  @ApiResponse({ status: 200, description: 'Stock updated successfully' })
  @ApiResponse({ status: 404, description: 'Store or inventory item not found' })
  updateStock(
    @Param('id') id: string,
    @Body() updateStockDto: UpdateStockDto,
    @Request() req,
  ) {
    try {
      // Organizations removed - data is user-scoped
      const result = this.storeItemSettingsService.update(id, req.user.userId, {
        currentStock: updateStockDto.quantity,
      });
      return result;
    } catch (error: any) {
      throw error;
    }
  }

  @Post('store/:storeId/item/:itemId/stock')
  @ApiOperation({ summary: 'Update stock quantity by store and item', description: 'Update the current stock quantity using store and item IDs' })
  @ApiResponse({ status: 200, description: 'Stock updated successfully' })
  @ApiResponse({ status: 404, description: 'Store or inventory item not found' })
  updateStockByStoreAndItem(
    @Param('storeId') storeId: string,
    @Param('itemId') itemId: string,
    @Body() updateStockDto: UpdateStockDto,
    @Request() req,
  ) {
    try {
      // Organizations removed - data is user-scoped
      const result = this.storeItemSettingsService.updateStock(
        storeId,
        itemId,
        updateStockDto.quantity,
        req.user.userId,
      );
      return result;
    } catch (error: any) {
      throw error;
    }
  }

  @Get('store/:storeId/report')
  @ApiOperation({ summary: 'Get store stock report', description: 'Generate a stock report for a specific store' })
  @ApiResponse({ status: 200, description: 'Stock report generated successfully' })
  @ApiResponse({ status: 404, description: 'Store not found' })
  getStoreStockReport(@Param('storeId') storeId: string, @Request() req) {
    // Organizations removed - data is user-scoped
    return this.storeItemSettingsService.getStoreStockReport(storeId, req.user.userId);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete store item settings', description: 'Delete settings for a specific store-item combination by ID. Admin/Owner only.' })
  @ApiResponse({ status: 204, description: 'Settings deleted successfully' })
  @ApiResponse({ status: 404, description: 'Settings not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin/Owner access required' })
  delete(@Param('id') id: string, @Request() req) {
    return this.storeItemSettingsService.delete(id, req.user.userId);
  }

  @Delete('store/:storeId/item/:itemId')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete store item settings by store and item', description: 'Delete settings for a specific store-item combination using store and item IDs. Admin/Owner only.' })
  @ApiResponse({ status: 204, description: 'Settings deleted successfully' })
  @ApiResponse({ status: 404, description: 'Store, item, or settings not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin/Owner access required' })
  deleteByStoreAndItem(
    @Param('storeId') storeId: string,
    @Param('itemId') itemId: string,
    @Request() req,
  ) {
    // Organizations removed - data is user-scoped
    return this.storeItemSettingsService.deleteByStoreAndItem(storeId, itemId, req.user.userId);
  }
}

