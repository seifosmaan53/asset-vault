import { useState, useEffect } from 'react';
import {Dialog,
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
  Typography,
  Alert,
  CircularProgress,
  Paper,
  Divider,
  IconButton,
  Chip,
  InputAdornment,
  Card,
  CardContent,
} from '@mui/material';
import Grid from '../common/Grid';
import StoreIcon from '@mui/icons-material/Store';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import InventoryIcon from '@mui/icons-material/Inventory';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import { useForm, Controller } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../../contexts/ToastContext';
import { useStores } from '../../hooks/useStore';
import { useInventory } from '../../hooks/useInventory';
import { useStoreStock } from '../../hooks/useStoreStock';
import { useStoreItemSettingsByStore } from '../../hooks/useStoreItemSettings';
import { storeItemSettingsApi } from '../../api/storeItemSettings';
import InventorySelect from './InventorySelect';
import type { InventoryItem } from '../../types/inventory';

interface StoreTransferModalProps {
  open: boolean;
  onClose: () => void;
  defaultFromStoreId?: string;
  defaultToStoreId?: string;
}

interface TransferFormData {
  fromStoreId: string;
  toStoreId: string;
  inventoryItemId: string;
  quantity: number;
  note?: string;
}

const StoreTransferModal = ({
  open,
  onClose,
  defaultFromStoreId,
  defaultToStoreId,
}: StoreTransferModalProps) => {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const { data: stores } = useStores(); // All stores (all are always active now)
  const [selectedInventoryItem, setSelectedInventoryItem] = useState<InventoryItem | null>(null);
  const [availableStock, setAvailableStock] = useState<number | null>(null);
  const [storeStocksMap, setStoreStocksMap] = useState<Map<string, number>>(new Map());

  const {
    control,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors },
  } = useForm<TransferFormData>({
    defaultValues: {
      fromStoreId: defaultFromStoreId || '',
      toStoreId: defaultToStoreId || '',
      inventoryItemId: '',
      quantity: 1,
      note: '',
    },
  });

  const fromStoreId = watch('fromStoreId');
  const toStoreId = watch('toStoreId');
  const inventoryItemId = watch('inventoryItemId');
  const quantity = watch('quantity');

  // Fetch store item settings to get stock for all items at source store
  const { data: storeItemSettings } = useStoreItemSettingsByStore(fromStoreId || '');

  // Build a map of inventory item IDs to their stock at the source store
  useEffect(() => {
    if (storeItemSettings && fromStoreId) {
      const stockMap = new Map<string, number>();
      storeItemSettings.forEach((setting) => {
        stockMap.set(setting.inventoryItemId, setting.currentStock || 0);
      });
      setStoreStocksMap(stockMap);
    } else {
      setStoreStocksMap(new Map());
    }
  }, [storeItemSettings, fromStoreId]);

  // Fetch available stock at source store for selected item
  const { data: storeStock, isLoading: stockLoading } = useStoreStock(
    fromStoreId,
    inventoryItemId,
  );

  useEffect(() => {
    if (storeStock !== null && storeStock !== undefined) {
      setAvailableStock(storeStock);
    } else {
      setAvailableStock(null);
    }
  }, [storeStock]);

  const transferMutation = useMutation({
    mutationFn: (data: TransferFormData) => storeItemSettingsApi.transferStock(data),
    onSuccess: (_, variables) => {
      showToast('Stock transferred successfully', 'success');
      
      // Invalidate store item settings for both stores
      queryClient.invalidateQueries({ queryKey: ['store-item-settings', 'store', variables.fromStoreId] });
      queryClient.invalidateQueries({ queryKey: ['store-item-settings', 'store', variables.toStoreId] });
      queryClient.invalidateQueries({ queryKey: ['store-item-settings', 'item', variables.inventoryItemId] });
      
      // Invalidate storeStock queries for both stores
      queryClient.invalidateQueries({ queryKey: ['storeStock', variables.fromStoreId, variables.inventoryItemId] });
      queryClient.invalidateQueries({ queryKey: ['storeStock', variables.toStoreId, variables.inventoryItemId] });
      queryClient.invalidateQueries({ queryKey: ['storeStocks'] });
      queryClient.invalidateQueries({ queryKey: ['storeStock'] });
      
      // Invalidate inventory (global stock movements)
      queryClient.invalidateQueries({ queryKey: ['inventory', variables.inventoryItemId] });
      queryClient.invalidateQueries({ queryKey: ['inventory', variables.inventoryItemId, 'movements'] });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'stats'] });
      
      // Invalidate store analytics for both stores
      queryClient.invalidateQueries({ queryKey: ['analytics', 'stores', variables.fromStoreId] });
      queryClient.invalidateQueries({ queryKey: ['analytics', 'stores', variables.toStoreId] });
      queryClient.invalidateQueries({ queryKey: ['analytics', 'stores'] });
      
      handleClose();
    },
    onError: (error: unknown) => {
      const errorMessage = error && typeof error === 'object' && 'response' in error
        ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
        : undefined;
      showToast(errorMessage || 'Failed to transfer stock', 'error');
    },
  });

  const handleClose = () => {
    reset();
    setSelectedInventoryItem(null);
    setAvailableStock(null);
    onClose();
  };

  const onSubmit = (data: TransferFormData) => {
    if (data.fromStoreId === data.toStoreId) {
      showToast('Source and destination stores must be different', 'error');
      return;
    }

    if (availableStock !== null && data.quantity > availableStock) {
      showToast(`Insufficient stock. Available: ${availableStock}`, 'error');
      return;
    }

    transferMutation.mutate(data);
  };

  const handleInventorySelect = (item: InventoryItem | null) => {
    setSelectedInventoryItem(item);
    if (item) {
      setValue('inventoryItemId', item.id);
    } else {
      setValue('inventoryItemId', '');
    }
  };

  const fromStore = stores?.find(s => s.id === fromStoreId);
  const toStore = stores?.find(s => s.id === toStoreId);
  const isValidTransfer = fromStoreId && toStoreId && fromStoreId !== toStoreId && inventoryItemId && quantity > 0;
  const isInsufficientStock = availableStock !== null && quantity > availableStock;

  return (
    <Dialog 
      open={open} 
      onClose={handleClose} 
      maxWidth="md" 
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          boxShadow: 8,
        },
      }}
    >
      <DialogTitle sx={{ pb: 2 }}>
        <Box display="flex" alignItems="center" gap={1.5}>
          <Box sx={{ 
            p: 1, 
            borderRadius: 2, 
            bgcolor: 'primary.main', 
            color: 'primary.contrastText',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <SwapHorizIcon sx={{ fontSize: 28 }} />
          </Box>
          <Box>
            <Typography variant="h5" component="div" sx={{ fontWeight: 700, fontSize: '1.5rem' }}>
              Transfer Stock Between Stores
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Move inventory from one store to another
            </Typography>
          </Box>
        </Box>
      </DialogTitle>
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogContent sx={{ pt: 2 }}>
          <Box display="flex" flexDirection="column" gap={3.5}>
            {/* Store Selection Section */}
            <Grid container spacing={3}>
              <Grid item xs={12} md={5}>
                <Paper sx={{ p: 2.5, borderRadius: 2, border: '2px solid', borderColor: errors.fromStoreId ? 'error.main' : 'primary.main', bgcolor: 'primary.50' }}>
                  <Box display="flex" alignItems="center" gap={1.5} mb={2}>
                    <StoreIcon sx={{ fontSize: 24, color: 'primary.main' }} />
                    <Typography variant="h6" sx={{ fontWeight: 700, color: 'primary.main' }}>
                      From Store
                    </Typography>
                  </Box>
                  <Controller
                    name="fromStoreId"
                    control={control}
                    rules={{ required: 'Source store is required' }}
                    render={({ field }) => (
                      <FormControl fullWidth error={!!errors.fromStoreId}>
                        <InputLabel sx={{ fontWeight: 600 }}>Select Source Store</InputLabel>
                        <Select 
                          {...field} 
                          label="Select Source Store"
                          sx={{ 
                            bgcolor: 'background.paper',
                            borderRadius: 2,
                            '& .MuiOutlinedInput-notchedOutline': {
                              borderColor: 'primary.main',
                            },
                          }}
                        >
                          {stores?.map((store) => (
                            <MenuItem key={store.id} value={store.id}>
                              <Box display="flex" alignItems="center" gap={1.5} width="100%">
                                <StoreIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
                                <Box>
                                  <Typography variant="body1" sx={{ fontWeight: 600 }}>
                                    {store.name}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    Code: {store.code}
                                  </Typography>
                                </Box>
                              </Box>
                            </MenuItem>
                          ))}
                        </Select>
                        {errors.fromStoreId && (
                          <Typography variant="caption" color="error" sx={{ mt: 1, display: 'block' }}>
                            {errors.fromStoreId.message}
                          </Typography>
                        )}
                        {fromStore && (
                          <Box mt={1.5}>
                            <Chip 
                              icon={<CheckCircleIcon sx={{ fontSize: 16 }} />}
                              label={`Selected: ${fromStore.name}`}
                              color="primary"
                              size="small"
                              sx={{ fontWeight: 600 }}
                            />
                          </Box>
                        )}
                      </FormControl>
                    )}
                  />
                </Paper>
              </Grid>

              <Grid item xs={12} md={2}>
                <Box display="flex" alignItems="center" justifyContent="center" height="100%" minHeight={120}>
                  <Box sx={{ 
                    p: 2, 
                    borderRadius: '50%', 
                    bgcolor: 'action.hover',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <SwapHorizIcon sx={{ fontSize: 40, color: 'primary.main' }} />
                  </Box>
                </Box>
              </Grid>

              <Grid item xs={12} md={5}>
                <Paper sx={{ p: 2.5, borderRadius: 2, border: '2px solid', borderColor: errors.toStoreId ? 'error.main' : 'success.main', bgcolor: 'success.50' }}>
                  <Box display="flex" alignItems="center" gap={1.5} mb={2}>
                    <StoreIcon sx={{ fontSize: 24, color: 'success.main' }} />
                    <Typography variant="h6" sx={{ fontWeight: 700, color: 'success.main' }}>
                      To Store
                    </Typography>
                  </Box>
                  <Controller
                    name="toStoreId"
                    control={control}
                    rules={{ 
                      required: 'Destination store is required',
                      validate: (value) => {
                        if (value === fromStoreId) {
                          return 'Destination must be different from source store';
                        }
                        return true;
                      },
                    }}
                    render={({ field }) => (
                      <FormControl fullWidth error={!!errors.toStoreId}>
                        <InputLabel sx={{ fontWeight: 600 }}>Select Destination Store</InputLabel>
                        <Select 
                          {...field} 
                          label="Select Destination Store"
                          sx={{ 
                            bgcolor: 'background.paper',
                            borderRadius: 2,
                            '& .MuiOutlinedInput-notchedOutline': {
                              borderColor: 'success.main',
                            },
                          }}
                        >
                          {stores?.filter(store => store.id !== fromStoreId).map((store) => (
                            <MenuItem key={store.id} value={store.id}>
                              <Box display="flex" alignItems="center" gap={1.5} width="100%">
                                <StoreIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
                                <Box>
                                  <Typography variant="body1" sx={{ fontWeight: 600 }}>
                                    {store.name}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    Code: {store.code}
                                  </Typography>
                                </Box>
                              </Box>
                            </MenuItem>
                          ))}
                        </Select>
                        {errors.toStoreId && (
                          <Typography variant="caption" color="error" sx={{ mt: 1, display: 'block' }}>
                            {errors.toStoreId.message}
                          </Typography>
                        )}
                        {toStore && (
                          <Box mt={1.5}>
                            <Chip 
                              icon={<CheckCircleIcon sx={{ fontSize: 16 }} />}
                              label={`Selected: ${toStore.name}`}
                              color="success"
                              size="small"
                              sx={{ fontWeight: 600 }}
                            />
                          </Box>
                        )}
                      </FormControl>
                    )}
                  />
                </Paper>
              </Grid>
            </Grid>

            <Divider />

            {/* Inventory Item Selection */}
            <Box>
              <Box display="flex" alignItems="center" gap={1.5} mb={2}>
                <InventoryIcon sx={{ fontSize: 24, color: 'primary.main' }} />
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  Inventory Item
                </Typography>
              </Box>
              <InventorySelect
                value={selectedInventoryItem}
                onChange={handleInventorySelect}
                storeId={fromStoreId}
                storeStocks={storeStocksMap}
              />
              {errors.inventoryItemId && (
                <Typography variant="caption" color="error" sx={{ mt: 1, display: 'block' }}>
                  {errors.inventoryItemId.message}
                </Typography>
              )}
              {selectedInventoryItem && (
                <Box mt={1.5}>
                  <Card variant="outlined" sx={{ bgcolor: 'grey.50' }}>
                    <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                      <Box display="flex" alignItems="center" gap={2}>
                        <Box sx={{ 
                          p: 1, 
                          borderRadius: 1.5, 
                          bgcolor: 'primary.main', 
                          color: 'primary.contrastText',
                        }}>
                          <InventoryIcon sx={{ fontSize: 20 }} />
                        </Box>
                        <Box flex={1}>
                          <Typography variant="body1" sx={{ fontWeight: 600 }}>
                            {selectedInventoryItem.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                            SKU: {selectedInventoryItem.sku}
                          </Typography>
                        </Box>
                        {selectedInventoryItem.category && (
                          <Chip 
                            label={selectedInventoryItem.category}
                            size="small"
                            sx={{ fontWeight: 600 }}
                          />
                        )}
                      </Box>
                    </CardContent>
                  </Card>
                </Box>
              )}
            </Box>

            {/* Stock Information and Quantity */}
            {fromStoreId && inventoryItemId && (
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Card variant="outlined" sx={{ bgcolor: 'info.50', borderColor: 'info.main' }}>
                    <CardContent>
                      <Box display="flex" alignItems="center" gap={1.5} mb={1.5}>
                        <InventoryIcon sx={{ fontSize: 20, color: 'info.main' }} />
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'info.main' }}>
                          Available Stock
                        </Typography>
                      </Box>
                      {stockLoading ? (
                        <Box display="flex" alignItems="center" gap={1.5}>
                          <CircularProgress size={20} />
                          <Typography variant="body2" color="text.secondary">
                            Loading stock information...
                          </Typography>
                        </Box>
                      ) : (
                        <Box>
                          <Typography variant="h4" sx={{ fontWeight: 700, color: 'info.main', mb: 0.5 }}>
                            {availableStock !== null ? availableStock.toLocaleString() : 'N/A'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {availableStock !== null ? `${availableStock} units available at ${fromStore?.name || 'source store'}` : 'Stock information unavailable'}
                          </Typography>
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
                      Transfer Quantity
                    </Typography>
                    <Controller
                      name="quantity"
                      control={control}
                      rules={{
                        required: 'Quantity is required',
                        min: { value: 1, message: 'Quantity must be at least 1' },
                        validate: (value) => {
                          if (availableStock !== null && value > availableStock) {
                            return `Quantity cannot exceed available stock (${availableStock})`;
                          }
                          return true;
                        },
                      }}
                      render={({ field }) => (
                        <Box>
                          <TextField
                            {...field}
                            label="Quantity"
                            type="number"
                            fullWidth
                            error={!!errors.quantity || isInsufficientStock}
                            helperText={errors.quantity?.message || (isInsufficientStock ? `Cannot exceed available stock (${availableStock})` : '')}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10);
                              field.onChange(isNaN(val) ? 0 : val);
                            }}
                            InputProps={{
                              startAdornment: (
                                <InputAdornment position="start">
                                  <IconButton
                                    size="small"
                                    onClick={() => {
                                      const newVal = Math.max(1, (field.value || 1) - 1);
                                      field.onChange(newVal);
                                    }}
                                    disabled={field.value <= 1}
                                  >
                                    <RemoveIcon />
                                  </IconButton>
                                </InputAdornment>
                              ),
                              endAdornment: (
                                <InputAdornment position="end">
                                  <IconButton
                                    size="small"
                                    onClick={() => {
                                      const newVal = (field.value || 0) + 1;
                                      field.onChange(newVal);
                                    }}
                                    disabled={availableStock !== null && (field.value || 0) >= availableStock}
                                  >
                                    <AddIcon />
                                  </IconButton>
                                </InputAdornment>
                              ),
                            }}
                            sx={{
                              '& .MuiOutlinedInput-root': {
                                borderRadius: 2,
                                fontSize: '1.25rem',
                                fontWeight: 600,
                              },
                            }}
                          />
                          {availableStock !== null && quantity > 0 && (
                            <Box mt={1.5}>
                              <Alert 
                                severity={isInsufficientStock ? 'error' : quantity === availableStock ? 'warning' : 'success'}
                                icon={isInsufficientStock ? <WarningIcon /> : <CheckCircleIcon />}
                                sx={{ borderRadius: 2 }}
                              >
                                {isInsufficientStock ? (
                                  `Insufficient stock. Only ${availableStock} units available.`
                                ) : quantity === availableStock ? (
                                  `Transferring all available stock (${availableStock} units).`
                                ) : (
                                  `Transferring ${quantity} of ${availableStock} available units.`
                                )}
                              </Alert>
                            </Box>
                          )}
                        </Box>
                      )}
                    />
                  </Box>
                </Grid>
              </Grid>
            )}

            {!fromStoreId || !inventoryItemId ? (
              <Alert severity="info" sx={{ borderRadius: 2 }}>
                Please select source store and inventory item to view available stock and set transfer quantity.
              </Alert>
            ) : null}

            {/* Note Section */}
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
                Transfer Note (Optional)
              </Typography>
              <Controller
                name="note"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Transfer Note"
                    multiline
                    rows={3}
                    fullWidth
                    placeholder="e.g., Restocking due to high demand, Emergency transfer, etc."
                    helperText="Optional: Add a note to document the reason for this transfer"
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2,
                      },
                    }}
                  />
                )}
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
          <Button 
            onClick={handleClose} 
            disabled={transferMutation.isPending}
            sx={{ 
              minWidth: 120,
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 600,
            }}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={transferMutation.isPending || !isValidTransfer || isInsufficientStock}
            startIcon={transferMutation.isPending ? <CircularProgress size={20} color="inherit" /> : <SwapHorizIcon />}
            sx={{ 
              minWidth: 150,
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 600,
              px: 3,
              py: 1.25,
            }}
          >
            {transferMutation.isPending ? 'Transferring...' : 'Transfer Stock'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default StoreTransferModal;

