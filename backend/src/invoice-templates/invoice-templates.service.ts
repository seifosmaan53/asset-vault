import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InvoiceTemplate } from './entities/invoice-template.entity';

@Injectable()
export class InvoiceTemplatesService {
  constructor(
    @InjectRepository(InvoiceTemplate)
    private templatesRepository: Repository<InvoiceTemplate>,
  ) {}

  async findAll(userId: string): Promise<InvoiceTemplate[]> {
    return this.templatesRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, userId: string): Promise<InvoiceTemplate> {
    const template = await this.templatesRepository.findOne({
      where: { id, userId },
    });
    if (!template) {
      throw new NotFoundException('Template not found');
    }
    return template;
  }

  async create(userId: string, data: Partial<InvoiceTemplate>): Promise<InvoiceTemplate> {
    // If setting as default, unset other defaults
    if (data.isDefault) {
      await this.templatesRepository.update(
        { userId, isDefault: true },
        { isDefault: false },
      );
    }

    const template = this.templatesRepository.create({
      ...data,
      userId,
    });
    return this.templatesRepository.save(template);
  }

  async update(id: string, userId: string, data: Partial<InvoiceTemplate>): Promise<InvoiceTemplate> {
    await this.findOne(id, userId);

    // If setting as default, unset other defaults
    if (data.isDefault) {
      await this.templatesRepository.update(
        { userId, isDefault: true },
        { isDefault: false },
      );
    }

    await this.templatesRepository.update({ id, userId }, data);
    return this.findOne(id, userId);
  }

  async remove(id: string, userId: string): Promise<void> {
    const template = await this.findOne(id, userId);
    await this.templatesRepository.remove(template);
  }
}

