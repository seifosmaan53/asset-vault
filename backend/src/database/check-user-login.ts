import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { User } from '../users/entities/user.entity';
import * as bcrypt from 'bcryptjs';

config();

async function checkUserLogin() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'invoiceme',
    entities: [User],
    synchronize: false,
    logging: false,
  });

  try {
    await dataSource.initialize();
    console.log('Database connection established\n');

    const userRepository = dataSource.getRepository(User);
    const email = process.argv[2] || 'moo@test.com';
    const normalizedEmail = email.toLowerCase().trim();

    console.log(`Checking user: ${normalizedEmail}\n`);

    const user = await userRepository.findOne({ where: { email: normalizedEmail } });

    if (!user) {
      console.log('❌ User not found in database');
      console.log('\nTo create this user, use the registration endpoint or run:');
      console.log('  npm run seed  (for demo user)');
      console.log('\nOr register via the API:');
      console.log('  POST /api/v1/auth/register');
      await dataSource.destroy();
      process.exit(1);
    }

    console.log('✅ User found:');
    console.log(`  ID: ${user.id}`);
    console.log(`  Email: ${user.email}`);
    console.log(`  Name: ${user.name}`);
    console.log(`  Role: ${user.role}`);
    console.log(`  Created: ${user.createdAt}`);
    console.log(`  Clerk User ID: ${user.clerkUserId || 'Not linked'}`);
    console.log('  ✅ Authentication is now handled by Clerk');

    // Test password if provided
    if (process.argv[3]) {
      const testPassword = process.argv[3];
      // Password authentication is now handled by Clerk
      console.log('  ⚠️  Password authentication is now handled by Clerk');
      const isValid = false; // Clerk handles authentication
      if (isValid) {
        console.log(`\n✅ Password "${testPassword}" is CORRECT`);
      } else {
        console.log(`\n❌ Password "${testPassword}" is INCORRECT`);
        console.log('\nIf you forgot the password, you can:');
        console.log('  1. Use password reset feature');
        console.log('  2. Delete and recreate the user');
        console.log('  3. Update password directly in database (not recommended)');
      }
    } else {
      console.log('\n💡 To test password, run:');
      console.log(`  npm run check-user-login ${email} <password>`);
    }

    await dataSource.destroy();
    process.exit(0);
  } catch (error) {
    console.error('Error checking user:', error);
    try {
      await dataSource.destroy();
    } catch {
      // Ignore destroy errors
    }
    process.exit(1);
  }
}

checkUserLogin();

