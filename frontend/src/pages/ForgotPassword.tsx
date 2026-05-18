import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Box,
  TextField,
  Button,
  Typography,
  Alert,
  Paper,
  InputAdornment,
  CircularProgress,
} from '@mui/material';
import EmailIcon from '@mui/icons-material/Email';
import LockResetIcon from '@mui/icons-material/LockReset';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { emailSchema } from '../utils/validators';
import { authApi } from '../api/auth';
import { useToast } from '../contexts/ToastContext';
import { getErrorMessage } from '../utils/errorHandling';

const forgotPasswordSchema = z.object({
  email: emailSchema,
});

interface ForgotPasswordFormData {
  email: string;
}

const ForgotPassword = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    try {
      setError(null);
      setLoading(true);
      await authApi.requestPasswordReset(data.email);
      setSuccess(true);
      showToast('If that email exists, we sent a password reset link', 'success');
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err, 'Failed to send reset email. Please try again.');
      setError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <Paper
        elevation={0}
        sx={{
          p: 4,
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 3,
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box
          sx={{
            p: 2,
            borderRadius: '50%',
            bgcolor: 'success.main',
            color: 'success.contrastText',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <CheckCircleIcon sx={{ fontSize: 48 }} />
        </Box>
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="h5" component="h2" gutterBottom fontWeight={600}>
            Check Your Email
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            If an account with that email exists, we've sent a password reset link.
          </Typography>
          <Alert severity="success" sx={{ mb: 2 }}>
            <Typography variant="body2">
              <strong>What to do next:</strong>
              <br />
              1. Check your inbox (and spam folder)
              <br />
              2. Click the reset link in the email
              <br />
              3. The link expires in 30 minutes
            </Typography>
          </Alert>
        </Box>
        <Button
          variant="contained"
          fullWidth
          onClick={() => navigate('/login')}
          sx={{ mt: 1, borderRadius: 2, fontWeight: 600 }}
        >
          Back to Login
        </Button>
        <Button
          variant="text"
          fullWidth
          onClick={() => {
            setSuccess(false);
            setError(null);
          }}
          sx={{ mt: -1 }}
        >
          Request Another Link
        </Button>
      </Paper>
    );
  }

  return (
    <Paper
      elevation={0}
      component="form"
      onSubmit={handleSubmit(onSubmit)}
      sx={{
        p: 4,
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Box sx={{ textAlign: 'center', mb: 1 }}>
        <Box
          sx={{
            p: 2,
            borderRadius: '50%',
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            mb: 2,
          }}
        >
          <LockResetIcon sx={{ fontSize: 32 }} />
        </Box>
        <Typography variant="h5" component="h2" gutterBottom fontWeight={600}>
          Forgot Password?
        </Typography>
        <Typography variant="body2" color="text.secondary">
          No worries! Enter your email address and we'll send you a link to reset your password.
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ borderRadius: 2 }}>
          {error}
        </Alert>
      )}

      <TextField
        label="Email Address"
        type="email"
        fullWidth
        {...register('email')}
        error={!!errors.email}
        helperText={errors.email?.message || 'Enter the email address associated with your account'}
        autoComplete="email"
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <EmailIcon color="action" />
            </InputAdornment>
          ),
        }}
        sx={{
          '& .MuiOutlinedInput-root': {
            borderRadius: 2,
          },
        }}
      />

      <Button
        type="submit"
        variant="contained"
        fullWidth
        disabled={loading}
        startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <LockResetIcon />}
        sx={{
          mt: 1,
          borderRadius: 2,
          py: 1.5,
          fontWeight: 600,
          boxShadow: 2,
          '&:hover': {
            boxShadow: 4,
          },
        }}
      >
        {loading ? 'Sending Reset Link...' : 'Send Reset Link'}
      </Button>

      <Box sx={{ textAlign: 'center', mt: 1 }}>
        <Button
          component={Link}
          to="/login"
          variant="text"
          sx={{ textTransform: 'none' }}
        >
          ← Back to Login
        </Button>
      </Box>
    </Paper>
  );
};

export default ForgotPassword;

