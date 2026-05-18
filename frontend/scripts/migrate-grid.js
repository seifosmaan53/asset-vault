#!/usr/bin/env node
/**
 * Migrate Grid to Grid2 in all TypeScript/TSX files
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Find all files with Grid usage
const files = execSync(
  'find src -name "*.tsx" -o -name "*.ts" | xargs grep -l "Grid item\\|Grid container" 2>/dev/null || true',
  { encoding: 'utf-8', cwd: __dirname + '/..' }
)
  .trim()
  .split('\n')
  .filter(Boolean);

console.log(`Found ${files.length} files to migrate`);

files.forEach((file) => {
  const filePath = path.join(__dirname, '..', file);
  if (!fs.existsSync(filePath)) {
    console.log(`Skipping ${file} (not found)`);
    return;
  }

  let content = fs.readFileSync(filePath, 'utf-8');
  let changed = false;

  // Replace Grid imports
  if (content.includes("import Grid from '@mui/material'") || content.includes("import { Grid } from '@mui/material'")) {
    // Check if Grid2 is already imported
    if (!content.includes("import Grid2 from '@mui/material/Grid2'")) {
      content = content.replace(
        /import\s+{\s*Grid\s*}\s+from\s+['"]@mui\/material['"]/g,
        "import Grid2 from '@mui/material/Grid2'"
      );
      content = content.replace(
        /import\s+Grid\s+from\s+['"]@mui\/material['"]/g,
        "import Grid2 from '@mui/material/Grid2'"
      );
      // Remove Grid from existing imports
      content = content.replace(/,\s*Grid\s*,/g, ',');
      content = content.replace(/,\s*Grid\s*}/g, '}');
      content = content.replace(/{\s*Grid\s*,/g, '{');
      changed = true;
    }
  }

  // Replace custom Grid import
  if (content.includes("import Grid from '../../components/common/Grid'") || 
      content.includes("import Grid from '../components/common/Grid'") ||
      content.includes("import Grid from './components/common/Grid'")) {
    if (!content.includes("import Grid2 from '@mui/material/Grid2'")) {
      content = content.replace(
        /import\s+Grid\s+from\s+['"].*components\/common\/Grid['"]/g,
        "import Grid2 from '@mui/material/Grid2'"
      );
      changed = true;
    }
  }

  // Replace Grid container
  content = content.replace(/<Grid\s+container/g, '<Grid2 container');
  if (content.includes('<Grid2 container')) changed = true;

  // Replace Grid item with Grid2 (remove item prop)
  content = content.replace(/<Grid\s+item\s+xs=([^>]+)>/g, '<Grid2 xs=$1>');
  if (content.match(/<Grid\s+item/)) changed = true;

  // Replace closing tags
  content = content.replace(/<\/Grid>/g, '</Grid2>');
  if (content.includes('</Grid2>')) changed = true;

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`✓ Migrated ${file}`);
  } else {
    console.log(`- Skipped ${file} (no changes needed)`);
  }
});

console.log('\nMigration complete!');

