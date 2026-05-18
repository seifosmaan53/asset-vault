// Copyright (c) 2025 Asset Vault. All rights reserved.

import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Box, Typography, CircularProgress, Alert, Button, Container } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useSubscriptionStore } from '../../store/subscriptionStore';
import { subscriptionsApi } from '../../api/subscriptions';
import { logger } from '../../utils/logger';

const MAX_RETRIES = 10;
const RETRY_DELAY = 2000; // 2 seconds

export default function SubscriptionSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { loadSubscription, checkAccess } = useSubscriptionStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const retryCountRef = useRef(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    
    if (!sessionId) {
      setError('Invalid session. Please try again.');
      setLoading(false);
      return;
    }

    const verifyAndPoll = async () => {
      try {
        // First, try to verify the checkout session and sync subscription
        const verifyResult = await subscriptionsApi.verifyCheckoutSession(sessionId);
        
        if (verifyResult.verified && verifyResult.subscription) {
          // Subscription is verified and synced, reload from store
          await loadSubscription();
          
          // Check if user has access
          const hasAccess = checkAccess();
          if (hasAccess) {
            setLoading(false);
            // Redirect to dashboard after a short delay
            setTimeout(() => {
              navigate('/dashboard');
            }, 2000);
            return;
          }
        }

        // If not verified yet or no access, retry
        retryCountRef.current += 1;
        
        if (retryCountRef.current >= MAX_RETRIES) {
          // Max retries reached, try one more time with just loadSubscription
          await loadSubscription();
          const hasAccess = checkAccess();
          if (hasAccess) {
            setLoading(false);
            setTimeout(() => {
              navigate('/dashboard');
            }, 2000);
          } else {
            setError('Subscription is being processed. Please wait a moment and refresh the page, or check your billing page.');
            setLoading(false);
          }
          return;
        }

        // Schedule next retry
        timeoutRef.current = setTimeout(() => {
          verifyAndPoll();
        }, RETRY_DELAY);
      } catch (err) {
        logger.error('Failed to verify subscription:', err);
        
        // On error, try to load subscription anyway
        retryCountRef.current += 1;
        if (retryCountRef.current >= MAX_RETRIES) {
          try {
            await loadSubscription();
            const hasAccess = checkAccess();
            if (hasAccess) {
              setLoading(false);
              setTimeout(() => {
                navigate('/dashboard');
              }, 2000);
            } else {
              setError('Failed to verify subscription. Please check your billing page or try refreshing.');
              setLoading(false);
            }
          } catch (loadErr) {
            setError('Failed to verify subscription. Please check your billing page.');
            setLoading(false);
          }
          return;
        }

        // Retry on error
        timeoutRef.current = setTimeout(() => {
          verifyAndPoll();
        }, RETRY_DELAY);
      }
    };

    // Start verification process
    verifyAndPoll();

    // Cleanup timeout on unmount
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [searchParams, loadSubscription, navigate, checkAccess]);

  if (loading) {
    return (
      <Container maxWidth="sm" sx={{ py: 4, textAlign: 'center' }}>
        <CircularProgress />
        <Typography variant="body1" sx={{ mt: 2 }}>
          Verifying your subscription...
        </Typography>
        {retryCountRef.current > 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Attempt {retryCountRef.current} of {MAX_RETRIES}...
          </Typography>
        )}
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="sm" sx={{ py: 4 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Button variant="contained" onClick={() => navigate('/subscription/billing')}>
          Go to Billing
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm" sx={{ py: 4, textAlign: 'center' }}>
      <CheckCircleIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
      <Typography variant="h4" component="h1" gutterBottom>
        Subscription Activated!
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Your subscription has been successfully activated. Redirecting to dashboard...
      </Typography>
      <Button variant="contained" onClick={() => navigate('/dashboard')}>
        Go to Dashboard
      </Button>
    </Container>
  );
}

