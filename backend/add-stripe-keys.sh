#!/bin/bash

# Script to add Stripe keys to .env file
# Usage: ./add-stripe-keys.sh

ENV_FILE=".env"

echo "🔑 Adding Stripe keys to $ENV_FILE..."
echo ""

# Check if .env exists
if [ ! -f "$ENV_FILE" ]; then
    echo "❌ Error: $ENV_FILE not found!"
    exit 1
fi

# Check if keys already exist
if grep -q "STRIPE_SECRET_KEY=" "$ENV_FILE"; then
    echo "⚠️  Stripe keys already exist in $ENV_FILE"
    echo "   Please edit manually or remove existing keys first"
    exit 1
fi

# Add Stripe configuration section
echo "" >> "$ENV_FILE"
echo "# Stripe Configuration" >> "$ENV_FILE"
echo "STRIPE_SECRET_KEY=sk_test_YOUR_SECRET_KEY_HERE" >> "$ENV_FILE"
echo "STRIPE_PRICE_ID=price_YOUR_PRICE_ID_HERE" >> "$ENV_FILE"
echo "STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET_HERE" >> "$ENV_FILE"

echo "✅ Stripe key placeholders added to $ENV_FILE"
echo ""
echo "📝 Next steps:"
echo "   1. Open $ENV_FILE"
echo "   2. Replace the placeholder values with your actual Stripe keys"
echo "   3. Save the file"
echo "   4. Restart your backend server"

