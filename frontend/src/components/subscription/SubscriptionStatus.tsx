// Copyright (c) 2025 Asset Vault. All rights reserved.

import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Chip, Link, Tooltip } from '@mui/material';
import { useSubscriptionStore } from '../../store/subscriptionStore';

export function SubscriptionStatus() {
  const navigate = useNavigate();
  const { subscription, loadSubscription, syncSubscription, checkAccess, isLoading } = useSubscriptionStore();
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [subscriptionWasNull, setSubscriptionWasNull] = useState(false);

  useEffect(() => {
    loadSubscription().then(() => {
      setHasLoadedOnce(true);
    });
  }, [loadSubscription]);

  // Track if subscription was null after initial load
  useEffect(() => {
    if (hasLoadedOnce && !isLoading) {
      setSubscriptionWasNull(!subscription);
    }
  }, [hasLoadedOnce, isLoading, subscription]);

  // Auto-refresh if status is pending (to catch webhook updates)
  // Use syncSubscription to actively fetch latest status from Stripe
  // IMPORTANT: Only sync if subscription exists AND status is pending
  // Stop immediately on 400 errors (indicates no subscription or no Stripe ID)
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasErroredRef = useRef(false);
  
  // Get stable status value
  const subscriptionStatus = subscription?.status;

  useEffect(() => {
    // Clear any existing intervals first
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    
    // Reset error flag when subscription changes
    hasErroredRef.current = false;

    // Don't sync if:
    // 1. Haven't loaded subscription from server yet
    // 2. Currently loading
    // 3. No subscription (or subscription was null after loading)
    // 4. Status is not pending
    // 5. We've already encountered a 400 error
    if (!hasLoadedOnce || isLoading || !subscription || subscriptionWasNull || subscriptionStatus !== 'pending' || hasErroredRef.current) {
      return;
    }

    const performSync = async () => {
      // Double-check before syncing - don't sync if conditions aren't met
      if (hasErroredRef.current || isLoading || !hasLoadedOnce || subscriptionWasNull || !subscription || subscriptionStatus !== 'pending') {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        return;
      }

      try {
        await syncSubscription();
      } catch (error: any) {
        // Stop syncing immediately on 400 errors (bad request - no subscription or no Stripe ID)
        // This indicates a permanent issue, not a temporary one
        if (error?.response?.status === 400) {
          hasErroredRef.current = true;
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }
        }
      }
    };

    // Start syncing every 10 seconds (reduced frequency to improve performance)
    intervalRef.current = setInterval(performSync, 10000);

    // Stop checking after 2 minutes
    timeoutRef.current = setTimeout(() => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }, 120000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [subscription, subscriptionStatus, syncSubscription, hasLoadedOnce, isLoading, subscriptionWasNull]);

  if (!subscription) {
    return (
      <Chip
        label="No Subscription"
        color="warning"
        size="small"
        component={Link}
        onClick={() => navigate('/subscription/plan')}
        sx={{ cursor: 'pointer' }}
      />
    );
  }

  const getStatusColor = (status: string): 'success' | 'info' | 'warning' | 'error' | 'default' => {
    switch (status) {
      case 'active':
        return 'success';
      case 'trialing':
        return 'info';
      case 'past_due':
        return 'warning';
      case 'canceled':
        return 'error';
      case 'pending':
        return 'info';
      case 'incomplete':
        return 'warning';
      case 'incomplete_expired':
        return 'error';
      case 'unpaid':
        return 'error';
      default:
        return 'default';
    }
  };

  const getStatusLabel = (status: string): string => {
    switch (status) {
      case 'active':
        return 'Active';
      case 'trialing':
        return 'Trial';
      case 'past_due':
        return 'Past Due';
      case 'canceled':
        return 'Canceled';
      case 'pending':
        return 'Pending';
      case 'incomplete':
        return 'Incomplete';
      case 'incomplete_expired':
        return 'Expired';
      case 'unpaid':
        return 'Unpaid';
      default:
        return status;
    }
  };

  const getStatusTooltip = (status: string, hasAccess: boolean, cancelAtPeriodEnd: boolean): string => {
    if (!hasAccess) {
      return 'Your subscription is inactive. Click to manage billing.';
    }

    switch (status) {
      case 'pending':
        return 'Subscription is being processed. This is normal right after payment. It will update to Active shortly.';
      case 'trialing':
        return 'You are currently on a trial period.';
      case 'active':
        return cancelAtPeriodEnd
          ? 'Subscription will be canceled at period end'
          : 'Your subscription is active. Click to manage billing.';
      case 'past_due':
        return 'Payment is past due. Please update your payment method.';
      case 'canceled':
        return 'Subscription has been canceled.';
      case 'incomplete':
        return 'Payment setup is incomplete. Please complete payment.';
      case 'incomplete_expired':
        return 'Payment setup expired. Please set up payment again.';
      case 'unpaid':
        return 'Payment failed. Please update your payment method.';
      default:
        return 'Click to manage billing.';
    }
  };

  const hasAccess = checkAccess();

  return (
    <Tooltip
      title={getStatusTooltip(subscription.status, hasAccess, subscription.cancelAtPeriodEnd)}
    >
      <Chip
        label={getStatusLabel(subscription.status)}
        color={getStatusColor(subscription.status)}
        size="small"
        component={Link}
        onClick={() => navigate('/subscription/billing')}
        sx={{ cursor: 'pointer' }}
      />
    </Tooltip>
  );
}

