import { config } from 'dotenv';
import { AppDataSource } from './data-source';
import { Invoice } from '../invoices/entities/invoice.entity';
import { Client } from '../clients/entities/client.entity';

config();

async function checkDeletedData() {
  try {
    await AppDataSource.initialize();
    console.log('Database connection established\n');

    const invoiceRepository = AppDataSource.getRepository(Invoice);
    const clientRepository = AppDataSource.getRepository(Client);

    const userId = '183c2f85-15a3-445b-ae03-047cf1e074cc'; // seifosman53@gmail.com

    // Check for soft-deleted invoices (with deletedAt set)
    const deletedInvoices = await invoiceRepository
      .createQueryBuilder('invoice')
      .withDeleted()
      .where('invoice.userId = :userId', { userId })
      .andWhere('invoice.deletedAt IS NOT NULL')
      .orderBy('invoice.total', 'DESC')
      .take(10)
      .getMany();

    console.log(`=== DELETED INVOICES FOR seifosman53@gmail.com ===`);
    console.log(`Found ${deletedInvoices.length} deleted invoices\n`);

    if (deletedInvoices.length > 0) {
      console.log('Top deleted invoices:');
      deletedInvoices.forEach(inv => {
        const total = parseFloat(inv.total.toString());
        console.log(`  - ${inv.number}: $${total.toFixed(2)} (${inv.status}) - Deleted: ${inv.deletedAt}`);
      });

      const totalDeleted = deletedInvoices.reduce((sum, inv) => sum + parseFloat(inv.total.toString()), 0);
      console.log(`\nTotal amount of deleted invoices: $${totalDeleted.toFixed(2)}`);
      console.log(`\nThese invoices can be restored if needed.`);
    } else {
      console.log('No deleted invoices found. Data may have been permanently deleted.');
    }

    // Check deleted clients
    const deletedClients = await clientRepository
      .createQueryBuilder('client')
      .withDeleted()
      .where('client.userId = :userId', { userId })
      .andWhere('client.deletedAt IS NOT NULL')
      .getMany();

    console.log(`\n=== DELETED CLIENTS ===`);
    console.log(`Found ${deletedClients.length} deleted clients`);
    if (deletedClients.length > 0) {
      deletedClients.forEach(client => {
        console.log(`  - ${client.name} - Deleted: ${client.deletedAt}`);
      });
    }

    await AppDataSource.destroy();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkDeletedData();

