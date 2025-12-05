import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RecurringInvoice } from './entities/recurring-invoice.entity';

@Injectable()
export class RecurringInvoicesService {
  constructor(
    @InjectRepository(RecurringInvoice)
    private recurringInvoicesRepository: Repository<RecurringInvoice>,
  ) {}

  async findAll(userId: string): Promise<RecurringInvoice[]> {
    return this.recurringInvoicesRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, userId: string): Promise<RecurringInvoice> {
    const recurring = await this.recurringInvoicesRepository.findOne({
      where: { id, userId },
    });
    if (!recurring) {
      throw new NotFoundException('Recurring invoice not found');
    }
    return recurring;
  }

  async create(userId: string, data: Partial<RecurringInvoice>): Promise<RecurringInvoice> {
    const recurring = this.recurringInvoicesRepository.create({
      ...data,
      userId,
      startDate: new Date(data.startDate),
      endDate: data.endDate ? new Date(data.endDate) : null,
      nextRunDate: new Date(data.nextRunDate),
    });
    return this.recurringInvoicesRepository.save(recurring);
  }

  async update(id: string, userId: string, data: Partial<RecurringInvoice>): Promise<RecurringInvoice> {
    await this.findOne(id, userId);
    if (data.startDate) {
      data.startDate = new Date(data.startDate);
    }
    if (data.endDate) {
      data.endDate = new Date(data.endDate);
    }
    if (data.nextRunDate) {
      data.nextRunDate = new Date(data.nextRunDate);
    }
    await this.recurringInvoicesRepository.update({ id, userId }, data);
    return this.findOne(id, userId);
  }

  async remove(id: string, userId: string): Promise<void> {
    const recurring = await this.findOne(id, userId);
    await this.recurringInvoicesRepository.remove(recurring);
  }
}

