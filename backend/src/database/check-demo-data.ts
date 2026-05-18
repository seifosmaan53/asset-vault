import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { User } from '../users/entities/user.entity';
import { Client } from '../clients/entities/client.entity';

config();

async function checkDemoData() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'invoiceme',
    entities: [User, Client],
    synchronize: false,
    logging: false,
  });

  try {
    await dataSource.initialize();
    
    const userRepository = dataSource.getRepository(User);
    const clientRepository = dataSource.getRepository(Client);
    
    // Check if demo user exists
    const demoUser = await userRepository.findOne({ where: { email: 'demo@example.com' } });
    
    if (!demoUser) {
      console.log('NO_DEMO_DATA');
      await dataSource.destroy();
      process.exit(0);
    }
    
    // Check if demo user has demo clients (indicating demo data exists)
    const demoClients = await clientRepository.find({ where: { userId: demoUser.id } });
    const demoClientNames = ['Acme Corporation', 'Tech Solutions Ltd', 'Global Enterprises', 'Small Business Co'];
    const hasDemoClients = demoClients.some(client => demoClientNames.includes(client.name));
    
    if (hasDemoClients) {
      console.log('DEMO_DATA_EXISTS');
    } else {
      console.log('DEMO_USER_ONLY');
    }
    
    await dataSource.destroy();
    process.exit(0);
  } catch (error) {
    // If database connection fails or tables don't exist, assume no demo data
    console.log('NO_DEMO_DATA');
    try {
      await dataSource.destroy();
    } catch {
      // Ignore destroy errors
    }
    process.exit(0);
  }
}

checkDemoData();

