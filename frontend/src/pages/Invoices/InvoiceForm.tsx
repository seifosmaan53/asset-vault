import { useState, useEffect } from 'react';
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
  Alert,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import { useInvoice, useCreateInvoice, useUpdateInvoice } from '../../hooks/useInvoices';
import { useClients } from '../../hooks/useClients';
import InventorySelect from '../../components/inventory/InventorySelect';
import { InventoryItem } from '../../types/inventory';
import { formatCurrency } from '../../utils/formatters';

interface InvoiceItemForm {
  inventoryItemId?: string;
  inventoryItem?: InventoryItem | null;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  discountRate: number;
}

interface InvoiceFormData {
  clientId: string;
  type: 'invoice' | 'estimate';
  issueDate: string;
  dueDate?: string;
  currency: string;
  notes?: string;
  items: InvoiceItemForm[];
}

const InvoiceForm = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const { data: invoice, isLoading } = useInvoice(id || '');
  const { data: clients } = useClients();
  const createInvoice = useCreateInvoice();
  const updateInvoice = useUpdateInvoice();
  const { showToast } = useToast();
  const [stockWarnings, setStockWarnings] = useState<Record<number, string>>({});

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
    reset,
    setValue,
  } = useForm<InvoiceFormData>({
    defaultValues: {
      type: 'invoice',
      currency: 'USD',
      issueDate: new Date().toISOString().split('T')[0],
      items: [{ description: '', quantity: 1, unitPrice: 0, taxRate: 0, discountRate: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });

  const watchedItems = watch('items');

  useEffect(() => {
    if (invoice) {
      reset({
        clientId: invoice.clientId,
        type: invoice.type,
        issueDate: invoice.issueDate.split('T')[0],
        dueDate: invoice.dueDate ? invoice.dueDate.split('T')[0] : undefined,
        currency: invoice.currency,
        notes: invoice.notes || '',
        items: invoice.items?.map((item) => ({
          inventoryItemId: item.inventoryItemId,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          taxRate: item.taxRate,
          discountRate: item.discountRate,
        })) || [],
      });
    }
  }, [invoice, reset]);

  const calculateLineTotal = (item: InvoiceItemForm) => {
    const subtotal = item.quantity * item.unitPrice;
    const discount = (subtotal * item.discountRate) / 100;
    const afterDiscount = subtotal - discount;
    const tax = (afterDiscount * item.taxRate) / 100;
    return afterDiscount + tax;
  };

  const calculateTotals = () => {
    let subtotal = 0;
    let taxTotal = 0;
    let discountTotal = 0;

    watchedItems.forEach((item) => {
      const lineSubtotal = item.quantity * item.unitPrice;
      const lineDiscount = (lineSubtotal * item.discountRate) / 100;
      const lineAfterDiscount = lineSubtotal - lineDiscount;
      const lineTax = (lineAfterDiscount * item.taxRate) / 100;

      subtotal += lineSubtotal;
      discountTotal += lineDiscount;
      taxTotal += lineTax;
    });

    return {
      subtotal,
      taxTotal,
      discountTotal,
      total: subtotal - discountTotal + taxTotal,
    };
  };

  const handleInventorySelect = (index: number, item: InventoryItem | null) => {
    if (item) {
      setValue(`items.${index}.inventoryItem`, item);
      setValue(`items.${index}.inventoryItemId`, item.id);
      setValue(`items.${index}.description`, item.name);
      setValue(`items.${index}.unitPrice`, item.defaultUnitPrice);
      setValue(`items.${index}.taxRate`, item.defaultTaxRate || 0);

      // Check stock availability
      const availableStock = item.currentStock - item.reservedStock;
      const quantity = watchedItems[index]?.quantity || 0;
      if (quantity > availableStock) {
        setStockWarnings({
          ...stockWarnings,
          [index]: `Quantity exceeds available stock (available: ${availableStock})`,
        });
      } else {
        const newWarnings = { ...stockWarnings };
        delete newWarnings[index];
        setStockWarnings(newWarnings);
      }
    } else {
      setValue(`items.${index}.inventoryItem`, null);
      setValue(`items.${index}.inventoryItemId`, undefined);
    }
  };

  const handleQuantityChange = (index: number, quantity: number) => {
    setValue(`items.${index}.quantity`, quantity);
    const item = watchedItems[index]?.inventoryItem;
    if (item) {
      const availableStock = item.currentStock - item.reservedStock;
      if (quantity > availableStock) {
        setStockWarnings({
          ...stockWarnings,
          [index]: `Quantity exceeds available stock (available: ${availableStock})`,
        });
      } else {
        const newWarnings = { ...stockWarnings };
        delete newWarnings[index];
        setStockWarnings(newWarnings);
      }
    }
  };

  const onSubmit = async (data: InvoiceFormData) => {
    try {
      const invoiceData = {
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
        await updateInvoice.mutateAsync({ id, data: invoiceData });
        showToast('Invoice updated successfully', 'success');
      } else {
        await createInvoice.mutateAsync(invoiceData);
        showToast('Invoice created successfully', 'success');
      }
      navigate('/invoices');
    } catch (error: any) {
      showToast(error.response?.data?.message || 'An error occurred', 'error');
    }
  };

  const totals = calculateTotals();

  if (isLoading) {
    return <Typography>Loading...</Typography>;
  }

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        {isEdit ? 'Edit Invoice' : 'Create Invoice'}
      </Typography>

      <Paper sx={{ p: 3, mt: 2 }}>
        <form onSubmit={handleSubmit(onSubmit)}>
          <Grid container spacing={2}>
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
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Type *</InputLabel>
                <Select
                  value={watch('type')}
                  label="Type *"
                  {...register('type', { required: true })}
                >
                  <MenuItem value="invoice">Invoice</MenuItem>
                  <MenuItem value="estimate">Estimate</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Issue Date *"
                type="date"
                {...register('issueDate', { required: true })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Due Date"
                type="date"
                {...register('dueDate')}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Currency *"
                {...register('currency', { required: true })}
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
                        value={watchedItems[index]?.inventoryItem || null}
                        onChange={(item) => handleInventorySelect(index, item)}
                      />
                    </Grid>
                    {stockWarnings[index] && (
                      <Grid item xs={12}>
                        <Alert severity="warning">{stockWarnings[index]}</Alert>
                      </Grid>
                    )}
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
                        onChange={(e) =>
                          handleQuantityChange(index, parseFloat(e.target.value) || 0)
                        }
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
                    <Grid item xs={12} md={12}>
                      <Typography variant="body2" color="text.secondary">
                        Line Total: {formatCurrency(calculateLineTotal(watchedItems[index]))}
                      </Typography>
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
              <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography>Subtotal:</Typography>
                  </Grid>
                  <Grid item xs={6} textAlign="right">
                    <Typography>{formatCurrency(totals.subtotal)}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography>Discount:</Typography>
                  </Grid>
                  <Grid item xs={6} textAlign="right">
                    <Typography>-{formatCurrency(totals.discountTotal)}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography>Tax:</Typography>
                  </Grid>
                  <Grid item xs={6} textAlign="right">
                    <Typography>{formatCurrency(totals.taxTotal)}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="h6">Total:</Typography>
                  </Grid>
                  <Grid item xs={6} textAlign="right">
                    <Typography variant="h6">{formatCurrency(totals.total)}</Typography>
                  </Grid>
                </Grid>
              </Paper>
            </Grid>

            <Grid item xs={12}>
              <Box display="flex" gap={2}>
                <Button type="submit" variant="contained">
                  {isEdit ? 'Update' : 'Create'}
                </Button>
                <Button variant="outlined" onClick={() => navigate('/invoices')}>
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

export default InvoiceForm;

