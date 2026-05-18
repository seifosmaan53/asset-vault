import { AppDataSource } from './data-source';
import { config } from 'dotenv';

config();

async function runMigrations() {
  try {
    await AppDataSource.initialize();
    console.log('Database connection established');
    
    const migrations = await AppDataSource.runMigrations();
    console.log(`Ran ${migrations.length} migration(s):`);
    migrations.forEach((migration) => {
      console.log(`  - ${migration.name}`);
    });
    
    await AppDataSource.destroy();
    console.log('Migrations completed');
    process.exit(0);
  } catch (error) {
    console.error('Error running migrations:', error);
    process.exit(1);
  }
}

runMigrations();

