import { useNavigate, useParams } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  CircularProgress,
  Skeleton,
  InputAdornment,
  Switch,
  FormControlLabel,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Alert,
} from '@mui/material';
import StoreIcon from '@mui/icons-material/Store';
import CodeIcon from '@mui/icons-material/Code';
import PhoneIcon from '@mui/icons-material/Phone';
import EmailIcon from '@mui/icons-material/Email';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import NotesIcon from '@mui/icons-material/Notes';
import { useStore, useCreateStore, useUpdateStore } from '../../hooks/useStore';
import type { CreateStoreDto } from '../../api/store';
import Grid from '../../components/common/Grid';
import { useClients } from '../../hooks/useClients';
import { useToast } from '../../contexts/ToastContext';
import { logger } from '../../utils/logger';
import { useUndo } from '../../hooks/useUndo';
import { storeApi } from '../../api/store';
import { storeSchema } from '../../utils/storeValidation';
import { getErrorMessage } from '../../utils/errorHandling';
import ErrorBoundary from '../../components/common/ErrorBoundary';
import PersonIcon from '@mui/icons-material/Person';
import InfoIcon from '@mui/icons-material/Info';

interface StoreFormData {
  clientId: string;
  name: string;
  code: string;
  address?: string;
  phoneCode?: string;
  phoneNumber?: string;
  email?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  notes?: string;
}

const PHONE_CODE_OPTIONS: Array<{ label: string; value: string }> = [
  { label: '+1 (US/Canada)', value: '+1' },
  { label: '+20 (Egypt)', value: '+20' },
  { label: '+30 (Greece)', value: '+30' },
  { label: '+39 (Italy)', value: '+39' },
  { label: '+44 (UK)', value: '+44' },
  { label: '+49 (Germany)', value: '+49' },
  { label: '+90 (Turkey)', value: '+90' },
  { label: '+212 (Morocco)', value: '+212' },
  { label: '+213 (Algeria)', value: '+213' },
  { label: '+216 (Tunisia)', value: '+216' },
  { label: '+218 (Libya)', value: '+218' },
  { label: '+249 (Sudan)', value: '+249' },
  { label: '+251 (Ethiopia)', value: '+251' },
  { label: '+254 (Kenya)', value: '+254' },
  { label: '+971 (UAE)', value: '+971' },
  { label: '+965 (Kuwait)', value: '+965' },
  { label: '+966 (Saudi Arabia)', value: '+966' },
  { label: '+973 (Bahrain)', value: '+973' },
  { label: '+974 (Qatar)', value: '+974' },
  { label: '+968 (Oman)', value: '+968' },
  { label: '+33 (France)', value: '+33' },
  { label: '+34 (Spain)', value: '+34' },
  { label: '+81 (Japan)', value: '+81' },
  { label: '+86 (China)', value: '+86' },
  { label: '+91 (India)', value: '+91' },
  { label: '+61 (Australia)', value: '+61' },
  { label: '+27 (South Africa)', value: '+27' },
  { label: '+55 (Brazil)', value: '+55' },
  { label: '+52 (Mexico)', value: '+52' },
  { label: '+7 (Russia)', value: '+7' },
];

const COMMON_COUNTRIES = [
  'United States',
  'Canada',
  'United Kingdom',
  'Australia',
  'Germany',
  'France',
  'Italy',
  'Spain',
  'Netherlands',
  'Belgium',
  'Switzerland',
  'Austria',
  'Sweden',
  'Norway',
  'Denmark',
  'Finland',
  'Poland',
  'Portugal',
  'Greece',
  'Turkey',
  'Egypt',
  'Saudi Arabia',
  'UAE',
  'Qatar',
  'Kuwait',
  'Bahrain',
  'Oman',
  'India',
  'China',
  'Japan',
  'South Korea',
  'Singapore',
  'Malaysia',
  'Thailand',
  'Indonesia',
  'Philippines',
  'Vietnam',
  'Brazil',
  'Mexico',
  'Argentina',
  'Chile',
  'South Africa',
  'Nigeria',
  'Kenya',
  'Morocco',
  'Algeria',
  'Tunisia',
  'Libya',
  'Sudan',
  'Ethiopia',
];

function normalizeEmptyString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

function splitE164(phone?: string): { phoneCode?: string; phoneNumber?: string } {
  if (!phone) return {};
  const trimmed = phone.trim();
  if (!trimmed.startsWith('+')) return { phoneNumber: trimmed.replace(/\D/g, '') };

  // pick the longest matching code from our list
  const codes = PHONE_CODE_OPTIONS.map((o) => o.value).sort((a, b) => b.length - a.length);
  const match = codes.find((c) => trimmed.startsWith(c));
  if (!match) return { phoneNumber: trimmed.replace(/\D/g, '') };

  const rest = trimmed.slice(match.length).replace(/\D/g, '');
  return { phoneCode: match, phoneNumber: rest };
}

const StoreForm = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const { data: store, isLoading } = useStore(id || '');
  const { data: clients, isLoading: clientsLoading } = useClients();
  const createStore = useCreateStore();
  const updateStore = useUpdateStore();
  const { showToast } = useToast();
  const { createCreateUndo, createUpdateUndo } = useUndo();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    control,
    watch,
  } = useForm<StoreFormData>({
    resolver: zodResolver(storeSchema),
    mode: 'onChange', // Show errors as user types for real-time feedback
    defaultValues: {
      clientId: '',
      name: '',
      code: '',
      address: '',
      phoneCode: '+1',
      phoneNumber: '',
      email: '',
      city: '',
      state: '',
      zip: '',
      country: '',
      notes: '',
    },
  });

  // Load store data when editing
  useEffect(() => {
    if (store) {
      const split = splitE164(store.phone);
      reset({
        clientId: store.clientId || '',
        name: store.name,
        code: store.code,
        address: store.address || '',
        phoneCode: split.phoneCode || '+1',
        phoneNumber: split.phoneNumber || '',
        email: store.email || '',
        city: store.city || '',
        state: store.state || '',
        zip: store.zip || '',
        country: store.country || '',
        notes: store.notes || '',
      });
    }
  }, [store, reset]);

  const onSubmit = async (data: StoreFormData) => {
    try {
      const phoneCode = normalizeEmptyString(data.phoneCode);
      const phoneNumberRaw = normalizeEmptyString(data.phoneNumber);
      const phoneNumberDigits = phoneNumberRaw ? phoneNumberRaw.replace(/\D/g, '') : undefined;
      const phone = phoneCode && phoneNumberDigits ? `${phoneCode}${phoneNumberDigits}` : undefined;

      const payload: CreateStoreDto = {
        clientId: data.clientId,
        name: normalizeEmptyString(data.name) || '',
        code: normalizeEmptyString(data.code) || '',
        address: normalizeEmptyString(data.address),
        phone,
        email: normalizeEmptyString(data.email),
        city: normalizeEmptyString(data.city),
        state: normalizeEmptyString(data.state),
        zip: normalizeEmptyString(data.zip),
        country: normalizeEmptyString(data.country),
        notes: normalizeEmptyString(data.notes),
        // active is always true - removed from form
      };

      // Remove undefined values to avoid sending them
      Object.keys(payload).forEach((key) => {
        if (payload[key] === undefined) {
          delete payload[key];
        }
      });

      if (isEdit && id) {
        // Get previous data for undo
        const previousStore = store;
        const updatedStore = await updateStore.mutateAsync({ id, data: payload });
        showToast('Store updated successfully', 'success');
        
        // Add undo operation for update
        if (previousStore) {
          createUpdateUndo(
            'store',
            `Store ${payload.name}`,
            previousStore,
            async (prevStore) => {
              await storeApi.update(id, {
                clientId: prevStore.clientId || '',
                name: prevStore.name,
                code: prevStore.code,
                address: prevStore.address,
                phone: prevStore.phone,
                email: prevStore.email,
                city: prevStore.city,
                state: prevStore.state,
                zip: prevStore.zip,
                country: prevStore.country,
                notes: prevStore.notes,
              });
              showToast(`Store ${prevStore.name} restored`, 'success');
            },
          );
        }
        navigate('/stores');
      } else {
        const newStore = await createStore.mutateAsync(payload);
        showToast('Store created successfully', 'success');
        
        // Add undo operation for create
        if (newStore && newStore.id) {
          createCreateUndo(
            'store',
            `Store ${payload.name}`,
            newStore,
            async (createdStore) => {
              await storeApi.delete(createdStore.id);
              showToast(`Store ${createdStore.name} removed`, 'success');
            },
          );
        }
        navigate('/stores');
      }
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error, 'Failed to save store');
      showToast(errorMessage, 'error');
      logger.error('Store save error:', error);
    }
  };

  if (isLoading) {
    return (
      <Box>
        <Skeleton variant="text" width={300} height={40} sx={{ mb: 3 }} />
        <Box display="flex" flexDirection="column" gap={3}>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} variant="rectangular" width="100%" height={56} />
          ))}
        </Box>
      </Box>
    );
  }

  return (
    <ErrorBoundary>
      <Box>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 600 }}>
            {isEdit ? 'Edit Store' : 'Create Store'}
          </Typography>
          {isEdit && id && (
            <Chip
              icon={<InfoIcon />}
              label={id}
              variant="outlined"
              size="small"
              sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}
            />
          )}
        </Box>

        <Paper sx={{ p: 3, mt: 2 }}>
          <form onSubmit={handleSubmit(onSubmit)}>
            {/* Basic Information Section */}
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <StoreIcon color="primary" />
              Basic Information
            </Typography>
            
            {isEdit && id && (
              <Box mb={2}>
                <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                  Store ID: {id}
                </Typography>
              </Box>
            )}
            
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12}>
                <Controller
                  name="clientId"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth error={!!errors.clientId} required>
                      <InputLabel>Client *</InputLabel>
                      <Select
                        {...field}
                        label="Client *"
                        disabled={clientsLoading}
                        startAdornment={
                          <InputAdornment position="start">
                            <PersonIcon fontSize="small" color="action" />
                          </InputAdornment>
                        }
                      >
                        {clientsLoading ? (
                          <MenuItem disabled>Loading clients...</MenuItem>
                        ) : clients && clients.length > 0 ? (
                          clients.map((client) => (
                            <MenuItem key={client.id} value={client.id}>
                              {client.name}
                            </MenuItem>
                          ))
                        ) : (
                          <MenuItem disabled>No clients available. Please create a client first.</MenuItem>
                        )}
                      </Select>
                      {errors.clientId && (
                        <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.75 }}>
                          {errors.clientId.message}
                        </Typography>
                      )}
                    </FormControl>
                  )}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Store Name *"
                  {...register('name')}
                  error={!!errors.name}
                  helperText={errors.name?.message}
                  required
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <StoreIcon fontSize="small" color="action" />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Store Code *"
                  {...register('code', {
                    setValueAs: (v) => (typeof v === 'string' ? v.trim().toUpperCase() : v),
                  })}
                  error={!!errors.code}
                  helperText={errors.code?.message || 'Short code for the store (e.g. ROMA, MILANO)'}
                  required
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <CodeIcon fontSize="small" color="action" />
                      </InputAdornment>
                    ),
                  }}
                  inputProps={{
                    style: { textTransform: 'uppercase' },
                    maxLength: 20,
                  }}
                />
              </Grid>
            </Grid>

            <Divider sx={{ my: 3 }} />

            {/* Contact Information Section */}
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
              <PhoneIcon color="primary" />
              Contact Information
            </Typography>

            <Grid container spacing={3} sx={{ mb: 3 }}>
              <Grid item xs={12} md={6}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                    <FormControl sx={{ minWidth: 140, flexShrink: 0, maxWidth: 140 }} error={!!errors.phoneCode}>
                      <InputLabel>Country Code</InputLabel>
                      <Controller
                        name="phoneCode"
                        control={control}
                        render={({ field }) => (
                          <Select
                            {...field}
                            label="Country Code"
                            startAdornment={
                              <InputAdornment position="start">
                                <PhoneIcon fontSize="small" color="action" />
                              </InputAdornment>
                            }
                          >
                            {PHONE_CODE_OPTIONS.map((opt) => (
                              <MenuItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </MenuItem>
                            ))}
                          </Select>
                        )}
                      />
                    </FormControl>
                    <Controller
                      name="phoneNumber"
                      control={control}
                      render={({ field }) => {
                        const formatPhoneNumber = (value: string) => {
                          // Remove all non-digits
                          const digits = value.replace(/\D/g, '');
                          
                          // Get current country code
                          const countryCode = watch('phoneCode') || '+1';
                          
                          // Format based on country code
                          if (countryCode === '+1') {
                            // US/Canada format: (555) 123-4567
                            if (digits.length === 0) return '';
                            if (digits.length <= 3) return `(${digits}`;
                            if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
                            return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
                          }
                          
                          // For other countries, return digits only
                          return digits;
                        };

                        return (
                          <TextField
                            fullWidth
                            label="Phone Number"
                            {...field}
                            value={field.value || ''}
                            onChange={(e) => {
                              const formatted = formatPhoneNumber(e.target.value);
                              field.onChange(formatted);
                            }}
                            error={!!errors.phoneNumber}
                            helperText={errors.phoneNumber?.message}
                            placeholder="(555) 123-4567"
                            InputProps={{
                              startAdornment: (
                                <InputAdornment position="start">
                                  <PhoneIcon sx={{ color: 'action.active' }} />
                                </InputAdornment>
                              ),
                            }}
                            inputProps={{
                              inputMode: 'tel',
                              maxLength: 17,
                            }}
                          />
                        );
                      }}
                    />
                  </Box>
                  {errors.phoneCode && (
                    <Typography variant="caption" color="error" sx={{ ml: 0.5 }}>
                      {errors.phoneCode.message || 'Invalid phone code'}
                    </Typography>
                  )}
                </Box>
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Email"
                  type="email"
                  {...register('email')}
                  error={!!errors.email}
                  helperText={errors.email?.message}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <EmailIcon fontSize="small" color="action" />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
            </Grid>

            <Divider sx={{ my: 3 }} />

            {/* Address Section */}
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <LocationOnIcon color="primary" />
              Address
            </Typography>

            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Street Address"
                  multiline
                  rows={2}
                  {...register('address')}
                  error={!!errors.address}
                  helperText={errors.address?.message || 'Full street address'}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start" sx={{ alignSelf: 'flex-start', mt: 1 }}>
                        <LocationOnIcon fontSize="small" color="action" />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="City"
                  {...register('city')}
                  error={!!errors.city}
                  helperText={errors.city?.message}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="State/Province"
                  {...register('state')}
                  error={!!errors.state}
                  helperText={errors.state?.message}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Zip/Postal Code"
                  {...register('zip')}
                  error={!!errors.zip}
                  helperText={errors.zip?.message}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <Controller
                  name="country"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth>
                      <InputLabel>Country</InputLabel>
                      <Select
                        {...field}
                        label="Country"
                        value={field.value || ''}
                        onChange={(e) => field.onChange(e.target.value || undefined)}
                        renderValue={(value) => value || ''}
                      >
                        <MenuItem value="">
                          <em>None</em>
                        </MenuItem>
                        {COMMON_COUNTRIES.map((country) => (
                          <MenuItem key={country} value={country}>
                            {country}
                          </MenuItem>
                        ))}
                      </Select>
                      {errors.country && (
                        <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.75 }}>
                          {errors.country.message}
                        </Typography>
                      )}
                    </FormControl>
                  )}
                />
              </Grid>
            </Grid>

            <Divider sx={{ my: 3 }} />

            {/* Additional Information Section */}
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <NotesIcon color="primary" />
              Additional Information
            </Typography>

            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Notes"
                  multiline
                  rows={4}
                  {...register('notes')}
                  error={!!errors.notes}
                  helperText={errors.notes?.message || 'Additional notes or information about the store'}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start" sx={{ alignSelf: 'flex-start', mt: 1 }}>
                        <NotesIcon fontSize="small" color="action" />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
            </Grid>

            <Divider sx={{ my: 3 }} />

            {/* Form Actions */}
            <Box display="flex" gap={2} justifyContent="flex-end" mt={3}>
              <Button
                variant="outlined"
                onClick={() => navigate('/stores')}
                disabled={createStore.isPending || updateStore.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="contained"
                disabled={createStore.isPending || updateStore.isPending}
                startIcon={(createStore.isPending || updateStore.isPending) ? <CircularProgress size={16} /> : null}
                sx={{ minWidth: 120 }}
              >
                {isEdit ? 'Update Store' : 'Create Store'}
              </Button>
            </Box>
          </form>
        </Paper>
      </Box>
    </ErrorBoundary>
  );
};

export default StoreForm;

