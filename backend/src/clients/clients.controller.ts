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
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { ClientsService } from './clients.service';
import { CreateClientDto, UpdateClientDto, BulkDeleteClientsDto } from './dto';
// Organizations removed - OrganizationId decorator no longer needed
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

@ApiTags('clients')
@ApiBearerAuth('JWT-auth')
@Controller('clients')
@UseGuards(ClerkAuthGuard)
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all clients', description: 'Retrieve a list of all clients for the authenticated user with optional filters.' })
  @ApiResponse({ status: 200, description: 'List of clients retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findAll(@Request() req, @Query() filters?: any) {
    // Organizations removed - data is user-scoped
    return this.clientsService.findAll(req.user.userId, filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get client by ID', description: 'Retrieve a single client by its ID with all details.' })
  @ApiParam({ name: 'id', type: String, description: 'Client ID' })
  @ApiResponse({ status: 200, description: 'Client retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Client not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findOne(@Param('id') id: string, @Request() req) {
    // Organizations removed - data is user-scoped
    return this.clientsService.findOne(id, req.user.userId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new client', description: 'Create a new client with contact information and address.' })
  @ApiResponse({ status: 201, description: 'Client created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  create(@Body() createClientDto: CreateClientDto, @Request() req) {
    try {
      // Organizations removed - data is user-scoped
      const result = this.clientsService.create(req.user.userId, createClientDto);
      return result;
    } catch (error: any) {
      throw error;
    }
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a client', description: 'Update an existing client\'s information.' })
  @ApiParam({ name: 'id', type: String, description: 'Client ID' })
  @ApiResponse({ status: 200, description: 'Client updated successfully' })
  @ApiResponse({ status: 404, description: 'Client not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  update(@Param('id') id: string, @Body() updateClientDto: UpdateClientDto, @Request() req) {
    try {
      // Organizations removed - data is user-scoped
      const result = this.clientsService.update(id, req.user.userId, updateClientDto);
      return result;
    } catch (error: any) {
      throw error;
    }
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  @ApiOperation({ summary: 'Delete a client', description: 'Delete a client. Cannot delete if client has associated invoices. Admin/Owner only.' })
  @ApiParam({ name: 'id', type: String, description: 'Client ID' })
  @ApiResponse({ status: 200, description: 'Client deleted successfully' })
  @ApiResponse({ status: 404, description: 'Client not found' })
  @ApiResponse({ status: 409, description: 'Conflict - client has associated invoices' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin/Owner access required' })
  async remove(@Param('id') id: string, @Request() req) {
    // Organizations removed - data is user-scoped
    await this.clientsService.remove(id, req.user.userId);
    return { message: 'Client deleted successfully' };
  }

  @Post('bulk-delete')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  @ApiOperation({ summary: 'Bulk delete clients', description: 'Delete multiple clients at once. Returns count of deleted and failed deletions. Admin/Owner only.' })
  @ApiResponse({ status: 200, description: 'Bulk deletion completed. Check response for details.' })
  @ApiResponse({ status: 400, description: 'Bad request - validation failed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin/Owner access required' })
  async bulkDelete(@Body() bulkDeleteDto: BulkDeleteClientsDto, @Request() req) {
    // Organizations removed - data is user-scoped
    const result = await this.clientsService.bulkRemove(bulkDeleteDto.ids, req.user.userId);
    return {
      message: `Bulk deletion completed. Deleted: ${result.deleted}, Failed: ${result.failed.length}`,
      ...result,
    };
  }

  @Post('import')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Import clients from CSV/Excel', description: 'Import multiple clients from a CSV or Excel file. Returns count of created and failed imports.' })
  @ApiResponse({ status: 200, description: 'Import completed. Check response for details.' })
  @ApiResponse({ status: 400, description: 'Bad request - invalid file format or validation failed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async import(@UploadedFile() file: Express.Multer.File, @Request() req) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    // Organizations removed - data is user-scoped
    const result = await this.clientsService.importFromFile(file, req.user.userId);
    return {
      message: `Import completed. Created: ${result.created}, Failed: ${result.failed.length}`,
      ...result,
    };
  }
}

