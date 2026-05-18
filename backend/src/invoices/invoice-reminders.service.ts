import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, IsNull } from 'typeorm';
import { Invoice } from './entities/invoice.entity';

@Injectable()
export class InvoiceRemindersService {
  private readonly logger = new Logger(InvoiceRemindersService.name);

  constructor(
    @InjectRepository(Invoice)
    private invoicesRepository: Repository<Invoice>,
  ) {}

  // Email functionality removed - cron job disabled
  // @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async sendOverdueReminders() {
    this.logger.log('Checking for overdue invoices to send reminders...');

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    // Find overdue invoices that haven't been paid or cancelled
    // and either haven't had a reminder sent, or last reminder was more than 7 days ago
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const overdueInvoices = await this.invoicesRepository.find({
      where: [
        {
          status: 'sent',
          dueDate: LessThan(now),
          paidAt: IsNull(),
        },
        {
          status: 'overdue',
          paidAt: IsNull(),
        },
      ],
      relations: ['client', 'user', 'items'],
    });

    this.logger.log(`Found ${overdueInvoices.length} overdue invoice(s) to check for reminders`);

    let sentCount = 0;
    let errorCount = 0;

    for (const invoice of overdueInvoices) {
      try {
        // Skip if no client email
        if (!invoice.client?.email) {
          this.logger.warn(`Skipping invoice ${invoice.number} - no client email`);
          continue;
        }

        // Skip if reminder was sent recently (within 7 days)
        if (invoice.lastReminderSentAt) {
          const lastReminder = new Date(invoice.lastReminderSentAt);
          if (lastReminder > sevenDaysAgo) {
            this.logger.log(`Skipping invoice ${invoice.number} - reminder sent recently`);
            continue;
          }
        }

        // Calculate days overdue
        const dueDate = new Date(invoice.dueDate);
        const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

        // Email functionality removed - just log and update status
        this.logger.log(`Invoice ${invoice.number} is ${daysOverdue} days overdue (email reminders disabled)`);

        // Update invoice
        invoice.lastReminderSentAt = new Date();
        if (invoice.status === 'sent') {
          invoice.status = 'overdue';
        }
        await this.invoicesRepository.save(invoice);

        sentCount++;
        this.logger.log(`Invoice ${invoice.number} marked as overdue (${daysOverdue} days)`);
      } catch (error) {
        errorCount++;
        this.logger.error(`Failed to send reminder for invoice ${invoice.id}:`, error);
      }
    }

    if (overdueInvoices.length > 0) {
      this.logger.log(
        `Invoice reminders completed: ${sentCount} sent, ${errorCount} errors`,
      );
    }
  }

  // Email functionality removed - methods commented out
  // private async sendReminderEmail(invoice: Invoice, daysOverdue: number): Promise<void> {
  //   // Email sending disabled
  // }

  // private buildReminderEmailHtml(invoice: Invoice, daysOverdue: number): string {
  //   // Email HTML generation disabled
  //   return '';
  // }
}

