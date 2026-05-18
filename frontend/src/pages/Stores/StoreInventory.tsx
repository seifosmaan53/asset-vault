import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  IconButton,
  Chip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Skeleton,
  Tooltip,
  CircularProgress,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Autocomplete,
  LinearProgress,
  InputAdornment} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import VisibilityIcon from '@mui/icons-material/Visibility';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import AddIcon from '@mui/icons-material/Add';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';
import InventoryIcon from '@mui/icons-material/Inventory';
import WarehouseIcon from '@mui/icons-material/Warehouse';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import DownloadIcon from '@mui/icons-material/Download';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import RemoveCircleIcon from '@mui/icons-material/RemoveCircle';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Divider from '@mui/material/Divider';
import Alert from '@mui/material/Alert';
import { useStoreItemSettingsByStore, useCreateOrUpdateStoreItemSettings, useUpdateStock } from '../../hooks/useStoreItemSettings';
import { exportToCSV } from '../../utils/export';
import { useStore } from '../../hooks/useStore';
import { useInventory } from '../../hooks/useInventory';
import { useToast } from '../../contexts/ToastContext';
import { useQueryClient } from '@tanstack/react-query';
import { formatCurrency } from '../../utils/formatters';
import StoreIcon from '@mui/icons-material/Store';
import { storeItemSettingsApi } from '../../api/storeItemSettings';
import type { StoreItemSettings } from '../../types/store';
import type { InventoryItem } from '../../types/inventory';
import Grid from '../../components/common/Grid';
import { TIMEOUTS } from '../../constants/timeouts';
import { ItemStoresDialog } from '../../components/inventory/ItemStoresDialog';

const StoreInventory = () => {
  const { id: storeId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: store, isLoading: storeLoading } = useStore(storeId || '');
  const { data: settings, isLoading: settingsLoading, refetch: refetchSettings } = useStoreItemSettingsByStore(storeId || '');
  const { data: allItems } = useInventory();
  
  // Auto-refresh stock levels periodically - only when page is visible to reduce unnecessary API calls
  useEffect(() => {
    if (!storeId) return;
    
    // Don't auto-refresh if page is hidden
    if (document.hidden) return;
    
    const interval = setInterval(() => {
      // Only refresh if page is still visible
      if (!document.hidden) {
        refetchSettings();
        // Also refresh main inventory to sync global stock
        queryClient.invalidateQueries({ queryKey: ['inventory'] });
      }
    }, TIMEOUTS.REAL_TIME_REFRESH_INTERVAL); // 5 seconds for real-time synchronization
    
    return () => clearInterval(interval);
  }, [storeId, refetchSettings, queryClient]);

  const updateSettings = useCreateOrUpdateStoreItemSettings();
  const updateStock = useUpdateStock();
  const { showToast } = useToast();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [lowStockFilter, setLowStockFilter] = useState<boolean>(false);
  const [outOfStockFilter, setOutOfStockFilter] = useState<boolean>(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [addItemDialogOpen, setAddItemDialogOpen] = useState(false);

  // Reset dialog state when it opens/closes
  useEffect(() => {
    if (!addItemDialogOpen) {
      // Reset when dialog closes
      setSelectedItemToAdd(null);
      setNewItemStock(1);
      setNewItemMinQty(0);
    } else {
      // Reset when dialog opens
      setNewItemStock(1);
      setNewItemMinQty(0);
    }
  }, [addItemDialogOpen]);
  const [selectedItemToAdd, setSelectedItemToAdd] = useState<InventoryItem | null>(null);
  const [newItemStock, setNewItemStock] = useState<number | string>(1);
  const [newItemMinQty, setNewItemMinQty] = useState<number | string>(0);
  const [editingStock, setEditingStock] = useState<Record<string, { stock: number | string; minQty: number | string; targetQty?: number | string }>>({});
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isExporting, setIsExporting] = useState(false);
  const [storesDialogOpen, setStoresDialogOpen] = useState(false);
  const [selectedItemForStores, setSelectedItemForStores] = useState<InventoryItem | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const isLoading = storeLoading || settingsLoading;
  
  // Get items not yet added to this store
  const availableItemsToAdd = useMemo(() => {
    if (!allItems || !settings) return allItems || [];
    const addedItemIds = new Set(settings.map(s => s.inventoryItemId));
    return allItems.filter(item => !addedItemIds.has(item.id));
  }, [allItems, settings]);
  
  // Extract unique categories from items
  const categories = useMemo(() => {
    if (!settings) return [];
    const categorySet = new Set<string>();
    settings.forEach((setting) => {
      const item = setting.inventoryItem;
      if (item?.category) {
        categorySet.add(item.category);
      }
    });
    return Array.from(categorySet).sort();
  }, [settings]);

  // Filter and sort settings
  const filteredSettings = useMemo(() => {
    if (!settings) return [];
    
    let filtered = [...settings];
    
    // Search filter
    if (searchTerm && searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter((setting) => {
        const item = setting.inventoryItem;
        if (!item) return false;
        return (
          item.name.toLowerCase().includes(searchLower) ||
          item.sku.toLowerCase().includes(searchLower) ||
          (item.description && item.description.toLowerCase().includes(searchLower))
        );
      });
    }
    
    // Status filter
    if (statusFilter === 'active' || statusFilter === 'inactive') {
      filtered = filtered.filter((setting) => {
        return setting.inventoryItem?.status === statusFilter;
      });
    }

    // Category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter((setting) => {
        return setting.inventoryItem?.category === categoryFilter;
      });
    }

    // Low stock filter
    if (lowStockFilter) {
      filtered = filtered.filter((setting) => isLowStock(setting));
    }

    // Out of stock filter
    if (outOfStockFilter) {
      filtered = filtered.filter((setting) => isOutOfStock(setting));
    }

    
    // Sorting
    filtered.sort((a, b) => {
      let comparison = 0;
      const itemA = a.inventoryItem;
      const itemB = b.inventoryItem;

      switch (sortBy) {
        case 'name':
          comparison = (itemA?.name || '').localeCompare(itemB?.name || '');
          break;
        case 'stock':
          comparison = (a.currentStock || 0) - (b.currentStock || 0);
          break;
        case 'sku':
          comparison = (itemA?.sku || '').localeCompare(itemB?.sku || '');
          break;
        default:
          comparison = 0;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });
    
    return filtered;
  }, [settings, searchTerm, statusFilter, lowStockFilter, outOfStockFilter, categoryFilter, sortBy, sortOrder]);
  
  const availableStock = useCallback((setting: StoreItemSettings) => {
    return setting.currentStock || 0;
  }, []);
  
  const isLowStock = useCallback((setting: StoreItemSettings) => {
    return setting.currentStock <= (setting.minQty || 0);
  }, []);
  
  const isOutOfStock = useCallback((setting: StoreItemSettings) => {
    return setting.currentStock === 0;
  }, []);

  // Memoize summary statistics for all settings (not filtered)
  const summaryStats = useMemo(() => {
    if (!settings) {
      return {
        totalItems: 0,
        totalStock: 0,
        lowStockCount: 0,
        outOfStockCount: 0,
      };
    }
    
    return {
      totalItems: settings.length,
      totalStock: settings.reduce((sum, s) => sum + (s.currentStock || 0), 0),
      lowStockCount: settings.filter(s => isLowStock(s)).length,
      outOfStockCount: settings.filter(s => isOutOfStock(s)).length,
    };
  }, [settings, isLowStock, isOutOfStock]);
  
  const handleStockEdit = (settingId: string, currentStock: number, minQty: number, targetQty?: number) => {
    setEditingStock(prev => ({
      ...prev,
      [settingId]: { stock: currentStock, minQty, targetQty: targetQty || undefined }
    }));
  };
  
  const handleStockSave = async (setting: StoreItemSettings) => {
    const edited = editingStock[setting.id];
    if (!edited) return;
    
    const newStock = typeof edited.stock === 'number' ? edited.stock : parseInt(String(edited.stock)) || 0;
    const previousStock = setting.currentStock || 0;
    
    // PROFESSIONAL FIX: Client-side validation before API call
    if (newStock > previousStock) {
      // This is an increase - check if total allocation would exceed global inventory
      const item = setting.inventoryItem;
      if (item) {
        const globalStock = item.currentStock || 0;
        const increaseAmount = newStock - previousStock;
        
        // Calculate current total store stock (sum of all stores)
        const currentTotalStoreStock = settings?.reduce(
          (sum, s) => sum + (s.currentStock || 0),
          0,
        ) || 0;
        
        const newTotalStoreStock = currentTotalStoreStock - previousStock + newStock;
        
        if (newTotalStoreStock > globalStock) {
          const availableForAllocation = globalStock - (currentTotalStoreStock - previousStock);
          showToast(
            `Cannot allocate ${increaseAmount} units. Total allocation would be ${newTotalStoreStock}, but total inventory is only ${globalStock}. Available: ${availableForAllocation} units.`,
            'error'
          );
          return;
        }
      }
    }
    
    try {
      await updateSettings.mutateAsync({
        storeId: storeId!,
        inventoryItemId: setting.inventoryItemId,
        currentStock: newStock,
        minQty: typeof edited.minQty === 'number' ? edited.minQty : parseInt(String(edited.minQty)) || 0,
        targetQty: edited.targetQty !== undefined && edited.targetQty !== '' 
          ? (typeof edited.targetQty === 'number' ? edited.targetQty : parseInt(String(edited.targetQty))) 
          : undefined,
      });
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['store-item-settings', 'store', storeId] });
      queryClient.invalidateQueries({ queryKey: ['store-item-settings', 'item', setting.inventoryItemId] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      
      setEditingStock(prev => {
        const newState = { ...prev };
        delete newState[setting.id];
        return newState;
      });
      
      showToast('Stock updated successfully', 'success');
      refetchSettings();
    } catch (error: unknown) {
      const errorMessage = (error as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to update stock';
      showToast(errorMessage, 'error');
    }
  };
  
  const handleAddItem = async () => {
    if (!selectedItemToAdd || !storeId) {
      showToast('Please select an item to add', 'warning');
      return;
    }
    
    // Validate stock values
    const stockValue = typeof newItemStock === 'number' 
      ? newItemStock 
      : (newItemStock === '' || newItemStock === '-') 
        ? 1 
        : parseInt(String(newItemStock), 10);
    
    const minQtyValue = typeof newItemMinQty === 'number' 
      ? newItemMinQty 
      : (newItemMinQty === '' || newItemMinQty === '-') 
        ? 0 
        : parseInt(String(newItemMinQty), 10);
    
    if (isNaN(stockValue) || stockValue < 0) {
      showToast('Please enter a valid initial stock value', 'error');
      return;
    }
    
    if (isNaN(minQtyValue) || minQtyValue < 0) {
      showToast('Please enter a valid minimum quantity value', 'error');
      return;
    }
    
    try {
      await updateSettings.mutateAsync({
        storeId: storeId,
        inventoryItemId: selectedItemToAdd.id,
        currentStock: stockValue,
        minQty: minQtyValue,
      });
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['store-item-settings', 'store', storeId] });
      queryClient.invalidateQueries({ queryKey: ['store-item-settings', 'item', selectedItemToAdd.id] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['stores'] });
      
      // Reset form state
      setAddItemDialogOpen(false);
      setSelectedItemToAdd(null);
      setNewItemStock(1);
      setNewItemMinQty(0);
      
      showToast('Item added to store successfully', 'success');
      refetchSettings();
    } catch (error: unknown) {
      const errorMessage = (error as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to add item to store';
      showToast(errorMessage, 'error');
      console.error('Error adding item to store:', error);
    }
  };
  
  const handleRemoveItem = async (setting: StoreItemSettings) => {
    try {
      if (setting.id) {
        // Use delete by ID if available
        await storeItemSettingsApi.delete(setting.id);
      } else {
        // Fallback to delete by store and item IDs
        await storeItemSettingsApi.deleteByStoreAndItem(storeId!, setting.inventoryItemId);
      }
      
      queryClient.invalidateQueries({ queryKey: ['store-item-settings', 'store', storeId] });
      queryClient.invalidateQueries({ queryKey: ['store-item-settings', 'item', setting.inventoryItemId] });
      showToast('Item removed from store', 'success');
      refetchSettings();
    } catch (error: unknown) {
      const errorMessage = (error as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to remove item';
      showToast(errorMessage, 'error');
    }
  };

  if (isLoading) {
    return (
      <Box>
        <Skeleton variant="text" width={300} height={40} sx={{ mb: 3 }} />
        <Skeleton variant="rectangular" width="100%" height={400} />
      </Box>
    );
  }

  if (!store) {
    return (
      <Box>
        <Typography variant="h4">Store not found</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ 
      width: '100%', 
      maxWidth: '100%',
    }}>
      {/* Enhanced Header Section */}
      <Paper 
        elevation={0}
        sx={{ 
          p: { xs: 2.5, sm: 3.5 }, 
          mb: 3, 
          borderRadius: 3,
          background: 'linear-gradient(135deg, rgba(25, 118, 210, 0.08) 0%, rgba(25, 118, 210, 0.03) 100%)',
          border: '1px solid',
          borderColor: 'divider',
          position: 'relative',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '4px',
            background: 'linear-gradient(90deg, #1976d2 0%, #42a5f5 50%, #1976d2 100%)',
          },
        }}
      >
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={2} sx={{ width: '100%' }}>
          <Box flex={1} minWidth={{ xs: '100%', sm: 280 }}>
            <Box display="flex" alignItems="center" gap={2} mb={2}>
              <Box sx={{ 
                p: 1.5, 
                borderRadius: 2.5, 
                bgcolor: 'primary.main', 
                color: 'primary.contrastText',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(25, 118, 210, 0.3)',
                transition: 'transform 0.2s',
                '&:hover': {
                  transform: 'scale(1.05)',
                },
              }}>
                <StoreIcon sx={{ fontSize: 32 }} />
              </Box>
              <Box flex={1}>
                <Typography 
                  variant="h4" 
                  component="h1" 
                  sx={{ 
                    fontWeight: 700, 
                    fontSize: { xs: '1.5rem', sm: '1.875rem' }, 
                    lineHeight: 1.2, 
                    mb: 0.5,
                    background: 'linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)',
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  {store.name}
                </Typography>
                <Typography 
                  variant="body2" 
                  color="text.secondary" 
                  sx={{ 
                    fontSize: '0.9375rem', 
                    fontWeight: 500,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    flexWrap: 'wrap',
                  }}
                >
                  <Chip 
                    label={`${settings?.length || 0} ${(settings?.length || 0) === 1 ? 'item' : 'items'}`}
                    size="small"
                    color="primary"
                    variant="outlined"
                    sx={{ 
                      height: 24,
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                    }}
                  />
                  {availableItemsToAdd.length > 0 && (
                    <Chip 
                      label={`${availableItemsToAdd.length} available to add`}
                      size="small"
                      color="success"
                      variant="outlined"
                      sx={{ 
                        height: 24,
                        fontSize: '0.8125rem',
                        fontWeight: 600,
                      }}
                    />
                  )}
                  {store.code && (
                    <Chip 
                      label={`Code: ${store.code}`}
                      size="small"
                      variant="outlined"
                      sx={{ 
                        height: 24,
                        fontSize: '0.8125rem',
                        fontWeight: 500,
                      }}
                    />
                  )}
                </Typography>
              </Box>
            </Box>
            
            {/* Enhanced Info Banner */}
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 1.5,
              px: 2,
              py: 1.25,
              borderRadius: 2,
              bgcolor: 'success.50',
              border: '1px solid',
              borderColor: 'success.200',
              mt: 1.5,
            }}>
              <Box sx={{ 
                width: 10, 
                height: 10, 
                borderRadius: '50%', 
                bgcolor: 'success.main',
                animation: 'pulse 2s infinite',
                '@keyframes pulse': {
                  '0%, 100%': { opacity: 1, transform: 'scale(1)' },
                  '50%': { opacity: 0.7, transform: 'scale(1.2)' },
                },
                boxShadow: '0 0 8px rgba(46, 125, 50, 0.4)',
              }} />
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem', fontWeight: 500 }}>
                <strong>Live Updates:</strong> Stock levels refresh automatically every 30 seconds
              </Typography>
            </Box>
          </Box>
          {/* Action Buttons */}
          <Box display="flex" gap={1.5} alignItems="flex-start" flexWrap="wrap" sx={{ width: { xs: '100%', sm: 'auto' } }}>
            <Tooltip title={`Export store inventory to CSV (Excel compatible)`} arrow>
              <span>
                <Button
                  variant="outlined"
                  startIcon={isExporting ? <CircularProgress size={18} /> : <DownloadIcon />}
                  onClick={async () => {
              if (!filteredSettings || filteredSettings.length === 0) {
                showToast('No items to export', 'warning');
                return;
              }
              setIsExporting(true);
              try {
                const exportData = filteredSettings.map(setting => {
                  const item = setting.inventoryItem;
                  const isLowStock = setting.currentStock <= (setting.minQty || 0);
                  return {
                    'SKU': item?.sku || '',
                    'Name': item?.name || '',
                    'Description': item?.description || '',
                    'Store Stock': setting.currentStock,
                    'Min Qty': setting.minQty,
                    'Target Qty': setting.targetQty || '',
                    'Weekly Usage': setting.weeklyUsage || '',
                    'Global Stock': item?.currentStock || 0,
                    'Stock Difference': (setting.currentStock - (item?.currentStock || 0)),
                    'Status': item?.status || 'active',
                    'Low Stock Alert': isLowStock ? 'Yes' : 'No',
                    'Unit Price': item?.defaultUnitPrice || 0,
                    'Stock Value': (setting.currentStock * (item?.defaultUnitPrice || 0)).toFixed(2),
                  };
                });
                
                const safeStoreName = store?.name?.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'store';
                
                exportToCSV(exportData, {
                  filename: `store-inventory-${safeStoreName}`,
                  title: `Store Inventory Export - ${store?.name || 'Store'}`,
                  description: `Inventory items and stock levels for ${store?.name || 'store'} (${store?.code || 'N/A'})`,
                  includeMetadata: true,
                  metadata: {
                    additionalInfo: `Store: ${store?.name || ''} | Code: ${store?.code || ''}`,
                  },
                  formatNumbers: true,
                  formatDates: false,
                });
                
                showToast('Store inventory exported successfully', 'success');
              } catch (error) {
                showToast('Failed to export inventory', 'error');
              } finally {
                setIsExporting(false);
              }
            }}
                  disabled={!filteredSettings || filteredSettings.length === 0 || isExporting}
                  sx={{
                    borderRadius: 2.5,
                    textTransform: 'none',
                    fontWeight: 600,
                    minWidth: 140,
                    px: 2.5,
                    py: 1.25,
                    borderWidth: 2,
                    bgcolor: 'background.paper',
                    '&:hover': {
                      borderWidth: 2,
                      bgcolor: 'action.hover',
                      transform: 'translateY(-2px)',
                      boxShadow: 3,
                    },
                    transition: 'all 0.2s ease-in-out',
                  }}
                >
                  {isExporting ? 'Exporting...' : 'Export CSV'}
                </Button>
              </span>
            </Tooltip>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setAddItemDialogOpen(true)}
              disabled={availableItemsToAdd.length === 0}
              sx={{
                borderRadius: 2.5,
                textTransform: 'none',
                fontWeight: 600,
                minWidth: 140,
                px: 2.5,
                py: 1.25,
                boxShadow: 3,
                background: 'linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)',
                '&:hover': {
                  boxShadow: 6,
                  transform: 'translateY(-2px)',
                  background: 'linear-gradient(135deg, #1565c0 0%, #1976d2 100%)',
                },
                '&:disabled': {
                  background: 'grey.300',
                },
                transition: 'all 0.2s ease-in-out',
              }}
            >
              Add Item
            </Button>
          </Box>
        </Box>
      </Paper>

      {/* Summary Cards - Always show totals for ALL items, not filtered */}
      {settings && settings.length > 0 && (
        <Grid container spacing={2.5} sx={{ width: '100%', mb: 3 }}>
          <Grid size={{ xs: 6, sm: 3 }} sx={{ display: 'flex' }}>
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
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  boxShadow: 4,
                  transform: 'translateY(-2px)',
                },
              }}
            >
              <Box sx={{ 
                p: 1.5, 
                borderRadius: 2, 
                bgcolor: 'primary.main', 
                color: 'primary.contrastText',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: 48,
                height: 48,
              }}>
                <InventoryIcon sx={{ fontSize: 24 }} />
              </Box>
              <Box flex={1}>
                <Typography variant="h4" fontWeight={700} sx={{ fontSize: '1.75rem', lineHeight: 1.2, mb: 0.5 }}>
                  {summaryStats.totalItems}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem', fontWeight: 500 }}>
                  Total Items
                </Typography>
              </Box>
            </Paper>
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }} sx={{ display: 'flex' }}>
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
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  boxShadow: 4,
                  transform: 'translateY(-2px)',
                },
              }}
            >
              <Box sx={{ 
                p: 1.5, 
                borderRadius: 2, 
                bgcolor: 'success.main', 
                color: 'success.contrastText',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: 48,
                height: 48,
              }}>
                <WarehouseIcon sx={{ fontSize: 24 }} />
              </Box>
              <Box flex={1}>
                <Typography variant="h4" fontWeight={700} sx={{ fontSize: '1.75rem', lineHeight: 1.2, mb: 0.5 }}>
                  {summaryStats.totalStock.toLocaleString()}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem', fontWeight: 500 }}>
                  Total Stock
                </Typography>
              </Box>
            </Paper>
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }} sx={{ display: 'flex' }}>
            <Paper 
              sx={{ 
                p: 2.5, 
                display: 'flex', 
                alignItems: 'center', 
                gap: 2,
                height: '100%',
                boxShadow: 2,
                borderRadius: 2,
                border: '1px solid',
                borderColor: summaryStats.lowStockCount > 0 ? 'warning.main' : 'divider',
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  boxShadow: 4,
                  transform: 'translateY(-2px)',
                },
              }}
            >
              <Box sx={{ 
                p: 1.5, 
                borderRadius: 2, 
                bgcolor: summaryStats.lowStockCount > 0 ? 'warning.main' : 'grey.300', 
                color: summaryStats.lowStockCount > 0 ? 'warning.contrastText' : 'text.secondary',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: 48,
                height: 48,
              }}>
                <WarningAmberIcon sx={{ fontSize: 24 }} />
              </Box>
              <Box flex={1}>
                <Typography 
                  variant="h4" 
                  fontWeight={700} 
                  sx={{ 
                    fontSize: '1.75rem', 
                    lineHeight: 1.2, 
                    mb: 0.5,
                    color: summaryStats.lowStockCount > 0 ? 'warning.main' : 'text.primary',
                  }}
                >
                  {summaryStats.lowStockCount}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem', fontWeight: 500 }}>
                  Low Stock Items
                </Typography>
              </Box>
            </Paper>
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }} sx={{ display: 'flex' }}>
            <Paper 
              sx={{ 
                p: 2.5, 
                display: 'flex', 
                alignItems: 'center', 
                gap: 2,
                height: '100%',
                boxShadow: 2,
                borderRadius: 2,
                border: '1px solid',
                borderColor: summaryStats.outOfStockCount > 0 ? 'error.main' : 'divider',
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  boxShadow: 4,
                  transform: 'translateY(-2px)',
                },
              }}
            >
              <Box sx={{ 
                p: 1.5, 
                borderRadius: 2, 
                bgcolor: summaryStats.outOfStockCount > 0 ? 'error.main' : 'grey.300', 
                color: summaryStats.outOfStockCount > 0 ? 'error.contrastText' : 'text.secondary',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: 48,
                height: 48,
              }}>
                <WarningAmberIcon sx={{ fontSize: 24 }} />
              </Box>
              <Box flex={1}>
                <Typography 
                  variant="h4" 
                  fontWeight={700} 
                  sx={{ 
                    fontSize: '1.75rem', 
                    lineHeight: 1.2, 
                    mb: 0.5,
                    color: summaryStats.outOfStockCount > 0 ? 'error.main' : 'text.primary',
                  }}
                >
                  {summaryStats.outOfStockCount}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem', fontWeight: 500 }}>
                  Out of Stock
                </Typography>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* Enhanced Filter Section */}
      <Paper 
        sx={{ 
          p: { xs: 2, sm: 3 }, 
          mb: 3, 
          borderRadius: 3, 
          boxShadow: 2, 
          border: '1px solid', 
          borderColor: 'divider',
          background: 'linear-gradient(to bottom, rgba(255, 255, 255, 0.95), rgba(250, 250, 250, 0.95))',
        }}
      >
        <Box display="flex" gap={2} flexWrap="wrap" alignItems="center" sx={{ width: '100%' }}>
          <TextField
            inputRef={searchInputRef}
            placeholder="Search items by name, SKU, or description..."
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
                  <SearchIcon sx={{ color: 'primary.main', fontSize: 22 }} />
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
                    sx={{ 
                      mr: -1,
                      '&:hover': {
                        bgcolor: 'action.hover',
                      },
                    }}
                  >
                    <ClearIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ),
            }}
            sx={{ 
              flexGrow: 1,
              minWidth: { xs: '100%', sm: 280 },
              '& .MuiOutlinedInput-root': {
                borderRadius: 2.5,
                bgcolor: 'background.paper',
                boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                '&:hover': {
                  boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
                },
                '&.Mui-focused': {
                  boxShadow: '0 4px 12px rgba(25, 118, 210, 0.15)',
                },
                transition: 'all 0.2s ease-in-out',
              },
            }}
          />
          <FormControl sx={{ minWidth: { xs: '100%', sm: 140 } }}>
            <InputLabel sx={{ fontSize: '0.875rem', fontWeight: 500 }}>Status</InputLabel>
            <Select
              value={statusFilter}
              label="Status"
              onChange={(e) => setStatusFilter(e.target.value)}
              sx={{ 
                borderRadius: 2.5, 
                bgcolor: 'background.paper',
                boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                '&:hover': {
                  boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
                },
              }}
            >
              <MenuItem value="all">All Status</MenuItem>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="inactive">Inactive</MenuItem>
            </Select>
          </FormControl>
          <Button
            variant={lowStockFilter ? 'contained' : 'outlined'}
            color={lowStockFilter ? 'warning' : 'inherit'}
            onClick={() => setLowStockFilter(!lowStockFilter)}
            startIcon={lowStockFilter ? <WarningAmberIcon /> : null}
            sx={{ 
              borderRadius: 2.5, 
              fontWeight: 600, 
              textTransform: 'none', 
              minWidth: { xs: '100%', sm: 130 },
              px: 2,
              boxShadow: lowStockFilter ? 2 : 0,
              '&:hover': {
                boxShadow: 3,
                transform: 'translateY(-1px)',
              },
              transition: 'all 0.2s ease-in-out',
            }}
          >
            Low Stock
          </Button>
          <Button
            variant={outOfStockFilter ? 'contained' : 'outlined'}
            color={outOfStockFilter ? 'error' : 'inherit'}
            onClick={() => setOutOfStockFilter(!outOfStockFilter)}
            startIcon={outOfStockFilter ? <WarningAmberIcon /> : null}
            sx={{ 
              borderRadius: 2.5, 
              fontWeight: 600, 
              textTransform: 'none', 
              minWidth: { xs: '100%', sm: 140 },
              px: 2,
              boxShadow: outOfStockFilter ? 2 : 0,
              '&:hover': {
                boxShadow: 3,
                transform: 'translateY(-1px)',
              },
              transition: 'all 0.2s ease-in-out',
            }}
          >
            Out of Stock
          </Button>
          {categories.length > 0 && (
            <FormControl sx={{ minWidth: { xs: '100%', sm: 160 } }}>
              <InputLabel sx={{ fontSize: '0.875rem', fontWeight: 500 }}>Category</InputLabel>
              <Select
                value={categoryFilter}
                label="Category"
                onChange={(e) => setCategoryFilter(e.target.value)}
                sx={{ 
                  borderRadius: 2.5, 
                  bgcolor: 'background.paper',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                  '&:hover': {
                    boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
                  },
                }}
              >
                <MenuItem value="all">All Categories</MenuItem>
                {categories.map(cat => (
                  <MenuItem key={cat} value={cat}>{cat}</MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          <FormControl sx={{ minWidth: { xs: '100%', sm: 140 } }}>
            <InputLabel sx={{ fontSize: '0.875rem', fontWeight: 500 }}>Sort By</InputLabel>
            <Select
              value={sortBy}
              label="Sort By"
              onChange={(e) => setSortBy(e.target.value)}
              sx={{ 
                borderRadius: 2.5, 
                bgcolor: 'background.paper',
                boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                '&:hover': {
                  boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
                },
              }}
            >
              <MenuItem value="name">Name</MenuItem>
              <MenuItem value="stock">Stock Level</MenuItem>
              <MenuItem value="sku">SKU</MenuItem>
            </Select>
          </FormControl>
          <Button
            variant="outlined"
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            sx={{ 
              borderRadius: 2.5, 
              minWidth: { xs: '100%', sm: 140 },
              fontWeight: 600,
              textTransform: 'none',
              px: 2,
              boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
              '&:hover': {
                boxShadow: 3,
                transform: 'translateY(-1px)',
              },
              transition: 'all 0.2s ease-in-out',
            }}
            startIcon={sortOrder === 'asc' ? <ArrowUpwardIcon /> : <ArrowDownwardIcon />}
          >
            {sortOrder === 'asc' ? 'Ascending' : 'Descending'}
          </Button>
      </Box>
      </Paper>

      <TableContainer 
        component={Paper}
        sx={{
          borderRadius: 3,
          boxShadow: 3,
          border: '1px solid',
          borderColor: 'divider',
          overflow: 'hidden',
          mb: 3,
          '&::-webkit-scrollbar': {
            height: '8px',
          },
          '&::-webkit-scrollbar-track': {
            background: 'rgba(0,0,0,0.05)',
          },
          '&::-webkit-scrollbar-thumb': {
            background: 'rgba(0,0,0,0.2)',
            borderRadius: '4px',
            '&:hover': {
              background: 'rgba(0,0,0,0.3)',
            },
          },
        }}
      >
        <Table>
          <TableHead>
            <TableRow sx={{ 
              background: 'linear-gradient(135deg, rgba(25, 118, 210, 0.12) 0%, rgba(25, 118, 210, 0.06) 100%)',
              borderBottom: '3px solid',
              borderColor: 'primary.main',
              '& th': {
                borderBottom: 'none',
              },
            }}>
              <TableCell sx={{ 
                fontWeight: 700, 
                py: 2.5, 
                px: 3,
                fontSize: '0.8125rem', 
                textTransform: 'uppercase', 
                letterSpacing: '1px', 
                color: 'text.primary',
                position: 'relative',
                '&::after': {
                  content: '""',
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: '2px',
                  background: 'linear-gradient(90deg, transparent, primary.main, transparent)',
                  opacity: 0.3,
                },
              }}>
                <Box display="flex" alignItems="center" gap={1}>
                  <InventoryIcon sx={{ fontSize: 18, color: 'primary.main', opacity: 0.8 }} />
                  <Typography component="span" sx={{ fontWeight: 700 }}>
                    Item Details
                  </Typography>
                </Box>
              </TableCell>
              <TableCell sx={{ 
                fontWeight: 700, 
                py: 2.5,
                px: 3,
                minWidth: 220, 
                fontSize: '0.8125rem', 
                textTransform: 'uppercase', 
                letterSpacing: '1px', 
                color: 'text.primary',
              }}>
                <Box display="flex" alignItems="center" gap={1}>
                  <InfoOutlinedIcon sx={{ fontSize: 18, color: 'text.secondary', opacity: 0.7 }} />
                  <Typography component="span" sx={{ fontWeight: 700 }}>
                    Description
                  </Typography>
                </Box>
              </TableCell>
              <TableCell 
                align="center" 
                sx={{ 
                  fontWeight: 700, 
                  py: 2.5,
                  px: 3,
                  minWidth: 200, 
                  background: 'linear-gradient(135deg, rgba(25, 118, 210, 0.15) 0%, rgba(25, 118, 210, 0.08) 100%)',
                  borderLeft: '3px solid',
                  borderRight: '3px solid',
                  borderColor: 'primary.main',
                  position: 'relative',
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'linear-gradient(135deg, rgba(25, 118, 210, 0.1) 0%, transparent 100%)',
                    pointerEvents: 'none',
                  },
                }}
              >
                <Box 
                  display="flex" 
                  alignItems="center" 
                  justifyContent="center" 
                  gap={1.5}
                  sx={{ position: 'relative', zIndex: 1 }}
                >
                  <Box sx={{
                    p: 0.75,
                    borderRadius: 1.5,
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 8px rgba(25, 118, 210, 0.3)',
                  }}>
                    <InventoryIcon sx={{ fontSize: 20 }} />
                  </Box>
                  <Typography 
                    variant="body1" 
                    fontWeight={700} 
                    sx={{ 
                      fontSize: '0.875rem', 
                      color: 'primary.main', 
                      textTransform: 'uppercase', 
                      letterSpacing: '1px',
                      textShadow: '0 1px 2px rgba(25, 118, 210, 0.2)',
                    }}
                  >
                    Stock Available
                  </Typography>
                </Box>
              </TableCell>
              <TableCell 
                align="right" 
                sx={{ 
                  fontWeight: 700, 
                  py: 2.5,
                  px: 3,
                  fontSize: '0.8125rem', 
                  textTransform: 'uppercase', 
                  letterSpacing: '1px', 
                  color: 'text.primary',
                }}
              >
                <Box display="flex" alignItems="center" justifyContent="flex-end" gap={1}>
                  <WarningAmberIcon sx={{ fontSize: 18, color: 'warning.main', opacity: 0.8 }} />
                  <Typography component="span" sx={{ fontWeight: 700 }}>
                    Min Qty
                  </Typography>
                </Box>
              </TableCell>
              <TableCell 
                align="center" 
                sx={{ 
                  fontWeight: 700, 
                  py: 2.5,
                  px: 3,
                  fontSize: '0.8125rem', 
                  textTransform: 'uppercase', 
                  letterSpacing: '1px', 
                  color: 'text.primary',
                }}
              >
                <Box display="flex" alignItems="center" justifyContent="center" gap={1}>
                  <Typography component="span" sx={{ fontWeight: 700 }}>
                    Actions
                  </Typography>
                </Box>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredSettings.length > 0 ? (
              filteredSettings.map((setting) => {
                const item = setting.inventoryItem;
                if (!item) return null;
                
                const available = availableStock(setting);
                const lowStock = isLowStock(setting);
                const outOfStock = isOutOfStock(setting);
                const storeStock = Math.max(0, setting.currentStock || 0);
                const globalStock = Math.max(0, item.currentStock || 0);
                const stockDiff = storeStock - globalStock;
                const stockValue = storeStock * (item.defaultUnitPrice || 0);
                const weeklyUsageNum = typeof setting.weeklyUsage === 'string' 
                  ? parseFloat(setting.weeklyUsage) 
                  : (setting.weeklyUsage || 0);
                const weeksOnHand = weeklyUsageNum > 0 
                  ? (storeStock / weeklyUsageNum).toFixed(1)
                  : null;
                // Calculate actual percentage (can exceed 100% if stock is above minimum)
                const stockPercent = setting.minQty > 0 
                  ? (storeStock / setting.minQty) * 100
                  : (storeStock > 0 ? 100 : 0);
                const targetPercent = setting.targetQty && setting.targetQty > 0
                  ? (storeStock / setting.targetQty) * 100
                  : null;
                
                return (
                  <TableRow 
                    key={setting.id} 
                    hover
                    sx={{
                      bgcolor: outOfStock 
                        ? 'error.50' 
                        : lowStock 
                          ? 'warning.50' 
                          : 'inherit',
                      borderLeft: outOfStock 
                        ? '3px solid' 
                        : lowStock 
                          ? '3px solid' 
                          : 'none',
                      borderLeftColor: outOfStock ? 'error.main' : lowStock ? 'warning.main' : 'transparent',
                      '&:hover': {
                        bgcolor: outOfStock 
                          ? 'error.100' 
                          : lowStock 
                            ? 'warning.100' 
                            : 'action.hover',
                      },
                    }}
                  >
                    <TableCell sx={{ py: 2 }}>
                      <Box>
                        <Box display="flex" alignItems="flex-start" gap={1.5} mb={1}>
                          <Box sx={{ 
                            p: 0.75, 
                            borderRadius: 1.5, 
                            bgcolor: outOfStock ? 'error.50' : lowStock ? 'warning.50' : 'primary.50',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minWidth: 32,
                            height: 32,
                          }}>
                          <InventoryIcon 
                            sx={{ 
                              color: outOfStock ? 'error.main' : lowStock ? 'warning.main' : 'primary.main',
                              fontSize: 18,
                            }} 
                          />
                          </Box>
                          <Box flex={1} minWidth={0}>
                            <Typography 
                              variant="body1" 
                              fontWeight={600} 
                              sx={{ 
                                fontSize: '0.9375rem',
                                lineHeight: 1.3,
                                mb: 0.25,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                              title={item.name}
                            >
                              {item.name}
                            </Typography>
                            <Typography 
                              variant="caption" 
                              sx={{ 
                                fontFamily: 'monospace',
                                fontSize: '0.75rem',
                                color: 'text.secondary',
                                display: 'block',
                              }}
                            >
                              SKU: {item.sku}
                            </Typography>
                          </Box>
                          <Box>
                          {lowStock && !outOfStock && (
                            <Chip
                              label="Low"
                              color="warning"
                              size="small"
                                sx={{ fontSize: '0.7rem', height: 22, fontWeight: 600 }}
                            />
                          )}
                          {outOfStock && (
                            <Chip
                              label="Out"
                              color="error"
                              size="small"
                                sx={{ fontSize: '0.7rem', height: 22, fontWeight: 600 }}
                            />
                          )}
                          {!lowStock && !outOfStock && stockPercent >= 100 && (
                            <Chip
                                icon={<CheckCircleIcon sx={{ fontSize: 14 }} />}
                              label="OK"
                              color="success"
                              size="small"
                                sx={{ fontSize: '0.7rem', height: 22, fontWeight: 600 }}
                            />
                          )}
                          </Box>
                        </Box>
                        {/* Stock Level Indicator */}
                        <Box sx={{ mt: 1.5, width: '100%', maxWidth: 280 }}>
                          <LinearProgress
                            variant="determinate"
                            value={Math.min(100, stockPercent)}
                            sx={{
                              height: 8,
                              borderRadius: 4,
                              bgcolor: 'grey.200',
                              '& .MuiLinearProgress-bar': {
                                bgcolor: outOfStock 
                                  ? 'error.main' 
                                  : lowStock 
                                    ? 'warning.main' 
                                    : stockPercent >= 100 
                                      ? 'success.main' 
                                      : 'info.main',
                                borderRadius: 4,
                              },
                            }}
                          />
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem', mt: 0.75, display: 'block', fontWeight: 500 }}>
                            {stockPercent.toFixed(1)}% of minimum
                            {targetPercent !== null && ` • ${targetPercent.toFixed(1)}% of target`}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ minWidth: 220, py: 2 }}>
                      {item.description ? (
                          <Typography 
                            variant="body2" 
                            sx={{ 
                            lineHeight: 1.6,
                              color: 'text.primary',
                            fontSize: '0.875rem',
                            fontWeight: 400,
                            }}
                          >
                            {item.description}
                          </Typography>
                      ) : (
                        <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic', fontSize: '0.8125rem' }}>
                          No description
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="center" sx={{ 
                      bgcolor: outOfStock ? 'error.50' : lowStock ? 'warning.50' : 'primary.50', 
                      py: 3,
                      px: 2,
                      borderLeft: '3px solid',
                      borderLeftColor: outOfStock ? 'error.main' : lowStock ? 'warning.main' : 'primary.main',
                    }}>
                      {editingStock[setting.id] ? (
                        <TextField
                          type="number"
                          size="small"
                          value={editingStock[setting.id].stock}
                          onChange={(e) => {
                            const val = e.target.value;
                            // Allow empty string temporarily for better UX
                            if (val === '' || val === '-') {
                              setEditingStock(prev => ({
                                ...prev,
                                [setting.id]: { ...prev[setting.id], stock: '' }
                              }));
                            } else {
                              // Remove leading zeros by parsing and converting back
                              const numVal = parseInt(val, 10);
                              if (!isNaN(numVal) && numVal >= 0) {
                                setEditingStock(prev => ({
                                  ...prev,
                                  [setting.id]: { ...prev[setting.id], stock: numVal }
                                }));
                              }
                            }
                          }}
                          onBlur={(e) => {
                            // Ensure we have a valid number on blur
                            const val = e.target.value.trim();
                            if (val === '' || val === '-') {
                              setEditingStock(prev => ({
                                ...prev,
                                [setting.id]: { ...prev[setting.id], stock: 0 }
                              }));
                            } else {
                              // Normalize the value (remove leading zeros)
                              const numVal = parseInt(val, 10);
                              if (Number.isFinite(numVal) && numVal >= 0) {
                                setEditingStock(prev => ({
                                  ...prev,
                                  [setting.id]: { ...prev[setting.id], stock: numVal }
                                }));
                              } else {
                                // Invalid number, reset to 0
                                setEditingStock(prev => ({
                                  ...prev,
                                  [setting.id]: { ...prev[setting.id], stock: 0 }
                                }));
                              }
                            }
                          }}
                          inputProps={{ min: 0 }}
                          sx={{ width: 140 }}
                          autoFocus
                        />
                      ) : (
                        <Box>
                          <Tooltip 
                            title={
                              <Box>
                                <Typography variant="caption" display="block" fontWeight={600}>
                                  Stock Allocation
                                </Typography>
                                <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                                  Store Stock: {storeStock.toLocaleString()} units
                                </Typography>
                                <Typography variant="caption" display="block">
                                  Total Inventory: {globalStock.toLocaleString()} units
                                </Typography>
                                {(() => {
                                  const totalStoreStock = settings?.reduce(
                                    (sum, s) => sum + (s.currentStock || 0),
                                    0,
                                  ) || 0;
                                  const availableForAllocation = globalStock - totalStoreStock;
                                  const isInconsistent = totalStoreStock > globalStock;
                                  
                                  if (isInconsistent) {
                                    return (
                                      <Typography variant="caption" display="block" color="error.main" sx={{ mt: 0.5, fontWeight: 600 }}>
                                        ⚠️ Data Inconsistency: Total allocation ({totalStoreStock}) exceeds total inventory ({globalStock})
                                      </Typography>
                                    );
                                  }
                                  
                                  return (
                                    <Typography variant="caption" display="block" color="info.main" sx={{ mt: 0.5 }}>
                                      Available for Allocation: {availableForAllocation.toLocaleString()} units
                                    </Typography>
                                  );
                                })()}
                                <Typography variant="caption" display="block" sx={{ mt: 0.5, pt: 0.5, borderTop: '1px solid rgba(255,255,255,0.2)' }}>
                                  Click number to edit • Click store icon to view all stores
                                </Typography>
                              </Box>
                            }
                            arrow
                          >
                            <Box display="flex" flexDirection="column" alignItems="center" gap={1.5}>
                              <Box display="flex" alignItems="center" gap={1.5}>
                              <IconButton
                                  size="medium"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStockEdit(setting.id, Math.max(0, setting.currentStock - 1), setting.minQty, setting.targetQty);
                                }}
                                  sx={{ 
                                    p: 1,
                                    bgcolor: 'background.paper',
                                    boxShadow: 1,
                                    '&:hover': { 
                                      bgcolor: 'action.hover',
                                      transform: 'scale(1.1)',
                                    },
                                    transition: 'all 0.2s',
                                  }}
                                >
                                  <RemoveCircleIcon sx={{ fontSize: 20 }} />
                              </IconButton>
                              <Box display="flex" alignItems="center" gap={0.5}>
                                <Typography 
                                    variant="h2" 
                                  fontWeight={700}
                                  color={outOfStock ? 'error.main' : lowStock ? 'warning.main' : 'primary.main'}
                                  onClick={() => handleStockEdit(setting.id, setting.currentStock, setting.minQty, setting.targetQty)}
                                  sx={{ 
                                    cursor: 'pointer', 
                                      minWidth: 120, 
                                    textAlign: 'center',
                                      fontSize: '3rem',
                                      fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
                                      letterSpacing: '-0.03em',
                                      lineHeight: 1,
                                      '&:hover': { 
                                        transform: 'scale(1.08)',
                                        transition: 'transform 0.2s',
                                        opacity: 0.9,
                                      },
                                      transition: 'all 0.2s',
                                  }}
                                >
                                  {storeStock.toLocaleString()}
                                </Typography>
                                <Tooltip title="View this item in all stores" arrow>
                                  <IconButton
                                    size="small"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedItemForStores(item);
                                      setStoresDialogOpen(true);
                                    }}
                                    sx={{
                                      p: 0.5,
                                      bgcolor: 'background.paper',
                                      boxShadow: 1,
                                      '&:hover': {
                                        bgcolor: 'primary.light',
                                        color: 'primary.contrastText',
                                        transform: 'scale(1.1)',
                                      },
                                      transition: 'all 0.2s',
                                    }}
                                  >
                                    <StoreIcon sx={{ fontSize: 16 }} />
                                  </IconButton>
                                </Tooltip>
                              </Box>
                              <IconButton
                                  size="medium"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStockEdit(setting.id, setting.currentStock + 1, setting.minQty, setting.targetQty);
                                }}
                                  sx={{ 
                                    p: 1,
                                    bgcolor: 'background.paper',
                                    boxShadow: 1,
                                    '&:hover': { 
                                      bgcolor: 'action.hover',
                                      transform: 'scale(1.1)',
                                    },
                                    transition: 'all 0.2s',
                                  }}
                                >
                                  <AddCircleIcon sx={{ fontSize: 20 }} />
                              </IconButton>
                            </Box>
                              <Typography 
                                variant="body2" 
                                color="text.secondary" 
                                sx={{ 
                                  fontSize: '0.8125rem',
                                  fontWeight: 600,
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.8px',
                                  mt: 0.5,
                                }}
                              >
                            {item.unit}
                          </Typography>
                            </Box>
                          </Tooltip>
                        </Box>
                      )}
                    </TableCell>
                    <TableCell align="right" sx={{ py: 2 }}>
                      {editingStock[setting.id] ? (
                        <TextField
                          type="number"
                          size="small"
                          value={editingStock[setting.id].minQty}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === '' || val === '-') {
                              setEditingStock(prev => ({
                                ...prev,
                                [setting.id]: { ...prev[setting.id], minQty: '' }
                              }));
                            } else {
                              const numVal = parseInt(val, 10);
                              if (!isNaN(numVal) && numVal >= 0) {
                                setEditingStock(prev => ({
                                  ...prev,
                                  [setting.id]: { ...prev[setting.id], minQty: numVal }
                                }));
                              }
                            }
                          }}
                          onBlur={(e) => {
                            const val = e.target.value;
                            if (val === '' || val === '-' || isNaN(parseInt(val, 10))) {
                              setEditingStock(prev => ({
                                ...prev,
                                [setting.id]: { ...prev[setting.id], minQty: 0 }
                              }));
                            } else {
                              const numVal = parseInt(val, 10);
                              setEditingStock(prev => ({
                                ...prev,
                                [setting.id]: { ...prev[setting.id], minQty: numVal }
                              }));
                            }
                          }}
                          inputProps={{ min: 0 }}
                          sx={{ width: 100 }}
                        />
                      ) : (
                        <Box>
                          <Typography variant="h6" fontWeight={700} sx={{ fontSize: '1.25rem' }}>
                            {setting.minQty.toLocaleString()}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem', fontWeight: 500, mt: 0.25, display: 'block' }}>
                            {item.unit}
                          </Typography>
                        </Box>
                      )}
                    </TableCell>
                    <TableCell align="right" sx={{ px: 2.5, py: 1.5 }} onClick={(e) => e.stopPropagation()}>
                      <Box display="flex" gap={0.5} justifyContent="flex-end">
                        {editingStock[setting.id] ? (
                          <>
                            <Tooltip title="Save">
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={() => handleStockSave(setting)}
                                disabled={updateSettings.isPending}
                              >
                                {updateSettings.isPending ? (
                                  <CircularProgress size={16} />
                                ) : (
                                  <SaveIcon fontSize="small" />
                                )}
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Cancel">
                              <IconButton
                                size="small"
                                onClick={() => {
                                  setEditingStock(prev => {
                                    const newState = { ...prev };
                                    delete newState[setting.id];
                                    return newState;
                                  });
                                }}
                              >
                                <CancelIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </>
                        ) : (
                          <>
                            <Tooltip title="View Details">
                              <IconButton
                                size="small"
                                onClick={() => navigate(`/inventory/${item.id}`)}
                                sx={{ 
                                  '&:hover': { 
                                    bgcolor: 'primary.light',
                                    color: 'primary.contrastText',
                                  },
                                }}
                              >
                                <VisibilityIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Edit Item">
                              <IconButton
                                size="small"
                                onClick={() => navigate(`/inventory/${item.id}/edit`)}
                                sx={{ 
                                  '&:hover': { 
                                    bgcolor: 'action.hover',
                                  },
                                }}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                  <Box display="flex" flexDirection="column" alignItems="center" gap={2.5}>
                    <Box sx={{
                      p: 3,
                      borderRadius: '50%',
                      bgcolor: searchTerm || statusFilter !== 'all' ? 'warning.50' : 'primary.50',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mb: 1,
                    }}>
                      <InventoryIcon sx={{ 
                        fontSize: 64, 
                        color: searchTerm || statusFilter !== 'all' ? 'warning.main' : 'primary.main',
                        opacity: 0.8,
                      }} />
                    </Box>
                    <Typography variant="h5" fontWeight={700} sx={{ 
                      color: 'text.primary',
                      fontSize: { xs: '1.25rem', sm: '1.5rem' },
                    }}>
                      {searchTerm || statusFilter !== 'all' || categoryFilter !== 'all' || lowStockFilter || outOfStockFilter
                        ? 'No items match your filters'
                        : 'No inventory items in this store'}
                    </Typography>
                    <Typography variant="body1" color="text.secondary" sx={{ 
                      maxWidth: 400,
                      textAlign: 'center',
                      fontSize: '0.9375rem',
                    }}>
                      {searchTerm || statusFilter !== 'all' || categoryFilter !== 'all' || lowStockFilter || outOfStockFilter
                        ? 'Try adjusting your search or filter criteria to see more results'
                        : availableItemsToAdd.length > 0
                          ? `Get started by adding items to track inventory levels. You have ${availableItemsToAdd.length} ${availableItemsToAdd.length === 1 ? 'item' : 'items'} available to add.`
                          : 'No items available to add. Create inventory items first to track them in this store.'}
                    </Typography>
                    {!searchTerm && statusFilter === 'all' && categoryFilter === 'all' && !lowStockFilter && !outOfStockFilter && availableItemsToAdd.length > 0 && (
                      <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={() => setAddItemDialogOpen(true)}
                        sx={{ 
                          mt: 1,
                          borderRadius: 2.5,
                          px: 3,
                          py: 1.25,
                          textTransform: 'none',
                          fontWeight: 600,
                          boxShadow: 3,
                          background: 'linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)',
                          '&:hover': {
                            boxShadow: 6,
                            transform: 'translateY(-2px)',
                            background: 'linear-gradient(135deg, #1565c0 0%, #1976d2 100%)',
                          },
                          transition: 'all 0.2s ease-in-out',
                        }}
                      >
                        Add Items to Store
                      </Button>
                    )}
                    {(searchTerm || statusFilter !== 'all' || categoryFilter !== 'all' || lowStockFilter || outOfStockFilter) && (
                      <Button
                        variant="outlined"
                        onClick={() => {
                          setSearchTerm('');
                          setSearchInput('');
                          setStatusFilter('all');
                          setCategoryFilter('all');
                          setLowStockFilter(false);
                          setOutOfStockFilter(false);
                        }}
                        sx={{ 
                          mt: 1,
                          borderRadius: 2.5,
                          px: 3,
                          py: 1,
                          textTransform: 'none',
                          fontWeight: 600,
                        }}
                      >
                        Clear All Filters
                      </Button>
                    )}
                  </Box>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Add Item Dialog */}
      <Dialog 
        open={addItemDialogOpen} 
        onClose={() => {
          if (!updateSettings.isPending) {
            setAddItemDialogOpen(false);
            setSelectedItemToAdd(null);
            setNewItemStock(1);
            setNewItemMinQty(0);
          }
        }} 
        maxWidth="md" 
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            boxShadow: 8,
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
          },
        }}
      >
        <DialogTitle sx={{ pb: 2, px: 3, pt: 3 }}>
          <Box display="flex" alignItems="center" gap={1.5}>
            <Box sx={{ 
              p: 1, 
              borderRadius: 2, 
              bgcolor: 'primary.main', 
              color: 'primary.contrastText',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <AddIcon sx={{ fontSize: 28 }} />
            </Box>
            <Box flex={1} minWidth={0}>
              <Typography variant="h5" component="div" sx={{ fontWeight: 700, fontSize: '1.5rem', lineHeight: 1.2 }}>
                Add Item to Store
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, lineHeight: 1.4 }}>
                Link an inventory item to this store and set initial stock levels
              </Typography>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ 
          px: 3, 
          py: 2, 
          '&.MuiDialogContent-root': { pt: 2 },
          overflowY: 'auto',
          flex: 1,
          minHeight: 0,
        }}>
          <Box display="flex" flexDirection="column" gap={3} sx={{ width: '100%' }}>
            {/* Item Selection Section */}
            <Box>
              <Box display="flex" alignItems="center" gap={1.5} mb={2}>
                <InventoryIcon sx={{ fontSize: 24, color: 'primary.main', flexShrink: 0 }} />
                <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                  Select Inventory Item
                </Typography>
              </Box>
              <Autocomplete
              options={availableItemsToAdd}
              getOptionLabel={(option) => `${option.name} (${option.sku})`}
              value={selectedItemToAdd}
              onChange={(_, newValue) => setSelectedItemToAdd(newValue)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Search by name or SKU"
                    placeholder="Type to search for an item..."
                    fullWidth
                    InputProps={{
                      ...params.InputProps,
                      startAdornment: (
                        <>
                          <InputAdornment position="start">
                            <SearchIcon sx={{ color: 'text.secondary' }} />
                          </InputAdornment>
                          {params.InputProps.startAdornment}
                        </>
                      ),
                    }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2,
                        bgcolor: 'background.paper',
                      },
                    }}
                  />
                )}
                renderOption={(props, option) => (
                  <Box component="li" {...props} key={option.id}>
                    <Box display="flex" alignItems="center" gap={2} width="100%">
                      <Box sx={{ 
                        p: 1, 
                        borderRadius: 1.5, 
                        bgcolor: 'primary.50',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        <InventoryIcon sx={{ fontSize: 20, color: 'primary.main' }} />
                      </Box>
                      <Box flex={1}>
                        <Typography variant="body1" sx={{ fontWeight: 600 }}>
                          {option.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace', display: 'block', mt: 0.25 }}>
                          SKU: {option.sku}
                        </Typography>
                      </Box>
                      {option.defaultUnitPrice && (
                        <Typography variant="body2" sx={{ fontWeight: 600, color: 'primary.main' }}>
                          {formatCurrency(option.defaultUnitPrice)}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                )}
                sx={{ 
                  width: '100%',
                  '& .MuiAutocomplete-popper': {
                    borderRadius: 2,
                  },
                }}
                noOptionsText={
                  <Box sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="body2" color="text.secondary">
                      No items available to add
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                      All inventory items are already linked to this store
                    </Typography>
                  </Box>
                }
              />
              {availableItemsToAdd.length === 0 && (
                <Alert severity="info" sx={{ borderRadius: 2, mt: 2, width: '100%' }}>
                  All inventory items are already linked to this store. No items available to add.
                </Alert>
              )}
            </Box>

            {/* Selected Item Details */}
            {selectedItemToAdd && (
              <>
                <Divider sx={{ my: 0 }} />
                <Card 
                  variant="outlined" 
                  sx={{ 
                    bgcolor: 'primary.50', 
                    borderColor: 'primary.main',
                    borderWidth: 2,
                    width: '100%',
                    boxShadow: '0 2px 8px rgba(25, 118, 210, 0.1)',
                  }}
                >
                  <CardContent sx={{ p: 3 }}>
                    <Box display="flex" alignItems="center" gap={1.5} mb={3}>
                      <CheckCircleIcon sx={{ fontSize: 22, color: 'success.main', flexShrink: 0 }} />
                      <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'primary.main', lineHeight: 1.2 }}>
                        Selected Item Details
                      </Typography>
                    </Box>
                    <Grid container spacing={4} sx={{ width: '100%', margin: 0 }}>
                      <Grid size={{ xs: 12, sm: 4 }}>
                        <Box sx={{ pr: { sm: 2 } }}>
                          <Typography 
                            variant="caption" 
                            color="text.secondary" 
                            sx={{ 
                              fontSize: '0.75rem', 
                              fontWeight: 600, 
                              textTransform: 'uppercase', 
                              letterSpacing: '0.5px',
                              display: 'block',
                              mb: 1.5,
                            }}
                          >
                            Item Name
                          </Typography>
                          <Typography 
                            variant="body1" 
                            sx={{ 
                              fontWeight: 600, 
                              fontSize: '1rem',
                              lineHeight: 1.5,
                              wordBreak: 'break-word',
                            }}
                          >
                            {selectedItemToAdd.name}
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid size={{ xs: 12, sm: 4 }}>
                        <Box sx={{ px: { sm: 2 } }}>
                          <Typography 
                            variant="caption" 
                            color="text.secondary" 
                            sx={{ 
                              fontSize: '0.75rem', 
                              fontWeight: 600, 
                              textTransform: 'uppercase', 
                              letterSpacing: '0.5px',
                              display: 'block',
                              mb: 1.5,
                            }}
                          >
                            SKU
                          </Typography>
                          <Typography 
                            variant="body1" 
                            sx={{ 
                              fontFamily: 'monospace', 
                              fontSize: '1rem',
                              lineHeight: 1.5,
                              fontWeight: 500,
                            }}
                          >
                            {selectedItemToAdd.sku}
                          </Typography>
                        </Box>
                      </Grid>
                      {selectedItemToAdd.defaultUnitPrice && (
                        <Grid size={{ xs: 12, sm: 4 }}>
                          <Box sx={{ pl: { sm: 2 } }}>
                            <Typography 
                              variant="caption" 
                              color="text.secondary" 
                              sx={{ 
                                fontSize: '0.75rem', 
                                fontWeight: 600, 
                                textTransform: 'uppercase', 
                                letterSpacing: '0.5px',
                                display: 'block',
                                mb: 1.5,
                              }}
                            >
                              Unit Price
                            </Typography>
                            <Typography 
                              variant="body1" 
                              sx={{ 
                                fontWeight: 600, 
                                color: 'primary.main', 
                                fontSize: '1rem',
                                lineHeight: 1.5,
                              }}
                            >
                              {formatCurrency(selectedItemToAdd.defaultUnitPrice)}
                            </Typography>
                          </Box>
                        </Grid>
                      )}
                    </Grid>
                  </CardContent>
                </Card>

                <Divider sx={{ my: 0 }} />

                {/* Stock Configuration */}
                <Box sx={{ width: '100%' }}>
                  <Box display="flex" alignItems="center" gap={1.5} mb={2.5} flexWrap="wrap">
                    <WarehouseIcon sx={{ fontSize: 24, color: 'primary.main', flexShrink: 0 }} />
                    <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2, flex: 1, minWidth: 0 }}>
                      Stock Configuration
                    </Typography>
                    <Chip 
                      label="Required" 
                      color="error" 
                      size="small"
                      sx={{ fontSize: '0.7rem', height: 20, flexShrink: 0 }}
                    />
                  </Box>
                  <Grid container spacing={3.5} sx={{ width: '100%', margin: 0 }}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Box sx={{ pr: { sm: 1.5 } }}>
                        <TextField
                          fullWidth
                          label="Initial Stock"
                          type="number"
                          value={newItemStock}
                        onChange={(e) => {
                          const val = e.target.value.trim();
                          if (val === '' || val === '-') {
                            setNewItemStock('');
                          } else {
                            const numVal = parseInt(val, 10);
                            if (!isNaN(numVal) && numVal >= 0) {
                              setNewItemStock(numVal);
                            } else if (val === '') {
                              setNewItemStock('');
                            }
                          }
                        }}
                        onBlur={(e) => {
                          const val = e.target.value.trim();
                          if (val === '' || val === '-' || isNaN(parseInt(val, 10)) || parseInt(val, 10) < 0) {
                            setNewItemStock(1);
                          } else {
                            const numVal = parseInt(val, 10);
                            setNewItemStock(Math.max(0, numVal));
                          }
                        }}
                        inputProps={{ min: 0 }}
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <InventoryIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
                            </InputAdornment>
                          ),
                          endAdornment: (
                            <InputAdornment position="end">
                              <IconButton
                                size="small"
                                onClick={() => {
                                  const current = typeof newItemStock === 'number' ? newItemStock : parseInt(String(newItemStock)) || 1;
                                  setNewItemStock(Math.max(0, current - 1));
                                }}
                                disabled={(typeof newItemStock === 'number' ? newItemStock : parseInt(String(newItemStock)) || 1) <= 0}
                              >
                                <RemoveCircleIcon />
                              </IconButton>
                              <IconButton
                                size="small"
                                onClick={() => {
                                  const current = typeof newItemStock === 'number' ? newItemStock : parseInt(String(newItemStock)) || 1;
                                  setNewItemStock(current + 1);
                                }}
                              >
                                <AddIcon />
                              </IconButton>
                            </InputAdornment>
                          ),
                        }}
                        helperText="Starting stock quantity for this item at this store"
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            borderRadius: 2,
                            fontSize: '1.125rem',
                            fontWeight: 600,
                          },
                        }}
                        />
                      </Box>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Box sx={{ pl: { sm: 1.5 } }}>
                        <TextField
                          fullWidth
                          label="Minimum Quantity (Reorder Level)"
                          type="number"
                          value={newItemMinQty}
                        onChange={(e) => {
                          const val = e.target.value.trim();
                          if (val === '' || val === '-') {
                            setNewItemMinQty('');
                          } else {
                            const numVal = parseInt(val, 10);
                            if (!isNaN(numVal) && numVal >= 0) {
                              setNewItemMinQty(numVal);
                            } else if (val === '') {
                              setNewItemMinQty('');
                            }
                          }
                        }}
                        onBlur={(e) => {
                          const val = e.target.value.trim();
                          if (val === '' || val === '-' || isNaN(parseInt(val, 10)) || parseInt(val, 10) < 0) {
                            setNewItemMinQty(0);
                          } else {
                            const numVal = parseInt(val, 10);
                            setNewItemMinQty(Math.max(0, numVal));
                          }
                        }}
                        inputProps={{ min: 0 }}
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <WarningAmberIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
                            </InputAdornment>
                          ),
                          endAdornment: (
                            <InputAdornment position="end">
                              <IconButton
                                size="small"
                                onClick={() => {
                                  const current = typeof newItemMinQty === 'number' ? newItemMinQty : parseInt(String(newItemMinQty)) || 0;
                                  setNewItemMinQty(Math.max(0, current - 1));
                                }}
                                disabled={(typeof newItemMinQty === 'number' ? newItemMinQty : parseInt(String(newItemMinQty)) || 0) <= 0}
                              >
                                <RemoveCircleIcon />
                              </IconButton>
                              <IconButton
                                size="small"
                                onClick={() => {
                                  const current = typeof newItemMinQty === 'number' ? newItemMinQty : parseInt(String(newItemMinQty)) || 0;
                                  setNewItemMinQty(current + 1);
                                }}
                              >
                                <AddIcon />
                              </IconButton>
                            </InputAdornment>
                          ),
                        }}
                        helperText="Alert when stock falls below this level"
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            borderRadius: 2,
                            fontSize: '1.125rem',
                            fontWeight: 600,
                          },
                        }}
                        />
                      </Box>
                    </Grid>
                  </Grid>
                  {(() => {
                    const stock = typeof newItemStock === 'number' ? newItemStock : parseInt(String(newItemStock)) || 1;
                    const minQty = typeof newItemMinQty === 'number' ? newItemMinQty : parseInt(String(newItemMinQty)) || 0;
                    return stock < minQty && minQty > 0 && (
                      <Alert severity="warning" sx={{ mt: 2.5, borderRadius: 2, width: '100%' }}>
                        Initial stock ({stock}) is below the minimum quantity ({minQty}). This item will be flagged as low stock immediately.
                      </Alert>
                    );
                  })()}
                </Box>
              </>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2.5, borderTop: '1px solid', borderColor: 'divider', gap: 1.5 }}>
          <Button 
            onClick={() => {
            setAddItemDialogOpen(false);
            setSelectedItemToAdd(null);
              setNewItemStock(1);
            setNewItemMinQty(0);
            }}
            disabled={updateSettings.isPending}
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
            onClick={handleAddItem} 
            variant="contained"
            disabled={
              !selectedItemToAdd || 
              !storeId ||
              updateSettings.isPending || 
              (typeof newItemStock === 'string' && (newItemStock === '' || newItemStock === '-')) ||
              (typeof newItemStock === 'number' && isNaN(newItemStock))
            }
            startIcon={updateSettings.isPending ? <CircularProgress size={20} color="inherit" /> : <AddIcon />}
            sx={{ 
              minWidth: 150,
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 600,
              px: 3,
              py: 1.25,
              background: 'linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #1565c0 0%, #1976d2 100%)',
              },
              '&:disabled': {
                background: 'grey.300',
              },
            }}
          >
            {updateSettings.isPending ? 'Adding...' : 'Add Item to Store'}
          </Button>
        </DialogActions>
      </Dialog>

      <ItemStoresDialog
        open={storesDialogOpen}
        onClose={() => {
          setStoresDialogOpen(false);
          setSelectedItemForStores(null);
        }}
        item={selectedItemForStores}
      />
    </Box>
  );
};

export default StoreInventory;

