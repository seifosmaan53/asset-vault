import { useNavigate, useParams } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  Chip,
  Autocomplete,
  Divider,
  InputAdornment,
  Skeleton,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
} from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import EmailIcon from '@mui/icons-material/Email';
import PhoneIcon from '@mui/icons-material/Phone';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import NotesIcon from '@mui/icons-material/Notes';
import PrintIcon from '@mui/icons-material/Print';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import Grid from "../../components/common/Grid";
import { useClient, useCreateClient, useUpdateClient } from '../../hooks/useClients';
import type { Client, Address } from '../../types/client';
import { clientsApi } from '../../api/clients';
import { useEffect, useState } from 'react';
import { clientSchema } from '../../utils/validationSchemas';
import { useToast } from '../../contexts/ToastContext';
import { useInlineValidation } from '../../hooks/useInlineValidation';
import { InlineError } from '../../components/common/InlineError';
import { logger } from '../../utils/logger';
import ErrorBoundary from '../../components/common/ErrorBoundary';
import { getErrorMessage } from '../../utils/errorHandling';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { useUndo } from '../../hooks/useUndo';

interface ClientFormData {
  name: string;
  email?: string;
  phoneCountryCode?: string;
  phone?: string;
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  notes?: string;
}


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

const ClientForm = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const { data: client, isLoading } = useClient(id || '');
  const createClient = useCreateClient();
  const updateClient = useUpdateClient();
  const { showToast } = useToast();
  const { createCreateUndo, createUpdateUndo } = useUndo();

  const {
    register,
    handleSubmit,
    formState: { errors, touchedFields },
    reset,
    watch,
    setValue,
    setError,
    control,
  } = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema),
    mode: 'onChange', // Show errors as user types for real-time feedback
    defaultValues: {
      phoneCountryCode: '+1',
    },
  });

  const { getFieldError, shouldShowError } = useInlineValidation(
    {
      control,
      formState: { errors, touchedFields },
    },
    'onTouched',
  );


  // Parse phone number to extract country code and number
  const parsePhoneNumber = (phone: string | undefined) => {
    if (!phone) return { code: '+1', number: '' };
    // Check if phone starts with +
    if (phone.startsWith('+')) {
      // Extract country code (typically 1-3 digits after +)
      const match = phone.match(/^\+(\d{1,3})(.*)/);
      if (match) {
        return { code: `+${match[1]}`, number: match[2].trim() };
      }
    }
    // Default to US/Canada if no country code
    return { code: '+1', number: phone };
  };

  useEffect(() => {
    if (client) {
      const { code, number } = parsePhoneNumber(client.phone);
      reset({
        name: client.name,
        email: client.email || '',
        phoneCountryCode: code,
        phone: number,
        street: client.addressJson?.street || '',
        city: client.addressJson?.city || '',
        state: client.addressJson?.state || '',
        zip: client.addressJson?.zip || '',
        country: client.addressJson?.country || '',
        notes: client.notes || '',
      });
    }
  }, [client, reset]);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    shortcuts: [
      {
        key: 's',
        ctrl: true,
        meta: true,
        handler: () => {
          // Trigger form submission
          const form = document.querySelector('form');
          if (form) {
            const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
            form.dispatchEvent(submitEvent);
          }
        },
        description: 'Save client',
        ignoreWhenTyping: true,
      },
    ],
  });

  const onSubmit = async (data: ClientFormData) => {
    try {
      // Validate client name is not empty
      if (!data.name || data.name.trim() === '') {
        showToast('Client name is required', 'error');
        setError('name', { type: 'manual', message: 'Client name is required' });
        return;
      }

      // Build address object only if at least one field is provided
      const addressJson: Address | undefined =
        data.street || data.city || data.state || data.zip || data.country
          ? {
              street: (data.street || '').trim(),
              city: (data.city || '').trim(),
              state: (data.state || '').trim(),
              zip: (data.zip || '').trim(),
              country: (data.country || '').trim(),
            }
          : undefined;

      // Combine country code and phone number
      const phoneValue = data.phone && typeof data.phone === 'string' && data.phone.trim()
        ? `${data.phoneCountryCode || '+1'} ${data.phone.trim()}`.trim()
        : undefined;

      const clientData: Partial<Client> = {
        name: data.name.trim(),
        // Fix Bug #60: Email validation is handled by zod schema, but add extra safety
        email: data.email && typeof data.email === 'string' && data.email.trim() 
          ? (data.email.trim().includes('@') ? data.email.trim() : undefined)
          : undefined,
        // Fix Bug #70: Phone validation - combine country code and number
        phone: phoneValue,
        addressJson,
        notes: data.notes?.trim() || undefined,
      };

      // Remove undefined values
      Object.keys(clientData).forEach((key) => {
        if (clientData[key as keyof Client] === undefined) {
          delete clientData[key as keyof Client];
        }
      });

      if (isEdit && id) {
        // Get previous data for undo
        const previousClient = client;
        const updatedClient = await updateClient.mutateAsync({ id, data: clientData });
        showToast('Client updated successfully', 'success');
        
        // Add undo operation for update
        if (previousClient) {
          createUpdateUndo(
            'client',
            `Client ${clientData.name}`,
            previousClient,
            async (prevClient: Client) => {
              await clientsApi.update(id, {
                name: prevClient.name,
                email: prevClient.email,
                phone: prevClient.phone,
                addressJson: prevClient.addressJson,
                notes: prevClient.notes,
              });
              showToast(`Client ${prevClient.name} restored`, 'success');
            },
          );
        }
      } else {
        const newClient = await createClient.mutateAsync(clientData);
        showToast('Client created successfully', 'success');
        
        // Add undo operation for create
        if (newClient && newClient.id) {
          createCreateUndo(
            'client',
            `Client ${clientData.name}`,
            newClient,
            async (createdClient: Client) => {
              await clientsApi.delete(createdClient.id);
              showToast(`Client ${createdClient.name} removed`, 'success');
            },
          );
        }
      }
      navigate('/clients');
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error, 'An error occurred');
      showToast(errorMessage, 'error');
      logger.error('Client save error:', error);
    }
  };

  if (isLoading) {
    return (
      <Box>
        <Skeleton variant="text" width={300} height={40} sx={{ mb: 3 }} />
        <Box display="flex" flexDirection="column" gap={3}>
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} variant="rectangular" width="100%" height={56} />
          ))}
        </Box>
      </Box>
    );
  }

  return (
    <ErrorBoundary>
      <Box>
        <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 600, mb: 3 }}>
          {isEdit ? 'Edit Client' : 'Create Client'}
        </Typography>

      <Paper sx={{ p: 4, mt: 2, borderRadius: 2, boxShadow: 2 }}>
        <form onSubmit={handleSubmit(onSubmit)}>
          <Grid container spacing={3}>
            {/* Contact Information Section */}
            <Grid item xs={12}>
              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <PersonIcon color="primary" />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Contact Information
                </Typography>
              </Box>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label={
                  <span>
                    Name <span style={{ color: '#d32f2f', marginLeft: '4px', fontSize: '16px', fontWeight: 'bold' }}>★</span>
                  </span>
                }
                {...register('name', { required: 'Name is required' })}
                error={!!errors.name || shouldShowError('name')}
                helperText={errors.name?.message}
                InputLabelProps={{ required: false }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    '&.Mui-error': {
                      borderColor: errors.name ? 'error.main' : undefined,
                    },
                  },
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <PersonIcon sx={{ color: 'action.active' }} />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Email"
                type="email"
                {...register('email', {
                  validate: (value) => {
                    if (!value) return true; // Optional
                    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || 'Invalid email format';
                  },
                })}
                error={!!errors.email || shouldShowError('email')}
                helperText={errors.email?.message || 'Optional email address'}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <EmailIcon sx={{ color: 'action.active' }} />
                    </InputAdornment>
                  ),
                }}
              />
              {shouldShowError('email') && getFieldError('email') && (
                <InlineError message={getFieldError('email')!} />
              )}
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                <FormControl sx={{ minWidth: 160, flexShrink: 0 }}>
                  <InputLabel>Country Code</InputLabel>
                  <Controller
                    name="phoneCountryCode"
                    control={control}
                    defaultValue="+1"
                    render={({ field }) => (
                      <Select
                        {...field}
                        label="Country Code"
                      >
                        <MenuItem value="+1">+1 (US/Canada)</MenuItem>
                        <MenuItem value="+44">+44 (UK)</MenuItem>
                        <MenuItem value="+33">+33 (France)</MenuItem>
                        <MenuItem value="+49">+49 (Germany)</MenuItem>
                        <MenuItem value="+39">+39 (Italy)</MenuItem>
                        <MenuItem value="+34">+34 (Spain)</MenuItem>
                        <MenuItem value="+31">+31 (Netherlands)</MenuItem>
                        <MenuItem value="+32">+32 (Belgium)</MenuItem>
                        <MenuItem value="+41">+41 (Switzerland)</MenuItem>
                        <MenuItem value="+43">+43 (Austria)</MenuItem>
                        <MenuItem value="+46">+46 (Sweden)</MenuItem>
                        <MenuItem value="+47">+47 (Norway)</MenuItem>
                        <MenuItem value="+45">+45 (Denmark)</MenuItem>
                        <MenuItem value="+358">+358 (Finland)</MenuItem>
                        <MenuItem value="+48">+48 (Poland)</MenuItem>
                        <MenuItem value="+351">+351 (Portugal)</MenuItem>
                        <MenuItem value="+30">+30 (Greece)</MenuItem>
                        <MenuItem value="+90">+90 (Turkey)</MenuItem>
                        <MenuItem value="+20">+20 (Egypt)</MenuItem>
                        <MenuItem value="+966">+966 (Saudi Arabia)</MenuItem>
                        <MenuItem value="+971">+971 (UAE)</MenuItem>
                        <MenuItem value="+974">+974 (Qatar)</MenuItem>
                        <MenuItem value="+965">+965 (Kuwait)</MenuItem>
                        <MenuItem value="+973">+973 (Bahrain)</MenuItem>
                        <MenuItem value="+968">+968 (Oman)</MenuItem>
                        <MenuItem value="+91">+91 (India)</MenuItem>
                        <MenuItem value="+86">+86 (China)</MenuItem>
                        <MenuItem value="+81">+81 (Japan)</MenuItem>
                        <MenuItem value="+82">+82 (South Korea)</MenuItem>
                        <MenuItem value="+65">+65 (Singapore)</MenuItem>
                        <MenuItem value="+60">+60 (Malaysia)</MenuItem>
                        <MenuItem value="+66">+66 (Thailand)</MenuItem>
                        <MenuItem value="+62">+62 (Indonesia)</MenuItem>
                        <MenuItem value="+63">+63 (Philippines)</MenuItem>
                        <MenuItem value="+84">+84 (Vietnam)</MenuItem>
                        <MenuItem value="+55">+55 (Brazil)</MenuItem>
                        <MenuItem value="+52">+52 (Mexico)</MenuItem>
                        <MenuItem value="+54">+54 (Argentina)</MenuItem>
                        <MenuItem value="+56">+56 (Chile)</MenuItem>
                        <MenuItem value="+27">+27 (South Africa)</MenuItem>
                        <MenuItem value="+234">+234 (Nigeria)</MenuItem>
                        <MenuItem value="+254">+254 (Kenya)</MenuItem>
                        <MenuItem value="+212">+212 (Morocco)</MenuItem>
                        <MenuItem value="+213">+213 (Algeria)</MenuItem>
                        <MenuItem value="+216">+216 (Tunisia)</MenuItem>
                        <MenuItem value="+218">+218 (Libya)</MenuItem>
                        <MenuItem value="+249">+249 (Sudan)</MenuItem>
                        <MenuItem value="+251">+251 (Ethiopia)</MenuItem>
                        <MenuItem value="+61">+61 (Australia)</MenuItem>
                      </Select>
                    )}
                  />
                </FormControl>
                <Controller
                  name="phone"
                  control={control}
                  render={({ field }) => {
                    const formatPhoneNumber = (value: string) => {
                      // Remove all non-digits
                      const digits = value.replace(/\D/g, '');
                      
                      // Get current country code
                      const countryCode = watch('phoneCountryCode') || '+1';
                      
                      // Format based on country code
                      if (countryCode === '+1') {
                        // US/Canada format: (555) 123-4567
                        if (digits.length === 0) return '';
                        if (digits.length <= 3) return `(${digits}`;
                        if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
                        return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
                      }
                      
                      // For other countries, just return digits (can be enhanced later)
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
                        helperText="Digits only (we will save as +code number)"
                        placeholder="(555) 123-4567"
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <PhoneIcon sx={{ color: 'action.active' }} />
                            </InputAdornment>
                          ),
                        }}
                      />
                    );
                  }}
                />
              </Box>
            </Grid>

            {/* Address Section */}
            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
            </Grid>
            
            <Grid item xs={12}>
              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <LocationOnIcon color="primary" />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Address
                </Typography>
              </Box>
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Street Address"
                {...register('street')}
                placeholder="123 Main Street"
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="City"
                {...register('city')}
                placeholder="New York"
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="State / Province"
                {...register('state')}
                placeholder="NY"
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="ZIP / Postal Code"
                {...register('zip')}
                placeholder="10001"
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
                  </FormControl>
                )}
              />
            </Grid>

            {/* Additional Information Section */}
            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
            </Grid>
            
            <Grid item xs={12}>
              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <NotesIcon color="primary" />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Notes
                </Typography>
              </Box>
              <TextField
                fullWidth
                label="Additional Notes"
                multiline
                rows={4}
                {...register('notes')}
                placeholder="Add any additional information about this client..."
                helperText="Optional notes or comments about the client"
              />
            </Grid>

            {/* Action Buttons */}
            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Box display="flex" gap={2} justifyContent="flex-end" mt={2}>
                <Button 
                  variant="outlined" 
                  onClick={() => navigate('/clients')}
                  size="large"
                  disabled={createClient.isPending || updateClient.isPending}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  variant="contained" 
                  size="large"
                  sx={{ minWidth: 120 }}
                  disabled={createClient.isPending || updateClient.isPending}
                  startIcon={(createClient.isPending || updateClient.isPending) ? (
                    <CircularProgress size={16} sx={{ color: 'inherit' }} />
                  ) : null}
                >
                  {isEdit ? 'Update Client' : 'Create Client'}
                </Button>
              </Box>
            </Grid>
          </Grid>
        </form>
      </Paper>
      </Box>
    </ErrorBoundary>
  );
};

export default ClientForm;

