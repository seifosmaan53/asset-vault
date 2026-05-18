#!/usr/bin/env node
/**
 * Pre-commit hook script to check for common import issues
 * Prevents Grid/Grid2 mismatches and missing imports
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const errors = [];

// Check for Grid imports (should use Grid2)
function checkGridImports(filePath, content) {
  const lines = content.split('\n');
  lines.forEach((line, index) => {
    // Check for Grid import from @mui/material
    if (line.includes("from '@mui/material'") || line.includes('from "@mui/material"')) {
      const prevLines = lines.slice(Math.max(0, index - 5), index + 1).join('\n');
      if (prevLines.includes('Grid,') && !prevLines.includes('Grid2')) {
        errors.push({
          file: filePath,
          line: index + 1,
          message: 'Grid imported but Grid2 should be used. Use: import { Grid2 } from "@mui/material";',
        });
      }
    }
    
    // Check for Grid2 from wrong path
    if (line.includes("from '@mui/material/Grid2'") || line.includes('from "@mui/material/Grid2"')) {
      errors.push({
        file: filePath,
        line: index + 1,
        message: 'Grid2 imported from wrong path. Use: import { Grid2 } from "@mui/material";',
      });
    }
    
    // Check for Grid usage in JSX
    if (line.includes('<Grid ') || line.includes('<Grid size') || line.includes('<Grid item')) {
      errors.push({
        file: filePath,
        line: index + 1,
        message: 'Grid component used. Replace with Grid2: <Grid2 size={...}>',
      });
    }
  });
}

// Check for getErrorMessage usage without import
function checkGetErrorMessage(filePath, content) {
  if (content.includes('getErrorMessage(') && !content.includes("import { getErrorMessage }")) {
    const lines = content.split('\n');
    const usageLine = lines.findIndex(line => line.includes('getErrorMessage('));
    if (usageLine !== -1) {
      errors.push({
        file: filePath,
        line: usageLine + 1,
        message: 'getErrorMessage used but not imported. Add: import { getErrorMessage } from "../../utils/errorHandling";',
      });
    }
  }
}

// Walk directory and check files
function walkDir(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      // Skip node_modules and dist
      if (file !== 'node_modules' && file !== 'dist' && file !== '.git') {
        walkDir(filePath, fileList);
      }
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      fileList.push(filePath);
    }
  });
  return fileList;
}

// Main check
console.log('🔍 Checking for common import issues...\n');

const srcDir = path.join(__dirname, '../src');
const files = walkDir(srcDir);

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const relativePath = path.relative(process.cwd(), file);
  
  checkGridImports(relativePath, content);
  checkGetErrorMessage(relativePath, content);
});

if (errors.length > 0) {
  console.error('❌ Found import issues:\n');
  errors.forEach(error => {
    console.error(`  ${error.file}:${error.line}`);
    console.error(`    ${error.message}\n`);
  });
  process.exit(1);
} else {
  console.log('✅ No import issues found!\n');
  process.exit(0);
}

