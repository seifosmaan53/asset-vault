#!/usr/bin/env node
// Copyright (c) 2024 InvoiceMe
// Utility script to free a port by killing the process using it

const { execSync } = require('child_process');
const port = process.argv[2] || '3000';

console.log(`🔍 Checking port ${port}...`);

try {
  // Find process using the port
  const result = execSync(`lsof -ti :${port}`, { encoding: 'utf-8', stdio: 'pipe' }).trim();
  
  if (result) {
    const pids = result.split('\n').filter(Boolean);
    console.log(`⚠️  Found ${pids.length} process(es) using port ${port}: ${pids.join(', ')}`);
    
    // Kill the process(es)
    pids.forEach(pid => {
      try {
        execSync(`kill -9 ${pid}`, { stdio: 'pipe' });
        console.log(`✅ Killed process ${pid}`);
      } catch (error) {
        console.log(`⚠️  Could not kill process ${pid} (may have already exited)`);
      }
    });
    
    console.log(`✅ Port ${port} is now free`);
  } else {
    console.log(`✅ Port ${port} is already free`);
  }
} catch (error) {
  // lsof returns non-zero exit code when no process is found
  if (error.status === 1) {
    console.log(`✅ Port ${port} is already free`);
  } else {
    console.error(`❌ Error checking port: ${error.message}`);
    process.exit(1);
  }
}

