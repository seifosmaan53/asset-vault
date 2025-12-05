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
import { RecurringInvoicesService } from './recurring-invoices.service';
import { CreateRecurringInvoiceDto, UpdateRecurringInvoiceDto } from './dto';

@Controller('recurring-invoices')
@UseGuards(AuthGuard('jwt'))
export class RecurringInvoicesController {
  constructor(private readonly recurringInvoicesService: RecurringInvoicesService) {}

  @Get()
  findAll(@Request() req) {
    return this.recurringInvoicesService.findAll(req.user.userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    return this.recurringInvoicesService.findOne(id, req.user.userId);
  }

  @Post()
  create(@Body() createDto: CreateRecurringInvoiceDto, @Request() req) {
    return this.recurringInvoicesService.create(req.user.userId, createDto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateDto: UpdateRecurringInvoiceDto, @Request() req) {
    return this.recurringInvoicesService.update(id, req.user.userId, updateDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req) {
    return this.recurringInvoicesService.remove(id, req.user.userId);
  }
}

