import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';

@Injectable()
export class UserSettingsService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async getSettings(userId: string) {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    // Return default settings structure
    return {
      invoiceNumberFormat: 'INV-{YYYY}-{####}',
      defaultCurrency: 'USD',
      defaultTaxRate: 0,
      companyName: user?.companyName || '',
      companyAddress: '',
      companyPhone: '',
      companyEmail: user?.email || '',
    };
  }

  async updateSettings(userId: string, data: any) {
    // In a real app, you'd have a separate settings table
    // For now, we'll just return the data
    return data;
  }
}

