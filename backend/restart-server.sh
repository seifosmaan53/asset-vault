#!/bin/bash

echo "🛑 Stopping any running NestJS processes..."
pkill -f "nest start" || true
pkill -f "node.*dist/main" || true
sleep 2

echo "🧹 Cleaning dist folder..."
rm -rf dist

echo "🔨 Building project..."
npm run build

echo "✅ Build complete! Now start your server with: npm run start:dev"
echo ""
echo "Or run this script with --start flag to start automatically"

if [ "$1" == "--start" ]; then
  echo "🚀 Starting server..."
  npm run start:dev
fi

