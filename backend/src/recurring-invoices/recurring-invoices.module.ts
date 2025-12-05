import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RecurringInvoicesController } from './recurring-invoices.controller';
import { RecurringInvoicesService } from './recurring-invoices.service';
import { RecurringInvoice } from './entities/recurring-invoice.entity';

@Module({
  imports: [TypeOrmModule.forFeature([RecurringInvoice])],
  controllers: [RecurringInvoicesController],
  providers: [RecurringInvoicesService],
  exports: [RecurringInvoicesService],
})
export class RecurringInvoicesModule {}

