import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Box,
  TextField,
  Button,
  Typography,
  Alert,
} from '@mui/material';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema } from '../utils/validators';
import { useRegister } from '../hooks/useAuth';
import { useToast } from '../contexts/ToastContext';

interface RegisterFormData {
  email: string;
  password: string;
  name: string;
  companyName?: string;
}

const Register = () => {
  const navigate = useNavigate();
  const register = useRegister();
  const { showToast } = useToast();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const {
    register: registerForm,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterFormData) => {
    try {
      setError(null);
      setLoading(true);
      await register.mutateAsync(data);
      showToast('Account created successfully!', 'success');
      navigate('/dashboard');
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Registration failed. Please try again.';
      setError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      component="form"
      onSubmit={handleSubmit(onSubmit)}
      sx={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}
    >
      <Typography variant="h5" component="h2" gutterBottom>
        Create Account
      </Typography>

      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <TextField
        label="Name"
        fullWidth
        {...registerForm('name')}
        error={!!errors.name}
        helperText={errors.name?.message}
        autoComplete="name"
      />

      <TextField
        label="Email"
        type="email"
        fullWidth
        {...registerForm('email')}
        error={!!errors.email}
        helperText={errors.email?.message}
        autoComplete="email"
      />

      <TextField
        label="Password"
        type="password"
        fullWidth
        {...registerForm('password')}
        error={!!errors.password}
        helperText={errors.password?.message}
        autoComplete="new-password"
      />

      <TextField
        label="Company Name (Optional)"
        fullWidth
        {...registerForm('companyName')}
        error={!!errors.companyName}
        helperText={errors.companyName?.message}
      />

      <Button
        type="submit"
        variant="contained"
        fullWidth
        disabled={loading}
        sx={{ mt: 2 }}
      >
        {loading ? 'Creating account...' : 'Create Account'}
      </Button>

      <Box sx={{ textAlign: 'center', mt: 2 }}>
        <Typography variant="body2">
          Already have an account?{' '}
          <Link to="/login" style={{ textDecoration: 'none' }}>
            Sign in
          </Link>
        </Typography>
      </Box>
    </Box>
  );
};

export default Register;

