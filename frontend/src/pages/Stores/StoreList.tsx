import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Chip,
  Tooltip,
  Skeleton,
  CircularProgress,
  TextField,
  InputAdornment,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import StoreIcon from '@mui/icons-material/Store';
import InventoryIcon from '@mui/icons-material/Inventory';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import CodeIcon from '@mui/icons-material/Code';
import VisibilityIcon from '@mui/icons-material/Visibility';
import WarningIcon from '@mui/icons-material/Warning';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import DownloadIcon from '@mui/icons-material/Download';
import { useStores, useDeleteStore, useUpdateStore } from '../../hooks/useStore';
import { useStoreAlerts } from '../../hooks/useStoreAlerts';
import type { StoreAlert } from '../../api/storeAlerts';
import { useInventoryStats } from '../../hooks/useInventory';
import { useToast } from '../../contexts/ToastContext';
import { useUndo } from '../../hooks/useUndo';
import { logger } from '../../utils/logger';
import { getErrorMessage } from '../../utils/errorHandling';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import StoreReportModal from '../../components/stores/StoreReportModal';
import type { ReportType } from '../../components/stores/StoreReportModal';
import { formatDate } from '../../utils/dates';
import { exportToCSV } from '../../utils/export';
import Grid from '../../components/common/Grid';
import { TIMEOUTS } from '../../constants/timeouts';

const StoreList = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: stores, isLoading, refetch: refetchStores } = useStores();
  const { data: alerts, isLoading: alertsLoading, refetch: refetchAlerts } = useStoreAlerts(undefined, false); // Get unresolved alerts
  const { data: inventoryStats, isLoading: statsLoading, refetch: refetchStats } = useInventoryStats();
  const deleteStore = useDeleteStore();
  const updateStore = useUpdateStore();
  const { showToast } = useToast();
  const { createDeleteUndo } = useUndo();
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [storeToDelete, setStoreToDelete] = useState<{ id: string; name: string } | null>(null);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportType, setReportType] = useState<ReportType>('total');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  // Clear cache and invalidate queries on mount to ensure fresh data
  useEffect(() => {
    // Invalidate all store-related queries to force fresh fetch
    queryClient.invalidateQueries({ queryKey: ['stores'], exact: false });
    queryClient.invalidateQueries({ queryKey: ['storeAlerts'], exact: false });
    queryClient.invalidateQueries({ queryKey: ['inventory', 'stats'], exact: false });
    // Also clear any old organization-scoped queries
    queryClient.removeQueries({ predicate: (query) => {
      const key = query.queryKey;
      if (Array.isArray(key)) {
        const keyStr = JSON.stringify(key);
        if (keyStr.includes('organization') || keyStr.includes('org')) {
          return true;
        }
      }
      return false;
    }});
  }, [queryClient]);

  // Auto-refresh stats periodically - only when page is visible to reduce unnecessary API calls
  useEffect(() => {
    // Don't auto-refresh if page is hidden
    if (document.hidden) return;
    
    const interval = setInterval(() => {
      // Only refresh if page is still visible
      if (!document.hidden) {
        // Only refetch stores if there are no pending mutations to avoid overwriting optimistic updates
        if (!updateStore.isPending && !deleteStore.isPending) {
          refetchStores();
          queryClient.invalidateQueries({ queryKey: ['stores'] });
        }
        refetchAlerts();
        refetchStats();
        // Also invalidate related queries to ensure consistency
        queryClient.invalidateQueries({ queryKey: ['storeAlerts'] });
        queryClient.invalidateQueries({ queryKey: ['inventory', 'stats'] });
      }
    }, TIMEOUTS.REAL_TIME_REFRESH_INTERVAL); // 5 seconds for real-time synchronization
    
    // FIX #144: Fix infinite loop - use refs for stable function references
    // FIX #145: Ensure interval is cleared on unmount
    return () => {
      clearInterval(interval);
    };
  }, [refetchStores, refetchAlerts, refetchStats, updateStore, deleteStore, queryClient]);

  const handleOpenReport = (type: ReportType) => {
    setReportType(type);
    setReportModalOpen(true);
  };

  // Filter stores based on search and validate data
  const filteredStores = useMemo(() => {
    // Ensure stores is an array
    if (!stores || !Array.isArray(stores)) return [];
    
    // Only filter out stores that are completely invalid (no ID)
    // Allow stores even if name or code is missing - they might be valid but have incomplete data
    const validStores = stores.filter(store => 
      store && store.id && typeof store.id === 'string' && store.id.trim() !== ''
    );
    
    if (!searchTerm) return validStores;
    
    const searchLower = searchTerm.toLowerCase();
    return validStores.filter(store => 
      store.name.toLowerCase().includes(searchLower) ||
      store.code.toLowerCase().includes(searchLower) ||
      (store.address && typeof store.address === 'string' && store.address.toLowerCase().includes(searchLower))
    );
  }, [stores, searchTerm]);

  // Calculate statistics
  const stats = useMemo(() => {
    // Ensure stores is an array
    if (!stores || !Array.isArray(stores)) return { total: 0, active: 0, inactive: 0, storesWithAlerts: 0, lowStockItems: 0 };
    
    // Only filter out stores that are completely invalid (no ID)
    // Allow stores even if name or code is missing - they might be valid but have incomplete data
    const validStores = stores.filter(store => 
      store && store.id && typeof store.id === 'string' && store.id.trim() !== ''
    );
    
    // Count unique stores with unresolved alerts
    // Ensure alerts is an array before calling filter - handle edge cases
    let storesWithAlerts = 0;
    try {
      if (Array.isArray(alerts) && alerts.length > 0) {
        storesWithAlerts = new Set(
          alerts
            .filter((a: StoreAlert) => a && !a.resolved && a.storeId)
            .map((a: StoreAlert) => a.storeId)
        ).size;
      }
    } catch (error) {
      // If alerts is not in expected format, default to 0
      logger.warn('Error processing alerts:', error);
      storesWithAlerts = 0;
    }
    
    return {
      total: validStores.length,
      storesWithAlerts,
      lowStockItems: inventoryStats?.lowStockItems || 0,
    };
  }, [stores, alerts, inventoryStats]);

  const handleDelete = (id: string, name: string) => {
    setStoreToDelete({ id, name });
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!storeToDelete) return;
    
    // Save store info before clearing state
    const storeId = storeToDelete.id;
    const storeName = storeToDelete.name;
    
    // Get store data before deletion for undo
    let storeData = queryClient.getQueryData<any>(['stores', storeId]);
    
    // If not in cache, try to find it in the current list
    if (!storeData && stores) {
      storeData = stores.find(store => store.id === storeId);
    }
    
    // If still not found, fetch it
    if (!storeData) {
      try {
        const { storeApi } = await import('../../api/store');
        storeData = await storeApi.getById(storeId);
      } catch (error) {
        logger.warn('Could not fetch store for undo:', error);
      }
    }
    
    // Show toast immediately for instant feedback
    showToast('Store deleted successfully', 'success');
    setDeleteConfirmOpen(false);
    setStoreToDelete(null);
    
    // The optimistic update is handled by useDeleteStore's onMutate
    // Call mutation without await to make it non-blocking - UI updates immediately
    deleteStore.mutate(storeId, {
      onSuccess: () => {
        // Create undo operation if we have store data
        if (storeData) {
          createDeleteUndo(
            'store',
            `Store ${storeData.name || storeName}`,
            storeData,
            async (store: any) => {
              try {
                const { storeApi } = await import('../../api/store');
                await storeApi.create({
                  clientId: store.clientId || '', // Store requires clientId
                  name: store.name,
                  code: store.code,
                  address: store.address,
                  phone: store.phone,
                  email: store.email,
                  city: store.city,
                  state: store.state,
                  zip: store.zip,
                  country: store.country,
                  notes: store.notes,
                });
                queryClient.invalidateQueries({ queryKey: ['stores'], exact: false });
                showToast(`Store ${store.name} restored`, 'success');
              } catch (error) {
                showToast(getErrorMessage(error, 'Failed to restore store'), 'error');
                throw error;
              }
            },
          );
        }
        
        // Refetch stats and alerts in background (non-blocking)
        setTimeout(() => {
          refetchAlerts();
          refetchStats();
        }, 100);
      },
      onError: (error: unknown) => {
        // Rollback toast on error
        showToast(getErrorMessage(error, `Failed to delete store "${storeName}"`), 'error');
        // Reopen dialog if deletion failed
        setDeleteConfirmOpen(true);
        setStoreToDelete({ id: storeId, name: storeName });
      },
    });
  };


  if (isLoading) {
    return (
      <Box>
        <Skeleton variant="text" width={300} height={40} sx={{ mb: 3 }} />
        <Skeleton variant="rectangular" width="100%" height={400} />
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1" fontWeight={600}>
          Stores
        </Typography>
        <Box display="flex" gap={1}>
          <Tooltip title="Export all stores to CSV (Excel compatible)">
            <span>
              <Button
                variant="outlined"
                startIcon={isExporting ? <CircularProgress size={16} /> : <DownloadIcon />}
                onClick={async () => {
                  if (!filteredStores || filteredStores.length === 0) {
                    showToast('No stores to export', 'warning');
                    return;
                  }
                  setIsExporting(true);
                  try {
                    // Show progress for large exports
                    if (filteredStores.length > 50) {
                      showToast(`Exporting ${filteredStores.length} stores... This may take a moment.`, 'info');
                    }
                    
                    const exportData = filteredStores.map(store => ({
                      'Store Name': store.name,
                      'Store Code': store.code,
                      'Status': store.active ? 'Active' : 'Inactive',
                      'Address': store.address || '',
                      'City': store.city || '',
                      'State': store.state || '',
                      'Zip/Postal Code': store.zip || '',
                      'Country': store.country || '',
                      'Phone': store.phone || '',
                      'Email': store.email || '',
                      'Notes': store.notes || '',
                      'Created': store.createdAt ? formatDate(store.createdAt) : '',
                      'Last Updated': store.updatedAt ? formatDate(store.updatedAt) : '',
                    }));
                    
                    exportToCSV(exportData, {
                      filename: 'stores',
                      title: 'STORES EXPORT',
                      description: 'Complete list of all stores',
                      includeMetadata: true,
                      formatDates: true,
                    });
                    
                    showToast(`Successfully exported ${filteredStores.length} store(s)`, 'success');
                  } catch (error: unknown) {
                    logger.error('Export error:', error);
                    showToast(getErrorMessage(error, 'Failed to export stores'), 'error');
                  } finally {
                    setIsExporting(false);
                  }
                }}
                disabled={!filteredStores || filteredStores.length === 0 || isExporting}
                size="large"
                aria-label="Export stores to CSV"
                sx={{
                  borderRadius: 2,
                  textTransform: 'none',
                  fontWeight: 600,
                  minWidth: 140,
                  borderWidth: 2,
                  '&:hover': {
                    borderWidth: 2,
                    bgcolor: 'action.hover',
                  },
                }}
              >
                {isExporting ? 'Exporting...' : 'Export CSV'}
              </Button>
            </span>
          </Tooltip>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/stores/new')}
            size="large"
            sx={{ minWidth: 160, borderRadius: 2 }}
          >
            Create Store
          </Button>
        </Box>
      </Box>

      {/* Statistics Cards */}
      {stores && Array.isArray(stores) && stores.length > 0 && (
        <Box mb={3}>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6} md={4}>
              <Paper 
                sx={{ 
                  p: 2.5, 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 2, 
                  height: '100%', 
                  width: '100%',
                  boxShadow: 2,
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    boxShadow: 4,
                    transform: 'translateY(-2px)',
                  },
                }}
                onClick={() => handleOpenReport('total')}
              >
                <Box sx={{ 
                  p: 1.5, 
                  borderRadius: 2, 
                  bgcolor: 'primary.light', 
                  color: 'primary.contrastText',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <StoreIcon />
                </Box>
                <Box>
                  <Typography variant="h3" fontWeight={700} sx={{ fontSize: '2rem' }}>
                    {stats.total}
                  </Typography>
                  <Typography variant="body1" color="text.secondary" sx={{ fontSize: '0.9375rem', fontWeight: 600, mt: 0.5 }}>
                    Total Stores
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem', mt: 0.5, display: 'block' }}>
                    Click to view all stores
                  </Typography>
                </Box>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <Paper 
                sx={{ 
                  p: 2.5, 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 2, 
                  height: '100%', 
                  width: '100%',
                  boxShadow: 2,
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    boxShadow: 4,
                    transform: 'translateY(-2px)',
                  },
                }}
                onClick={() => handleOpenReport('alerts')}
              >
                <Box sx={{ 
                  p: 1.5, 
                  borderRadius: 2, 
                  bgcolor: stats.storesWithAlerts > 0 ? 'warning.light' : 'grey.300', 
                  color: stats.storesWithAlerts > 0 ? 'warning.contrastText' : 'text.primary',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <WarningIcon />
                </Box>
                <Box flex={1}>
                  <Typography variant="h3" fontWeight={700} sx={{ fontSize: '2rem', display: 'flex', alignItems: 'center', gap: 1 }}>
                    {alertsLoading ? (
                      <CircularProgress size={24} />
                    ) : (
                      stats.storesWithAlerts
                    )}
                  </Typography>
                  <Typography variant="body1" color="text.secondary" sx={{ fontSize: '0.9375rem', fontWeight: 600, mt: 0.5 }}>
                    Stores with Alerts
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem', mt: 0.5, display: 'block' }}>
                    {stats.storesWithAlerts > 0 ? 'Low stock or out of stock items' : 'Click to view alert status'}
                  </Typography>
                </Box>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <Paper 
                sx={{ 
                  p: 2.5, 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 2, 
                  height: '100%', 
                  width: '100%',
                  boxShadow: 2,
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    boxShadow: 4,
                    transform: 'translateY(-2px)',
                  },
                }}
                onClick={() => handleOpenReport('lowStock')}
              >
                <Box sx={{ 
                  p: 1.5, 
                  borderRadius: 2, 
                  bgcolor: stats.lowStockItems > 0 ? 'error.light' : 'grey.300', 
                  color: stats.lowStockItems > 0 ? 'error.contrastText' : 'text.primary',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <TrendingDownIcon />
                </Box>
                <Box flex={1}>
                  <Typography variant="h3" fontWeight={700} sx={{ fontSize: '2rem', display: 'flex', alignItems: 'center', gap: 1 }}>
                    {statsLoading ? (
                      <CircularProgress size={24} />
                    ) : (
                      stats.lowStockItems
                    )}
                  </Typography>
                  <Typography variant="body1" color="text.secondary" sx={{ fontSize: '0.9375rem', fontWeight: 600, mt: 0.5 }}>
                    Low Stock Items
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem', mt: 0.5, display: 'block' }}>
                    {stats.lowStockItems > 0 ? 'Items below minimum threshold' : 'Click to view stock levels'}
                  </Typography>
                </Box>
              </Paper>
            </Grid>
          </Grid>
        </Box>
      )}

      {/* Search Bar */}
      <Box mb={2}>
        <TextField
          inputRef={searchInputRef}
          fullWidth
          placeholder="Search stores by name, code, or address... (Press Enter to search)"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              setSearchTerm(searchInput.trim());
            }
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: 'text.secondary' }} />
              </InputAdornment>
            ),
            endAdornment: searchInput && (
              <InputAdornment position="end">
                <IconButton
                  aria-label="Clear search"
                  size="small"
                  onClick={() => {
                    setSearchInput('');
                    setSearchTerm('');
                    searchInputRef.current?.focus();
                  }}
                  edge="end"
                >
                  <ClearIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ),
          }}
          sx={{ 
            '& .MuiOutlinedInput-root': {
              borderRadius: 2,
            },
          }}
        />
      </Box>

      <TableContainer 
        component={Paper} 
        sx={{ 
          borderRadius: 2, 
          boxShadow: 2,
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Table>
          <TableHead>
            <TableRow sx={{ bgcolor: 'grey.50' }}>
              <TableCell sx={{ fontWeight: 600, py: 1.5, px: 1.5, whiteSpace: 'nowrap', width: '25%' }}>
                <Box display="flex" alignItems="center" gap={0.5}>
                  <StoreIcon fontSize="small" color="primary" />
                  <Typography variant="caption" fontWeight={600}>Name</Typography>
                </Box>
              </TableCell>
              <TableCell sx={{ fontWeight: 600, px: 1, whiteSpace: 'nowrap', width: '10%' }}>
                <Box display="flex" alignItems="center" gap={0.5}>
                  <CodeIcon fontSize="small" color="primary" />
                  <Typography variant="caption" fontWeight={600}>Code</Typography>
                </Box>
              </TableCell>
              <TableCell sx={{ fontWeight: 600, px: 1, whiteSpace: 'nowrap', width: '30%' }}>
                <Box display="flex" alignItems="center" gap={0.5}>
                  <LocationOnIcon fontSize="small" color="primary" />
                  <Typography variant="caption" fontWeight={600}>Address</Typography>
                </Box>
              </TableCell>
              <TableCell sx={{ fontWeight: 600, px: 1, whiteSpace: 'nowrap', width: '13%' }}>
                <Typography variant="caption" fontWeight={600}>Created</Typography>
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 600, px: 1, whiteSpace: 'nowrap', width: '10%' }}>
                <Typography variant="caption" fontWeight={600}>Actions</Typography>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredStores && filteredStores.length > 0 ? (
              filteredStores.map((store) => (
                <TableRow 
                  key={store.id} 
                  hover
                  sx={{
                    '&:hover': {
                      bgcolor: 'grey.50',
                      cursor: 'pointer',
                    },
                    '& .MuiTableCell-root': {
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                    },
                  }}
                  onClick={() => navigate(`/stores/${store.id}`)}
                >
                  <TableCell sx={{ px: 1.5, py: 1.5 }}>
                    <Box display="flex" alignItems="center" gap={1}>
                      <StoreIcon fontSize="small" color="primary" sx={{ opacity: 0.7 }} />
                      <Typography variant="body2" fontWeight={500}>
                        {store.name || 'Unnamed Store'}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell sx={{ px: 1, py: 1.5 }}>
                    <Chip
                      label={store.code || 'N/A'}
                      size="small"
                      sx={{
                        fontFamily: 'monospace',
                        fontWeight: 600,
                        bgcolor: 'primary.50',
                        color: 'primary.main',
                        fontSize: '0.75rem',
                        height: 24,
                      }}
                    />
                  </TableCell>
                  <TableCell sx={{ px: 1, py: 1.5 }}>
                    <Typography 
                      variant="body2" 
                      color="text.secondary"
                      sx={{
                        fontSize: '0.8125rem',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: 300,
                      }}
                      title={store.address || 'No address'}
                    >
                      {store.address || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ px: 1, py: 1.5 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8125rem' }}>
                      {formatDate(store.createdAt)}
                    </Typography>
                  </TableCell>
                  <TableCell align="right" sx={{ px: 1, py: 1.5 }} onClick={(e) => e.stopPropagation()}>
                    <Box display="flex" gap={0.5} justifyContent="flex-end">
                      <Tooltip title="View Details">
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/stores/${store.id}`);
                          }}
                          sx={{ 
                            p: 0.75,
                            '&:hover': { 
                              bgcolor: 'primary.light',
                              color: 'primary.contrastText',
                            },
                          }}
                        >
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="View Inventory">
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/stores/${store.id}?tab=inventory`);
                          }}
                          sx={{ 
                            p: 0.75,
                            '&:hover': { 
                              bgcolor: 'primary.light',
                              color: 'primary.contrastText',
                            },
                          }}
                        >
                          <InventoryIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Edit Store">
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/stores/${store.id}/edit`);
                          }}
                          sx={{ 
                            p: 0.75,
                            '&:hover': { 
                              bgcolor: 'primary.light',
                              color: 'primary.contrastText',
                            },
                          }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete Store">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(store.id, store.name);
                          }}
                          disabled={deleteStore.isPending}
                          sx={{ 
                            p: 0.75,
                            '&:hover': { 
                              bgcolor: 'error.light',
                              color: 'error.contrastText',
                            },
                          }}
                        >
                          {deleteStore.isPending ? (
                            <CircularProgress size={16} />
                          ) : (
                            <DeleteIcon fontSize="small" />
                          )}
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                  <Box display="flex" flexDirection="column" alignItems="center" gap={2}>
                    <StoreIcon sx={{ fontSize: 48, color: 'text.disabled', opacity: 0.5 }} />
                    <Typography variant="h6" color="text.secondary">
                      {searchTerm ? 'No stores found' : 'No stores yet'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {searchTerm 
                        ? 'Try adjusting your search terms'
                        : 'Create your first store to get started'}
                    </Typography>
                    {!searchTerm && (
                      <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={() => navigate('/stores/new')}
                        sx={{ mt: 1 }}
                      >
                        Create Store
                      </Button>
                    )}
                  </Box>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <ConfirmDialog
        open={deleteConfirmOpen}
        onClose={() => {
          setDeleteConfirmOpen(false);
          setStoreToDelete(null);
        }}
        onConfirm={confirmDelete}
        title="Delete Store"
        message={storeToDelete ? `Are you sure you want to delete "${storeToDelete.name}"? This action cannot be undone.` : 'Are you sure you want to delete this store? This action cannot be undone.'}
        confirmText="Delete"
        cancelText="Cancel"
        confirmColor="error"
        loading={deleteStore.isPending}
        severity="error"
      />

      <StoreReportModal
        open={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        reportType={reportType}
      />
    </Box>
  );
};

export default StoreList;

