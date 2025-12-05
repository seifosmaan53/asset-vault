import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Box,
  Typography,
  TextField,
  Button,
  Grid,
  Paper,
} from '@mui/material';
import { useClient, useCreateClient, useUpdateClient } from '../../hooks/useClients';
import { Client, Address } from '../../types/client';
import { useEffect } from 'react';
import { clientSchema } from '../../utils/validationSchemas';
import { useToast } from '../../contexts/ToastContext';

interface ClientFormData {
  name: string;
  email?: string;
  phone?: string;
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  notes?: string;
}

const ClientForm = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const { data: client, isLoading } = useClient(id || '');
  const createClient = useCreateClient();
  const updateClient = useUpdateClient();
  const { showToast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema),
  });

  useEffect(() => {
    if (client) {
      reset({
        name: client.name,
        email: client.email || '',
        phone: client.phone || '',
        street: client.addressJson?.street || '',
        city: client.addressJson?.city || '',
        state: client.addressJson?.state || '',
        zip: client.addressJson?.zip || '',
        country: client.addressJson?.country || '',
        notes: client.notes || '',
      });
    }
  }, [client, reset]);

  const onSubmit = async (data: ClientFormData) => {
    const addressJson: Address | undefined =
      data.street || data.city || data.state || data.zip || data.country
        ? {
            street: data.street || '',
            city: data.city || '',
            state: data.state || '',
            zip: data.zip || '',
            country: data.country || '',
          }
        : undefined;

    const clientData: Partial<Client> = {
      name: data.name,
      email: data.email || undefined,
      phone: data.phone || undefined,
      addressJson,
      notes: data.notes || undefined,
    };

    try {
      if (isEdit && id) {
        await updateClient.mutateAsync({ id, data: clientData });
        showToast('Client updated successfully', 'success');
      } else {
        await createClient.mutateAsync(clientData as any);
        showToast('Client created successfully', 'success');
      }
      navigate('/clients');
    } catch (error: any) {
      showToast(error.response?.data?.message || 'An error occurred', 'error');
    }
  };

  if (isLoading) {
    return <Typography>Loading...</Typography>;
  }

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        {isEdit ? 'Edit Client' : 'Create Client'}
      </Typography>

      <Paper sx={{ p: 3, mt: 2 }}>
        <form onSubmit={handleSubmit(onSubmit)}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Name *"
                {...register('name', { required: 'Name is required' })}
                error={!!errors.name}
                helperText={errors.name?.message}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Email"
                type="email"
                {...register('email')}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Phone"
                {...register('phone')}
              />
            </Grid>
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Address
              </Typography>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Street"
                {...register('street')}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="City"
                {...register('city')}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="State"
                {...register('state')}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="ZIP"
                {...register('zip')}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Country"
                {...register('country')}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Notes"
                multiline
                rows={4}
                {...register('notes')}
              />
            </Grid>
            <Grid item xs={12}>
              <Box display="flex" gap={2}>
                <Button type="submit" variant="contained">
                  {isEdit ? 'Update' : 'Create'}
                </Button>
                <Button variant="outlined" onClick={() => navigate('/clients')}>
                  Cancel
                </Button>
              </Box>
            </Grid>
          </Grid>
        </form>
      </Paper>
    </Box>
  );
};

export default ClientForm;

