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
import { AuthGuard } from '@nestjs/passport';
import { InventoryService } from './inventory.service';
import { CreateInventoryItemDto, UpdateInventoryItemDto, CreateStockMovementDto } from './dto';

@Controller('inventory')
@UseGuards(AuthGuard('jwt'))
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('items')
  findAll(@Request() req, @Query() filters: any) {
    return this.inventoryService.findAll(req.user.userId, filters);
  }

  @Get('items/:id')
  findOne(@Param('id') id: string, @Request() req) {
    return this.inventoryService.findOne(id, req.user.userId);
  }

  @Post('items')
  create(@Body() createDto: CreateInventoryItemDto, @Request() req) {
    return this.inventoryService.create(req.user.userId, createDto);
  }

  @Patch('items/:id')
  update(@Param('id') id: string, @Body() updateDto: UpdateInventoryItemDto, @Request() req) {
    return this.inventoryService.update(id, req.user.userId, updateDto);
  }

  @Delete('items/:id')
  remove(@Param('id') id: string, @Request() req) {
    return this.inventoryService.remove(id, req.user.userId);
  }

  @Get('items/:id/movements')
  getMovements(@Param('id') id: string, @Request() req) {
    return this.inventoryService.getMovements(id, req.user.userId);
  }

  @Post('items/:id/movements')
  createMovement(@Param('id') id: string, @Body() createDto: CreateStockMovementDto, @Request() req) {
    return this.inventoryService.createMovement(id, req.user.userId, createDto);
  }

  @Get('stats')
  getStats(@Request() req) {
    return this.inventoryService.getStats(req.user.userId);
  }

  @Get('low-stock')
  getLowStock(@Request() req) {
    return this.inventoryService.getLowStock(req.user.userId);
  }

  @Get('items/:id/invoices')
  getLinkedInvoices(@Param('id') id: string, @Request() req) {
    return this.inventoryService.getLinkedInvoices(id, req.user.userId);
  }
}

