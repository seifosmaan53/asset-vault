import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MetricsService } from './services/metrics.service';
import { MetricsController } from './controllers/metrics.controller';
import { PuppeteerService } from './services/puppeteer.service';
import { ImportService } from './services/import.service';

@Global()
@Module({
  imports: [TypeOrmModule],
  providers: [MetricsService, PuppeteerService, ImportService],
  controllers: [MetricsController],
  exports: [MetricsService, PuppeteerService, ImportService],
})
export class CommonModule {}

