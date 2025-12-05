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
  Res,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import { InvoicesService } from './invoices.service';
import { CreateInvoiceDto, UpdateInvoiceDto } from './dto';

@Controller('invoices')
@UseGuards(AuthGuard('jwt'))
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get()
  findAll(@Request() req, @Query() filters: any) {
    return this.invoicesService.findAll(req.user.userId, filters);
  }

  @Get('stats')
  getStats(@Request() req) {
    return this.invoicesService.getStats(req.user.userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    return this.invoicesService.findOne(id, req.user.userId);
  }

  @Post()
  create(@Body() createDto: CreateInvoiceDto, @Request() req) {
    return this.invoicesService.create(req.user.userId, createDto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateDto: UpdateInvoiceDto, @Request() req) {
    return this.invoicesService.update(id, req.user.userId, updateDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req) {
    return this.invoicesService.remove(id, req.user.userId);
  }

  @Post(':id/convert')
  convert(@Param('id') id: string, @Request() req) {
    return this.invoicesService.convertEstimateToInvoice(id, req.user.userId);
  }

  @Post(':id/send')
  async send(@Param('id') id: string, @Request() req) {
    return this.invoicesService.sendEmail(id, req.user.userId);
  }

  @Post(':id/pdf')
  async generatePdf(@Param('id') id: string, @Request() req, @Res() res: Response) {
    const pdfBuffer = await this.invoicesService.generatePdf(id, req.user.userId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${id}.pdf`);
    res.send(pdfBuffer);
  }
}

