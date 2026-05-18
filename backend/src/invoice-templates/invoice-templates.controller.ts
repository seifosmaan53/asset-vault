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
} from '@nestjs/common';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { InvoiceTemplatesService } from './invoice-templates.service';
import { CreateInvoiceTemplateDto, UpdateInvoiceTemplateDto } from './dto';

@ApiTags('invoice-templates')
@ApiBearerAuth('JWT-auth')
@Controller('invoice-templates')
@UseGuards(ClerkAuthGuard)
export class InvoiceTemplatesController {
  constructor(private readonly templatesService: InvoiceTemplatesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all invoice templates', description: 'Retrieve all invoice templates for the authenticated user.' })
  @ApiResponse({ status: 200, description: 'List of templates retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findAll(@Request() req) {
    return this.templatesService.findAll(req.user.userId);
  }

  @Get('default')
  @ApiOperation({ summary: 'Get default template', description: 'Retrieve the default invoice template for the authenticated user.' })
  @ApiResponse({ status: 200, description: 'Default template retrieved successfully' })
  @ApiResponse({ status: 404, description: 'No default template found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findDefault(@Request() req) {
    return this.templatesService.findDefault(req.user.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get template by ID', description: 'Retrieve a specific invoice template by its ID.' })
  @ApiParam({ name: 'id', type: String, description: 'Template ID' })
  @ApiResponse({ status: 200, description: 'Template retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findOne(@Param('id') id: string, @Request() req) {
    return this.templatesService.findOne(id, req.user.userId);
  }

  @Post()
  @ApiOperation({ summary: 'Create invoice template', description: 'Create a new customizable invoice template.' })
  @ApiResponse({ status: 201, description: 'Template created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  create(@Body() createDto: CreateInvoiceTemplateDto, @Request() req) {
    return this.templatesService.create(req.user.userId, createDto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update invoice template', description: 'Update an existing invoice template.' })
  @ApiParam({ name: 'id', type: String, description: 'Template ID' })
  @ApiResponse({ status: 200, description: 'Template updated successfully' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  update(@Param('id') id: string, @Body() updateDto: UpdateInvoiceTemplateDto, @Request() req) {
    return this.templatesService.update(id, req.user.userId, updateDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete invoice template', description: 'Delete an invoice template (soft delete).' })
  @ApiParam({ name: 'id', type: String, description: 'Template ID' })
  @ApiResponse({ status: 200, description: 'Template deleted successfully' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async remove(@Param('id') id: string, @Request() req) {
    await this.templatesService.remove(id, req.user.userId);
    return { message: 'Template deleted successfully' };
  }
}
