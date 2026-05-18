import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
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
import LockIcon from '@mui/icons-material/Lock';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { passwordSchema } from '../utils/validators';
import { authApi } from '../api/auth';
import { useToast } from '../contexts/ToastContext';
import { getErrorMessage } from '../utils/errorHandling';

const resetPasswordSchema = z.object({
  password: passwordSchema,
  confirmPassword: z.string(),
  email: z.string().email(),
  token: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

interface ResetPasswordFormData {
  email: string;
  token: string;
  password: string;
  confirmPassword: string;
}

const ResetPassword = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { showToast } = useToast();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const tokenParam = searchParams.get('token');
    const emailParam = searchParams.get('email');
    
    if (!tokenParam || !emailParam) {
      setError('Invalid reset link. Please request a new password reset.');
    } else {
      setToken(tokenParam);
      setEmail(emailParam);
    }
  }, [searchParams]);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      email: email || '',
      token: token || '',
    },
  });

  useEffect(() => {
    if (email) setValue('email', email);
    if (token) setValue('token', token);
  }, [email, token, setValue]);

  const onSubmit = async (data: ResetPasswordFormData) => {
    if (!token || !email) {
      setError('Invalid reset link. Please request a new password reset.');
      return;
    }

    try {
      setError(null);
      setLoading(true);
      await authApi.confirmPasswordReset({
        email: data.email,
        token: data.token,
        password: data.password,
      });
      showToast('Password reset successfully. Please login with your new password.', 'success');
      navigate('/login');
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err, 'Failed to reset password. The link may have expired.');
      setError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!token || !email) {
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
            bgcolor: 'error.main',
            color: 'error.contrastText',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <LockOutlinedIcon sx={{ fontSize: 48 }} />
        </Box>
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="h5" component="h2" gutterBottom fontWeight={600}>
            Invalid Reset Link
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            This password reset link is invalid or has expired.
          </Typography>
          {error && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
              {error}
            </Alert>
          )}
        </Box>
        <Button
          variant="contained"
          fullWidth
          onClick={() => navigate('/forgot-password')}
          sx={{ mt: 1, borderRadius: 2, fontWeight: 600 }}
        >
          Request New Reset Link
        </Button>
        <Button
          variant="text"
          fullWidth
          onClick={() => navigate('/login')}
        >
          Back to Login
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
          <LockIcon sx={{ fontSize: 32 }} />
        </Box>
        <Typography variant="h5" component="h2" gutterBottom fontWeight={600}>
          Reset Your Password
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Enter your new password below. Make sure it's strong and secure.
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ borderRadius: 2 }}>
          <Typography variant="body2" fontWeight={500}>
            {error}
          </Typography>
          {error.includes('expired') && (
            <Typography variant="caption" display="block" sx={{ mt: 1 }}>
              Password reset links expire after 30 minutes. Please request a new one.
            </Typography>
          )}
        </Alert>
      )}

      <TextField
        label="New Password"
        type="password"
        fullWidth
        {...register('password')}
        error={!!errors.password}
        helperText={errors.password?.message || 'Minimum 6 characters required'}
        autoComplete="new-password"
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <LockIcon color="action" />
            </InputAdornment>
          ),
        }}
        sx={{
          '& .MuiOutlinedInput-root': {
            borderRadius: 2,
          },
        }}
      />

      <TextField
        label="Confirm New Password"
        type="password"
        fullWidth
        {...register('confirmPassword')}
        error={!!errors.confirmPassword}
        helperText={errors.confirmPassword?.message || 'Re-enter your password to confirm'}
        autoComplete="new-password"
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <LockOutlinedIcon color="action" />
            </InputAdornment>
          ),
        }}
        sx={{
          '& .MuiOutlinedInput-root': {
            borderRadius: 2,
          },
        }}
      />

      <input type="hidden" {...register('email')} />
      <input type="hidden" {...register('token')} />

      <Button
        type="submit"
        variant="contained"
        fullWidth
        disabled={loading}
        startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <CheckCircleIcon />}
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
        {loading ? 'Resetting Password...' : 'Reset Password'}
      </Button>

      <Box sx={{ textAlign: 'center', mt: 1 }}>
        <Button
          variant="text"
          onClick={() => navigate('/login')}
          sx={{ textTransform: 'none' }}
        >
          ← Back to Login
        </Button>
      </Box>
    </Paper>
  );
};

export default ResetPassword;

