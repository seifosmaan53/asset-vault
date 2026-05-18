import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { InvoiceTemplate, TemplateData } from './entities/invoice-template.entity';
import { CreateInvoiceTemplateDto, UpdateInvoiceTemplateDto } from './dto';

@Injectable()
export class InvoiceTemplatesService {
  private readonly logger = new Logger(InvoiceTemplatesService.name);

  constructor(
    @InjectRepository(InvoiceTemplate)
    private templateRepository: Repository<InvoiceTemplate>,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(userId: string): Promise<InvoiceTemplate[]> {
    return this.templateRepository
      .createQueryBuilder('template')
      .where('template.userId = :userId', { userId })
      .andWhere('template.deletedAt IS NULL')
      .orderBy('template.isDefault', 'DESC')
      .addOrderBy('template.createdAt', 'DESC')
      .getMany();
  }

  async findOne(id: string, userId: string): Promise<InvoiceTemplate> {
    const template = await this.templateRepository
      .createQueryBuilder('template')
      .where('template.id = :id', { id })
      .andWhere('template.userId = :userId', { userId })
      .andWhere('template.deletedAt IS NULL')
      .getOne();

    if (!template) {
      throw new NotFoundException('Invoice template not found');
    }

    return template;
  }

  async findDefault(userId: string): Promise<InvoiceTemplate | null> {
    return this.templateRepository
      .createQueryBuilder('template')
      .where('template.userId = :userId', { userId })
      .andWhere('template.isDefault = :isDefault', { isDefault: true })
      .andWhere('template.deletedAt IS NULL')
      .getOne();
  }

  async create(userId: string, data: CreateInvoiceTemplateDto): Promise<InvoiceTemplate> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // If setting as default, unset other defaults
      if (data.isDefault) {
        await queryRunner.manager
          .createQueryBuilder()
          .update(InvoiceTemplate)
          .set({ isDefault: false })
          .where('userId = :userId', { userId })
          .andWhere('deletedAt IS NULL')
          .execute();
      }

      const template = this.templateRepository.create({
        userId,
        name: data.name,
        description: data.description,
        templateData: data.templateData,
        isDefault: data.isDefault || false,
      });

      const saved = await queryRunner.manager.save(template);
      await queryRunner.commitTransaction();
      
      this.logger.log(`Created invoice template ${saved.id} for user ${userId}`);
      return saved;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to create invoice template for user ${userId}`, error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async update(id: string, userId: string, data: UpdateInvoiceTemplateDto): Promise<InvoiceTemplate> {
    const template = await this.findOne(id, userId);
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // If setting as default, unset other defaults
      if (data.isDefault && !template.isDefault) {
        await queryRunner.manager
          .createQueryBuilder()
          .update(InvoiceTemplate)
          .set({ isDefault: false })
          .where('userId = :userId', { userId })
          .andWhere('id != :id', { id })
          .andWhere('deletedAt IS NULL')
          .execute();
      }

      Object.assign(template, data);
      const updated = await queryRunner.manager.save(template);
      await queryRunner.commitTransaction();
      
      this.logger.log(`Updated invoice template ${id} for user ${userId}`);
      return updated;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to update invoice template ${id} for user ${userId}`, error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async remove(id: string, userId: string): Promise<void> {
    const template = await this.findOne(id, userId);
    
    // Soft delete
    template.deletedAt = new Date();
    await this.templateRepository.save(template);
    
    this.logger.log(`Deleted invoice template ${id} for user ${userId}`);
  }

  /**
   * Render invoice using template
   */
  renderInvoice(template: InvoiceTemplate, invoiceData: any): string {
    // This would generate HTML for the invoice using the template
    // For now, return a basic structure
    // In a full implementation, this would use a templating engine like Handlebars or Mustache
    
    const data = template.templateData;
    let html = '';

    // Header
    if (data.header) {
      html += '<div class="invoice-header">';
      if (data.header.logo) {
        html += `<img src="${data.header.logo}" alt="Logo" />`;
      }
      if (data.header.companyName) {
        html += `<h1>${data.header.companyName}</h1>`;
      }
      html += '</div>';
    }

    // Invoice content would be rendered here based on template sections
    
    // Footer
    if (data.footer) {
      html += '<div class="invoice-footer">';
      if (data.footer.text) {
        html += `<p>${data.footer.text}</p>`;
      }
      html += '</div>';
    }

    return html;
  }
}
