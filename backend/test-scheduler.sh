#!/bin/bash

# Recurring Invoice Scheduler Test Script
# This script helps test the recurring invoice scheduler end-to-end

echo "=== Recurring Invoice Scheduler Test ==="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Step 1: Ensure backend is running${NC}"
echo "Make sure you have:"
echo "  1. Run: npm run migration:run"
echo "  2. Run: npm run seed"
echo "  3. Run: npm run start:dev"
echo ""
read -p "Press Enter when backend is running..."

echo ""
echo -e "${YELLOW}Step 2: Testing Manual Trigger${NC}"
echo "Calling POST /api/v1/recurring-invoices/trigger-generation"
echo ""

# Get auth token first (you'll need to login and get a token)
echo "Note: You need to be authenticated. Get a token from:"
echo "  POST /api/v1/auth/login"
echo "  Body: { \"email\": \"demo@example.com\", \"password\": \"password123\" }"
echo ""
read -p "Enter your JWT token (or press Enter to skip authenticated test): " TOKEN

if [ -n "$TOKEN" ]; then
  echo ""
  echo "Triggering scheduler..."
  curl -X POST http://localhost:3000/api/v1/recurring-invoices/trigger-generation \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -v
  echo ""
  echo ""
  echo -e "${GREEN}Check the backend logs for:${NC}"
  echo "  - 'Checking for recurring invoices to generate...'"
  echo "  - 'Found X recurring invoice(s) ready to generate'"
  echo "  - 'Generated invoice from recurring template...'"
else
  echo "Skipping authenticated test. You can test manually with:"
  echo "  curl -X POST http://localhost:3000/api/v1/recurring-invoices/trigger-generation \\"
  echo "    -H \"Authorization: Bearer YOUR_TOKEN\""
fi

echo ""
echo -e "${YELLOW}Step 3: Verify Results${NC}"
echo "Check the database or API for:"
echo "  1. New invoices created for templates with nextRunDate <= now"
echo "  2. invoicesGenerated incremented on templates"
echo "  3. nextRunDate moved forward correctly"
echo ""
echo "You can check invoices with:"
echo "  GET /api/v1/invoices"
echo ""
echo "You can check recurring invoices with:"
echo "  GET /api/v1/recurring-invoices"
echo ""

echo -e "${YELLOW}Step 4: Test Cron Job${NC}"
echo "The scheduler runs automatically every 5 minutes."
echo "Leave the backend running and check logs after 5+ minutes."
echo "You should see invoices generated without manual trigger."
echo ""

echo -e "${GREEN}Test complete!${NC}"

