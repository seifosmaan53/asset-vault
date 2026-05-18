import { AppDataSource } from './data-source';
import { Invoice } from '../invoices/entities/invoice.entity';
import { IsNull } from 'typeorm';
import { config } from 'dotenv';

config();

async function backfillPaidAtDates() {
  try {
    console.log('Initializing database connection...');
    await AppDataSource.initialize();
    console.log('Database connection established');

    const invoiceRepository = AppDataSource.getRepository(Invoice);

    // Find all paid invoices without paidAt date
    console.log('Finding paid invoices without paidAt dates...');
    const paidInvoicesWithoutPaidAt = await invoiceRepository.find({
      where: {
        status: 'paid',
        paidAt: IsNull(),
      },
    });

    console.log(`Found ${paidInvoicesWithoutPaidAt.length} paid invoices without paidAt date`);

    if (paidInvoicesWithoutPaidAt.length === 0) {
      console.log('No invoices need to be updated. All paid invoices already have paidAt dates.');
      await AppDataSource.destroy();
      process.exit(0);
    }

    let updatedCount = 0;
    for (const invoice of paidInvoicesWithoutPaidAt) {
      // Use updatedAt if available (when invoice was last updated, likely when it was marked as paid)
      // Otherwise fall back to issueDate
      const paidAtDate = invoice.updatedAt || invoice.issueDate || new Date();
      
      await invoiceRepository.update(
        { id: invoice.id },
        { paidAt: paidAtDate }
      );
      
      updatedCount++;
      console.log(`✓ Updated invoice ${invoice.number} (${invoice.id}) with paidAt: ${paidAtDate.toISOString()}`);
    }

    console.log(`\n✅ Successfully updated ${updatedCount} invoice(s) with paidAt dates`);
    console.log('\nYou can now refresh your dashboard to see updated monthly revenue.');
    
    await AppDataSource.destroy();
    process.exit(0);
  } catch (error) {
    console.error('Error backfilling paidAt dates:', error);
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
    process.exit(1);
  }
}

backfillPaidAtDates();

