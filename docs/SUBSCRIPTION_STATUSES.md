# Subscription Status Guide

## Overview

Your subscription can have different statuses depending on its current state. This guide explains what each status means and when it occurs.

## All Subscription Statuses

### ✅ **Active** (`active`)
- **What it means**: Your subscription is fully active and working normally.
- **When it occurs**: After successful payment and webhook processing.
- **Access**: ✅ Full access to all features.
- **Action needed**: None - everything is working!

### 🔵 **Pending** (`pending`)
- **What it means**: Your subscription is being set up or processed.
- **When it occurs**:
  - When you first create an account (before subscribing)
  - Immediately after completing payment (while waiting for Stripe webhook to process)
  - During the brief period between payment and webhook confirmation
- **Access**: ✅ You have access (to prevent blocking during setup)
- **Action needed**: Usually none - it should automatically update to "Active" within seconds to minutes. If it stays pending for more than 5 minutes, try refreshing the page or contact support.

### 🟢 **Trialing** (`trialing`)
- **What it means**: You're in a trial period (if trials are enabled).
- **When it occurs**: During an active trial period before first payment.
- **Access**: ✅ Full access during trial.
- **Action needed**: None during trial.

### ⚠️ **Past Due** (`past_due`)
- **What it means**: A payment attempt failed, but you're still within the grace period.
- **When it occurs**: When Stripe couldn't charge your payment method, but it's been less than the grace period.
- **Access**: ⚠️ Limited access (may be restricted).
- **Action needed**: Update your payment method immediately to avoid cancellation.

### ❌ **Canceled** (`canceled`)
- **What it means**: Your subscription has been canceled.
- **When it occurs**: 
  - After you manually cancel
  - After payment failures exceed grace period
  - At the end of billing period if you set it to cancel
- **Access**: ⚠️ Grace period access (7 days after cancellation), then no access.
- **Action needed**: Reactivate subscription if you want to continue.

### ⚠️ **Incomplete** (`incomplete`)
- **What it means**: Payment setup was started but not completed.
- **When it occurs**: When checkout session is created but payment isn't finalized.
- **Access**: ❌ No access.
- **Action needed**: Complete the payment process.

### ❌ **Incomplete Expired** (`incomplete_expired`)
- **What it means**: Payment setup expired without completion.
- **When it occurs**: When checkout session expires (usually after 24 hours).
- **Access**: ❌ No access.
- **Action needed**: Start a new subscription.

### ❌ **Unpaid** (`unpaid`)
- **What it means**: Payment failed and grace period has ended.
- **When it occurs**: After multiple failed payment attempts.
- **Access**: ❌ No access.
- **Action needed**: Update payment method and reactivate.

## Common Scenarios

### Scenario 1: Just Created Account
- **Status**: `pending`
- **Why**: Account created, but no subscription yet
- **What to do**: Click "Start Subscription" to begin

### Scenario 2: Just Completed Payment
- **Status**: `pending` (briefly)
- **Why**: Payment completed, but webhook hasn't processed yet (usually takes 1-30 seconds)
- **What to do**: Wait a moment and refresh. Should update to `active` automatically.

### Scenario 3: Payment Completed But Still Pending
- **Status**: `pending` (for more than 5 minutes)
- **Why**: Possible webhook delay or issue
- **What to do**: 
  1. Refresh the page
  2. Check your billing page - it may show active there
  3. Contact support if it persists

### Scenario 4: Payment Failed
- **Status**: `past_due` → `unpaid` → `canceled`
- **Why**: Payment method declined or insufficient funds
- **What to do**: Update payment method in billing settings

## Status Flow Diagram

```
New Account
    ↓
[pending] ← Initial state
    ↓
User Subscribes
    ↓
[incomplete] ← During checkout
    ↓
Payment Completed
    ↓
[pending] ← Brief moment (1-30 seconds)
    ↓
Webhook Processes
    ↓
[active] ← Final state ✅
    ↓
(If payment fails)
    ↓
[past_due] → [unpaid] → [canceled]
```

## Troubleshooting

### Stuck on "Pending" After Payment?

1. **Wait 1-2 minutes** - Webhooks can take time to process
2. **Refresh the page** - The status may have updated
3. **Check Stripe Dashboard** - Verify payment was successful
4. **Check backend logs** - Look for webhook processing errors
5. **Use verify endpoint** - The success page automatically verifies, but you can manually trigger it

### How to Check Your Actual Status

1. Go to `/subscription/billing` page
2. Check the subscription details
3. Look at backend logs for webhook events
4. Check Stripe dashboard for subscription status

## Technical Notes

- Status updates come from Stripe webhooks (`checkout.session.completed`, `customer.subscription.updated`)
- The `verify-checkout` endpoint can force sync status if webhook is delayed
- PENDING status allows access to prevent blocking users during setup
- Status mapping: Stripe statuses → Our internal statuses (see `mapStripeStatusToSubscriptionStatus`)
