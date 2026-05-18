import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InvoiceTemplatesController } from './invoice-templates.controller';
import { InvoiceTemplatesService } from './invoice-templates.service';
import { InvoiceTemplate } from './entities/invoice-template.entity';

@Module({
  imports: [TypeOrmModule.forFeature([InvoiceTemplate])],
  controllers: [InvoiceTemplatesController],
  providers: [InvoiceTemplatesService],
  exports: [InvoiceTemplatesService],
})
export class InvoiceTemplatesModule {}
