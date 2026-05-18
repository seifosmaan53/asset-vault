#!/bin/bash
# Script to migrate Grid to Grid2 in all files

# Find all files with Grid usage
files=$(find src -name "*.tsx" -o -name "*.ts" | xargs grep -l "Grid item\|Grid container" 2>/dev/null)

for file in $files; do
  echo "Migrating $file..."
  
  # Replace Grid import with Grid2
  sed -i '' "s/import Grid from '@mui\/material';/import Grid2 from '@mui\/material\/Grid2';/g" "$file"
  sed -i '' "s/import { Grid } from '@mui\/material';/import Grid2 from '@mui\/material\/Grid2';/g" "$file"
  sed -i '' "s/import Grid from '..\/..\/components\/common\/Grid';/import Grid2 from '@mui\/material\/Grid2';/g" "$file"
  
  # Replace Grid container with Grid2 container
  sed -i '' "s/<Grid container/<Grid2 container/g" "$file"
  
  # Replace Grid item with Grid2 (remove item prop)
  sed -i '' "s/<Grid item xs=\([^>]*\)>/<Grid2 xs=\1>/g" "$file"
  sed -i '' "s/<Grid item xs=\([^>]*\) md=\([^>]*\)>/<Grid2 xs=\1 md=\2>/g" "$file"
  sed -i '' "s/<Grid item xs=\([^>]*\) sm=\([^>]*\) md=\([^>]*\)>/<Grid2 xs=\1 sm=\2 md=\3>/g" "$file"
  
  # Replace closing tags
  sed -i '' "s/<\/Grid>/<\/Grid2>/g" "$file"
  
  echo "Done: $file"
done

echo "Migration complete!"

