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
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { InventoryService } from './inventory.service';
import { CreateInventoryItemDto, UpdateInventoryItemDto, CreateStockMovementDto, BulkCreateInventoryItemsDto, BulkDeleteInventoryDto } from './dto';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { OrganizationsService } from '../organizations/organizations.service';
// Organizations removed - OrganizationId decorator no longer needed

@ApiTags('inventory')
@ApiBearerAuth('JWT-auth')
@Controller('inventory')
@UseGuards(ClerkAuthGuard)
export class InventoryController {
  constructor(
    private readonly inventoryService: InventoryService,
    private readonly organizationsService: OrganizationsService,
  ) {}

  @Get('items')
  @ApiOperation({ summary: 'Get all inventory items', description: 'Retrieve all inventory items with optional filtering' })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Search by item name, SKU, or description' })
  @ApiQuery({ name: 'category', required: false, type: String, description: 'Filter by category' })
  @ApiQuery({ name: 'status', required: false, enum: ['active', 'inactive'], description: 'Filter by status' })
  @ApiQuery({ name: 'lowStockOnly', required: false, type: Boolean, description: 'Show only items with low stock' })
  @ApiResponse({ status: 200, description: 'List of inventory items retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findAll(@Request() req, @Query() filters: any) {
    // Organizations removed - data is user-scoped
    // Parse boolean query parameters correctly
    const parsedFilters: any = {};
    
    // Only include search if provided
    if (filters.search) {
      parsedFilters.search = filters.search;
    }
    
    // Only include category if provided
    if (filters.category) {
      parsedFilters.category = filters.category;
    }
    
    // Only include status if it's a valid status value ('active' or 'inactive')
    // If status is 'all', undefined, or invalid, don't include it (will show all items)
    if (filters.status === 'active' || filters.status === 'inactive') {
      parsedFilters.status = filters.status;
    }
    
    // Handle lowStockOnly - only set to true if explicitly true
    if (filters.lowStockOnly === 'true' || filters.lowStockOnly === true) {
      parsedFilters.lowStockOnly = true;
    }
    
    return this.inventoryService.findAll(req.user.userId, parsedFilters);
  }

  @Get('items/:id')
  @ApiOperation({ summary: 'Get inventory item by ID', description: 'Retrieve a specific inventory item by its ID' })
  @ApiParam({ name: 'id', description: 'Inventory item UUID' })
  @ApiResponse({ status: 200, description: 'Inventory item retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Inventory item not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findOne(@Param('id') id: string, @Request() req) {
    // Organizations removed - data is user-scoped
    return this.inventoryService.findOne(id, req.user.userId);
  }

  @Post('items')
  @ApiOperation({ summary: 'Create new inventory item', description: 'Create a new inventory item' })
  @ApiResponse({ status: 201, description: 'Inventory item created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - validation failed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async create(@Body() createDto: CreateInventoryItemDto, @Request() req) {
    try {
      // Organizations removed - data is user-scoped
      const result = await this.inventoryService.create(req.user.userId, createDto);
      return result;
    } catch (error: any) {
      throw error;
    }
  }

  @Post('items/bulk')
  @ApiOperation({ summary: 'Create multiple inventory items', description: 'Create multiple inventory items in a single transaction. Returns successful items and errors for failed items.' })
  @ApiResponse({ status: 201, description: 'Bulk creation completed. Check response for success and error details.' })
  @ApiResponse({ status: 400, description: 'Bad request - validation failed or all items failed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async bulkCreate(@Body() bulkDto: BulkCreateInventoryItemsDto, @Request() req) {
    try {
      // Organizations removed - data is user-scoped
      const result = await this.inventoryService.bulkCreate(req.user.userId, bulkDto.items);
      return result;
    } catch (error: any) {
      throw error;
    }
  }

  @Patch('items/:id')
  @ApiOperation({ summary: 'Update inventory item', description: 'Update an existing inventory item' })
  @ApiParam({ name: 'id', description: 'Inventory item UUID' })
  @ApiResponse({ status: 200, description: 'Inventory item updated successfully' })
  @ApiResponse({ status: 404, description: 'Inventory item not found' })
  @ApiResponse({ status: 400, description: 'Bad request - validation failed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async update(@Param('id') id: string, @Body() updateDto: UpdateInventoryItemDto, @Request() req) {
    try {
      // Organizations removed - data is user-scoped
      const result = await this.inventoryService.update(id, req.user.userId, updateDto);
      return result;
    } catch (error: any) {
      throw error;
    }
  }

  @Delete('items/:id')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  @ApiOperation({ summary: 'Delete inventory item', description: 'Delete an inventory item (Admin/Owner only)' })
  @ApiParam({ name: 'id', description: 'Inventory item UUID' })
  @ApiResponse({ status: 200, description: 'Inventory item deleted successfully' })
  @ApiResponse({ status: 404, description: 'Inventory item not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async remove(@Param('id') id: string, @Request() req) {
    // Organizations removed - data is user-scoped
    return this.inventoryService.remove(id, req.user.userId);
  }

  @Get('items/:id/movements')
  @ApiOperation({ summary: 'Get stock movements for item', description: 'Retrieve all stock movements for a specific inventory item' })
  @ApiParam({ name: 'id', description: 'Inventory item UUID' })
  @ApiResponse({ status: 200, description: 'Stock movements retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Inventory item not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getMovements(@Param('id') id: string, @Request() req) {
    // Organizations removed - data is user-scoped
    return this.inventoryService.getMovements(id, req.user.userId);
  }

  @Post('items/:id/movements')
  @ApiOperation({ summary: 'Create stock movement', description: 'Create a new stock movement (purchase, sale, or adjustment) for an item' })
  @ApiParam({ name: 'id', description: 'Inventory item UUID' })
  @ApiResponse({ status: 201, description: 'Stock movement created successfully' })
  @ApiResponse({ status: 404, description: 'Inventory item not found' })
  @ApiResponse({ status: 400, description: 'Bad request - validation failed or insufficient stock' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  createMovement(
    @Param('id') id: string,
    @Body() createDto: CreateStockMovementDto,
    @Request() req,
  ) {
    try {
      // Organizations removed - data is user-scoped
      const result = this.inventoryService.createMovement(id, req.user.userId, createDto);
      return result;
    } catch (error: any) {
      throw error;
    }
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get inventory statistics', description: 'Retrieve overall inventory statistics' })
  @ApiResponse({ status: 200, description: 'Inventory statistics retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getStats(@Request() req) {
    // Organizations removed - data is user-scoped
    return this.inventoryService.getStats(req.user.userId);
  }

  @Get('low-stock')
  @ApiOperation({ summary: 'Get low stock items', description: 'Retrieve all items with stock below reorder level' })
  @ApiResponse({ status: 200, description: 'Low stock items retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getLowStock(@Request() req) {
    // Organizations removed - data is user-scoped
    return this.inventoryService.getLowStock(req.user.userId);
  }

  @Get('items/:id/invoices')
  @ApiOperation({ summary: 'Get linked invoices', description: 'Retrieve all invoices that include this inventory item' })
  @ApiParam({ name: 'id', description: 'Inventory item UUID' })
  @ApiResponse({ status: 200, description: 'Linked invoices retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Inventory item not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getLinkedInvoices(@Param('id') id: string, @Request() req) {
    // Organizations removed - data is user-scoped
    return this.inventoryService.getLinkedInvoices(id, req.user.userId);
  }

  @Post('items/bulk-delete')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  @ApiOperation({ summary: 'Bulk delete inventory items', description: 'Delete multiple inventory items at once. Returns count of deleted and failed deletions. Admin/Owner only.' })
  @ApiResponse({ status: 200, description: 'Bulk deletion completed. Check response for details.' })
  @ApiResponse({ status: 400, description: 'Bad request - validation failed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin/Owner access required' })
  async bulkDelete(@Body() bulkDeleteDto: BulkDeleteInventoryDto, @Request() req) {
    // Organizations removed - data is user-scoped
    const result = await this.inventoryService.bulkRemove(bulkDeleteDto.ids, req.user.userId);
    return {
      message: `Bulk deletion completed. Deleted: ${result.deleted}, Failed: ${result.failed.length}`,
      ...result,
    };
  }

  @Post('items/import')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Import inventory items from CSV/Excel', description: 'Import multiple inventory items from a CSV or Excel file. Returns count of created and failed imports.' })
  @ApiResponse({ status: 200, description: 'Import completed. Check response for details.' })
  @ApiResponse({ status: 400, description: 'Bad request - invalid file format or validation failed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async import(@UploadedFile() file: Express.Multer.File, @Request() req) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    // Organizations removed - data is user-scoped
    const result = await this.inventoryService.importFromFile(file, req.user.userId);
    return {
      message: `Import completed. Created: ${result.created}, Failed: ${result.failed.length}`,
      ...result,
    };
  }
}

