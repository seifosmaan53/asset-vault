import { DataSource } from 'typeorm';
import {
  ENTITIES_GLOB,
  MIGRATIONS_GLOB,
  connectionSettingsFromEnv,
  loadDotenvIfAvailable,
} from './database-options';

// backend/.env in a checkout; in the production image the environment is the container's.
loadDotenvIfAvailable();

/**
 * The DataSource used by the migration runner, the revert script and the TypeORM CLI.
 * Works from src/database (ts-node) and from dist/database (compiled, production image).
 */
export const AppDataSource = new DataSource({
  type: 'postgres',
  ...connectionSettingsFromEnv(),
  entities: [ENTITIES_GLOB],
  migrations: [MIGRATIONS_GLOB],
  synchronize: false,
  migrationsRun: false,
  logging: process.env.NODE_ENV === 'development',
});
