import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CancelIcon from '@mui/icons-material/Cancel';
import StoreIcon from '@mui/icons-material/Store';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useStoreItemSettingsByItem } from '../../hooks/useStoreItemSettings';
import { useNavigate } from 'react-router-dom';
import type { InventoryItem } from '../../types/inventory';
import { alpha, useTheme } from '@mui/material';

interface ItemStoresDialogProps {
  open: boolean;
  onClose: () => void;
  item: InventoryItem | null;
}

export const ItemStoresDialog = ({ open, onClose, item }: ItemStoresDialogProps) => {
  const navigate = useNavigate();
  const theme = useTheme();
  const { data: storeSettings, isLoading, error } = useStoreItemSettingsByItem(item?.id || '');
  
  const handleStoreClick = (storeId: string) => {
    navigate(`/stores/${storeId}`);
    onClose();
  };

  if (!item) return null;

  const stores = storeSettings?.filter(setting => setting.store) || [];
  const storesWithStock = stores.filter(s => (s.currentStock || 0) > 0);
  const storesWithLowStock = stores.filter(s => {
    const stock = s.currentStock || 0;
    const minQty = s.minQty || 0;
    return stock > 0 && stock <= minQty;
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
        },
      }}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center" gap={1}>
            <StoreIcon color="primary" />
            <Box>
              <Typography variant="h6" component="div">
                Stores with Inventory
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {item.name} ({item.sku})
              </Typography>
            </Box>
          </Box>
          <IconButton
            aria-label="close"
            onClick={onClose}
            sx={{
              color: (theme) => theme.palette.grey[500],
            }}
          >
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      
      <DialogContent>
        {isLoading ? (
          <Box display="flex" justifyContent="center" alignItems="center" minHeight={200}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error">
            Failed to load store information. Please try again.
          </Alert>
        ) : stores.length === 0 ? (
          <Box textAlign="center" py={4}>
            <StoreIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No Stores Configured
            </Typography>
            <Typography variant="body2" color="text.secondary">
              This item is not configured in any stores. All inventory is in the warehouse.
            </Typography>
          </Box>
        ) : (
          <Box>
            {/* Summary */}
            <Box mb={3} display="flex" gap={2} flexWrap="wrap">
              <Paper
                variant="outlined"
                sx={{
                  p: 1.5,
                  flex: 1,
                  minWidth: 120,
                  bgcolor: alpha(theme.palette.primary.main, 0.05),
                }}
              >
                <Typography variant="caption" color="text.secondary" display="block">
                  Total Stores
                </Typography>
                <Typography variant="h6" fontWeight={600}>
                  {stores.length}
                </Typography>
              </Paper>
              <Paper
                variant="outlined"
                sx={{
                  p: 1.5,
                  flex: 1,
                  minWidth: 120,
                  bgcolor: alpha(theme.palette.success.main, 0.05),
                }}
              >
                <Typography variant="caption" color="text.secondary" display="block">
                  With Stock
                </Typography>
                <Typography variant="h6" fontWeight={600} color="success.main">
                  {storesWithStock.length}
                </Typography>
              </Paper>
              <Paper
                variant="outlined"
                sx={{
                  p: 1.5,
                  flex: 1,
                  minWidth: 120,
                  bgcolor: alpha(theme.palette.warning.main, 0.05),
                }}
              >
                <Typography variant="caption" color="text.secondary" display="block">
                  Low Stock
                </Typography>
                <Typography variant="h6" fontWeight={600} color="warning.main">
                  {storesWithLowStock.length}
                </Typography>
              </Paper>
            </Box>

            {/* Stores Table */}
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
                    <TableCell sx={{ fontWeight: 600 }}>Store</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>Current Stock</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>Min Qty</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>Target Qty</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {stores
                    .sort((a, b) => {
                      // Sort by stock descending, then by store name
                      const stockA = a.currentStock || 0;
                      const stockB = b.currentStock || 0;
                      if (stockB !== stockA) {
                        return stockB - stockA;
                      }
                      return (a.store?.name || '').localeCompare(b.store?.name || '');
                    })
                    .map((setting) => {
                      const stock = setting.currentStock || 0;
                      const minQty = setting.minQty || 0;
                      const isLowStock = stock > 0 && stock <= minQty;
                      const isOutOfStock = stock <= 0;
                      
                      return (
                        <TableRow
                          key={setting.id}
                          hover
                          sx={{
                            cursor: 'pointer',
                            '&:hover': {
                              bgcolor: alpha(theme.palette.primary.main, 0.04),
                            },
                            borderLeft: isOutOfStock
                              ? `3px solid ${theme.palette.error.main}`
                              : isLowStock
                              ? `3px solid ${theme.palette.warning.main}`
                              : '3px solid transparent',
                          }}
                          onClick={() => setting.storeId && handleStoreClick(setting.storeId)}
                        >
                          <TableCell>
                            <Box display="flex" alignItems="center" gap={1}>
                              <StoreIcon fontSize="small" color="primary" />
                              <Box>
                                <Typography variant="body2" fontWeight={500}>
                                  {setting.store?.name || 'Unknown Store'}
                                </Typography>
                                {setting.store?.code && (
                                  <Typography variant="caption" color="text.secondary">
                                    Code: {setting.store.code}
                                  </Typography>
                                )}
                                {setting.store?.address && (
                                  <Box display="flex" alignItems="center" gap={0.5} mt={0.5}>
                                    <LocationOnIcon sx={{ fontSize: 12, color: 'text.disabled' }} />
                                    <Typography variant="caption" color="text.disabled">
                                      {setting.store.address}
                                    </Typography>
                                  </Box>
                                )}
                              </Box>
                            </Box>
                          </TableCell>
                          <TableCell align="right">
                            <Typography
                              variant="body2"
                              fontWeight={600}
                              color={
                                isOutOfStock
                                  ? 'error.main'
                                  : isLowStock
                                  ? 'warning.main'
                                  : 'text.primary'
                              }
                            >
                              {stock.toLocaleString()}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" color="text.secondary">
                              {minQty.toLocaleString()}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" color="text.secondary">
                              {setting.targetQty ? setting.targetQty.toLocaleString() : '-'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              icon={
                                isOutOfStock ? (
                                  <CancelIcon sx={{ fontSize: '0.875rem !important' }} />
                                ) : isLowStock ? (
                                  <WarningAmberIcon sx={{ fontSize: '0.875rem !important' }} />
                                ) : (
                                  <CheckCircleIcon sx={{ fontSize: '0.875rem !important' }} />
                                )
                              }
                              label={
                                isOutOfStock
                                  ? 'Out of Stock'
                                  : isLowStock
                                  ? 'Low Stock'
                                  : 'In Stock'
                              }
                              color={isOutOfStock ? 'error' : isLowStock ? 'warning' : 'success'}
                              size="small"
                              sx={{
                                fontSize: '0.6875rem',
                                height: 24,
                                fontWeight: 600,
                                '& .MuiChip-icon': {
                                  marginLeft: '6px',
                                  marginRight: '-4px',
                                },
                                '& .MuiChip-label': {
                                  px: 1,
                                },
                              }}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}
      </DialogContent>
      
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} variant="outlined">
          Close
        </Button>
        {stores.length > 0 && (
          <Button
            onClick={() => {
              navigate('/stores');
              onClose();
            }}
            variant="contained"
            startIcon={<StoreIcon />}
          >
            View All Stores
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};
