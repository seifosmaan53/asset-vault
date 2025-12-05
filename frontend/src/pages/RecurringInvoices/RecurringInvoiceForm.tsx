import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { useToast } from '../../contexts/ToastContext';
import {
  Box,
  Typography,
  TextField,
  Button,
  Grid,
  Paper,
  IconButton,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Checkbox,
  FormControlLabel,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import { useRecurringInvoice, useCreateRecurringInvoice, useUpdateRecurringInvoice } from '../../hooks/useRecurringInvoices';
import { useClients } from '../../hooks/useClients';
import InventorySelect from '../../components/inventory/InventorySelect';
import { InventoryItem } from '../../types/inventory';

interface RecurringInvoiceItemForm {
  inventoryItemId?: string;
  inventoryItem?: InventoryItem | null;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  discountRate: number;
}

interface RecurringInvoiceFormData {
  clientId: string;
  name: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  interval: number;
  startDate: string;
  endDate?: string;
  nextRunDate: string;
  currency: string;
  items: RecurringInvoiceItemForm[];
  notes?: string;
  isActive: boolean;
}

const RecurringInvoiceForm = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const { data: recurringInvoice, isLoading } = useRecurringInvoice(id || '');
  const { data: clients } = useClients();
  const createRecurringInvoice = useCreateRecurringInvoice();
  const updateRecurringInvoice = useUpdateRecurringInvoice();
  const { showToast } = useToast();

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
    reset,
    setValue,
  } = useForm<RecurringInvoiceFormData>({
    defaultValues: {
      frequency: 'monthly',
      interval: 1,
      currency: 'USD',
      isActive: true,
      items: [{ description: '', quantity: 1, unitPrice: 0, taxRate: 0, discountRate: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });

  useEffect(() => {
    if (recurringInvoice) {
      reset({
        clientId: recurringInvoice.clientId,
        name: recurringInvoice.name,
        frequency: recurringInvoice.frequency,
        interval: recurringInvoice.interval,
        startDate: recurringInvoice.startDate.split('T')[0],
        endDate: recurringInvoice.endDate ? recurringInvoice.endDate.split('T')[0] : undefined,
        nextRunDate: recurringInvoice.nextRunDate.split('T')[0],
        currency: recurringInvoice.currency,
        notes: recurringInvoice.notes || '',
        isActive: recurringInvoice.isActive,
        items: recurringInvoice.items?.map((item) => ({
          inventoryItemId: item.inventoryItemId,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          taxRate: item.taxRate,
          discountRate: item.discountRate,
        })) || [],
      });
    }
  }, [recurringInvoice, reset]);

  const handleInventorySelect = (index: number, item: InventoryItem | null) => {
    if (item) {
      setValue(`items.${index}.inventoryItem`, item);
      setValue(`items.${index}.inventoryItemId`, item.id);
      setValue(`items.${index}.description`, item.name);
      setValue(`items.${index}.unitPrice`, item.defaultUnitPrice);
      setValue(`items.${index}.taxRate`, item.defaultTaxRate || 0);
    } else {
      setValue(`items.${index}.inventoryItem`, null);
      setValue(`items.${index}.inventoryItemId`, undefined);
    }
  };

  const onSubmit = async (data: RecurringInvoiceFormData) => {
    try {
      const recurringData = {
        ...data,
        items: data.items.map((item) => ({
          inventoryItemId: item.inventoryItemId,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          taxRate: item.taxRate,
          discountRate: item.discountRate,
        })),
      };

      if (isEdit && id) {
        await updateRecurringInvoice.mutateAsync({ id, data: recurringData });
        showToast('Recurring invoice updated successfully', 'success');
      } else {
        await createRecurringInvoice.mutateAsync(recurringData);
        showToast('Recurring invoice created successfully', 'success');
      }
      navigate('/recurring-invoices');
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
        {isEdit ? 'Edit Recurring Invoice' : 'Create Recurring Invoice'}
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
              <FormControl fullWidth>
                <InputLabel>Client *</InputLabel>
                <Select
                  value={watch('clientId') || ''}
                  label="Client *"
                  {...register('clientId', { required: 'Client is required' })}
                  error={!!errors.clientId}
                >
                  {clients?.map((client) => (
                    <MenuItem key={client.id} value={client.id}>
                      {client.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>Frequency *</InputLabel>
                <Select
                  value={watch('frequency')}
                  label="Frequency *"
                  {...register('frequency', { required: true })}
                >
                  <MenuItem value="daily">Daily</MenuItem>
                  <MenuItem value="weekly">Weekly</MenuItem>
                  <MenuItem value="monthly">Monthly</MenuItem>
                  <MenuItem value="quarterly">Quarterly</MenuItem>
                  <MenuItem value="yearly">Yearly</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Interval *"
                type="number"
                {...register('interval', { required: true, valueAsNumber: true, min: 1 })}
                error={!!errors.interval}
                helperText={errors.interval?.message}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Currency *"
                {...register('currency', { required: true })}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Start Date *"
                type="date"
                {...register('startDate', { required: true })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="End Date"
                type="date"
                {...register('endDate')}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Next Run Date *"
                type="date"
                {...register('nextRunDate', { required: true })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={<Checkbox {...register('isActive')} defaultChecked />}
                label="Active"
              />
            </Grid>

            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Line Items
              </Typography>
              {fields.map((field, index) => (
                <Paper key={field.id} sx={{ p: 2, mb: 2 }}>
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <InventorySelect
                        value={watch(`items.${index}.inventoryItem`) || null}
                        onChange={(item) => handleInventorySelect(index, item)}
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="Description *"
                        {...register(`items.${index}.description`, { required: true })}
                      />
                    </Grid>
                    <Grid item xs={12} md={2}>
                      <TextField
                        fullWidth
                        label="Quantity *"
                        type="number"
                        {...register(`items.${index}.quantity`, {
                          required: true,
                          valueAsNumber: true,
                          min: 0.01,
                        })}
                      />
                    </Grid>
                    <Grid item xs={12} md={2}>
                      <TextField
                        fullWidth
                        label="Unit Price *"
                        type="number"
                        {...register(`items.${index}.unitPrice`, {
                          required: true,
                          valueAsNumber: true,
                        })}
                      />
                    </Grid>
                    <Grid item xs={12} md={1}>
                      <TextField
                        fullWidth
                        label="Tax %"
                        type="number"
                        {...register(`items.${index}.taxRate`, {
                          valueAsNumber: true,
                        })}
                      />
                    </Grid>
                    <Grid item xs={12} md={1}>
                      <TextField
                        fullWidth
                        label="Disc %"
                        type="number"
                        {...register(`items.${index}.discountRate`, {
                          valueAsNumber: true,
                        })}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <IconButton
                        onClick={() => remove(index)}
                        color="error"
                        disabled={fields.length === 1}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Grid>
                  </Grid>
                </Paper>
              ))}
              <Button
                startIcon={<AddIcon />}
                onClick={() =>
                  append({
                    description: '',
                    quantity: 1,
                    unitPrice: 0,
                    taxRate: 0,
                    discountRate: 0,
                  })
                }
              >
                Add Item
              </Button>
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
                <Button variant="outlined" onClick={() => navigate('/recurring-invoices')}>
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

export default RecurringInvoiceForm;

