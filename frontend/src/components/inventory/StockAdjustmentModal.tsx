import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  DialogContentText,
} from '@mui/material';
import { useCreateStockMovement, useInventoryItem } from '../../hooks/useInventory';
import type { CreateStockMovementDto } from '../../api/inventory';
import { stockMovementSchema } from '../../utils/validationSchemas';
import { useToast } from '../../contexts/ToastContext';
import { getErrorMessage } from '../../utils/errorHandling';

interface StockAdjustmentModalProps {
  open: boolean;
  onClose: () => void;
  inventoryItemId: string;
}

const StockAdjustmentModal = ({ open, onClose, inventoryItemId }: StockAdjustmentModalProps) => {
  const createMovement = useCreateStockMovement();
  const { showToast } = useToast();
  const { data: item } = useInventoryItem(inventoryItemId);
  const [adjustmentType, setAdjustmentType] = useState<'purchase' | 'adjustment'>('adjustment');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingData, setPendingData] = useState<{ quantity: number; note?: string } | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<{ quantity: number; note?: string }>({
    resolver: zodResolver(stockMovementSchema),
    defaultValues: {
      quantity: 0,
      note: '',
    },
  });

  const onSubmit = async (data: { quantity: number; note?: string }) => {
    if (!item) return;

    // Check for large stock adjustment (>50% change)
    const currentStock = item.currentStock;
    let newStock: number;
    
    if (adjustmentType === 'purchase') {
      newStock = currentStock + Math.abs(data.quantity);
    } else {
      newStock = data.quantity;
    }

    const changePercent = Math.abs((newStock - currentStock) / currentStock) * 100;
    
    if (changePercent > 50 && currentStock > 0) {
      setPendingData(data);
      setShowConfirmDialog(true);
      return;
    }

    await performAdjustment(data);
  };

  const performAdjustment = async (data: { quantity: number; note?: string }) => {
    try {
      const movementData: CreateStockMovementDto = {
        type: adjustmentType,
        quantity: adjustmentType === 'purchase' ? Math.abs(data.quantity) : data.quantity,
        sourceType: 'manual',
        note: data.note,
      };

      await createMovement.mutateAsync({ id: inventoryItemId, data: movementData });
      showToast('Stock adjusted successfully', 'success');
      reset();
      setShowConfirmDialog(false);
      setPendingData(null);
      onClose();
    } catch (error: unknown) {
      showToast(getErrorMessage(error, 'Failed to adjust stock'), 'error');
    }
  };

  const handleClose = () => {
    reset();
    setShowConfirmDialog(false);
    setPendingData(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Adjust Stock</DialogTitle>
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Adjustment Type</InputLabel>
              <Select
                value={adjustmentType}
                label="Adjustment Type"
                onChange={(e) => setAdjustmentType(e.target.value as 'purchase' | 'adjustment')}
              >
                <MenuItem value="purchase">Purchase (Add Stock)</MenuItem>
                <MenuItem value="adjustment">Adjustment (Set Stock)</MenuItem>
              </Select>
            </FormControl>

            <TextField
              fullWidth
              label={adjustmentType === 'purchase' ? 'Quantity to Add' : 'New Stock Level'}
              type="number"
              {...register('quantity', {
                required: 'Quantity is required',
                valueAsNumber: true,
              })}
              error={!!errors.quantity}
              helperText={errors.quantity?.message}
            />

            <TextField
              fullWidth
              label="Note"
              multiline
              rows={3}
              {...register('note')}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={createMovement.isPending}>
            {createMovement.isPending ? 'Adjusting...' : 'Adjust Stock'}
          </Button>
        </DialogActions>
      </form>

      <Dialog open={showConfirmDialog} onClose={() => setShowConfirmDialog(false)}>
        <DialogTitle>Large Stock Adjustment</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This adjustment will change the stock by more than 50%. Are you sure you want to continue?
            {item && (
              <>
                <br />
                <br />
                Current stock: {item.currentStock}
                <br />
                New stock: {adjustmentType === 'purchase' 
                  ? item.currentStock + (pendingData?.quantity || 0)
                  : pendingData?.quantity || 0}
              </>
            )}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowConfirmDialog(false)} disabled={createMovement.isPending}>
            Cancel
          </Button>
          <Button 
            onClick={() => pendingData && performAdjustment(pendingData)} 
            color="warning" 
            variant="contained"
            disabled={createMovement.isPending || !pendingData}
          >
            {createMovement.isPending ? 'Adjusting...' : 'Confirm Adjustment'}
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
};

export default StockAdjustmentModal;

