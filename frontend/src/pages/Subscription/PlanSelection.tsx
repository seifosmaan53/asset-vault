// Copyright (c) 2025 Asset Vault. All rights reserved.

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  CardActions,
  Alert,
  CircularProgress,
  Container,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { subscriptionsApi } from '../../api/subscriptions';
import { useSubscriptionStore } from '../../store/subscriptionStore';
import { useToast } from '../../contexts/ToastContext';
import { logger } from '../../utils/logger';

export default function PlanSelection() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { loadSubscription } = useSubscriptionStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubscribe = async () => {
    setLoading(true);
    setError(null);

    try {
      const { url } = await subscriptionsApi.createCheckoutSession();
      // Redirect to Stripe checkout
      window.location.href = url;
    } catch (err: unknown) {
      logger.error('Failed to create checkout session:', err);
      const errorMessage = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
        : undefined;
      setError(errorMessage || 'Failed to start subscription. Please try again.');
      showToast('Failed to start subscription', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Check if user already has an active subscription
    const checkSubscription = async () => {
      try {
        await loadSubscription();
        const store = useSubscriptionStore.getState();
        if (store.checkAccess()) {
          navigate('/dashboard');
        }
      } catch (error) {
        // Subscription check failed - user can still select a plan
        logger.debug('Failed to load subscription status', error);
      }
    };
    checkSubscription();
  }, [loadSubscription, navigate]);

  const features = [
    'Unlimited invoices',
    'Unlimited clients',
    'Unlimited inventory items',
    'Advanced analytics',
    'API access',
    '10GB storage',
    'Priority support',
  ];

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Box sx={{ textAlign: 'center', mb: 4 }}>
        <Typography variant="h3" component="h1" gutterBottom>
          Choose Your Plan
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Get started with our Pro plan. All features included.
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Card sx={{ maxWidth: 600, mx: 'auto' }}>
        <CardContent>
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <Typography variant="h4" component="h2" gutterBottom>
              Pro Plan
            </Typography>
            <Typography variant="h3" component="div" sx={{ my: 2 }}>
              $49.99
              <Typography component="span" variant="h6" color="text.secondary">
                /month
              </Typography>
            </Typography>
          </Box>

          <List>
            {features.map((feature, index) => (
              <ListItem key={index}>
                <ListItemIcon>
                  <CheckCircleIcon color="primary" />
                </ListItemIcon>
                <ListItemText primary={feature} />
              </ListItem>
            ))}
          </List>
        </CardContent>

        <CardActions sx={{ justifyContent: 'center', pb: 3 }}>
          <Button
            variant="contained"
            size="large"
            onClick={handleSubscribe}
            disabled={loading}
            sx={{ minWidth: 200 }}
          >
            {loading ? <CircularProgress size={24} /> : 'Start Subscription'}
          </Button>
        </CardActions>
      </Card>

      <Box sx={{ textAlign: 'center', mt: 4 }}>
        <Typography variant="body2" color="text.secondary">
          Secure payment processing by Stripe. Cancel anytime.
        </Typography>
      </Box>
    </Container>
  );
}

