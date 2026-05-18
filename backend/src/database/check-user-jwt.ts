import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { User } from '../users/entities/user.entity';
import * as jwt from 'jsonwebtoken';

config();

/**
 * Script to decode and verify JWT tokens
 * Helps diagnose why users might see wrong data
 */
async function checkUserJWT() {
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
    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      console.error('❌ JWT_SECRET not found in environment variables');
      process.exit(1);
    }

    // Get all users
    const allUsers = await userRepository.find({
      select: ['id', 'email', 'role', 'name'],
      order: { createdAt: 'ASC' },
    });

    console.log('='.repeat(70));
    console.log('JWT TOKEN VERIFICATION GUIDE');
    console.log('='.repeat(70));
    console.log('\n📋 All users in database:\n');
    
    for (const user of allUsers) {
      const isDemo = user.email.toLowerCase() === 'demo@example.com';
      const marker = isDemo ? ' 👈 DEMO' : '';
      console.log(`  ${user.email}${marker}`);
      console.log(`    ID: ${user.id}`);
      console.log(`    Role: ${user.role}`);
      console.log(`    Name: ${user.name || 'N/A'}`);
      console.log('');
    }

    console.log('\n🔍 How to verify your JWT token:');
    console.log('-'.repeat(70));
    console.log('1. Open browser DevTools (F12)');
    console.log('2. Go to Application/Storage tab');
    console.log('3. Check localStorage for "accessToken"');
    console.log('4. Copy the token value');
    console.log('5. Go to https://jwt.io');
    console.log('6. Paste the token in the "Encoded" section');
    console.log('7. Check the "payload" section for:');
    console.log('   - "sub": This should be your userId');
    console.log('   - "email": This should be your email');
    console.log('');
    console.log('✅ Expected userIds:');
    for (const user of allUsers) {
      console.log(`   ${user.email}: ${user.id}`);
    }
    console.log('');
    console.log('⚠️  If the "sub" in your JWT token doesn\'t match your userId:');
    console.log('   1. Log out completely');
    console.log('   2. Clear browser localStorage');
    console.log('   3. Clear browser cache');
    console.log('   4. Log back in');
    console.log('');

    // If a token is provided as argument, decode it
    const tokenArg = process.argv[2];
    if (tokenArg) {
      try {
        const decoded = jwt.verify(tokenArg, jwtSecret) as any;
        console.log('🔐 Decoded JWT Token:');
        console.log('-'.repeat(70));
        console.log(`  User ID (sub): ${decoded.sub}`);
        console.log(`  Email: ${decoded.email}`);
        console.log(`  Expires: ${new Date(decoded.exp * 1000).toLocaleString()}`);
        console.log('');
        
        const user = allUsers.find(u => u.id === decoded.sub);
        if (user) {
          console.log(`✅ Token belongs to: ${user.email}`);
          if (user.email.toLowerCase() === 'demo@example.com') {
            console.log('⚠️  WARNING: This is the demo account token!');
            console.log('   If you\'re logged in as a different user, you need to log out and log back in.');
          }
        } else {
          console.log('❌ ERROR: Token userId does not match any user in database!');
        }
      } catch (error: any) {
        console.error('❌ Failed to decode token:', error.message);
      }
    }

    await dataSource.destroy();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    try {
      await dataSource.destroy();
    } catch {
      // Ignore destroy errors
    }
    process.exit(1);
  }
}

checkUserJWT();

