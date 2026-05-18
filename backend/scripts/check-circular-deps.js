#!/usr/bin/env node
// Copyright (c) 2024 InvoiceMe
// Circular dependency detection script

const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '../src');
const visited = new Set();
const visiting = new Set();
const cycles = [];

function findImports(filePath, content) {
  const imports = [];
  const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
  const requireRegex = /require\s*\(['"]([^'"]+)['"]\)/g;
  
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }
  while ((match = requireRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }
  
  return imports;
}

function resolveImport(importPath, fromFile) {
  if (importPath.startsWith('.')) {
    const dir = path.dirname(fromFile);
    let resolved = path.resolve(dir, importPath);
    
    // Try .ts extension
    if (!resolved.endsWith('.ts') && !resolved.endsWith('.tsx')) {
      if (fs.existsSync(resolved + '.ts')) {
        resolved += '.ts';
      } else if (fs.existsSync(resolved + '/index.ts')) {
        resolved = path.join(resolved, 'index.ts');
      }
    }
    
    return resolved;
  }
  return null; // External dependency
}

function checkFile(filePath, stack = []) {
  if (visiting.has(filePath)) {
    const cycleStart = stack.indexOf(filePath);
    if (cycleStart !== -1) {
      cycles.push([...stack.slice(cycleStart), filePath]);
    }
    return;
  }
  
  if (visited.has(filePath)) {
    return;
  }
  
  if (!fs.existsSync(filePath)) {
    return;
  }
  
  visiting.add(filePath);
  stack.push(filePath);
  
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const imports = findImports(filePath, content);
    
    for (const imp of imports) {
      const resolved = resolveImport(imp, filePath);
      if (resolved && resolved.startsWith(srcDir)) {
        checkFile(resolved, [...stack]);
      }
    }
  } catch (error) {
    // Skip files that can't be read
  }
  
  visiting.delete(filePath);
  visited.add(filePath);
}

function findAllTsFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory() && !filePath.includes('node_modules')) {
      findAllTsFiles(filePath, fileList);
    } else if (file.endsWith('.ts') && !file.endsWith('.spec.ts')) {
      fileList.push(filePath);
    }
  }
  
  return fileList;
}

// Main execution
console.log('Checking for circular dependencies...\n');

const allFiles = findAllTsFiles(srcDir);

for (const file of allFiles) {
  if (!visited.has(file)) {
    checkFile(file);
  }
}

if (cycles.length > 0) {
  console.error('❌ Circular dependencies found:\n');
  cycles.forEach((cycle, index) => {
    console.error(`Cycle ${index + 1}:`);
    cycle.forEach((file, i) => {
      const relative = path.relative(srcDir, file);
      console.error(`  ${i + 1}. ${relative}`);
    });
    console.error('');
  });
  process.exit(1);
} else {
  console.log('✅ No circular dependencies found!');
  process.exit(0);
}

