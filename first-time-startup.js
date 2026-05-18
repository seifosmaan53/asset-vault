#!/usr/bin/env node

/**
 * InvoiceMe First-Time Startup Script
 * 
 * Automatically installs dependencies, sets up environment, and starts the application.
 * This is the unified cross-platform script that works on Mac, Linux, and Windows.
 * 
 * Usage:
 *   node first-time-startup.js
 * 
 * The script will:
 *   - Check prerequisites (Node.js, npm, PostgreSQL)
 *   - Create environment files (.env)
 *   - Install dependencies
 *   - Set up database
 *   - Run migrations
 *   - Start the application
 */

const { execSync, spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const readline = require('readline');
const http = require('http');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Colors for output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step, message) {
  log(`\n[${step}] ${message}`, 'cyan');
}

function logSuccess(message) {
  log(`✓ ${message}`, 'green');
}

function logError(message) {
  log(`✗ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠ ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ ${message}`, 'blue');
}

// Check if command exists
function commandExists(command) {
  try {
    if (process.platform === 'win32') {
      execSync(`where ${command}`, { stdio: 'ignore' });
    } else {
      execSync(`which ${command}`, { stdio: 'ignore' });
    }
    return true;
  } catch {
    return false;
  }
}

// Execute command and return result
function execCommand(command, options = {}) {
  try {
    const result = execSync(command, {
      encoding: 'utf8',
      stdio: options.silent ? 'pipe' : 'inherit',
      ...options
    });
    return { success: true, output: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Ask question and wait for input
function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(`${colors.cyan}${question}${colors.reset} `, (answer) => {
      resolve(answer.trim());
    });
  });
}

// Check prerequisites
async function checkPrerequisites() {
  logStep(1, 'Checking prerequisites...');
  logInfo('Verifying required tools are installed...');
  
  const missing = [];
  let needsNodeInstall = false;
  
  // Check Node.js
  if (!commandExists('node')) {
    missing.push('Node.js');
    logError('Node.js is not installed');
    logInfo('Required version: 18 or higher');
    
    // Try to install Node.js automatically
    if (process.platform === 'darwin' && commandExists('brew')) {
      logInfo('Attempting to install Node.js via Homebrew...');
      const installResult = execCommand('brew install node', { silent: false });
      if (installResult.success) {
        logSuccess('Node.js installed successfully!');
        logInfo('Please restart your terminal and run this script again.');
        logInfo('Or run: source ~/.zshrc (or ~/.bash_profile)');
        return false;
      } else {
        logWarning('Automatic installation failed. Opening download page...');
        needsNodeInstall = true;
      }
    } else {
      needsNodeInstall = true;
    }
  } else {
    const nodeVersion = execCommand('node --version', { silent: true }).output;
    const majorVersion = parseInt(nodeVersion.replace('v', '').split('.')[0]);
    if (majorVersion < 18) {
      logWarning(`Node.js version ${nodeVersion} is installed. Version 18+ is recommended.`);
      const update = await askQuestion('Would you like to update Node.js? (y/n) [n]:');
      if (update.toLowerCase() === 'y') {
        if (process.platform === 'darwin' && commandExists('brew')) {
          logInfo('Updating Node.js via Homebrew...');
          execCommand('brew upgrade node', { silent: false });
        } else {
          logInfo('Please update Node.js from: https://nodejs.org/');
          needsNodeInstall = true;
        }
      }
    } else {
      logSuccess(`Node.js ${nodeVersion} is installed`);
    }
  }
  
  // Check npm
  if (!commandExists('npm')) {
    missing.push('npm');
    logError('npm is not installed (usually comes with Node.js)');
    if (needsNodeInstall) {
      logInfo('npm will be installed with Node.js');
    }
  } else {
    const npmVersion = execCommand('npm --version', { silent: true }).output;
    logSuccess(`npm ${npmVersion} is installed`);
  }
  
  // Check PostgreSQL
  let needsPostgresInstall = false;
  if (!commandExists('psql')) {
    missing.push('PostgreSQL');
    logWarning('PostgreSQL is not installed or not in PATH');
    logInfo('PostgreSQL is required for the database');
    
    // Try to install PostgreSQL automatically
    if (process.platform === 'darwin' && commandExists('brew')) {
      const installPostgres = await askQuestion('Would you like to install PostgreSQL via Homebrew? (y/n) [y]:');
      if (installPostgres.toLowerCase() !== 'n') {
        logInfo('Installing PostgreSQL via Homebrew...');
        const installResult = execCommand('brew install postgresql@14', { silent: false });
        if (installResult.success) {
          logSuccess('PostgreSQL installed successfully!');
          logInfo('Starting PostgreSQL service...');
          execCommand('brew services start postgresql@14', { silent: false });
          logInfo('PostgreSQL is now running');
        } else {
          logWarning('Automatic installation failed. You can install manually:');
          logInfo('  brew install postgresql@14');
          logInfo('  brew services start postgresql@14');
          needsPostgresInstall = true;
        }
      } else {
        needsPostgresInstall = true;
      }
    } else if (commandExists('docker')) {
      logInfo('Docker detected. You can use PostgreSQL in Docker:');
      logInfo('  docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres --name invoiceme-db postgres:14');
      const useDocker = await askQuestion('Would you like to start PostgreSQL in Docker? (y/n) [y]:');
      if (useDocker.toLowerCase() !== 'n') {
        logInfo('Starting PostgreSQL in Docker...');
        execCommand('docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres --name invoiceme-db postgres:14', { silent: false });
        logInfo('Waiting for PostgreSQL to be ready...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        logSuccess('PostgreSQL is running in Docker');
      } else {
        needsPostgresInstall = true;
      }
    } else {
      needsPostgresInstall = true;
    }
    
    if (needsPostgresInstall) {
    logInfo('Mac: Install with: brew install postgresql@14');
    logInfo('Windows: Download from: https://www.postgresql.org/download/windows/');
      logInfo('Linux: sudo apt-get install postgresql postgresql-contrib');
    logInfo('Or use Docker: docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:14');
    }
  } else {
    logSuccess('PostgreSQL is installed');
  }
  
  // Open Node.js download page if needed
  if (needsNodeInstall) {
    logInfo('\nOpening Node.js download page...');
    if (process.platform === 'darwin') {
      execCommand('open https://nodejs.org/', { silent: true });
    } else if (process.platform === 'win32') {
      execCommand('start https://nodejs.org/', { silent: true });
    } else {
      execCommand('xdg-open https://nodejs.org/', { silent: true });
    }
    logInfo('Please install Node.js and run this script again.');
    return false;
  }
  
  if (missing.length > 0 && missing.includes('Node.js')) {
    return false;
  }
  
  // PostgreSQL is optional - we can continue without it and let user set it up
  if (missing.length > 0 && !missing.includes('Node.js')) {
    logWarning(`\nSome prerequisites are missing: ${missing.filter(m => m !== 'Node.js').join(', ')}`);
    logInfo('You can continue, but you\'ll need to set up the database manually.');
    const continueAnyway = await askQuestion('Continue anyway? (y/n) [y]:');
    if (continueAnyway.toLowerCase() === 'n') {
      return false;
    }
  }
  
  return true;
}

// Generate random secret
function generateSecret() {
  return crypto.randomBytes(32).toString('hex');
}

// Setup backend environment
async function setupBackendEnv() {
  logStep(2, 'Setting up backend environment...');
  logInfo('Configuring environment variables...');
  
  const backendDir = path.join(__dirname, 'backend');
  const envPath = path.join(backendDir, '.env');
  const envExamplePath = path.join(backendDir, '.env.example');
  
  // Check if .env already exists
  if (fs.existsSync(envPath)) {
    logSuccess('✓ Backend .env file already exists');
    logInfo('  Using existing configuration');
    
    // Read existing .env file to extract database config
    const envContent = fs.readFileSync(envPath, 'utf8');
    const dbHost = envContent.match(/DB_HOST=(.+)/)?.[1]?.trim() || 'localhost';
    const dbPort = envContent.match(/DB_PORT=(.+)/)?.[1]?.trim() || '5432';
    const dbUsername = envContent.match(/DB_USERNAME=(.+)/)?.[1]?.trim() || 'postgres';
    const dbPassword = envContent.match(/DB_PASSWORD=(.+)/)?.[1]?.trim() || 'postgres';
    const dbDatabase = envContent.match(/DB_DATABASE=(.+)/)?.[1]?.trim() || 'invoiceme';
    
    return { dbHost, dbPort, dbUsername, dbPassword, dbDatabase };
  }
  
  // Check if .env.example exists
  if (!fs.existsSync(envExamplePath)) {
    logError('.env.example file not found!');
    return false;
  }
  
  // Read .env.example
  let envContent = fs.readFileSync(envExamplePath, 'utf8');
  
  // Generate JWT secrets
  const jwtSecret = generateSecret();
  const jwtRefreshSecret = generateSecret();
  
  // Replace placeholder secrets
  envContent = envContent.replace(
    /JWT_SECRET=.*/,
    `JWT_SECRET=${jwtSecret}`
  );
  envContent = envContent.replace(
    /JWT_REFRESH_SECRET=.*/,
    `JWT_REFRESH_SECRET=${jwtRefreshSecret}`
  );
  
  // Ask for database configuration
  logInfo('Database Configuration:');
  const dbHost = await askQuestion('Database host [localhost]:') || 'localhost';
  const dbPort = await askQuestion('Database port [5432]:') || '5432';
  const dbUsername = await askQuestion('Database username [postgres]:') || 'postgres';
  const dbPassword = await askQuestion('Database password [postgres]:') || 'postgres';
  const dbDatabase = await askQuestion('Database name [invoiceme]:') || 'invoiceme';
  
  // Replace database configuration
  envContent = envContent.replace(/DB_HOST=.*/, `DB_HOST=${dbHost}`);
  envContent = envContent.replace(/DB_PORT=.*/, `DB_PORT=${dbPort}`);
  envContent = envContent.replace(/DB_USERNAME=.*/, `DB_USERNAME=${dbUsername}`);
  envContent = envContent.replace(/DB_PASSWORD=.*/, `DB_PASSWORD=${dbPassword}`);
  envContent = envContent.replace(/DB_DATABASE=.*/, `DB_DATABASE=${dbDatabase}`);
  
  // Write .env file
  fs.writeFileSync(envPath, envContent);
  logSuccess('✓ Backend .env file created');
  logInfo('  Generated secure JWT secrets automatically');
  
  return { dbHost, dbPort, dbUsername, dbPassword, dbDatabase };
}

// Setup frontend environment
function setupFrontendEnv() {
  logStep(3, 'Setting up frontend environment...');
  logInfo('Configuring frontend API connection...');
  
  const frontendDir = path.join(__dirname, 'frontend');
  const envPath = path.join(frontendDir, '.env');
  
  // Check if .env already exists
  if (fs.existsSync(envPath)) {
    logSuccess('✓ Frontend .env file already exists');
    return true;
  }
  
  const apiUrl = 'http://localhost:3000/api/v1';
  const envContent = `VITE_API_BASE_URL=${apiUrl}\n`;
  
  fs.writeFileSync(envPath, envContent);
  logSuccess('✓ Frontend .env file created');
  logInfo(`  API URL: ${apiUrl}`);
  
  return true;
}

// Create database if it doesn't exist
async function createDatabase(dbConfig) {
  logStep(4, 'Setting up database...');
  logInfo('Checking database connection...');
  
  const { dbHost, dbPort, dbUsername, dbPassword, dbDatabase } = dbConfig;
  
  // Set password as environment variable for psql
  process.env.PGPASSWORD = dbPassword;
  
  // Check if database exists - try using psql to list databases
  let dbExists = false;
  
  if (commandExists('psql')) {
    try {
      // Try to connect and check if database exists
      const checkCommand = process.platform === 'win32'
        ? `psql -h ${dbHost} -p ${dbPort} -U ${dbUsername} -lqt 2>nul`
        : `psql -h ${dbHost} -p ${dbPort} -U ${dbUsername} -lqt 2>/dev/null`;
      
      const result = execSync(checkCommand, { 
        encoding: 'utf8',
        env: { ...process.env, PGPASSWORD: dbPassword },
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      dbExists = result.includes(dbDatabase);
    } catch (error) {
      // Database check failed, will try to create
      dbExists = false;
    }
  }
  
  if (dbExists) {
    logSuccess(`Database '${dbDatabase}' already exists`);
    return true;
  }
  
  // Try to create database
  logInfo(`Creating database '${dbDatabase}'...`);
  
  if (commandExists('createdb')) {
    const createDbCommand = `createdb -h ${dbHost} -p ${dbPort} -U ${dbUsername} ${dbDatabase}`;
    const result = execCommand(createDbCommand, { 
      silent: true,
      env: { ...process.env, PGPASSWORD: dbPassword }
    });
    
    if (result.success) {
      logSuccess(`Database '${dbDatabase}' created successfully`);
      return true;
    }
  }
  
  // Fallback: Try using psql
  if (commandExists('psql')) {
    const createDbCommand = `psql -h ${dbHost} -p ${dbPort} -U ${dbUsername} -c "CREATE DATABASE ${dbDatabase};"`;
    const result = execCommand(createDbCommand, { 
      silent: true,
      env: { ...process.env, PGPASSWORD: dbPassword }
    });
    
    if (result.success) {
      logSuccess(`Database '${dbDatabase}' created successfully`);
      return true;
    }
  }
  
  logWarning(`Could not create database automatically.`);
  logInfo('You may need to create it manually:');
  if (commandExists('createdb')) {
    logInfo(`  createdb -h ${dbHost} -p ${dbPort} -U ${dbUsername} ${dbDatabase}`);
  }
  logInfo(`  psql -h ${dbHost} -p ${dbPort} -U ${dbUsername} -c "CREATE DATABASE ${dbDatabase};"`);
  
  const createManually = await askQuestion('Continue anyway? (y/n):');
  return createManually.toLowerCase() === 'y';
}

// Install dependencies
function installDependencies() {
  logStep(5, 'Installing dependencies...');
  logInfo('This may take a few minutes on first run...');
  
  // Install backend dependencies
  logInfo('📦 Installing backend dependencies...');
  const backendDir = path.join(__dirname, 'backend');
  const backendNodeModules = path.join(backendDir, 'node_modules');
  const backendPackageLock = path.join(backendDir, 'package-lock.json');
  
  // Check if we need to install (no node_modules or package.json changed)
  const needsBackendInstall = !fs.existsSync(backendNodeModules) || 
    (fs.existsSync(backendPackageLock) && 
     fs.statSync(backendPackageLock).mtime > (fs.existsSync(backendNodeModules) ? fs.statSync(backendNodeModules).mtime : new Date(0)));
  
  if (needsBackendInstall) {
    logInfo('Running npm install in backend...');
    const result = execCommand('npm install', { cwd: backendDir });
    if (!result.success) {
      logError('Failed to install backend dependencies');
      logInfo('Trying to fix npm cache...');
      execCommand('npm cache clean --force', { cwd: backendDir, silent: true });
      const retryResult = execCommand('npm install', { cwd: backendDir });
      if (!retryResult.success) {
      return false;
      }
    }
    logSuccess('Backend dependencies installed');
  } else {
    logSuccess('Backend dependencies already installed');
  }
  
  // Install frontend dependencies
  logInfo('📦 Installing frontend dependencies...');
  const frontendDir = path.join(__dirname, 'frontend');
  const frontendNodeModules = path.join(frontendDir, 'node_modules');
  const frontendPackageLock = path.join(frontendDir, 'package-lock.json');
  
  // Check if we need to install
  const needsFrontendInstall = !fs.existsSync(frontendNodeModules) || 
    (fs.existsSync(frontendPackageLock) && 
     fs.statSync(frontendPackageLock).mtime > (fs.existsSync(frontendNodeModules) ? fs.statSync(frontendNodeModules).mtime : new Date(0)));
  
  if (needsFrontendInstall) {
    logInfo('Running npm install in frontend...');
    const result = execCommand('npm install', { cwd: frontendDir });
    if (!result.success) {
      logError('Failed to install frontend dependencies');
      logInfo('Trying to fix npm cache...');
      execCommand('npm cache clean --force', { cwd: frontendDir, silent: true });
      const retryResult = execCommand('npm install', { cwd: frontendDir });
      if (!retryResult.success) {
      return false;
      }
    }
    logSuccess('Frontend dependencies installed');
  } else {
    logSuccess('Frontend dependencies already installed');
  }
  
  return true;
}

// Run database migrations
function runMigrations() {
  logStep(6, 'Running database migrations...');
  logInfo('Setting up database schema...');
  
  const backendDir = path.join(__dirname, 'backend');
  const result = execCommand('npm run migration:run', { cwd: backendDir });
  
  if (result.success) {
    logSuccess('✓ Database migrations completed');
    logInfo('  All tables and indexes created');
    return true;
  } else {
    logError('✗ Failed to run migrations');
    logInfo('');
    logInfo('Troubleshooting:');
    logInfo('  1. Make sure PostgreSQL is running');
    logInfo('  2. Verify database credentials in backend/.env');
    logInfo('  3. Check database connection: psql -h localhost -U postgres');
    return false;
  }
}

// Skip database seeding (removed prompt for faster startup)
async function skipSeeding() {
  logStep(7, 'Database setup complete');
  logSuccess('✓ Database is ready');
  logInfo('💡 Tip: To add demo data later, run: cd backend && npm run seed');
  return true;
}

// Start application
async function startApplication() {
  logStep(8, 'Starting application...');
  logInfo('');
  logInfo('🚀 Launching InvoiceMe...');
  logInfo('   Backend and frontend will run in this terminal');
  logInfo('   Press Ctrl+C to stop both servers');
  logInfo('');
  
  const backendDir = path.join(__dirname, 'backend');
  const frontendDir = path.join(__dirname, 'frontend');
  
  // Check if backend dependencies are installed
  const backendNodeModules = path.join(backendDir, 'node_modules');
  if (!fs.existsSync(backendNodeModules)) {
    logError('Backend dependencies not installed!');
    logInfo('Please run: cd backend && npm install');
    return false;
  }
  
  // Start backend
  logInfo('Starting backend server on http://localhost:3000...');
  // Kill any existing backend processes to prevent port conflicts
  logInfo('Checking for existing backend processes...');
  try {
    const checkPort = execSync('lsof -ti:3000 2>/dev/null || echo ""', { encoding: 'utf8' }).trim();
    if (checkPort) {
      logWarning(`Found existing process on port 3000 (PID: ${checkPort}). Killing it...`);
      execSync(`kill -9 ${checkPort} 2>/dev/null || true`, { stdio: 'ignore' });
      await new Promise(resolve => setTimeout(resolve, 1000));
      logSuccess('Cleared port 3000');
    }
  } catch (error) {
    // Ignore errors - port might not be in use
  }
  
  // Kill any existing nest watch processes
  try {
    const nestProcesses = execSync('pgrep -f "nest start --watch" 2>/dev/null || echo ""', { encoding: 'utf8' }).trim();
    if (nestProcesses) {
      logWarning('Found existing NestJS watch processes. Killing them...');
      execSync(`pkill -f "nest start --watch" 2>/dev/null || true`, { stdio: 'ignore' });
      await new Promise(resolve => setTimeout(resolve, 1000));
      logSuccess('Cleared existing watch processes');
    }
  } catch (error) {
    // Ignore errors
  }

  const backendProcess = spawn('npm', ['run', 'start:dev'], {
    cwd: backendDir,
    stdio: 'pipe',
    shell: true,
    detached: false,
    env: { ...process.env, FORCE_COLOR: '1' }
  });
  
  // Set up backend output handlers immediately
  backendProcess.stdout.on('data', (data) => {
    const lines = data.toString().split('\n').filter(line => line.trim());
    lines.forEach(line => {
      if (line.trim()) {
        process.stdout.write(`${colors.blue}[BACKEND]${colors.reset} ${line}\n`);
      }
    });
  });
  
  backendProcess.stderr.on('data', (data) => {
    const lines = data.toString().split('\n').filter(line => line.trim());
    lines.forEach(line => {
      if (line.trim()) {
        process.stderr.write(`${colors.red}[BACKEND ERROR]${colors.reset} ${line}\n`);
      }
    });
  });
  
  // Check if backend process started successfully
  backendProcess.on('error', (error) => {
    logError(`Failed to start backend: ${error.message}`);
    logInfo('Make sure backend dependencies are installed: cd backend && npm install');
  });
  
  // Wait for backend to start and check if it's ready
  logInfo('Waiting for backend to initialize...');
  let backendReady = false;
  for (let i = 0; i < 20; i++) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    try {
      const checkBackend = () => {
        return new Promise((resolve) => {
          const req = http.get('http://localhost:3000/api/v1/health', { timeout: 1000 }, (res) => {
            resolve(res.statusCode === 200);
          });
          req.on('error', () => resolve(false));
          req.on('timeout', () => {
            req.destroy();
            resolve(false);
          });
        });
      };
      if (await checkBackend()) {
        backendReady = true;
        logSuccess('Backend is ready!');
        break;
      }
    } catch (e) {
      // Continue waiting
    }
    if (i === 9) {
      logWarning('Backend is taking longer than expected...');
    }
  }
  
  if (!backendReady) {
    logWarning('Backend may not be fully ready, but continuing...');
  }
  
  // Check if frontend dependencies are installed and vite is available
  const frontendNodeModules = path.join(frontendDir, 'node_modules');
  const vitePath = path.join(frontendNodeModules, '.bin', 'vite');
  const vitePathWin = path.join(frontendNodeModules, '.bin', 'vite.cmd');
  const vitePackage = path.join(frontendNodeModules, 'vite');
  
  if (!fs.existsSync(frontendNodeModules) || 
      (!fs.existsSync(vitePath) && !fs.existsSync(vitePathWin) && !fs.existsSync(vitePackage))) {
    logWarning('Frontend dependencies not found or incomplete. Installing...');
    logInfo('This may take a few minutes...');
    const installResult = execCommand('npm install', { cwd: frontendDir });
    if (!installResult.success) {
      logError('Failed to install frontend dependencies');
      logInfo('Please run manually: cd frontend && npm install');
      logInfo('Then restart this script.');
      return false;
    }
    logSuccess('Frontend dependencies installed');
    
    // Wait a moment for file system to sync
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Verify vite is now available
    const viteExists = fs.existsSync(path.join(frontendDir, 'node_modules', '.bin', 'vite')) || 
                       fs.existsSync(path.join(frontendDir, 'node_modules', '.bin', 'vite.cmd')) ||
                       fs.existsSync(path.join(frontendDir, 'node_modules', 'vite'));
    if (!viteExists) {
      logError('Vite is still not available after installation');
      logInfo('Try running manually: cd frontend && npm install');
      logInfo('Make sure you have internet connection and npm is working.');
      return false;
    }
  } else {
    logSuccess('Frontend dependencies verified');
  }
  
  // Check if port 5173 is already in use
  try {
    const testServer = http.createServer();
    await new Promise((resolve, reject) => {
      testServer.listen(5173, () => {
        testServer.close(() => resolve());
      });
      testServer.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          logWarning('Port 5173 is already in use. Trying to kill existing process...');
          try {
            if (process.platform === 'darwin' || process.platform === 'linux') {
              execSync('lsof -ti:5173 | xargs kill -9 2>/dev/null || true', { stdio: 'ignore' });
              logInfo('Killed process on port 5173. Waiting 2 seconds...');
              setTimeout(() => resolve(), 2000);
            } else {
              logWarning('Please manually close the application using port 5173');
              reject(err);
            }
          } catch (e) {
            reject(err);
          }
        } else {
          reject(err);
        }
      });
    });
  } catch (error) {
    logWarning('Could not check/free port 5173. Continuing anyway...');
  }
  
  // Start frontend - use direct path to vite binary via node
  logInfo('Starting frontend server on http://localhost:5173...');
  
  // Verify vite one more time before starting
  const viteBinPath = path.join(frontendDir, 'node_modules', '.bin', 'vite');
  const viteBinPathWin = path.join(frontendDir, 'node_modules', '.bin', 'vite.cmd');
  const hasVite = fs.existsSync(viteBinPath) || fs.existsSync(viteBinPathWin);
  
  if (!hasVite) {
    logError('Vite binary not found even after dependency check!');
    logInfo('Installing frontend dependencies now...');
    const installResult = execCommand('npm install', { cwd: frontendDir });
    if (!installResult.success) {
      logError('Failed to install frontend dependencies');
      logInfo('Please run manually: cd frontend && npm install');
      return false;
    }
    logSuccess('Frontend dependencies installed. Waiting for file system...');
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // Use the full path to vite binary directly via node to ensure it works
  // This bypasses PATH issues with npm/npx
  
  // Determine which command to use based on platform
  let viteCommand;
  let viteArgs;
  
  if (process.platform === 'win32') {
    // Windows: use vite.cmd if it exists, otherwise use node with vite.js
    if (fs.existsSync(viteBinPathWin)) {
      viteCommand = viteBinPathWin;
      viteArgs = [];
    } else {
      viteCommand = 'node';
      viteArgs = [path.join(frontendDir, 'node_modules', 'vite', 'bin', 'vite.js')];
    }
  } else {
    // Unix/Mac: use node to execute the vite binary script
    if (fs.existsSync(viteBinPath)) {
      viteCommand = 'node';
      viteArgs = [viteBinPath];
    } else {
      // Fallback: try node_modules/vite/bin/vite.js
      viteCommand = 'node';
      viteArgs = [path.join(frontendDir, 'node_modules', 'vite', 'bin', 'vite.js')];
    }
  }
  
  logInfo(`Starting frontend with: ${viteCommand} ${viteArgs.join(' ')}`);
  
  const frontendProcess = spawn(viteCommand, viteArgs, {
    cwd: frontendDir,
    stdio: 'pipe',
    shell: false, // Don't use shell to avoid PATH issues
    detached: false,
    env: { 
      ...process.env, 
      FORCE_COLOR: '1',
      PATH: `${path.join(frontendDir, 'node_modules', '.bin')}:${process.env.PATH}`
    }
  });
  
  // Set up output handlers BEFORE waiting
  let frontendOutput = '';
  let frontendExited = false;
  let frontendExitCode = null;
  
  frontendProcess.stdout.on('data', (data) => {
    const output = data.toString();
    frontendOutput += output;
    const lines = output.split('\n').filter(line => line.trim());
    lines.forEach(line => {
      if (line.trim()) {
        process.stdout.write(`${colors.cyan}[FRONTEND]${colors.reset} ${line}\n`);
      }
    });
  });
  
  frontendProcess.stderr.on('data', (data) => {
    const output = data.toString();
    frontendOutput += output;
    const lines = output.split('\n').filter(line => line.trim());
    lines.forEach(line => {
      if (line.trim()) {
        process.stderr.write(`${colors.red}[FRONTEND ERROR]${colors.reset} ${line}\n`);
      }
    });
  });
  
  // Check if frontend process started successfully
  frontendProcess.on('error', (error) => {
    logError(`Failed to start frontend: ${error.message}`);
    logInfo('Make sure frontend dependencies are installed: cd frontend && npm install');
    frontendExited = true;
  });
  
  // Track when frontend exits
  frontendProcess.on('exit', (code, signal) => {
    frontendExited = true;
    frontendExitCode = code;
    if (code !== 0 && code !== null) {
      logError(`Frontend process exited with code ${code}${signal ? ` (signal: ${signal})` : ''}`);
      if (code === 127) {
        logError('Vite command not found! This usually means:');
        logInfo('  1. Frontend dependencies are not installed');
        logInfo('  2. Vite is missing from package.json devDependencies');
        logInfo('  3. node_modules is corrupted');
        logInfo('');
        logInfo('Fix: cd frontend && npm install');
        logInfo('Or: cd frontend && npm install --save-dev vite @vitejs/plugin-react-swc');
      }
    }
  });
  
  // Wait for frontend to start and check if it's ready
  logInfo('Waiting for frontend to initialize...');
  let frontendReady = false;
  for (let i = 0; i < 20; i++) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Check if process is still running
    if (frontendProcess.killed) {
      logError('Frontend process was killed!');
      logInfo('Check the [FRONTEND ERROR] messages above for details.');
      break;
    }
    
    // Check if process exited with error (exitCode 0 is success, null means still running)
    if (frontendProcess.exitCode !== null && frontendProcess.exitCode !== 0) {
      logError(`Frontend process exited with code ${frontendProcess.exitCode}`);
      logInfo('Check the [FRONTEND ERROR] messages above for details.');
      logInfo('Common issues:');
      logInfo('  - Missing dependencies: cd frontend && npm install');
      logInfo('  - Port conflict: lsof -ti:5173 | xargs kill');
      logInfo('  - Build errors: Check [FRONTEND ERROR] output');
      break;
    }
    
    // Check if Vite is ready by looking for "Local:" in output or checking HTTP
    if (frontendOutput.includes('Local:') || frontendOutput.includes('ready in')) {
      // Give it a moment more to fully start
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    try {
      const checkFrontend = () => {
        return new Promise((resolve) => {
          const req = http.get('http://localhost:5173', { timeout: 1000 }, (res) => {
            resolve(res.statusCode === 200 || res.statusCode === 304);
          });
          req.on('error', () => resolve(false));
          req.on('timeout', () => {
            req.destroy();
            resolve(false);
          });
        });
      };
      if (await checkFrontend()) {
        frontendReady = true;
        logSuccess('Frontend is ready!');
        break;
      }
    } catch (e) {
      // Continue waiting
    }
    if (i === 9) {
      logWarning('Frontend is taking longer than expected...');
      logInfo('Check [FRONTEND] output above for status');
    }
  }
  
  if (!frontendReady) {
    if (frontendExited && frontendExitCode !== 0) {
      logError('\n❌ Frontend failed to start!');
      logInfo('Backend is running on http://localhost:3000');
      logInfo('Frontend is NOT running - check errors above');
      logInfo('');
      logInfo('To fix: cd frontend && npm install --save-dev vite @vitejs/plugin-react-swc');
    } else {
      logWarning('Frontend may not be fully ready yet.');
      logInfo('Check the [FRONTEND] output above for any errors.');
      logInfo('You can manually open http://localhost:5173 when it\'s ready.');
    }
  }
  
  // Enhanced status display
  log('\n' + '='.repeat(60), 'bright');
  if (frontendReady) {
    logSuccess('✅ Application is running!');
    logInfo('');
    logInfo('📍 Access your application:');
    logInfo('   Frontend: http://localhost:5173');
    logInfo('   Backend API: http://localhost:3000/api/v1');
    logInfo('');
    logInfo('💡 Tips:');
    logInfo('   • The browser will open automatically');
    logInfo('   • Both servers support hot-reload');
    logInfo('   • Press Ctrl+C to stop both servers');
  } else if (!frontendExited || frontendExitCode === 0) {
    logWarning('⚠️  Application is starting...');
    logInfo('');
    logInfo('📍 Access your application:');
    logInfo('   Frontend: http://localhost:5173 (starting...)');
    logInfo('   Backend API: http://localhost:3000/api/v1 ✅');
    logInfo('');
    logInfo('💡 Frontend may take 10-20 seconds to fully start');
  } else {
    logError('❌ Frontend failed to start');
    logInfo('');
    logInfo('📍 Status:');
    logInfo('   Backend: http://localhost:3000 ✅');
    logInfo('   Frontend: NOT RUNNING ❌');
    logInfo('');
    logInfo('🔧 Troubleshooting:');
    logInfo('   1. Check [FRONTEND ERROR] messages above');
    logInfo('   2. Try: cd frontend && npm install');
    logInfo('   3. Check port 5173: lsof -ti:5173');
  }
  log('='.repeat(60) + '\n', 'bright');
  
  // Always try to open browser (frontend might be ready even if check failed)
  logInfo('Opening browser...');
  const openCommand = process.platform === 'darwin' 
    ? 'open' 
    : process.platform === 'win32' 
      ? 'start' 
      : 'xdg-open';
  
  // Wait a bit more before opening browser to give frontend time
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Try to open browser
  try {
    const browserResult = execCommand(`${openCommand} http://localhost:5173`, { silent: true });
    if (browserResult.success || process.platform === 'darwin') {
      // On Mac, 'open' command doesn't return error codes properly, so assume success
      if (frontendReady) {
        logSuccess('Browser opened! 🎉 Frontend is ready.');
      } else {
        logWarning('Browser opened, but frontend may still be starting...');
        logInfo('If the page doesn\'t load, wait 10-20 seconds and refresh (Cmd+R or F5).');
        logInfo('Check [FRONTEND] output above for status.');
      }
    } else {
      logWarning('Could not open browser automatically.');
      logInfo('Please manually open: http://localhost:5173');
    }
  } catch (error) {
    logWarning('Could not open browser automatically.');
    logInfo('Please manually open: http://localhost:5173');
  }
  
  // Backend and frontend output handlers are already set up above
  
  // Handle process termination
  const cleanup = () => {
    logInfo('\n\nStopping servers...');
    backendProcess.kill('SIGTERM');
    frontendProcess.kill('SIGTERM');
    
    // Give processes a moment to clean up
    setTimeout(() => {
      backendProcess.kill('SIGKILL');
      frontendProcess.kill('SIGKILL');
      process.exit(0);
    }, 2000);
  };
  
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  
  // Handle process exits
  backendProcess.on('exit', (code, signal) => {
    if (code !== 0 && code !== null) {
      logError(`Backend process exited with code ${code}${signal ? ` (signal: ${signal})` : ''}`);
      logInfo('Check [BACKEND ERROR] messages above for details.');
    } else if (code === 0) {
      logWarning('Backend process exited normally (this is unexpected in dev mode)');
    }
  });
  
  frontendProcess.on('exit', (code, signal) => {
    if (code !== 0 && code !== null) {
      logError(`Frontend process exited with code ${code}${signal ? ` (signal: ${signal})` : ''}`);
      logInfo('Check [FRONTEND ERROR] messages above for details.');
      logInfo('Common fixes:');
      logInfo('  - cd frontend && npm install');
      logInfo('  - Check for port conflicts: lsof -i :5173');
    } else if (code === 0) {
      logWarning('Frontend process exited normally (this is unexpected in dev mode)');
    }
  });
  
  // Status already displayed above
  
  // Keep the script running - wait for both processes
  return new Promise(() => {
    // Never resolves, keeps script alive until Ctrl+C
  });
}

// Main function
async function main() {
  log('\n' + '='.repeat(60), 'bright');
  log('InvoiceMe - First-Time Startup Script', 'bright');
  log('='.repeat(60) + '\n', 'bright');
  
  try {
    // Check prerequisites
    if (!(await checkPrerequisites())) {
      process.exit(1);
    }
    
    // Setup environment files
    const dbConfig = await setupBackendEnv();
    if (!dbConfig || typeof dbConfig === 'boolean') {
      logError('Failed to get database configuration');
      process.exit(1);
    }
    
    setupFrontendEnv();
    
    // Create database
    if (!(await createDatabase(dbConfig))) {
      process.exit(1);
    }
    
    // Install dependencies
    if (!installDependencies()) {
      process.exit(1);
    }
    
    // Run migrations
    if (!runMigrations()) {
      process.exit(1);
    }
    
    // Skip seeding (removed prompt for faster startup)
    await skipSeeding();
    
    // Show startup summary
    log('\n' + '='.repeat(60), 'bright');
    log('✅ Setup Complete!', 'green');
    log('='.repeat(60), 'bright');
    logInfo('');
    logInfo('📋 Summary:');
    logSuccess('  ✓ Prerequisites checked');
    logSuccess('  ✓ Environment files configured');
    logSuccess('  ✓ Dependencies installed');
    logSuccess('  ✓ Database created and migrated');
    logInfo('');
    logInfo('🚀 Ready to start the application!');
    logInfo('');
    
    // Start application
    await startApplication();
    
  } catch (error) {
    logError(`\n❌ Unexpected error: ${error.message}`);
    logInfo('');
    logInfo('Please check the error messages above and try again.');
    logInfo('For help, see: README.md or FIRST_TIME_STARTUP.md');
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Run main function
main();

