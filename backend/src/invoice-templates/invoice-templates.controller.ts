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
import { AuthGuard } from '@nestjs/passport';
import { InvoiceTemplatesService } from './invoice-templates.service';
import { CreateInvoiceTemplateDto, UpdateInvoiceTemplateDto } from './dto';

@Controller('invoice-templates')
@UseGuards(AuthGuard('jwt'))
export class InvoiceTemplatesController {
  constructor(private readonly templatesService: InvoiceTemplatesService) {}

  @Get()
  findAll(@Request() req) {
    return this.templatesService.findAll(req.user.userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    return this.templatesService.findOne(id, req.user.userId);
  }

  @Post()
  create(@Body() createDto: CreateInvoiceTemplateDto, @Request() req) {
    return this.templatesService.create(req.user.userId, createDto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateDto: UpdateInvoiceTemplateDto, @Request() req) {
    return this.templatesService.update(id, req.user.userId, updateDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req) {
    return this.templatesService.remove(id, req.user.userId);
  }
}

