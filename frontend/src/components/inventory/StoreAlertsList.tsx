import React from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Button,
  CircularProgress,
  IconButton,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Divider,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useStoreAlerts, useResolveAlert, useCheckAlerts } from '../../hooks/useStoreAlerts';
import { useStores } from '../../hooks/useStore';
import { useToast } from '../../contexts/ToastContext';
import { getErrorMessage } from '../../utils/errorHandling';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RefreshIcon from '@mui/icons-material/Refresh';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';

interface StoreAlertsListProps {
  storeId?: string;
  showStoreColumn?: boolean;
}

const StoreAlertsList = ({ storeId, showStoreColumn = false }: StoreAlertsListProps) => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [selectedStoreFilter, setSelectedStoreFilter] = React.useState<string>('');
  const [resolvedFilter, setResolvedFilter] = React.useState<boolean | undefined>(false);

  const { data: stores } = useStores(true);
  const { data: alerts, isLoading } = useStoreAlerts(
    selectedStoreFilter || storeId,
    resolvedFilter,
  );
  const resolveMutation = useResolveAlert();
  const checkAlertsMutation = useCheckAlerts();
  
  // Alerts will automatically refetch via query invalidation in the hooks

  const handleResolve = async (alertId: string) => {
    try {
      await resolveMutation.mutateAsync(alertId);
      showToast('Alert resolved successfully', 'success');
    } catch (error: unknown) {
      showToast(getErrorMessage(error, 'Failed to resolve alert'), 'error');
    }
  };

  const handleCheckAlerts = async () => {
    try {
      const newAlerts = await checkAlertsMutation.mutateAsync();
      const alertCount = newAlerts?.length || 0;
      if (alertCount > 0) {
        showToast(`${alertCount} new alert${alertCount === 1 ? '' : 's'} found`, 'warning');
      } else {
        showToast('Alert check completed. No new alerts found.', 'success');
      }
    } catch (error: unknown) {
      showToast(getErrorMessage(error, 'Failed to check alerts'), 'error');
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
        <CircularProgress />
      </Box>
    );
  }

  const activeAlerts = alerts?.filter((alert) => !alert.resolved) || [];
  const resolvedAlerts = alerts?.filter((alert) => alert.resolved) || [];
  const displayedAlerts = resolvedFilter === undefined 
    ? alerts 
    : resolvedFilter 
      ? resolvedAlerts 
      : activeAlerts;
  
  const lowStockCount = activeAlerts.filter(a => a.alertType === 'low_stock').length;
  const outOfStockCount = activeAlerts.filter(a => a.alertType === 'out_of_stock').length;

  return (
    <Box>
      {/* Header Section */}
      <Paper
        elevation={1}
        sx={{
          p: 3,
          mb: 3,
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
          <Box>
            <Box display="flex" alignItems="center" gap={1.5} mb={1}>
              <WarningIcon sx={{ fontSize: 28, color: 'warning.main' }} />
              <Typography variant="h5" fontWeight={600}>
                Store Alerts
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary">
              Monitor inventory levels and stock alerts for this store
            </Typography>
          </Box>
          <Box display="flex" gap={1} alignItems="center">
            {activeAlerts.length > 0 && (
              <Chip
                icon={<WarningIcon />}
                label={`${activeAlerts.length} Active`}
                color="warning"
                sx={{ fontWeight: 600 }}
              />
            )}
            {outOfStockCount > 0 && (
              <Chip
                icon={<ErrorIcon />}
                label={`${outOfStockCount} Out of Stock`}
                color="error"
                sx={{ fontWeight: 600 }}
              />
            )}
          </Box>
        </Box>

        <Divider sx={{ my: 2 }} />

        <Box display="flex" gap={2} alignItems="center" flexWrap="wrap">
          {showStoreColumn && stores && (
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>Filter by Store</InputLabel>
              <Select
                value={selectedStoreFilter}
                label="Filter by Store"
                onChange={(e) => setSelectedStoreFilter(e.target.value)}
              >
                <MenuItem value="">All Stores</MenuItem>
                {stores.map((store) => (
                  <MenuItem key={store.id} value={store.id}>
                    {store.name} ({store.code})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={resolvedFilter === undefined ? 'all' : resolvedFilter ? 'resolved' : 'active'}
              label="Status"
              onChange={(e) => {
                const value = e.target.value;
                setResolvedFilter(
                  value === 'all' ? undefined : value === 'resolved' ? true : false,
                );
              }}
            >
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="resolved">Resolved</MenuItem>
              <MenuItem value="all">All</MenuItem>
            </Select>
          </FormControl>
          <Button
            variant="outlined"
            startIcon={checkAlertsMutation.isPending ? <CircularProgress size={16} /> : <RefreshIcon />}
            onClick={handleCheckAlerts}
            disabled={checkAlertsMutation.isPending}
            size="small"
            title="Check all stores for items below their reorder points"
          >
            {checkAlertsMutation.isPending ? 'Checking...' : 'Check Now'}
          </Button>
        </Box>
      </Paper>

      {/* Stats Summary */}
      {activeAlerts.length > 0 && resolvedFilter !== true && (
        <Box display="flex" gap={2} mb={3}>
          <Paper
            elevation={1}
            sx={{
              p: 2,
              flex: 1,
              border: '1px solid',
              borderColor: 'warning.light',
              bgcolor: 'rgba(255, 152, 0, 0.08)',
            }}
          >
            <Box display="flex" alignItems="center" gap={1.5}>
              <WarningIcon sx={{ color: 'warning.main', fontSize: 24 }} />
              <Box>
                <Typography variant="body2" color="text.secondary" fontWeight={500}>
                  Low Stock Items
                </Typography>
                <Typography variant="h5" fontWeight={600} color="warning.dark">
                  {lowStockCount}
                </Typography>
              </Box>
            </Box>
          </Paper>
          <Paper
            elevation={1}
            sx={{
              p: 2,
              flex: 1,
              border: '1px solid',
              borderColor: 'error.light',
              bgcolor: 'rgba(211, 47, 47, 0.08)',
            }}
          >
            <Box display="flex" alignItems="center" gap={1.5}>
              <ErrorIcon sx={{ color: 'error.main', fontSize: 24 }} />
              <Box>
                <Typography variant="body2" color="text.secondary" fontWeight={500}>
                  Out of Stock Items
                </Typography>
                <Typography variant="h5" fontWeight={600} color="error.dark">
                  {outOfStockCount}
                </Typography>
              </Box>
            </Box>
          </Paper>
        </Box>
      )}

      {/* Empty State for Active Alerts */}
      {activeAlerts.length === 0 && resolvedFilter !== true && (
        <Paper
          elevation={1}
          sx={{
            p: 4,
            textAlign: 'center',
            border: '1px solid',
            borderColor: 'success.light',
            bgcolor: 'rgba(46, 125, 50, 0.05)',
          }}
        >
          <CheckCircleIcon sx={{ fontSize: 64, color: 'success.main', mb: 2, opacity: 0.8 }} />
          <Typography variant="h6" fontWeight={600} color="success.dark" gutterBottom>
            No Active Alerts
          </Typography>
          <Typography variant="body2" color="text.secondary">
            All items are above their reorder points. Inventory levels are healthy.
          </Typography>
        </Paper>
      )}

      {/* Alerts Table */}
      {displayedAlerts && displayedAlerts.length > 0 ? (
        <TableContainer 
          component={Paper}
          elevation={1}
          sx={{
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: 'grey.50' }}>
                {showStoreColumn && <TableCell sx={{ fontWeight: 600, py: 2 }}>Store</TableCell>}
                <TableCell sx={{ fontWeight: 600, py: 2 }}>Item</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600, py: 2 }}>
                  Current Stock
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 600, py: 2 }}>
                  Min Quantity
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 600, py: 2 }}>
                  Difference
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 600, py: 2 }}>
                  Alert Type
                </TableCell>
                <TableCell sx={{ fontWeight: 600, py: 2 }}>Created</TableCell>
                {resolvedFilter !== true && (
                  <TableCell align="center" sx={{ fontWeight: 600, py: 2 }}>
                    Actions
                  </TableCell>
                )}
              </TableRow>
            </TableHead>
            <TableBody>
              {displayedAlerts.map((alert) => {
                const stockDifference = alert.currentStock - alert.minQty;
                const stockPercentage = alert.minQty > 0 
                  ? ((alert.currentStock / alert.minQty) * 100).toFixed(0)
                  : 0;
                return (
                <TableRow key={alert.id} hover>
                  {showStoreColumn && (
                    <TableCell>
                      {alert.store ? (
                        <Box
                          sx={{ cursor: 'pointer' }}
                          onClick={() => navigate(`/stores/${alert.storeId}`)}
                        >
                          <Typography variant="body2" fontWeight={600}>
                            {alert.store.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {alert.store.code}
                          </Typography>
                        </Box>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                  )}
                  <TableCell>
                    {alert.inventoryItem ? (
                      <Box
                        sx={{ cursor: 'pointer', '&:hover': { opacity: 0.7 } }}
                        onClick={() => navigate(`/inventory/${alert.inventoryItemId}`)}
                      >
                        <Typography variant="body2" fontWeight={600}>
                          {alert.inventoryItem.name}
                        </Typography>
                        {alert.inventoryItem.sku && (
                          <Typography 
                            variant="caption" 
                            color="text.secondary"
                            sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}
                          >
                            SKU: {alert.inventoryItem.sku}
                          </Typography>
                        )}
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        Item removed
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <Typography 
                      variant="body2" 
                      fontWeight={600}
                      color={alert.currentStock === 0 ? 'error.main' : 'text.primary'}
                    >
                      {alert.currentStock.toLocaleString()}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" fontWeight={500}>
                      {alert.minQty.toLocaleString()}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography 
                      variant="body2" 
                      fontWeight={600}
                      color={stockDifference < 0 ? 'error.main' : stockDifference === 0 ? 'warning.main' : 'success.main'}
                    >
                      {stockDifference > 0 ? '+' : ''}{stockDifference.toLocaleString()}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                      {stockPercentage}% of min
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      icon={
                        alert.alertType === 'out_of_stock' ? (
                          <ErrorIcon sx={{ fontSize: 16 }} />
                        ) : (
                          <WarningIcon sx={{ fontSize: 16 }} />
                        )
                      }
                      label={alert.alertType === 'out_of_stock' ? 'Out of Stock' : 'Low Stock'}
                      color={alert.alertType === 'out_of_stock' ? 'error' : 'warning'}
                      size="small"
                      sx={{ fontWeight: 600 }}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {new Date(alert.createdAt).toLocaleDateString()}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                      {new Date(alert.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Typography>
                  </TableCell>
                  {resolvedFilter !== true && !alert.resolved && (
                    <TableCell align="center">
                      <IconButton
                        size="small"
                        color="success"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleResolve(alert.id);
                        }}
                        disabled={resolveMutation.isPending}
                        title="Mark as resolved - This will mark the alert as resolved even if stock is still low"
                        sx={{
                          '&:hover': {
                            bgcolor: 'success.light',
                            color: 'success.contrastText',
                          },
                        }}
                      >
                        {resolveMutation.isPending ? (
                          <CircularProgress size={20} />
                        ) : (
                          <CheckCircleIcon />
                        )}
                      </IconButton>
                    </TableCell>
                  )}
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <Paper 
          elevation={1}
          sx={{ 
            p: 4, 
            textAlign: 'center',
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No Alerts Found
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {resolvedFilter === true 
              ? 'No resolved alerts to display.'
              : resolvedFilter === false
              ? 'No active alerts at this time.'
              : 'No alerts match your current filters.'}
          </Typography>
        </Paper>
      )}
    </Box>
  );
};

export default StoreAlertsList;

