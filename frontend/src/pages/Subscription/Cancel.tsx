// Copyright (c) 2025 Asset Vault. All rights reserved.

import { useNavigate } from 'react-router-dom';
import { Container, Box, Typography, Button, Alert } from '@mui/material';
import CancelIcon from '@mui/icons-material/Cancel';

export default function SubscriptionCancel() {
  const navigate = useNavigate();

  return (
    <Container maxWidth="sm" sx={{ py: 4, textAlign: 'center' }}>
      <CancelIcon sx={{ fontSize: 64, color: 'error.main', mb: 2 }} />
      <Typography variant="h4" component="h1" gutterBottom>
        Subscription Canceled
      </Typography>
      <Alert severity="info" sx={{ mb: 3, textAlign: 'left' }}>
        You canceled the subscription process. No charges were made.
      </Alert>
      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
        <Button variant="contained" onClick={() => navigate('/subscription/plan')}>
          Try Again
        </Button>
        <Button variant="outlined" onClick={() => navigate('/dashboard')}>
          Go to Dashboard
        </Button>
      </Box>
    </Container>
  );
}

