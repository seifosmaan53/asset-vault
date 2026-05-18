import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {Box,
  Typography,
  TextField,
  Button,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
  CircularProgress,
  Skeleton,
  InputAdornment,
  Divider,
  Alert,
  FormControl,
  InputLabel,
  Select,
  Paper,
  Chip} from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import EmailIcon from '@mui/icons-material/Email';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import LockIcon from '@mui/icons-material/Lock';
import BusinessIcon from '@mui/icons-material/Business';
import { useUser, useCreateUser, useUpdateUser } from '../../hooks/useUsers';
import { useEffect } from 'react';
import { createUserSchema, updateUserSchema } from '../../utils/validationSchemas';
import { useToast } from '../../contexts/ToastContext';
import type { CreateUserDto, UpdateUserDto } from '../../api/users';
import { getErrorMessage } from '../../utils/errorHandling';
import Grid from '../../components/common/Grid';

interface UserFormProps {
  userId?: string | null;
  onSuccess: () => void;
  onCancel: () => void;
}

interface CreateUserFormData {
  name: string;
  email: string;
  role: 'owner' | 'admin';
  password: string;
  companyName?: string;
}

interface UpdateUserFormData {
  name: string;
  role: 'owner' | 'admin';
  password: string;
}

const UserForm = ({ userId, onSuccess, onCancel }: UserFormProps) => {
  const isEdit = !!userId;
  const { data: user, isLoading } = useUser(userId || '');
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const { showToast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    control,
  } = useForm<CreateUserFormData | UpdateUserFormData>({
    resolver: zodResolver(isEdit ? updateUserSchema : createUserSchema),
    defaultValues: {
      role: isEdit ? (user?.role as 'owner' | 'admin' || 'admin') : 'admin',
    },
  });

  useEffect(() => {
    if (user && isEdit) {
      reset({
        name: user.name,
        role: user.role as 'owner' | 'admin',
        password: '',
      });
    } else if (!isEdit) {
      reset({
        name: '',
        email: '',
        role: 'admin' as const,
        password: '',
        companyName: '',
      });
    }
  }, [user, isEdit, reset]);

  const onSubmit = async (data: CreateUserFormData | UpdateUserFormData) => {
    try {
      if (isEdit && userId) {
        const updateData: UpdateUserDto = {
          name: data.name,
          role: data.role,
        };
        // Only include password if it's provided
        if (data.password && data.password.trim() !== '') {
          updateData.password = data.password;
        }
        await updateUser.mutateAsync({ id: userId, data: updateData });
        showToast('User updated successfully', 'success');
      } else {
        const createData: CreateUserDto = {
          name: data.name,
          email: (data as CreateUserFormData).email,
          role: data.role,
          password: data.password,
          companyName: (data as CreateUserFormData).companyName,
        };
        await createUser.mutateAsync(createData);
        showToast('User created successfully', 'success');
      }
      onSuccess();
    } catch (error: unknown) {
      const { getErrorMessage } = await import('../../utils/errorHandling');
      showToast(getErrorMessage(error, 'An error occurred'), 'error');
    }
  };

  if (isLoading && isEdit) {
    return (
      <Box>
        <Skeleton variant="text" width={300} height={40} sx={{ mb: 3 }} />
        <Box display="flex" flexDirection="column" gap={3}>
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} variant="rectangular" width="100%" height={56} />
          ))}
        </Box>
      </Box>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <DialogTitle sx={{ pb: 2, pt: 3 }}>
        <Box display="flex" alignItems="center" gap={2} mb={1}>
          <Box
            sx={{
              p: 1.5,
              borderRadius: 2,
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <PersonIcon sx={{ fontSize: 28 }} />
          </Box>
          <Box flex={1}>
            <Typography variant="h5" component="div" fontWeight={600}>
              {isEdit ? 'Edit User' : 'Create New User'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {isEdit ? 'Update user information and permissions' : 'Add a new user to your organization'}
            </Typography>
          </Box>
        </Box>
      </DialogTitle>
      <Divider />
      <DialogContent sx={{ pt: 3, pb: 2 }}>
        <Box>
          <Grid container spacing={3}>
            {/* Basic Information Section */}
            <Grid item xs={12}>
              <Box mb={1}>
                <Typography variant="subtitle2" fontWeight={600} color="text.secondary" sx={{ textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: 1 }}>
                  Basic Information
                </Typography>
              </Box>
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label={
                  <span>
                    Full Name <span style={{ color: '#d32f2f', marginLeft: '4px' }}>*</span>
                  </span>
                }
                required
                {...register('name')}
                error={!!errors.name}
                helperText={errors.name?.message || 'Enter the user\'s full name'}
                InputLabelProps={{ required: false }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <PersonIcon color="action" />
                    </InputAdornment>
                  ),
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                  },
                }}
              />
            </Grid>

            {!isEdit && (
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label={
                    <span>
                      Email Address <span style={{ color: '#d32f2f', marginLeft: '4px' }}>*</span>
                    </span>
                  }
                  type="email"
                  required
                  {...register('email')}
                  error={!!errors.email}
                  helperText={errors.email?.message || 'User will use this email to log in'}
                  InputLabelProps={{ required: false }}
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
              </Grid>
            )}

            {isEdit && (
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Email Address"
                  value={user?.email || ''}
                  disabled
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <EmailIcon color="disabled" />
                      </InputAdornment>
                    ),
                  }}
                  helperText="Email cannot be changed after account creation"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                      backgroundColor: 'action.disabledBackground',
                    },
                  }}
                />
              </Grid>
            )}

            {/* Permissions Section */}
            <Grid item xs={12}>
              <Divider sx={{ my: 1 }} />
              <Box mb={1} mt={2}>
                <Typography variant="subtitle2" fontWeight={600} color="text.secondary" sx={{ textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: 1 }}>
                  Permissions
                </Typography>
              </Box>
            </Grid>

            <Grid item xs={12}>
              <Controller
                name="role"
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth required error={!!errors.role}>
                    <InputLabel>Role *</InputLabel>
                    <Select
                      {...field}
                      label="Role *"
                      error={!!errors.role}
                      sx={{
                        borderRadius: 2,
                        '& .MuiSelect-select': {
                          display: 'flex',
                          alignItems: 'center',
                        },
                      }}
                    >
                      <MenuItem value="owner">
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 0.5, width: '100%' }}>
                          <AdminPanelSettingsIcon fontSize="small" color="primary" />
                          <Box flex={1}>
                            <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                              <Typography variant="body2" fontWeight={600}>OWNER</Typography>
                              <Chip label="Full Access" size="small" color="primary" variant="outlined" sx={{ height: 18, fontSize: '0.65rem' }} />
                            </Box>
                            <Typography variant="caption" color="text.secondary" display="block">
                              Full access to all features and settings
                            </Typography>
                          </Box>
                        </Box>
                      </MenuItem>
                      <MenuItem value="admin">
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 0.5, width: '100%' }}>
                          <PersonIcon fontSize="small" color="action" />
                          <Box flex={1}>
                            <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                              <Typography variant="body2" fontWeight={600}>ADMIN</Typography>
                              <Chip label="Limited" size="small" color="default" variant="outlined" sx={{ height: 18, fontSize: '0.65rem' }} />
                            </Box>
                            <Typography variant="caption" color="text.secondary" display="block">
                              Manage invoices, clients, and inventory
                            </Typography>
                          </Box>
                        </Box>
                      </MenuItem>
                    </Select>
                    {errors.role && (
                      <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.75 }}>
                        {errors.role.message}
                      </Typography>
                    )}
                    {!errors.role && (
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, ml: 1.75 }}>
                        Select the user's permission level
                      </Typography>
                    )}
                  </FormControl>
                )}
              />
            </Grid>

            {/* Security Section */}
            <Grid item xs={12}>
              <Divider sx={{ my: 1 }} />
              <Box mb={1} mt={2}>
                <Typography variant="subtitle2" fontWeight={600} color="text.secondary" sx={{ textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: 1 }}>
                  Security
                </Typography>
              </Box>
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label={
                  <span>
                    {isEdit ? 'New Password' : 'Password'} {!isEdit && <span style={{ color: '#d32f2f', marginLeft: '4px' }}>*</span>}
                  </span>
                }
                type="password"
                required={!isEdit}
                {...register('password')}
                error={!!errors.password}
                helperText={
                  errors.password?.message || 
                  (isEdit 
                    ? 'Leave blank to keep current password. Minimum 6 characters if changing.' 
                    : 'Minimum 6 characters required')
                }
                InputLabelProps={{ required: false }}
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
            </Grid>

            {/* Additional Information Section */}
            {!isEdit && (
              <>
                <Grid item xs={12}>
                  <Divider sx={{ my: 1 }} />
                  <Box mb={1} mt={2}>
                    <Typography variant="subtitle2" fontWeight={600} color="text.secondary" sx={{ textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: 1 }}>
                      Additional Information
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Company Name"
                    {...register('companyName')}
                    error={!!errors.companyName}
                    helperText={errors.companyName?.message || 'Optional: Associate user with a company'}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <BusinessIcon color="action" />
                        </InputAdornment>
                      ),
                    }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2,
                      },
                    }}
                  />
                </Grid>
              </>
            )}

            {isEdit && user?.companyName && (
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Company Name"
                  value={user.companyName}
                  disabled
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <BusinessIcon color="disabled" />
                      </InputAdornment>
                    ),
                  }}
                  helperText="Company name cannot be changed"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                      backgroundColor: 'action.disabledBackground',
                    },
                  }}
                />
              </Grid>
            )}
          </Grid>
        </Box>
      </DialogContent>
      <Divider />
      <DialogActions sx={{ px: 3, py: 2.5, gap: 1.5 }}>
        <Button 
          onClick={onCancel}
          variant="outlined"
          disabled={createUser.isPending || updateUser.isPending}
          sx={{ 
            borderRadius: 2,
            minWidth: 100,
            fontWeight: 500,
          }}
        >
          Cancel
        </Button>
        <Button 
          type="submit" 
          variant="contained" 
          disabled={createUser.isPending || updateUser.isPending}
          startIcon={
            (createUser.isPending || updateUser.isPending) ? (
              <CircularProgress size={16} color="inherit" />
            ) : null
          }
          sx={{ 
            minWidth: 140,
            borderRadius: 2,
            fontWeight: 600,
            boxShadow: 2,
            '&:hover': {
              boxShadow: 4,
            },
          }}
        >
          {createUser.isPending || updateUser.isPending
            ? (isEdit ? 'Updating...' : 'Creating...')
            : (isEdit ? 'Update User' : 'Create User')
          }
        </Button>
      </DialogActions>
    </form>
  );
};

export default UserForm;

