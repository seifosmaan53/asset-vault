import { AppDataSource } from './data-source';
import { config } from 'dotenv';

config();

async function revertMigration() {
  try {
    await AppDataSource.initialize();
    console.log('Database connection established');
    
    await AppDataSource.undoLastMigration();
    console.log('Last migration reverted');
    
    await AppDataSource.destroy();
    console.log('Migration revert completed');
    process.exit(0);
  } catch (error) {
    console.error('Error reverting migration:', error);
    process.exit(1);
  }
}

revertMigration();

