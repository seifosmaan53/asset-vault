// Copyright (c) 2025 Asset Vault. All rights reserved.

import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  Alert,
  CircularProgress,
  Container,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Link,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { subscriptionsApi, type BillingInvoice } from '../../api/subscriptions';
import { useSubscriptionStore } from '../../store/subscriptionStore';
import { useToast } from '../../contexts/ToastContext';
import { logger } from '../../utils/logger';

export default function Billing() {
  const { showToast } = useToast();
  const { subscription, loadSubscription, loadUsage, usage } = useSubscriptionStore();
  const [canceling, setCanceling] = useState(false);
  const [reactivating, setReactivating] = useState(false);

  useEffect(() => {
    loadSubscription();
    loadUsage();
  }, [loadSubscription]);

  const { data: invoices, isLoading: invoicesLoading } = useQuery({
    queryKey: ['billing-history'],
    queryFn: () => subscriptionsApi.getBillingHistory(),
    select: (data) => data.invoices,
  });

  const handleManageBilling = async () => {
    try {
      const { url } = await subscriptionsApi.createPortalSession();
      window.location.href = url;
    } catch (err: unknown) {
      logger.error('Failed to create portal session:', err);
      showToast('Failed to open billing portal', 'error');
    }
  };

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel your subscription? You will have access until the end of your billing period.')) {
      return;
    }

    setCanceling(true);
    try {
      await subscriptionsApi.cancelSubscription();
      await loadSubscription();
      showToast('Subscription will be canceled at the end of the billing period', 'info');
    } catch (err: unknown) {
      logger.error('Failed to cancel subscription:', err);
      showToast('Failed to cancel subscription', 'error');
    } finally {
      setCanceling(false);
    }
  };

  const handleReactivate = async () => {
    setReactivating(true);
    try {
      await subscriptionsApi.reactivateSubscription();
      await loadSubscription();
      showToast('Subscription reactivated successfully', 'success');
    } catch (err: unknown) {
      logger.error('Failed to reactivate subscription:', err);
      showToast('Failed to reactivate subscription', 'error');
    } finally {
      setReactivating(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'trialing':
        return 'info';
      case 'past_due':
        return 'warning';
      case 'canceled':
        return 'error';
      default:
        return 'default';
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount);
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Billing & Subscription
      </Typography>

      <Grid container spacing={3} sx={{ mt: 2 }}>
        {/* Subscription Status */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Current Subscription
              </Typography>
              {subscription ? (
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                    <Typography variant="h5">{subscription.plan.name}</Typography>
                    <Chip
                      label={subscription.status}
                      color={getStatusColor(subscription.status) as 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'}
                      size="small"
                    />
                  </Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    ${subscription.plan.price}/{subscription.plan.billingCycle}
                  </Typography>
                  {subscription.currentPeriodEnd && (
                    <Typography variant="body2" color="text.secondary">
                      Next billing date: {formatDate(subscription.currentPeriodEnd)}
                    </Typography>
                  )}
                  {subscription.cancelAtPeriodEnd && (
                    <Alert severity="warning" sx={{ mt: 2 }}>
                      Your subscription will be canceled at the end of the current period.
                    </Alert>
                  )}
                  <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
                    <Button variant="outlined" onClick={handleManageBilling}>
                      Manage Billing
                    </Button>
                    {subscription.cancelAtPeriodEnd ? (
                      <Button
                        variant="contained"
                        onClick={handleReactivate}
                        disabled={reactivating}
                      >
                        {reactivating ? <CircularProgress size={20} /> : 'Reactivate'}
                      </Button>
                    ) : (
                      <Button
                        variant="outlined"
                        color="error"
                        onClick={handleCancel}
                        disabled={canceling}
                      >
                        {canceling ? <CircularProgress size={20} /> : 'Cancel Subscription'}
                      </Button>
                    )}
                  </Box>
                </Box>
              ) : (
                <Alert severity="info">
                  No active subscription. <Link href="/subscription/plan">Subscribe now</Link>
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Usage Metrics */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Usage This Month
              </Typography>
              {usage ? (
                <Box>
                  <Typography variant="body2" gutterBottom>
                    Invoices Created: {usage.invoices_created}
                  </Typography>
                  <Typography variant="body2" gutterBottom>
                    Clients: {usage.clients_created}
                  </Typography>
                  <Typography variant="body2" gutterBottom>
                    Inventory Items: {usage.inventory_items_created}
                  </Typography>
                  <Typography variant="body2" gutterBottom>
                    Storage Used: {usage.storage_used_mb} MB
                  </Typography>
                  <Typography variant="body2">
                    API Requests: {usage.api_requests}
                  </Typography>
                </Box>
              ) : (
                <CircularProgress size={24} />
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Billing History */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Billing History
              </Typography>
              {invoicesLoading ? (
                <CircularProgress />
              ) : invoices && invoices.length > 0 ? (
                <TableContainer component={Paper} variant="outlined">
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Date</TableCell>
                        <TableCell>Amount</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Invoice</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {invoices.map((invoice) => (
                        <TableRow key={invoice.id}>
                          <TableCell>{formatDate(invoice.created)}</TableCell>
                          <TableCell>
                            {formatCurrency(invoice.amount, invoice.currency)}
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={invoice.status}
                              color={invoice.status === 'paid' ? 'success' : 'default'}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            {invoice.hostedInvoiceUrl && (
                              <Link href={invoice.hostedInvoiceUrl} target="_blank" rel="noopener">
                                View Invoice
                              </Link>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No billing history available.
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Container>
  );
}

