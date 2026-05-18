import React, { useState, useMemo } from 'react';
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
  Skeleton,
  Alert,
  Link as MuiLink,
  Divider,
  LinearProgress,
  IconButton,
  Tooltip,
} from '@mui/material';
import StoreIcon from '@mui/icons-material/Store';
import InventoryIcon from '@mui/icons-material/Inventory';
import WarningIcon from '@mui/icons-material/Warning';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import CodeIcon from '@mui/icons-material/Code';
import PhoneIcon from '@mui/icons-material/Phone';
import EmailIcon from '@mui/icons-material/Email';
import VisibilityIcon from '@mui/icons-material/Visibility';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { useStores } from '../../hooks/useStore';
import { useStoreAlerts } from '../../hooks/useStoreAlerts';
import { useLowStock } from '../../hooks/useInventory';
import { useStoreItemSettingsByItem } from '../../hooks/useStoreItemSettings';
import { formatDate } from '../../utils/dates';
import { formatCurrency } from '../../utils/formatters';
import { useNavigate } from 'react-router-dom';

export type ReportType = 'total' | 'alerts' | 'lowStock'; // active/inactive removed - all stores are always active

interface StoreReportModalProps {
  open: boolean;
  onClose: () => void;
  reportType: ReportType;
}

const StoreReportModal = ({ open, onClose, reportType }: StoreReportModalProps) => {
  const navigate = useNavigate();
  const { data: allStores, isLoading: storesLoading } = useStores();
  const { data: alerts, isLoading: alertsLoading, refetch: refetchAlerts } = useStoreAlerts(undefined, false);
  const { data: lowStockItems, isLoading: lowStockLoading, refetch: refetchLowStock } = useLowStock();

  const reportData = useMemo(() => {
    if (!allStores) return null;

    switch (reportType) {
      case 'total':
        return {
          title: 'All Stores',
          icon: <StoreIcon />,
          stores: allStores,
          description: `Complete list of all ${allStores.length} stores in your system`,
        };
      case 'alerts':
        if (!alerts || alerts.length === 0) {
          return {
            title: 'Stores with Alerts',
            icon: <WarningIcon />,
            stores: [],
            alerts: new Map(),
            description: 'No stores with active alerts',
          };
        }
        const storesWithAlerts = new Map<string, typeof allStores[0]>();
        const alertsByStore = new Map<string, typeof alerts>();
        alerts.forEach((alert) => {
          if (!alert.resolved) {
            // Find store from allStores if not in alert.store
            let store = alert.store;
            if (!store && allStores) {
              store = allStores.find((s) => s.id === alert.storeId) || undefined;
            }
            if (store) {
              storesWithAlerts.set(alert.storeId, store);
              if (!alertsByStore.has(alert.storeId)) {
                alertsByStore.set(alert.storeId, []);
              }
              alertsByStore.get(alert.storeId)!.push(alert);
            }
          }
        });
        return {
          title: 'Stores with Alerts',
          icon: <WarningIcon />,
          stores: Array.from(storesWithAlerts.values()),
          alerts: alertsByStore,
          description: `${storesWithAlerts.size} store(s) have unresolved alerts`,
        };
      case 'lowStock':
        return {
          title: 'Low Stock Items',
          icon: <TrendingDownIcon />,
          items: lowStockItems || [],
          description: `${lowStockItems?.length || 0} items are below their minimum stock level`,
        };
      default:
        return null;
    }
  }, [allStores, alerts, lowStockItems, reportType]);

  const handleStoreClick = (storeId: string) => {
    navigate(`/stores/${storeId}`);
    onClose();
  };

  const handleItemClick = (itemId: string) => {
    navigate(`/inventory/${itemId}`);
    onClose();
  };

  // Refetch data when modal opens to ensure fresh data
  React.useEffect(() => {
    if (open) {
      if (reportType === 'alerts') {
        refetchAlerts();
      } else if (reportType === 'lowStock') {
        refetchLowStock();
      }
    }
  }, [open, reportType, refetchAlerts, refetchLowStock]);

  if (!reportData) {
    return null;
  }

  const isLoading = storesLoading || alertsLoading || lowStockLoading;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      sx={{
        '& .MuiDialog-paper': {
          borderRadius: 2,
        },
      }}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={2}>
          <Box
            sx={{
              p: 1,
              borderRadius: 1,
              bgcolor: 'primary.light',
              color: 'primary.contrastText',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {reportData.icon}
          </Box>
          <Box>
            <Typography variant="h6" fontWeight={600}>
              {reportData.title}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {reportData.description}
            </Typography>
          </Box>
        </Box>
      </DialogTitle>
      <DialogContent>
        {isLoading ? (
          <Box>
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} variant="rectangular" height={60} sx={{ mb: 1, borderRadius: 1 }} />
            ))}
          </Box>
        ) : reportType === 'lowStock' ? (
          <LowStockReport items={reportData.items} onItemClick={handleItemClick} />
        ) : reportType === 'alerts' && reportData.alerts ? (
          <AlertsReport
            stores={reportData.stores}
            alertsByStore={reportData.alerts}
            onStoreClick={handleStoreClick}
            onItemClick={handleItemClick}
          />
        ) : (
          <StoresReport stores={reportData.stores} onStoreClick={handleStoreClick} />
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2, pt: 1 }}>
        <Button onClick={onClose} variant="contained">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const StoresReport = ({
  stores,
  onStoreClick,
}: {
  stores: Array<{
    id: string;
    name: string;
    code: string;
    address?: string;
    phone?: string;
    email?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
    // active removed - all stores are always active
    createdAt: string;
  }>;
  onStoreClick: (storeId: string) => void;
}) => {
  if (stores.length === 0) {
    return (
      <Alert severity="info" sx={{ mt: 2 }}>
        No stores found in this category.
      </Alert>
    );
  }

  return (
    <TableContainer component={Paper} variant="outlined" sx={{ mt: 2 }}>
      <Table>
        <TableHead>
          <TableRow sx={{ bgcolor: 'grey.50' }}>
            <TableCell sx={{ fontWeight: 600 }}>Store Name</TableCell>
            <TableCell sx={{ fontWeight: 600 }}>Code</TableCell>
            <TableCell sx={{ fontWeight: 600 }}>Location</TableCell>
            <TableCell sx={{ fontWeight: 600 }}>Contact</TableCell>
            <TableCell sx={{ fontWeight: 600 }}>Created</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {stores.map((store) => (
            <TableRow
              key={store.id}
              hover
              sx={{ cursor: 'pointer' }}
              onClick={() => onStoreClick(store.id)}
            >
              <TableCell>
                <Box display="flex" alignItems="center" gap={1}>
                  <StoreIcon fontSize="small" color="primary" />
                  <Typography variant="body2" fontWeight={500}>
                    {store.name}
                  </Typography>
                </Box>
              </TableCell>
              <TableCell>
                <Chip
                  label={store.code}
                  size="small"
                  sx={{
                    fontFamily: 'monospace',
                    fontWeight: 600,
                    bgcolor: 'primary.50',
                    color: 'primary.main',
                  }}
                />
              </TableCell>
              <TableCell>
                {store.address || store.city ? (
                  <Box>
                    {store.address && (
                      <Typography variant="body2" sx={{ fontSize: '0.8125rem' }}>
                        {store.address}
                      </Typography>
                    )}
                    {(store.city || store.state || store.zip) && (
                      <Typography variant="caption" color="text.secondary">
                        {[store.city, store.state, store.zip].filter(Boolean).join(', ')}
                        {store.country && `, ${store.country}`}
                      </Typography>
                    )}
                  </Box>
                ) : (
                  <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                    No address
                  </Typography>
                )}
              </TableCell>
              <TableCell>
                <Box>
                  {store.phone && (
                    <Box display="flex" alignItems="center" gap={0.5} sx={{ mb: 0.5 }}>
                      <PhoneIcon fontSize="small" sx={{ fontSize: 14, color: 'text.secondary' }} />
                      <Typography variant="caption" sx={{ fontSize: '0.75rem' }}>
                        {store.phone}
                      </Typography>
                    </Box>
                  )}
                  {store.email && (
                    <Box display="flex" alignItems="center" gap={0.5}>
                      <EmailIcon fontSize="small" sx={{ fontSize: 14, color: 'text.secondary' }} />
                      <Typography variant="caption" sx={{ fontSize: '0.75rem' }}>
                        {store.email}
                      </Typography>
                    </Box>
                  )}
                  {!store.phone && !store.email && (
                    <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                      No contact info
                    </Typography>
                  )}
                </Box>
              </TableCell>
              <TableCell>
                <Typography variant="caption" color="text.secondary">
                  {formatDate(store.createdAt)}
                </Typography>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

const AlertsReport = ({
  stores,
  alertsByStore,
  onStoreClick,
  onItemClick,
}: {
  stores: Array<{ id: string; name: string; code: string }>;
  alertsByStore: Map<string, Array<{ id: string; alertType: 'low_stock' | 'out_of_stock'; currentStock: number; minQty: number; inventoryItem?: { id?: string; name: string; sku?: string } }>>;
  onStoreClick: (storeId: string) => void;
  onItemClick: (itemId: string) => void;
}) => {
  if (stores.length === 0) {
    return (
      <Alert severity="success" sx={{ mt: 2 }}>
        Great! No stores have active alerts. All inventory levels are healthy.
      </Alert>
    );
  }

  return (
    <Box sx={{ mt: 2 }}>
      {stores.map((store) => {
        const storeAlerts = alertsByStore.get(store.id) || [];
        const lowStockCount = storeAlerts.filter((a) => a.alertType === 'low_stock').length;
        const outOfStockCount = storeAlerts.filter((a) => a.alertType === 'out_of_stock').length;

        return (
          <Paper 
            key={store.id} 
            variant="outlined" 
            sx={{ 
              mb: 3, 
              p: 3,
              borderLeft: `4px solid ${outOfStockCount > 0 ? 'error.main' : 'warning.main'}`,
              bgcolor: outOfStockCount > 0 ? 'error.50' : 'warning.50',
            }}
          >
            {/* Store Header */}
            <Box
              display="flex"
              alignItems="center"
              justifyContent="space-between"
              mb={3}
            >
              <Box display="flex" alignItems="center" gap={2}>
                <Box
                  sx={{
                    p: 1.5,
                    borderRadius: 2,
                    bgcolor: outOfStockCount > 0 ? 'error.light' : 'warning.light',
                    color: outOfStockCount > 0 ? 'error.contrastText' : 'warning.contrastText',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <StoreIcon />
                </Box>
                <Box>
                  <Typography variant="h6" fontWeight={700} sx={{ fontSize: '1.25rem' }}>
                    {store.name}
                  </Typography>
                  <Box display="flex" alignItems="center" gap={1.5} mt={0.5}>
                    <Chip
                      label={store.code}
                      size="small"
                      sx={{
                        fontFamily: 'monospace',
                        fontWeight: 600,
                        bgcolor: 'primary.100',
                        color: 'primary.main',
                        fontSize: '0.75rem',
                        height: 22,
                      }}
                    />
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<VisibilityIcon />}
                      onClick={(e) => {
                        e.stopPropagation();
                        onStoreClick(store.id);
                      }}
                      sx={{ textTransform: 'none', fontSize: '0.75rem' }}
                    >
                      View Store
                    </Button>
                  </Box>
                </Box>
              </Box>
              <Box display="flex" gap={1.5} flexWrap="wrap" justifyContent="flex-end">
                {outOfStockCount > 0 && (
                  <Chip
                    label={`${outOfStockCount} Out of Stock`}
                    color="error"
                    size="medium"
                    icon={<WarningIcon />}
                    sx={{ fontWeight: 600, fontSize: '0.875rem' }}
                  />
                )}
                {lowStockCount > 0 && (
                  <Chip
                    label={`${lowStockCount} Low Stock`}
                    color="warning"
                    size="medium"
                    icon={<WarningIcon />}
                    sx={{ fontWeight: 600, fontSize: '0.875rem' }}
                  />
                )}
                <Chip
                  label={`${storeAlerts.length} Total Alert${storeAlerts.length !== 1 ? 's' : ''}`}
                  size="medium"
                  sx={{ bgcolor: 'grey.300', fontWeight: 700, fontSize: '0.875rem' }}
                />
              </Box>
            </Box>

            <Divider sx={{ mb: 3 }} />

            {/* Alerts Table */}
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: 'background.paper' }}>
                    <TableCell sx={{ fontWeight: 700, py: 1.5 }}>Item Details</TableCell>
                    <TableCell sx={{ fontWeight: 700, py: 1.5 }}>Alert Type</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, py: 1.5 }}>
                      Stock Level
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, py: 1.5 }}>
                      Minimum Required
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, py: 1.5 }}>
                      Shortage
                    </TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700, py: 1.5 }}>
                      Actions
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {storeAlerts.map((alert) => {
                    const shortage = Math.max(0, alert.minQty - alert.currentStock);
                    const stockPercent = alert.minQty > 0 
                      ? Math.min(100, (alert.currentStock / alert.minQty) * 100) 
                      : 0;
                    const isOutOfStock = alert.alertType === 'out_of_stock';
                    const isSevere = shortage >= alert.minQty * 0.5; // Severe if shortage is >= 50% of minimum
                    
                    return (
                      <TableRow 
                        key={alert.id}
                        sx={{
                          bgcolor: isOutOfStock ? 'error.50' : 'warning.50',
                          '&:hover': {
                            bgcolor: isOutOfStock ? 'error.100' : 'warning.100',
                          },
                        }}
                      >
                        <TableCell>
                          <Box>
                            <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                              <InventoryIcon 
                                fontSize="small" 
                                sx={{ 
                                  color: isOutOfStock ? 'error.main' : 'warning.main',
                                  fontSize: 18,
                                }} 
                              />
                              <Typography variant="body1" fontWeight={600} sx={{ fontSize: '0.9375rem' }}>
                                {alert.inventoryItem?.name || 'Unknown Item'}
                              </Typography>
                            </Box>
                            {alert.inventoryItem?.sku && (
                              <Typography 
                                variant="caption" 
                                color="text.secondary"
                                sx={{ 
                                  fontFamily: 'monospace',
                                  fontSize: '0.75rem',
                                  display: 'block',
                                }}
                              >
                                SKU: {alert.inventoryItem.sku}
                              </Typography>
                            )}
                            {/* Stock Level Progress Bar */}
                            <Box sx={{ mt: 1, width: '100%', maxWidth: 200 }}>
                              <LinearProgress
                                variant="determinate"
                                value={stockPercent}
                                sx={{
                                  height: 6,
                                  borderRadius: 3,
                                  bgcolor: 'grey.200',
                                  '& .MuiLinearProgress-bar': {
                                    bgcolor: isOutOfStock ? 'error.main' : stockPercent < 50 ? 'warning.main' : 'info.main',
                                  },
                                }}
                              />
                              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', mt: 0.5, display: 'block' }}>
                                {stockPercent.toFixed(1)}% of minimum
                              </Typography>
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={isOutOfStock ? 'Out of Stock' : 'Low Stock'}
                            color={isOutOfStock ? 'error' : 'warning'}
                            size="medium"
                            icon={<WarningIcon sx={{ fontSize: 16 }} />}
                            sx={{ 
                              fontWeight: 600,
                              fontSize: '0.8125rem',
                            }}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Box>
                            <Typography
                              variant="h6"
                              fontWeight={700}
                              color={isOutOfStock ? 'error.main' : 'warning.main'}
                              sx={{ fontSize: '1.25rem' }}
                            >
                              {alert.currentStock.toLocaleString()}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                              {isOutOfStock ? 'Critical' : stockPercent < 25 ? 'Very Low' : 'Low'}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body1" fontWeight={600} sx={{ fontSize: '0.9375rem' }}>
                            {alert.minQty.toLocaleString()}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Box>
                            <Typography 
                              variant="h6" 
                              fontWeight={700} 
                              color="error.main"
                              sx={{ fontSize: '1.25rem' }}
                            >
                              {shortage.toLocaleString()}
                            </Typography>
                            {isSevere && (
                              <Chip
                                label="Severe"
                                color="error"
                                size="small"
                                sx={{ 
                                  mt: 0.5,
                                  fontSize: '0.65rem',
                                  height: 18,
                                }}
                              />
                            )}
                          </Box>
                        </TableCell>
                        <TableCell align="center">
                          {alert.inventoryItem?.id && (
                            <Tooltip title="View Item Details">
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onItemClick(alert.inventoryItem!.id!);
                                }}
                                sx={{
                                  bgcolor: 'primary.50',
                                  '&:hover': {
                                    bgcolor: 'primary.100',
                                  },
                                }}
                              >
                                <OpenInNewIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        );
      })}
    </Box>
  );
};

const LowStockReport = ({
  items,
  onItemClick,
}: {
  items: Array<{
    id: string;
    name: string;
    sku: string;
    currentStock: number;
    reorderLevel: number;
    unit: string;
    category?: string;
    defaultUnitPrice?: number;
  }>;
  onItemClick: (itemId: string) => void;
}) => {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const { data: allStores } = useStores();

  const toggleExpanded = (itemId: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  if (items.length === 0) {
    return (
      <Alert severity="success" sx={{ mt: 2 }}>
        Excellent! All items are above their minimum stock levels.
      </Alert>
    );
  }

  // Calculate summary statistics - properly handle edge cases
  const totalShortage = items.reduce((sum, item) => {
    if (item.reorderLevel > 0) {
      return sum + Math.max(0, item.reorderLevel - item.currentStock);
    }
    return sum; // Items with no minimum don't contribute to shortage
  }, 0);
  
  const outOfStockCount = items.filter((item) => item.currentStock === 0).length;
  
  const totalValue = items.reduce((sum, item) => {
    const shortage = item.reorderLevel > 0 
      ? Math.max(0, item.reorderLevel - item.currentStock)
      : 0;
    return sum + (shortage * (item.defaultUnitPrice || 0));
  }, 0);

  return (
    <Box sx={{ mt: 2 }}>
      {/* Summary Cards */}
      <Box display="flex" gap={2} mb={3} flexWrap="wrap">
        <Paper variant="outlined" sx={{ p: 2, flex: 1, minWidth: 200 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem', fontWeight: 600 }}>
            Total Items
          </Typography>
          <Typography variant="h4" fontWeight={700} sx={{ mt: 0.5 }}>
            {items.length}
          </Typography>
        </Paper>
        <Paper variant="outlined" sx={{ p: 2, flex: 1, minWidth: 200, borderLeft: '4px solid', borderColor: 'error.main' }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem', fontWeight: 600 }}>
            Out of Stock
          </Typography>
          <Typography variant="h4" fontWeight={700} color="error.main" sx={{ mt: 0.5 }}>
            {outOfStockCount}
          </Typography>
        </Paper>
        <Paper variant="outlined" sx={{ p: 2, flex: 1, minWidth: 200, borderLeft: '4px solid', borderColor: 'warning.main' }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem', fontWeight: 600 }}>
            Total Shortage
          </Typography>
          <Typography variant="h4" fontWeight={700} color="warning.main" sx={{ mt: 0.5 }}>
            {totalShortage.toLocaleString()}
          </Typography>
        </Paper>
        {totalValue > 0 && (
          <Paper variant="outlined" sx={{ p: 2, flex: 1, minWidth: 200, borderLeft: '4px solid', borderColor: 'info.main' }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem', fontWeight: 600 }}>
              Est. Reorder Value
            </Typography>
            <Typography variant="h4" fontWeight={700} color="info.main" sx={{ mt: 0.5 }}>
              {formatCurrency(totalValue)}
            </Typography>
          </Paper>
        )}
      </Box>

      {/* Items Table */}
      <TableContainer component={Paper} variant="outlined">
        <Table>
          <TableHead>
            <TableRow sx={{ bgcolor: 'background.paper' }}>
              <TableCell sx={{ fontWeight: 700, py: 1.5 }}>Item Details</TableCell>
              <TableCell sx={{ fontWeight: 700, py: 1.5 }}>Category</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700, py: 1.5 }}>
                Stock Level
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 700, py: 1.5 }}>
                Minimum Required
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 700, py: 1.5 }}>
                Shortage
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 700, py: 1.5 }}>
                Unit Price
              </TableCell>
              <TableCell align="center" sx={{ fontWeight: 700, py: 1.5 }}>
                Actions
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((item) => {
              // Calculate shortage - handle edge case where reorderLevel is 0
              const shortage = item.reorderLevel > 0 
                ? Math.max(0, item.reorderLevel - item.currentStock)
                : (item.currentStock === 0 ? 0 : 0); // If reorderLevel is 0 and stock is 0, no shortage
              
              const stockPercent = item.reorderLevel > 0 
                ? Math.min(100, (item.currentStock / item.reorderLevel) * 100) 
                : (item.currentStock > 0 ? 100 : 0); // If no minimum, consider 100% if has stock
              
              const isOutOfStock = item.currentStock === 0;
              // Severe if shortage is >= 50% of minimum (but only if there is a minimum)
              const isSevere = item.reorderLevel > 0 && shortage >= item.reorderLevel * 0.5;
              const isExpanded = expandedItems.has(item.id);
              
              return (
                <React.Fragment key={item.id}>
                  <TableRow
                    hover
                    sx={{
                      bgcolor: isOutOfStock ? 'error.50' : 'warning.50',
                      '&:hover': {
                        bgcolor: isOutOfStock ? 'error.100' : 'warning.100',
                      },
                    }}
                  >
                    <TableCell>
                      <Box>
                        <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                          <InventoryIcon 
                            fontSize="small" 
                            sx={{ 
                              color: isOutOfStock ? 'error.main' : 'warning.main',
                              fontSize: 18,
                            }} 
                          />
                          <Typography variant="body1" fontWeight={600} sx={{ fontSize: '0.9375rem' }}>
                            {item.name}
                          </Typography>
                        </Box>
                        <Typography 
                          variant="caption" 
                          color="text.secondary"
                          sx={{ 
                            fontFamily: 'monospace',
                            fontSize: '0.75rem',
                            display: 'block',
                            mb: 1,
                          }}
                        >
                          SKU: {item.sku}
                        </Typography>
                        {/* Stock Level Progress Bar */}
                        <Box sx={{ width: '100%', maxWidth: 250 }}>
                          <LinearProgress
                            variant="determinate"
                            value={stockPercent}
                            sx={{
                              height: 6,
                              borderRadius: 3,
                              bgcolor: 'grey.200',
                              '& .MuiLinearProgress-bar': {
                                bgcolor: isOutOfStock ? 'error.main' : stockPercent < 50 ? 'warning.main' : 'info.main',
                              },
                            }}
                          />
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', mt: 0.5, display: 'block' }}>
                            {stockPercent.toFixed(1)}% of minimum
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      {item.category ? (
                        <Chip 
                          label={item.category} 
                          size="small"
                          sx={{
                            fontWeight: 500,
                            bgcolor: 'primary.50',
                            color: 'primary.main',
                          }}
                        />
                      ) : (
                        <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                          No category
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Box>
                        <Typography
                          variant="h6"
                          fontWeight={700}
                          color={isOutOfStock ? 'error.main' : 'warning.main'}
                          sx={{ fontSize: '1.25rem' }}
                        >
                          {item.currentStock.toLocaleString()}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', display: 'block' }}>
                          {item.unit}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                          {isOutOfStock ? 'Critical' : stockPercent < 25 ? 'Very Low' : 'Low'}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      <Box>
                        <Typography variant="body1" fontWeight={600} sx={{ fontSize: '0.9375rem' }}>
                          {item.reorderLevel.toLocaleString()}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                          {item.unit}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      <Box>
                        {shortage > 0 ? (
                          <>
                            <Typography 
                              variant="h6" 
                              fontWeight={700} 
                              color="error.main"
                              sx={{ fontSize: '1.25rem' }}
                            >
                              {shortage.toLocaleString()}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', display: 'block' }}>
                              {item.unit}
                            </Typography>
                            {isSevere && (
                              <Chip
                                label="Severe"
                                color="error"
                                size="small"
                                sx={{ 
                                  mt: 0.5,
                                  fontSize: '0.65rem',
                                  height: 18,
                                }}
                              />
                            )}
                          </>
                        ) : (
                          <>
                            <Typography 
                              variant="body2" 
                              fontWeight={600} 
                              color="success.main"
                              sx={{ fontSize: '0.9375rem' }}
                            >
                              0
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                              {item.reorderLevel === 0 ? 'No minimum set' : 'No shortage'}
                            </Typography>
                          </>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      {item.defaultUnitPrice ? (
                        <Box>
                          <Typography variant="body1" fontWeight={600} sx={{ fontSize: '0.9375rem' }}>
                            {formatCurrency(item.defaultUnitPrice)}
                          </Typography>
                          {shortage > 0 && (
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                              Est: {formatCurrency(shortage * item.defaultUnitPrice)}
                            </Typography>
                          )}
                        </Box>
                      ) : (
                        <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                          Not set
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="center">
                      <Box display="flex" gap={1} justifyContent="center" flexWrap="wrap">
                        <Tooltip title={isExpanded ? 'Hide Store Details' : 'Show Store Stock Levels'}>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleExpanded(item.id);
                            }}
                            sx={{ textTransform: 'none', fontSize: '0.75rem' }}
                          >
                            {isExpanded ? 'Hide' : 'Stores'}
                          </Button>
                        </Tooltip>
                        <Tooltip title="View Item Details">
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={(e) => {
                              e.stopPropagation();
                              onItemClick(item.id);
                            }}
                            sx={{
                              bgcolor: 'primary.50',
                              '&:hover': {
                                bgcolor: 'primary.100',
                              },
                            }}
                          >
                            <OpenInNewIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                  {isExpanded && (
                    <StoreStockDetailsRow itemId={item.id} />
                  )}
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

const StoreStockDetailsRow = ({ itemId }: { itemId: string }) => {
  const { data: storeSettings, isLoading } = useStoreItemSettingsByItem(itemId);
  const { data: allStores } = useStores();

  if (isLoading) {
    return (
      <TableRow>
        <TableCell colSpan={7}>
          <Skeleton variant="rectangular" height={40} />
        </TableCell>
      </TableRow>
    );
  }

  if (!storeSettings || storeSettings.length === 0) {
    return (
      <TableRow>
        <TableCell colSpan={7}>
          <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic', pl: 4 }}>
            This item is not tracked in any store yet.
          </Typography>
        </TableCell>
      </TableRow>
    );
  }

  const storeMap = new Map(allStores?.map((s) => [s.id, s]) || []);

  return (
    <TableRow>
      <TableCell colSpan={7} sx={{ bgcolor: 'grey.50', py: 2 }}>
        <Box sx={{ pl: 4 }}>
          <Typography variant="subtitle2" fontWeight={600} gutterBottom>
            Store Stock Levels:
          </Typography>
          <Box display="flex" flexWrap="wrap" gap={2}>
            {storeSettings.map((setting) => {
              const store = storeMap.get(setting.storeId);
              const isLowStock = setting.currentStock < setting.minQty;
              
              return (
                <Paper key={setting.id} variant="outlined" sx={{ p: 1.5, minWidth: 200 }}>
                  <Box display="flex" alignItems="center" gap={1} mb={1}>
                    <StoreIcon fontSize="small" color="primary" />
                    <Typography variant="body2" fontWeight={600}>
                      {store?.name || 'Unknown Store'}
                    </Typography>
                    <Chip
                      label={store?.code || '-'}
                      size="small"
                      sx={{
                        fontFamily: 'monospace',
                        fontSize: '0.7rem',
                        height: 20,
                      }}
                    />
                  </Box>
                  <Box>
                    <Box display="flex" justifyContent="space-between" mb={0.5}>
                      <Typography variant="caption" color="text.secondary">
                        Current:
                      </Typography>
                      <Typography
                        variant="caption"
                        fontWeight={600}
                        color={isLowStock ? 'error.main' : 'text.primary'}
                      >
                        {setting.currentStock}
                      </Typography>
                    </Box>
                    <Box display="flex" justifyContent="space-between">
                      <Typography variant="caption" color="text.secondary">
                        Min:
                      </Typography>
                      <Typography variant="caption">{setting.minQty}</Typography>
                    </Box>
                    {isLowStock && (
                      <Chip
                        label={`Shortage: ${setting.minQty - setting.currentStock}`}
                        color="error"
                        size="small"
                        sx={{ mt: 1, fontSize: '0.65rem', height: 20 }}
                      />
                    )}
                  </Box>
                </Paper>
              );
            })}
          </Box>
        </Box>
      </TableCell>
    </TableRow>
  );
};

export default StoreReportModal;