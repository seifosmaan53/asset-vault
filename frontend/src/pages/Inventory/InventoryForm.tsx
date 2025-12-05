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
import { useInventoryItem, useCreateInventoryItem, useUpdateInventoryItem } from '../../hooks/useInventory';
import { useEffect } from 'react';
import { inventoryItemSchema } from '../../utils/validationSchemas';
import { useToast } from '../../contexts/ToastContext';

interface InventoryFormData {
  sku: string;
  name: string;
  description?: string;
  category?: string;
  unit: string;
  barcode?: string;
  costPrice?: number;
  defaultUnitPrice: number;
  defaultTaxRate?: number;
  currentStock: number;
  reorderLevel: number;
  maxStockLevel?: number;
  status: 'active' | 'inactive';
}

const InventoryForm = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const { data: item, isLoading } = useInventoryItem(id || '');
  const createItem = useCreateInventoryItem();
  const updateItem = useUpdateInventoryItem();
  const { showToast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<InventoryFormData>({
    resolver: zodResolver(inventoryItemSchema),
    defaultValues: {
      status: 'active',
      currentStock: 0,
      reorderLevel: 0,
      defaultUnitPrice: 0,
    },
  });

  useEffect(() => {
    if (item) {
      reset({
        sku: item.sku,
        name: item.name,
        description: item.description || '',
        category: item.category || '',
        unit: item.unit,
        barcode: item.barcode || '',
        costPrice: item.costPrice || 0,
        defaultUnitPrice: item.defaultUnitPrice,
        defaultTaxRate: item.defaultTaxRate || 0,
        currentStock: item.currentStock,
        reorderLevel: item.reorderLevel,
        maxStockLevel: item.maxStockLevel || 0,
        status: item.status,
      });
    }
  }, [item, reset]);

  const onSubmit = async (data: InventoryFormData) => {
    try {
      if (isEdit && id) {
        await updateItem.mutateAsync({ id, data });
        showToast('Inventory item updated successfully', 'success');
      } else {
        await createItem.mutateAsync(data);
        showToast('Inventory item created successfully', 'success');
      }
      navigate('/inventory');
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
        {isEdit ? 'Edit Inventory Item' : 'Create Inventory Item'}
      </Typography>

      <Paper sx={{ p: 3, mt: 2 }}>
        <form onSubmit={handleSubmit(onSubmit)}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="SKU *"
                {...register('sku', { required: 'SKU is required' })}
                error={!!errors.sku}
                helperText={errors.sku?.message}
                disabled={isEdit}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Name *"
                {...register('name', { required: 'Name is required' })}
                error={!!errors.name}
                helperText={errors.name?.message}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                multiline
                rows={3}
                {...register('description')}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Category"
                {...register('category')}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Unit *"
                {...register('unit', { required: 'Unit is required' })}
                error={!!errors.unit}
                helperText={errors.unit?.message}
                placeholder="pcs, box, hour, etc."
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Barcode"
                {...register('barcode')}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Cost Price"
                type="number"
                {...register('costPrice', { valueAsNumber: true })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Default Unit Price *"
                type="number"
                {...register('defaultUnitPrice', {
                  required: 'Default unit price is required',
                  valueAsNumber: true,
                })}
                error={!!errors.defaultUnitPrice}
                helperText={errors.defaultUnitPrice?.message}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Default Tax Rate (%)"
                type="number"
                {...register('defaultTaxRate', { valueAsNumber: true })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Current Stock"
                type="number"
                {...register('currentStock', {
                  valueAsNumber: true,
                  min: { value: 0, message: 'Stock cannot be negative' },
                })}
                error={!!errors.currentStock}
                helperText={errors.currentStock?.message}
                disabled={isEdit}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Reorder Level *"
                type="number"
                {...register('reorderLevel', {
                  required: 'Reorder level is required',
                  valueAsNumber: true,
                  min: { value: 0, message: 'Reorder level cannot be negative' },
                })}
                error={!!errors.reorderLevel}
                helperText={errors.reorderLevel?.message}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Max Stock Level"
                type="number"
                {...register('maxStockLevel', { valueAsNumber: true })}
              />
            </Grid>
            <Grid item xs={12}>
              <Box display="flex" gap={2}>
                <Button type="submit" variant="contained">
                  {isEdit ? 'Update' : 'Create'}
                </Button>
                <Button variant="outlined" onClick={() => navigate('/inventory')}>
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

export default InventoryForm;

