import { useState, useMemo, useCallback, useEffect } from 'react';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import ExportProgressDialog from '../../components/common/ExportProgressDialog';
import { BulkActionsBar } from '../../components/common/BulkActionsBar';
import { ImportDialog } from '../../components/import/ImportDialog';
import { ImportPreview } from '../../components/import/ImportPreview';
import { useNavigate } from 'react-router-dom';
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
  TableSortLabel,
  InputAdornment,
  Checkbox,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import DownloadIcon from '@mui/icons-material/Download';
import VisibilityIcon from '@mui/icons-material/Visibility';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import InventoryIcon from '@mui/icons-material/Inventory';
import CategoryIcon from '@mui/icons-material/Category';
import NumbersIcon from '@mui/icons-material/Numbers';
import WarehouseIcon from '@mui/icons-material/Warehouse';
import StoreIcon from '@mui/icons-material/Store';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import LabelIcon from '@mui/icons-material/Label';
import RemoveShoppingCartIcon from '@mui/icons-material/RemoveShoppingCart';
import { useInventory, useDeleteInventoryItem, useBulkDeleteInventoryItems } from '../../hooks/useInventory';
import { useToast } from '../../contexts/ToastContext';
import { useUndo } from '../../hooks/useUndo';
import { getErrorMessage } from '../../utils/errorHandling';
import { exportToCSV } from '../../utils/export';
import { formatCurrency } from '../../utils/formatters';
import { alpha, useTheme } from '@mui/material';
import BulkAddInventoryDialog from '../../components/inventory/BulkAddInventoryDialog';
import { ItemStoresDialog } from '../../components/inventory/ItemStoresDialog';
import Grid from '../../components/common/Grid';
import { useQueryClient } from '@tanstack/react-query';
import { useDebounce } from '../../utils/useDebounce';
import { inventoryApi, type CreateInventoryItemDto } from '../../api/inventory';
import type { InventoryItem } from '../../types/inventory';
import type { ImportResult } from '../../utils/import';
import { logger } from '../../utils/logger';
import { EmptyState } from '../../components/common/EmptyState';
import { useTableColumns } from '../../hooks/useTableColumns';

const InventoryList = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(() => {
    return localStorage.getItem('inventory_statusFilter') || 'all';
  });
  const [lowStockOnly, setLowStockOnly] = useState(() => {
    return localStorage.getItem('inventory_lowStockOnly') === 'true';
  });
  const [inStoresOnly, setInStoresOnly] = useState(() => {
    return localStorage.getItem('inventory_inStoresOnly') === 'true';
  });
  const [sortField, setSortField] = useState<string>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [bulkAddDialogOpen, setBulkAddDialogOpen] = useState(false);
  const [exportProgress, setExportProgress] = useState({ open: false, current: 0, total: 0 });
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importPreviewOpen, setImportPreviewOpen] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult<Partial<InventoryItem>> | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [storesDialogOpen, setStoresDialogOpen] = useState(false);
  const [selectedItemForStores, setSelectedItemForStores] = useState<InventoryItem | null>(null);
  
  // Column visibility management
  const defaultColumns = ['checkbox', 'sku', 'name', 'attributes', 'stock', 'storeStock', 'actions'];
  const {
    preferences,
    toggleColumnVisibility,
    resetPreferences,
  } = useTableColumns('inventory-list', defaultColumns);
  
  const columnControls = useMemo(() => [
    { id: 'sku', label: 'SKU', visible: preferences.sku?.visible !== false },
    { id: 'name', label: 'Name', visible: preferences.name?.visible !== false },
    { id: 'attributes', label: 'Description', visible: preferences.attributes?.visible !== false },
    { id: 'stock', label: 'Total Inventory', visible: preferences.stock?.visible !== false },
    { id: 'storeStock', label: 'Store Stock', visible: preferences.storeStock?.visible !== false },
  ], [preferences]);
  const queryClient = useQueryClient();
  
  // Debounced search for real-time filtering
  const debouncedSearchInput = useDebounce(searchInput, 300);
  
  // Update search term when debounced input changes
  useEffect(() => {
    setSearchTerm(debouncedSearchInput.trim());
  }, [debouncedSearchInput]);
  
  // Clear cache and invalidate queries on mount to ensure fresh data
  useEffect(() => {
    // Invalidate all inventory-related queries to force fresh fetch
    queryClient.invalidateQueries({ queryKey: ['inventory'], exact: false });
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
  
  // Persist filters to localStorage
  useEffect(() => {
    localStorage.setItem('inventory_statusFilter', statusFilter);
  }, [statusFilter]);
  
  useEffect(() => {
    localStorage.setItem('inventory_lowStockOnly', lowStockOnly.toString());
  }, [lowStockOnly]);
  
  useEffect(() => {
    localStorage.setItem('inventory_inStoresOnly', inStoresOnly.toString());
  }, [inStoresOnly]);
  
  
  // Memoize filters
  const filters = useMemo(() => {
    const filterObj: {
      search?: string;
      status?: string;
      lowStockOnly?: boolean;
    } = {};
    
    if (searchTerm && searchTerm.trim()) {
      filterObj.search = searchTerm.trim();
    }
    
    if (statusFilter === 'active' || statusFilter === 'inactive') {
      filterObj.status = statusFilter;
    }
    
    if (lowStockOnly) {
      filterObj.lowStockOnly = true;
    }
    
    return filterObj;
  }, [searchTerm, statusFilter, lowStockOnly]);
  
  const { data: items, isLoading, isRefetching, error, isError, refetch } = useInventory(filters);
  const deleteItem = useDeleteInventoryItem();
  const bulkDeleteItems = useBulkDeleteInventoryItems();
  const { showToast } = useToast();
  const { createDeleteUndo } = useUndo();


  // Filter and sort items
  const filteredItems = useMemo(() => {
    if (!items) return [];
    
    let filtered = [...items];
    
    // Store filter
    if (inStoresOnly) {
      filtered = filtered.filter(item => item.storeAggregation && item.storeAggregation.storeCount > 0);
    }
    
    
    // Sorting
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case 'name':
          comparison = (a.name || '').localeCompare(b.name || '');
          break;
        case 'sku':
          comparison = (a.sku || '').localeCompare(b.sku || '');
          break;
        case 'stock':
          comparison = a.currentStock - b.currentStock;
          break;
        case 'available':
          comparison = a.currentStock - b.currentStock;
          break;
        case 'storeStock':
          comparison = (a.storeAggregation?.totalStoreStock || 0) - (b.storeAggregation?.totalStoreStock || 0);
          break;
        default:
          comparison = 0;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    
    return filtered;
  }, [items, inStoresOnly, sortField, sortOrder]);
  
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Calculate store statistics
  const storeStats = useMemo(() => {
    if (!items) return { 
      totalItemsInStores: 0, 
      totalStoreStock: 0, 
      storesWithLowStock: 0,
      lowStockCount: 0,
      outOfStockCount: 0,
      totalValue: 0,
    };
    const itemsInStores = items.filter(item => item.storeAggregation && item.storeAggregation.storeCount > 0);
    const lowStockItems = items.filter(item => {
      // Item is low stock if:
      // 1. Warehouse stock is 0 (needs warehouse restocking), OR
      // 2. Total stock (warehouse + stores) is above 0 but at or below reorder level
      const warehouseStock = item.currentStock || 0;
      const storeStock = item.storeAggregation?.totalStoreStock || 0;
      const totalStock = warehouseStock + storeStock;
      
      // Flag as low stock if warehouse is empty (needs restocking) OR total stock is at/below reorder level
      if (warehouseStock <= 0 && totalStock > 0) {
        // Warehouse is empty but stores have stock - needs warehouse restocking
        return true;
      }
      // Or if total stock is at or below reorder level
      return totalStock > 0 && totalStock <= item.reorderLevel;
    });
    const outOfStockItems = items.filter(item => {
      // Item is out of stock if both warehouse and store stock are 0 or less
      const warehouseStock = item.currentStock || 0;
      const storeStock = item.storeAggregation?.totalStoreStock || 0;
      return warehouseStock <= 0 && storeStock <= 0;
    });
    const totalValue = items.reduce((sum, item) => {
      // Include both warehouse stock and store stock for accurate inventory value
      const warehouseStock = item.currentStock || 0;
      const storeStock = item.storeAggregation?.totalStoreStock || 0;
      const totalStock = warehouseStock + storeStock;
      // Use costPrice only (what you paid for inventory), not selling price
      // If costPrice is not set, use 0 to avoid inflating inventory value
      const stockValue = totalStock * (item.costPrice || 0);
      return sum + stockValue;
    }, 0);
    
    return {
      totalItemsInStores: itemsInStores.length,
      totalStoreStock: items.reduce((sum, item) => sum + (item.storeAggregation?.totalStoreStock || 0), 0),
      storesWithLowStock: items.reduce((sum, item) => sum + (item.storeAggregation?.storesWithLowStock || 0), 0),
      lowStockCount: lowStockItems.length,
      outOfStockCount: outOfStockItems.length,
      totalValue,
    };
  }, [items]);

  // Show error toast if query fails
  useEffect(() => {
    if (isError && error) {
      // Fix Issue #2: Use proper error handling utility instead of 'as any'
      const errorMessage = getErrorMessage(error, 'Failed to load inventory items', {
        operation: 'load',
        resource: 'inventory items',
      });
      showToast(errorMessage, 'error');
    }
  }, [isError, error, showToast]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + K: Focus search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        const searchInput = document.querySelector('input[placeholder*="Search inventory"]') as HTMLInputElement;
        searchInput?.focus();
      }
      // Ctrl/Cmd + N: New item
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        navigate('/inventory/create');
      }
      // Escape: Clear search
      if (e.key === 'Escape' && (searchInput || searchTerm)) {
        setSearchInput('');
        setSearchTerm('');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate, searchTerm]);

  const handleDeleteClick = useCallback((id: string) => {
    setItemToDelete(id);
    setDeleteConfirmOpen(true);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!itemToDelete) return;
    
    // Get inventory item data before deletion for undo
    let itemData = queryClient.getQueryData<InventoryItem>(['inventory', itemToDelete]);
    
    // If not in cache, try to find it in the current list
    if (!itemData && items) {
      itemData = items.find(item => item.id === itemToDelete);
    }
    
    // If still not found, fetch it
    if (!itemData) {
      try {
        itemData = await inventoryApi.getById(itemToDelete);
      } catch (error) {
        logger.warn('Could not fetch inventory item for undo:', error);
      }
    }
    
    try {
      await deleteItem.mutateAsync(itemToDelete);
      
      // Create undo operation if we have item data
      if (itemData) {
        createDeleteUndo(
          'inventory',
          `Item ${itemData.name}`,
          itemData,
          async (item: InventoryItem) => {
            try {
              const restoreData: CreateInventoryItemDto = {
                sku: item.sku,
                name: item.name,
                description: item.description,
                unit: item.unit,
                defaultUnitPrice: item.unitPrice || 0,
                currentStock: item.stock || 0,
                reorderLevel: item.reorderLevel || 0,
                status: item.status || 'active',
                bundleSize: item.bundleSize,
                bundleUnit: item.bundleUnit,
                spacePerBundle: item.spacePerBundle,
                bundlesPerContainer: item.bundlesPerContainer,
                targetBundles: item.targetBundles,
                packSize: item.packSize,
                unitsPerContainer: item.unitsPerContainer,
                weeksSupplyTargetOverride: item.weeksSupplyTargetOverride,
                averageWeeklyUsage: item.averageWeeklyUsage,
              };
              
              await inventoryApi.create(restoreData);
              queryClient.invalidateQueries({ queryKey: ['inventory'], exact: false });
              showToast(`Item ${item.name} restored`, 'success');
            } catch (error) {
              showToast(getErrorMessage(error, 'Failed to restore item'), 'error');
              throw error;
            }
          },
        );
      } else {
        showToast('Inventory item deleted successfully', 'success');
      }
      
      setDeleteConfirmOpen(false);
      setItemToDelete(null);
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error, 'Failed to delete item', {
        operation: 'delete',
        resource: 'inventory item',
      });
      showToast(errorMessage, 'error');
    }
  }, [itemToDelete, deleteItem, showToast, createDeleteUndo, queryClient, items]);

  const handleDeleteCancel = useCallback(() => {
    setDeleteConfirmOpen(false);
    setItemToDelete(null);
  }, []);

  // Bulk selection handlers
  const handleSelectItem = useCallback((itemId: string) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (!filteredItems || filteredItems.length === 0) return;
    
    const allSelected = filteredItems.every(item => selectedItems.has(item.id));
    if (allSelected) {
      // Deselect all
      setSelectedItems(new Set());
    } else {
      // Select all filtered items
      setSelectedItems(new Set(filteredItems.map(item => item.id)));
    }
  }, [filteredItems, selectedItems]);

  const handleClearSelection = useCallback(() => {
    setSelectedItems(new Set());
  }, []);

  const handleBulkDelete = useCallback(() => {
    setBulkDeleteConfirmOpen(true);
  }, []);

  const handleBulkDeleteConfirm = useCallback(async () => {
    if (selectedItems.size === 0) return;
    
    try {
      const ids = Array.from(selectedItems);
      const result = await bulkDeleteItems.mutateAsync(ids);
      
      if (result.failed.length > 0) {
        showToast(
          `Deleted ${result.deleted} item(s). ${result.failed.length} failed: ${result.failed.map(f => f.reason).join(', ')}`,
          'warning'
        );
      } else {
        showToast(`Successfully deleted ${result.deleted} item(s)`, 'success');
      }
      
      setSelectedItems(new Set());
      setBulkDeleteConfirmOpen(false);
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error, 'Failed to delete items', {
        operation: 'bulk delete',
        resource: 'inventory items',
      });
      showToast(errorMessage, 'error');
    }
  }, [selectedItems, bulkDeleteItems, showToast]);

  const handleBulkDeleteCancel = useCallback(() => {
    setBulkDeleteConfirmOpen(false);
  }, []);

  // Update selected items when filtered items change
  useEffect(() => {
    if (!filteredItems) return;
    const filteredIds = new Set(filteredItems.map(i => i.id));
    setSelectedItems(prev => {
      const next = new Set(prev);
      let changed = false;
      prev.forEach(id => {
        if (!filteredIds.has(id)) {
          next.delete(id);
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [filteredItems]);

  // Import handlers
  const handleImportFileSelect = useCallback((data: any[], file: File) => {
    setImportFile(file);
    
    // Transform data to inventory item format
    const transformed = data.map(row => {
      const mapped: Partial<InventoryItem> = {
        sku: row.sku || row.SKU || row['Stock Keeping Unit'] || '',
        name: row.name || row.Name || row['Product Name'] || '',
        description: row.description || row.Description || '',
        unit: row.unit || row.Unit || 'pcs',
        barcode: row.barcode || row.Barcode || undefined,
        costPrice: row.costPrice || row['Cost Price'] ? parseFloat(row.costPrice || row['Cost Price']) : undefined,
        defaultUnitPrice: parseFloat(row.defaultUnitPrice || row['Unit Price'] || row.price || row.Price || '0'),
        defaultTaxRate: row.defaultTaxRate || row['Tax Rate'] ? parseFloat(row.defaultTaxRate || row['Tax Rate']) : undefined,
        currentStock: parseInt(row.currentStock || row['Current Stock'] || row.stock || row.Stock || '0', 10),
        reorderLevel: parseInt(row.reorderLevel || row['Reorder Level'] || '0', 10),
        maxStockLevel: row.maxStockLevel || row['Max Stock Level'] ? parseInt(row.maxStockLevel || row['Max Stock Level'], 10) : undefined,
        status: (row.status || row.Status || 'active').toLowerCase() === 'inactive' ? 'inactive' : 'active',
      };
      return mapped;
    });

    // Validate
    const valid: Partial<InventoryItem>[] = [];
    const invalid: Array<{ row: number; data: any; errors: string[] }> = [];
    
    transformed.forEach((row, index) => {
      const errors: string[] = [];
      if (!row.sku || row.sku.trim() === '') {
        errors.push('SKU is required');
      }
      if (!row.name || row.name.trim() === '') {
        errors.push('Name is required');
      }
      if (isNaN(row.defaultUnitPrice || 0) || (row.defaultUnitPrice || 0) < 0) {
        errors.push('Valid unit price is required');
      }
      if (errors.length > 0) {
        invalid.push({ row: index + 2, data: row, errors });
      } else {
        valid.push(row);
      }
    });

    setImportResult({ valid, invalid });
    setImportPreviewOpen(true);
  }, []);

  const handleImportConfirm = useCallback(async (data: Partial<InventoryItem>[]) => {
    if (!importFile) return;
    
    setIsImporting(true);
    try {
      const result = await inventoryApi.import(importFile);
      
      if (result.failed.length > 0) {
        showToast(
          `Imported ${result.created} item(s). ${result.failed.length} failed.`,
          'warning'
        );
      } else {
        showToast(`Successfully imported ${result.created} item(s)`, 'success');
      }
      
      // Refresh inventory list
      refetch();
      queryClient.invalidateQueries({ queryKey: ['inventory'], exact: false });
      
      setImportDialogOpen(false);
      setImportPreviewOpen(false);
      setImportResult(null);
      setImportFile(null);
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error, 'Failed to import items', {
        operation: 'import',
        resource: 'inventory items',
      });
      showToast(errorMessage, 'error');
    } finally {
      setIsImporting(false);
    }
  }, [importFile, showToast, refetch, queryClient]);

  // Early returns must come AFTER all hooks
  if (isError) {
    return (
      <Box sx={{ p: { xs: 2, sm: 3 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: 2 }}>
          <Typography variant="h4" fontWeight={700}>
            Inventory
          </Typography>
          <Button variant="contained" onClick={() => refetch()}>
            Retry
          </Button>
        </Box>
        <Paper sx={{ p: 3, borderRadius: 2 }}>
          <Typography variant="h6" gutterBottom>
            Inventory data couldn't be loaded
          </Typography>
          <Typography variant="body2" color="text.secondary">
            This is usually caused by a missing/incorrect organization selection or a temporary server issue. Try retrying, or switch
            organizations in the top bar.
          </Typography>
        </Paper>
      </Box>
    );
  }


  if (isLoading) {
    return (
      <Box>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Skeleton variant="text" width={200} height={40} />
          <Skeleton variant="rectangular" width={150} height={40} />
        </Box>
        <Skeleton variant="rectangular" width="100%" height={56} sx={{ mb: 2 }} />
        <Paper>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell><Skeleton /></TableCell>
                  <TableCell><Skeleton /></TableCell>
                  <TableCell><Skeleton /></TableCell>
                  <TableCell><Skeleton /></TableCell>
                  <TableCell><Skeleton /></TableCell>
                  <TableCell align="right"><Skeleton /></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {[1, 2, 3, 4, 5].map((i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton /></TableCell>
                    <TableCell><Skeleton /></TableCell>
                    <TableCell><Skeleton /></TableCell>
                    <TableCell><Skeleton /></TableCell>
                    <TableCell><Skeleton width={60} /></TableCell>
                    <TableCell align="right"><Skeleton width={100} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Box>
    );
  }

  return (
    <Box component="main">
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 600, mb: 0.5 }} id="page-title">
            Inventory
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {items?.length || 0} {items?.length === 1 ? 'item' : 'items'}
            {lowStockOnly && items && items.length > 0 && (
              <span> • {items.filter(i => i.currentStock <= i.reorderLevel).length} low stock</span>
            )}
            {isRefetching && (
              <span style={{ marginLeft: '8px', opacity: 0.7 }}>
                • <CircularProgress size={12} sx={{ verticalAlign: 'middle', mr: 0.5 }} />
                Refreshing...
              </span>
            )}
          </Typography>
        </Box>
        <Box 
          display="flex" 
          gap={1}
          sx={{
            flexDirection: { xs: 'column', sm: 'row' },
            width: { xs: '100%', sm: 'auto' },
          }}
        >
          <Tooltip title="Export filtered inventory items to CSV (Excel compatible)">
            <span>
              <Button
                variant="outlined"
                startIcon={isExporting ? <CircularProgress size={16} /> : <DownloadIcon />}
                onClick={async () => {
              if (!filteredItems || filteredItems.length === 0) {
                showToast('No items to export', 'warning');
                return;
              }
              setIsExporting(true);
              const totalItems = filteredItems.length;
              const showProgress = totalItems > 100;
              
              if (showProgress) {
                setExportProgress({ open: true, current: 0, total: totalItems });
              }
              
              try {
                const exportData = filteredItems.map((item) => {
                  return {
                  'SKU': item.sku,
                  'Name': item.name,
                  'Barcode': item.barcode || '',
                  'Description': item.description || '',
                  'Unit': item.unit,
                  'Current Stock': item.currentStock,
                  'Reorder Level': item.reorderLevel,
                  'Max Stock': item.maxStockLevel || '',
                  'Default Unit Price': item.defaultUnitPrice,
                  'Cost Price': item.costPrice || '',
                  'Default Tax Rate': `${item.defaultTaxRate}%`,
                  'Status': item.status || 'active',
                  'Low Stock': item.currentStock <= item.reorderLevel ? 'Yes' : 'No',
                  'Stock Value': (item.currentStock * (item.costPrice || item.defaultUnitPrice)).toFixed(2),
                  'Created': item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '',
                  'Last Updated': item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : '',
                  };
                });
                
                exportToCSV(exportData, {
                  filename: 'inventory',
                  title: 'Inventory Export',
                  description: 'Complete inventory items with stock levels and pricing',
                  includeMetadata: true,
                  formatNumbers: true,
                  formatDates: true,
                  onProgress: showProgress ? (current, total) => {
                    setExportProgress({ open: true, current, total });
                  } : undefined,
                });
                
                if (showProgress) {
                  // Ensure progress shows 100% before closing
                  setExportProgress({ open: true, current: totalItems, total: totalItems });
                  // Close dialog after a brief delay to show completion
                  setTimeout(() => {
                    setExportProgress({ open: false, current: 0, total: 0 });
                  }, 500);
                }
                
                showToast('Inventory exported successfully', 'success');
              } catch (error) {
                if (showProgress) {
                  setExportProgress({ open: false, current: 0, total: 0 });
                }
                const errorMessage = getErrorMessage(error, 'Failed to export inventory', {
                  operation: 'export',
                  resource: 'inventory items',
                  context: { itemCount: filteredItems.length },
                });
                showToast(errorMessage, 'error');
              } finally {
                setIsExporting(false);
              }
            }}
            disabled={!filteredItems || filteredItems.length === 0 || isExporting}
            size="large"
            aria-label="Export inventory to CSV"
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 600,
              minWidth: { xs: '100%', sm: 140 },
              width: { xs: '100%', sm: 'auto' },
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
            variant="outlined"
            startIcon={<UploadFileIcon />}
            onClick={() => setImportDialogOpen(true)}
            size="large"
            sx={{ 
              minWidth: { xs: '100%', sm: 140 },
              width: { xs: '100%', sm: 'auto' },
            }}
          >
            Import
          </Button>
          <Button
            variant="outlined"
            startIcon={<UploadFileIcon />}
            onClick={() => setBulkAddDialogOpen(true)}
            size="large"
            sx={{ 
              minWidth: { xs: '100%', sm: 140 },
              width: { xs: '100%', sm: 'auto' },
            }}
          >
            Bulk Add
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/inventory/create')}
            size="large"
            sx={{ 
              minWidth: { xs: '100%', sm: 140 },
              width: { xs: '100%', sm: 'auto' },
            }}
          >
            Add Item
          </Button>
        </Box>
      </Box>

      {/* Summary Cards */}
      {items && items.length > 0 && (
        <Box mb={3.5} sx={{ width: '100%' }}>
          <Grid container spacing={2.5} sx={{ width: '100%', margin: 0 }}>
          {/* Total Items Card */}
          <Grid item xs={{ xs: 6, sm: 6, md: 2.4 }} sx={{ display: 'flex' }}>
            <Paper 
              elevation={0}
              sx={{ 
                p: 2, 
                display: 'flex', 
                flexDirection: 'column',
                alignItems: 'flex-start',
                textAlign: 'left',
                height: '100%',
                width: '100%',
                background: theme.palette.mode === 'dark' 
                  ? `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.15)} 0%, ${alpha(theme.palette.primary.main, 0.05)} 100%)`
                  : '#ffffff',
                borderRadius: 2.5,
                border: `1px solid ${alpha(theme.palette.primary.main, 0.12)}`,
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                position: 'relative',
                overflow: 'hidden',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '4px',
                  background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.primary.light})`,
                },
                '&::after': {
                  content: '""',
                  position: 'absolute',
                  top: -50,
                  right: -50,
                  width: 120,
                  height: 120,
                  borderRadius: '50%',
                  background: `radial-gradient(circle, ${alpha(theme.palette.primary.main, 0.1)} 0%, transparent 70%)`,
                  transition: 'all 0.3s ease',
                },
                '&:hover': {
                  transform: 'translateY(-4px) scale(1.02)',
                  boxShadow: `0 8px 24px ${alpha(theme.palette.primary.main, 0.2)}, 0 4px 8px ${alpha(theme.palette.primary.main, 0.1)}`,
                  borderColor: alpha(theme.palette.primary.main, 0.3),
                  '&::after': {
                    transform: 'scale(1.2)',
                    opacity: 0.8,
                  },
                },
              }}
            >
              <Box sx={{ 
                p: 1.25, 
                borderRadius: 2, 
                background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mb: 1.5,
                boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.3)}`,
                transition: 'transform 0.3s ease',
                '&:hover': {
                  transform: 'scale(1.1) rotate(5deg)',
                },
              }}>
                <InventoryIcon sx={{ fontSize: 22 }} />
              </Box>
              <Typography 
                variant="h4" 
                fontWeight={800} 
                sx={{ 
                  color: theme.palette.text.primary, 
                  fontSize: '2rem',
                  mb: 0.5,
                  lineHeight: 1,
                  letterSpacing: '-0.02em',
                }}
              >
                {items.length.toLocaleString()}
              </Typography>
              <Typography 
                variant="body2" 
                color="text.secondary" 
                sx={{ 
                  fontSize: '0.8125rem', 
                  fontWeight: 500,
                  textTransform: 'none',
                  letterSpacing: '0.01em',
                }}
              >
                Total Items
              </Typography>
            </Paper>
          </Grid>

          {/* Total Store Stock Card */}
          <Grid item xs={{ xs: 6, sm: 6, md: 2.4 }} sx={{ display: 'flex' }}>
            <Paper 
              elevation={0}
              sx={{ 
                p: 2, 
                display: 'flex', 
                flexDirection: 'column',
                alignItems: 'flex-start',
                textAlign: 'left',
                height: '100%',
                width: '100%',
                background: theme.palette.mode === 'dark' 
                  ? `linear-gradient(135deg, ${alpha(theme.palette.success.main, 0.15)} 0%, ${alpha(theme.palette.success.main, 0.05)} 100%)`
                  : '#ffffff',
                borderRadius: 2.5,
                border: `1px solid ${alpha(theme.palette.success.main, 0.12)}`,
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                position: 'relative',
                overflow: 'hidden',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '4px',
                  background: `linear-gradient(90deg, ${theme.palette.success.main}, ${theme.palette.success.light})`,
                },
                '&::after': {
                  content: '""',
                  position: 'absolute',
                  top: -50,
                  right: -50,
                  width: 120,
                  height: 120,
                  borderRadius: '50%',
                  background: `radial-gradient(circle, ${alpha(theme.palette.success.main, 0.1)} 0%, transparent 70%)`,
                  transition: 'all 0.3s ease',
                },
                '&:hover': {
                  transform: 'translateY(-4px) scale(1.02)',
                  boxShadow: `0 8px 24px ${alpha(theme.palette.success.main, 0.2)}, 0 4px 8px ${alpha(theme.palette.success.main, 0.1)}`,
                  borderColor: alpha(theme.palette.success.main, 0.3),
                  '&::after': {
                    transform: 'scale(1.2)',
                    opacity: 0.8,
                  },
                },
              }}
            >
              <Box sx={{ 
                p: 1.25, 
                borderRadius: 2, 
                background: `linear-gradient(135deg, ${theme.palette.success.main}, ${theme.palette.success.dark})`,
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mb: 1.5,
                boxShadow: `0 4px 12px ${alpha(theme.palette.success.main, 0.3)}`,
                transition: 'transform 0.3s ease',
                '&:hover': {
                  transform: 'scale(1.1) rotate(5deg)',
                },
              }}>
                <WarehouseIcon sx={{ fontSize: 22 }} />
              </Box>
              <Typography 
                variant="h4" 
                fontWeight={800} 
                sx={{ 
                  color: theme.palette.text.primary, 
                  fontSize: '2rem',
                  mb: 0.5,
                  lineHeight: 1,
                  letterSpacing: '-0.02em',
                }}
              >
                {storeStats.totalStoreStock.toLocaleString()}
              </Typography>
              <Typography 
                variant="body2" 
                color="text.secondary" 
                sx={{ 
                  fontSize: '0.8125rem', 
                  fontWeight: 500,
                  textTransform: 'none',
                  letterSpacing: '0.01em',
                }}
              >
                Total Store Stock
              </Typography>
            </Paper>
          </Grid>

          {/* Low Stock Items Card */}
          <Grid item xs={{ xs: 6, sm: 6, md: 2.4 }} sx={{ display: 'flex' }}>
            <Paper 
              elevation={0}
              sx={{ 
                p: 2, 
                display: 'flex', 
                flexDirection: 'column',
                alignItems: 'flex-start',
                textAlign: 'left',
                height: '100%',
                width: '100%',
                background: theme.palette.mode === 'dark' 
                  ? (storeStats.lowStockCount > 0
                      ? `linear-gradient(135deg, ${alpha(theme.palette.warning.main, 0.15)} 0%, ${alpha(theme.palette.warning.main, 0.05)} 100%)`
                      : `linear-gradient(135deg, ${alpha(theme.palette.grey[500], 0.15)} 0%, ${alpha(theme.palette.grey[500], 0.05)} 100%)`)
                  : '#ffffff',
                borderRadius: 2.5,
                border: `1px solid ${storeStats.lowStockCount > 0 ? alpha(theme.palette.warning.main, 0.12) : alpha(theme.palette.grey[500], 0.12)}`,
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                position: 'relative',
                overflow: 'hidden',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '4px',
                  background: storeStats.lowStockCount > 0 
                    ? `linear-gradient(90deg, ${theme.palette.warning.main}, ${theme.palette.warning.light})`
                    : `linear-gradient(90deg, ${theme.palette.grey[400]}, ${theme.palette.grey[300]})`,
                },
                '&::after': {
                  content: '""',
                  position: 'absolute',
                  top: -50,
                  right: -50,
                  width: 120,
                  height: 120,
                  borderRadius: '50%',
                  background: storeStats.lowStockCount > 0
                    ? `radial-gradient(circle, ${alpha(theme.palette.warning.main, 0.1)} 0%, transparent 70%)`
                    : `radial-gradient(circle, ${alpha(theme.palette.grey[500], 0.08)} 0%, transparent 70%)`,
                  transition: 'all 0.3s ease',
                },
                '&:hover': {
                  transform: 'translateY(-4px) scale(1.02)',
                  boxShadow: storeStats.lowStockCount > 0
                    ? `0 8px 24px ${alpha(theme.palette.warning.main, 0.2)}, 0 4px 8px ${alpha(theme.palette.warning.main, 0.1)}`
                    : `0 8px 24px ${alpha(theme.palette.grey[500], 0.15)}, 0 4px 8px ${alpha(theme.palette.grey[500], 0.08)}`,
                  borderColor: storeStats.lowStockCount > 0 
                    ? alpha(theme.palette.warning.main, 0.3)
                    : alpha(theme.palette.grey[500], 0.25),
                  '&::after': {
                    transform: 'scale(1.2)',
                    opacity: 0.8,
                  },
                },
              }}
            >
              <Box sx={{ 
                p: 1.25, 
                borderRadius: 2, 
                background: storeStats.lowStockCount > 0
                  ? `linear-gradient(135deg, ${theme.palette.warning.main}, ${theme.palette.warning.dark})`
                  : `linear-gradient(135deg, ${theme.palette.grey[500]}, ${theme.palette.grey[600]})`,
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mb: 1.5,
                boxShadow: storeStats.lowStockCount > 0
                  ? `0 4px 12px ${alpha(theme.palette.warning.main, 0.3)}`
                  : `0 4px 12px ${alpha(theme.palette.grey[500], 0.2)}`,
                transition: 'transform 0.3s ease',
                '&:hover': {
                  transform: 'scale(1.1) rotate(5deg)',
                },
              }}>
                <TrendingDownIcon sx={{ fontSize: 22 }} />
              </Box>
              <Typography 
                variant="h4" 
                fontWeight={800}
                sx={{ 
                  color: theme.palette.text.primary,
                  fontSize: '2rem',
                  mb: 0.5,
                  lineHeight: 1,
                  letterSpacing: '-0.02em',
                }}
              >
                {storeStats.lowStockCount.toLocaleString()}
              </Typography>
              <Typography 
                variant="body2" 
                color="text.secondary" 
                sx={{ 
                  fontSize: '0.8125rem', 
                  fontWeight: 500,
                  textTransform: 'none',
                  letterSpacing: '0.01em',
                }}
              >
                Low Stock Items
              </Typography>
            </Paper>
          </Grid>

          {/* Out of Stock Items Card */}
          <Grid item xs={{ xs: 6, sm: 6, md: 2.4 }} sx={{ display: 'flex' }}>
            <Paper 
              elevation={0}
              sx={{ 
                p: 2, 
                display: 'flex', 
                flexDirection: 'column',
                alignItems: 'flex-start',
                textAlign: 'left',
                height: '100%',
                width: '100%',
                background: theme.palette.mode === 'dark' 
                  ? (storeStats.outOfStockCount > 0
                      ? `linear-gradient(135deg, ${alpha(theme.palette.error.main, 0.15)} 0%, ${alpha(theme.palette.error.main, 0.05)} 100%)`
                      : `linear-gradient(135deg, ${alpha(theme.palette.grey[500], 0.15)} 0%, ${alpha(theme.palette.grey[500], 0.05)} 100%)`)
                  : '#ffffff',
                borderRadius: 2.5,
                border: `1px solid ${storeStats.outOfStockCount > 0 ? alpha(theme.palette.error.main, 0.12) : alpha(theme.palette.grey[500], 0.12)}`,
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                position: 'relative',
                overflow: 'hidden',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '4px',
                  background: storeStats.outOfStockCount > 0 
                    ? `linear-gradient(90deg, ${theme.palette.error.main}, ${theme.palette.error.light})`
                    : `linear-gradient(90deg, ${theme.palette.grey[400]}, ${theme.palette.grey[300]})`,
                },
                '&::after': {
                  content: '""',
                  position: 'absolute',
                  top: -50,
                  right: -50,
                  width: 120,
                  height: 120,
                  borderRadius: '50%',
                  background: storeStats.outOfStockCount > 0
                    ? `radial-gradient(circle, ${alpha(theme.palette.error.main, 0.1)} 0%, transparent 70%)`
                    : `radial-gradient(circle, ${alpha(theme.palette.grey[500], 0.08)} 0%, transparent 70%)`,
                  transition: 'all 0.3s ease',
                },
                '&:hover': {
                  transform: 'translateY(-4px) scale(1.02)',
                  boxShadow: storeStats.outOfStockCount > 0
                    ? `0 8px 24px ${alpha(theme.palette.error.main, 0.2)}, 0 4px 8px ${alpha(theme.palette.error.main, 0.1)}`
                    : `0 8px 24px ${alpha(theme.palette.grey[500], 0.15)}, 0 4px 8px ${alpha(theme.palette.grey[500], 0.08)}`,
                  borderColor: storeStats.outOfStockCount > 0 
                    ? alpha(theme.palette.error.main, 0.3)
                    : alpha(theme.palette.grey[500], 0.25),
                  '&::after': {
                    transform: 'scale(1.2)',
                    opacity: 0.8,
                  },
                },
              }}
            >
              <Box sx={{ 
                p: 1.25, 
                borderRadius: 2, 
                background: storeStats.outOfStockCount > 0
                  ? `linear-gradient(135deg, ${theme.palette.error.main}, ${theme.palette.error.dark})`
                  : `linear-gradient(135deg, ${theme.palette.grey[500]}, ${theme.palette.grey[600]})`,
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mb: 1.5,
                boxShadow: storeStats.outOfStockCount > 0
                  ? `0 4px 12px ${alpha(theme.palette.error.main, 0.3)}`
                  : `0 4px 12px ${alpha(theme.palette.grey[500], 0.2)}`,
                transition: 'transform 0.3s ease',
                '&:hover': {
                  transform: 'scale(1.1) rotate(5deg)',
                },
              }}>
                <RemoveShoppingCartIcon sx={{ fontSize: 22 }} />
              </Box>
              <Typography 
                variant="h4" 
                fontWeight={800}
                sx={{ 
                  color: theme.palette.text.primary,
                  fontSize: '2rem',
                  mb: 0.5,
                  lineHeight: 1,
                  letterSpacing: '-0.02em',
                }}
              >
                {storeStats.outOfStockCount.toLocaleString()}
              </Typography>
              <Typography 
                variant="body2" 
                color="text.secondary" 
                sx={{ 
                  fontSize: '0.8125rem', 
                  fontWeight: 500,
                  textTransform: 'none',
                  letterSpacing: '0.01em',
                }}
              >
                Out of Stock Items
              </Typography>
            </Paper>
          </Grid>

          {/* Total Inventory Value Card */}
          <Grid item xs={{ xs: 12, sm: 6, md: 2.4 }} sx={{ display: 'flex' }}>
            <Paper 
              elevation={0}
              sx={{ 
                p: 2, 
                display: 'flex', 
                flexDirection: 'column',
                alignItems: 'flex-start',
                textAlign: 'left',
                height: '100%',
                width: '100%',
                background: theme.palette.mode === 'dark' 
                  ? `linear-gradient(135deg, ${alpha(theme.palette.info.main, 0.15)} 0%, ${alpha(theme.palette.info.main, 0.05)} 100%)`
                  : '#ffffff',
                borderRadius: 2.5,
                border: `1px solid ${alpha(theme.palette.info.main, 0.12)}`,
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                position: 'relative',
                overflow: 'hidden',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '4px',
                  background: `linear-gradient(90deg, ${theme.palette.info.main}, ${theme.palette.info.light})`,
                },
                '&::after': {
                  content: '""',
                  position: 'absolute',
                  top: -50,
                  right: -50,
                  width: 120,
                  height: 120,
                  borderRadius: '50%',
                  background: `radial-gradient(circle, ${alpha(theme.palette.info.main, 0.1)} 0%, transparent 70%)`,
                  transition: 'all 0.3s ease',
                },
                '&:hover': {
                  transform: 'translateY(-4px) scale(1.02)',
                  boxShadow: `0 8px 24px ${alpha(theme.palette.info.main, 0.2)}, 0 4px 8px ${alpha(theme.palette.info.main, 0.1)}`,
                  borderColor: alpha(theme.palette.info.main, 0.3),
                  '&::after': {
                    transform: 'scale(1.2)',
                    opacity: 0.8,
                  },
                },
              }}
            >
              <Box sx={{ 
                p: 1.25, 
                borderRadius: 2, 
                background: `linear-gradient(135deg, ${theme.palette.info.main}, ${theme.palette.info.dark})`,
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mb: 1.5,
                boxShadow: `0 4px 12px ${alpha(theme.palette.info.main, 0.3)}`,
                transition: 'transform 0.3s ease',
                '&:hover': {
                  transform: 'scale(1.1) rotate(5deg)',
                },
              }}>
                <AttachMoneyIcon sx={{ fontSize: 22 }} />
              </Box>
              <Typography 
                variant="h4" 
                fontWeight={800} 
                sx={{ 
                  color: theme.palette.text.primary, 
                  fontSize: '1.75rem',
                  mb: 0.5,
                  lineHeight: 1,
                  letterSpacing: '-0.02em',
                  fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
                }}
              >
                {formatCurrency(storeStats.totalValue)}
              </Typography>
              <Typography 
                variant="body2" 
                color="text.secondary" 
                sx={{ 
                  fontSize: '0.8125rem', 
                  fontWeight: 500,
                  textTransform: 'none',
                  letterSpacing: '0.01em',
                }}
              >
                Total Inventory Value
              </Typography>
            </Paper>
          </Grid>
        </Grid>
        </Box>
      )}

      <Box 
        display="flex" 
        flexDirection={{ xs: 'column', md: 'row' }}
        gap={2} 
        mb={3}
        sx={{
          flexWrap: 'wrap',
          '& > *': {
            minWidth: { xs: '100%', sm: 'auto' },
          },
        }}
      >
        <TextField
          placeholder="Search inventory..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          inputProps={{
            'aria-label': 'Search inventory items',
          }}
          sx={{ 
            flexGrow: 1,
            minWidth: { xs: '100%', sm: 250 },
            '& .MuiOutlinedInput-root': {
              borderRadius: 2,
              transition: 'all 0.2s ease-in-out',
              bgcolor: 'background.paper',
              '&:hover': {
                boxShadow: 1,
              },
              '&.Mui-focused': {
                boxShadow: 2,
              },
            },
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
                  }}
                  edge="end"
                  sx={{ 
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
        />
        <FormControl 
          sx={{ 
            minWidth: { xs: '100%', sm: 150 },
            '& .MuiOutlinedInput-root': {
              borderRadius: 2,
            },
          }}
        >
          <InputLabel>Status</InputLabel>
          <Select
            value={statusFilter}
            label="Status"
            onChange={(e) => {
              const newStatus = e.target.value as string;
              setStatusFilter(newStatus);
            }}
          >
            <MenuItem value="all">All Items</MenuItem>
            <MenuItem value="active">Active Only</MenuItem>
            <MenuItem value="inactive">Inactive Only</MenuItem>
          </Select>
        </FormControl>
        <Button
          variant={inStoresOnly ? 'contained' : 'outlined'}
          color={inStoresOnly ? 'primary' : 'default'}
          startIcon={<StoreIcon />}
          onClick={() => setInStoresOnly(!inStoresOnly)}
          sx={{
            ...(inStoresOnly && {
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              '&:hover': {
                bgcolor: 'primary.dark',
              },
            }),
            borderRadius: 2,
            minWidth: { xs: '100%', sm: 'auto' },
          }}
        >
          In Stores
        </Button>
        <Button
          variant={lowStockOnly ? 'contained' : 'outlined'}
          color={lowStockOnly ? 'warning' : 'primary'}
          onClick={() => setLowStockOnly(!lowStockOnly)}
          sx={{
            ...(lowStockOnly && {
              fontWeight: 'bold',
            }),
            minWidth: { xs: '100%', sm: 'auto' },
          }}
        >
          {lowStockOnly ? '✓ Low Stock' : 'Low Stock'}
        </Button>
        {(searchTerm || statusFilter !== 'all' || lowStockOnly || inStoresOnly) && (
          <Button
            variant="outlined"
            startIcon={<ClearIcon />}
            onClick={() => {
              setSearchInput('');
              setSearchTerm('');
              setStatusFilter('all');
              setLowStockOnly(false);
              setInStoresOnly(false);
            }}
            sx={{
              minWidth: { xs: '100%', sm: 'auto' },
            }}
          >
            Clear
          </Button>
        )}
      </Box>

      {/* Result Count */}
      {filteredItems && filteredItems.length > 0 && (
        <Box mb={2} display="flex" justifyContent="space-between" alignItems="center" sx={{ px: 0.5 }}>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
            Showing <strong>{filteredItems.length}</strong> of <strong>{items?.length || 0}</strong> item{filteredItems.length !== 1 ? 's' : ''}
            {(searchTerm || statusFilter !== 'all' || lowStockOnly || inStoresOnly) && (
              <span> (filtered)</span>
            )}
          </Typography>
        </Box>
      )}


      <TableContainer 
        component={Paper} 
        sx={{ 
          borderRadius: 2, 
          boxShadow: 1,
          overflowX: 'auto',
          overflowY: 'auto',
          maxHeight: 'calc(100vh - 400px)',
          border: '1px solid',
          borderColor: 'divider',
          '&::-webkit-scrollbar': {
            height: 8,
            width: 8,
          },
          '&::-webkit-scrollbar-track': {
            backgroundColor: 'grey.100',
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: 'grey.400',
            borderRadius: 4,
            '&:hover': {
              backgroundColor: 'grey.500',
            },
          },
        }}
      >
        <Table 
          sx={{ 
            '& .MuiTableCell-root': { 
              py: { xs: 0.75, sm: 1 },
              fontSize: { xs: '0.7rem', sm: '0.875rem' },
            },
            minWidth: { xs: 1100, sm: 'auto' },
            '& .MuiTableRow-root': {
              '&:hover': {
                bgcolor: { xs: 'transparent', sm: alpha(theme.palette.primary.main, 0.04) }, // Disable hover on mobile
              },
            },
          }}
          size="small"
        >
          <TableHead>
            <TableRow sx={{ 
              bgcolor: alpha(theme.palette.primary.main, 0.05),
              '& .MuiTableCell-root': {
                borderBottom: `2px solid ${theme.palette.divider}`,
                py: 1.5,
                px: 2,
              },
            }}>
              <TableCell padding="checkbox" sx={{ fontWeight: 600, py: 1.5, px: 1.5 }}>
                <Checkbox
                  indeterminate={selectedItems.size > 0 && selectedItems.size < (filteredItems?.length || 0)}
                  checked={filteredItems && filteredItems.length > 0 && filteredItems.every(item => selectedItems.has(item.id))}
                  onChange={handleSelectAll}
                  inputProps={{ 'aria-label': 'select all items' }}
                />
              </TableCell>
              <TableCell 
                sx={{ 
                  fontWeight: 600, 
                  py: 1.5, 
                  px: 2, 
                  whiteSpace: 'nowrap', 
                  width: '9%', 
                  minWidth: 90,
                  display: preferences.sku?.visible === false ? 'none' : 'table-cell',
                }}
              >
                <TableSortLabel
                  active={sortField === 'sku'}
                  direction={sortField === 'sku' ? sortOrder : 'asc'}
                  onClick={() => handleSort('sku')}
                >
                  <Box display="flex" alignItems="center" gap={0.5}>
                    <NumbersIcon fontSize="small" color="primary" />
                    <Typography variant="caption" fontWeight={600}>SKU</Typography>
                  </Box>
                </TableSortLabel>
              </TableCell>
              <TableCell 
                sx={{ 
                  fontWeight: 600, 
                  px: 2, 
                  whiteSpace: 'nowrap', 
                  width: '20%', 
                  minWidth: 140,
                  display: preferences.name?.visible === false ? 'none' : 'table-cell',
                }}
              >
                <TableSortLabel
                  active={sortField === 'name'}
                  direction={sortField === 'name' ? sortOrder : 'asc'}
                  onClick={() => handleSort('name')}
                >
                  <Box display="flex" alignItems="center" gap={0.5}>
                    <InventoryIcon fontSize="small" color="primary" />
                    <Typography variant="caption" fontWeight={600}>Name</Typography>
                  </Box>
                </TableSortLabel>
              </TableCell>
              <TableCell 
                sx={{ 
                  fontWeight: 600, 
                  px: 2, 
                  whiteSpace: 'nowrap', 
                  width: '12%', 
                  minWidth: 100, 
                  display: preferences.attributes?.visible === false ? 'none' : { xs: 'none', md: 'table-cell' },
                }}
              >
                <Box display="flex" alignItems="center" gap={0.5}>
                  <LabelIcon fontSize="small" color="primary" />
                  <Typography variant="caption" fontWeight={600}>Description</Typography>
                </Box>
              </TableCell>
              <TableCell 
                sx={{ 
                  fontWeight: 600, 
                  px: 2, 
                  whiteSpace: 'nowrap', 
                  width: '8%', 
                  minWidth: 70,
                  display: preferences.stock?.visible === false ? 'none' : 'table-cell',
                }} 
                align="right"
              >
                <TableSortLabel
                  active={sortField === 'stock'}
                  direction={sortField === 'stock' ? sortOrder : 'asc'}
                  onClick={() => handleSort('stock')}
                >
                  <Box display="flex" alignItems="center" gap={0.5} justifyContent="flex-end">
                    <WarehouseIcon fontSize="small" color="primary" />
                    <Typography variant="caption" fontWeight={600}>Total Inventory</Typography>
                  </Box>
                </TableSortLabel>
              </TableCell>
              <TableCell 
                sx={{ 
                  fontWeight: 600, 
                  px: 2, 
                  whiteSpace: 'nowrap', 
                  width: '9%', 
                  minWidth: 85,
                  display: preferences.storeStock?.visible === false ? 'none' : 'table-cell',
                }} 
                align="right"
              >
                <TableSortLabel
                  active={sortField === 'storeStock'}
                  direction={sortField === 'storeStock' ? sortOrder : 'asc'}
                  onClick={() => handleSort('storeStock')}
                >
                  <Box display="flex" alignItems="center" gap={0.5} justifyContent="flex-end">
                    <StoreIcon fontSize="small" color="primary" />
                    <Typography variant="caption" fontWeight={600}>Store Stock</Typography>
                  </Box>
                </TableSortLabel>
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 600, px: 2, whiteSpace: 'nowrap', width: '8%', minWidth: 70 }}>
                <Typography variant="caption" fontWeight={600}>Actions</Typography>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredItems && filteredItems.length > 0 ? (
              filteredItems.map((item) => {
                const isZero = item.currentStock === 0;
                // Check total stock (warehouse + stores) for low stock status
                const warehouseStock = item.currentStock || 0;
                const storeStock = item.storeAggregation?.totalStoreStock || 0;
                const totalStock = warehouseStock + storeStock;
                const isLowStock = totalStock > 0 && totalStock <= item.reorderLevel;
                
                return (
                  <TableRow 
                    key={item.id} 
                    hover
                    tabIndex={0}
                    role="button"
                    aria-label={`View details for ${item.name}`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        navigate(`/inventory/${item.id}`);
                      }
                    }}
                    sx={{ 
                      '&:hover': { 
                        bgcolor: alpha(theme.palette.primary.main, 0.04),
                        cursor: 'pointer',
                        transform: 'scale(1.001)',
                      },
                      '&:focus-visible': {
                        outline: '2px solid',
                        outlineColor: 'primary.main',
                        outlineOffset: -2,
                      },
                      transition: 'all 0.15s ease-in-out',
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                      borderLeft: isZero ? `3px solid ${theme.palette.error.main}` : isLowStock ? `3px solid ${theme.palette.warning.main}` : '3px solid transparent',
                      '& .MuiTableCell-root': {
                        borderBottom: '1px solid',
                        borderColor: 'divider',
                      },
                    }}
                    onClick={() => navigate(`/inventory/${item.id}`)}
                  >
                    <TableCell padding="checkbox" sx={{ px: 1.5, py: 1 }} onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedItems.has(item.id)}
                        onChange={() => handleSelectItem(item.id)}
                        inputProps={{ 'aria-label': `select ${item.name}` }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </TableCell>
                    <TableCell 
                      sx={{ 
                        px: 2, 
                        py: 1,
                        display: preferences.sku?.visible === false ? 'none' : 'table-cell',
                      }}
                    >
                      <Typography 
                        variant="body2" 
                        sx={{ 
                          fontFamily: 'monospace', 
                          fontWeight: 500,
                          color: 'primary.main',
                          fontSize: '0.75rem',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {item.sku}
                      </Typography>
                    </TableCell>
                    <TableCell 
                      sx={{ 
                        px: 2, 
                        py: 1,
                        display: preferences.name?.visible === false ? 'none' : 'table-cell',
                      }}
                    >
                      <Typography 
                        variant="body2" 
                        fontWeight={500}
                        sx={{ 
                          fontSize: '0.8125rem',
                          lineHeight: 1.3,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={item.name}
                      >
                        {item.name}
                      </Typography>
                    </TableCell>
                    <TableCell 
                      sx={{ 
                        px: 2, 
                        py: 1, 
                        display: preferences.attributes?.visible === false ? 'none' : { xs: 'none', md: 'table-cell' },
                        maxWidth: 200,
                      }}
                    >
                      {item.description ? (
                        <Tooltip title={item.description}>
                          <Typography 
                            variant="body2" 
                            color="text.secondary" 
                            sx={{ 
                              fontSize: '0.75rem',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              maxWidth: 200,
                            }}
                          >
                            {item.description}
                          </Typography>
                        </Tooltip>
                      ) : (
                        <Typography variant="body2" color="text.disabled" sx={{ fontSize: '0.75rem' }}>
                          -
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell 
                      align="right" 
                      sx={{ 
                        px: 2, 
                        py: 1,
                        display: preferences.stock?.visible === false ? 'none' : 'table-cell',
                      }}
                    >
                      <Tooltip
                        title={
                          <Box>
                            <Typography variant="caption" display="block" fontWeight={600}>
                              Total Inventory Breakdown
                            </Typography>
                            <Typography variant="caption" display="block" sx={{ mt: 0.5, fontWeight: 600 }}>
                              Total: {Math.max(0, item.currentStock || 0).toLocaleString()} units
                            </Typography>
                            {item.storeAggregation && item.storeAggregation.storeCount > 0 && (
                              <>
                                <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                                  Allocated to Stores: {item.storeAggregation.totalStoreStock.toLocaleString()} units
                                </Typography>
                                {Math.max(0, item.currentStock || 0) - (item.storeAggregation.totalStoreStock || 0) > 0 && (
                                  <Typography variant="caption" display="block" color="info.main" sx={{ mt: 0.5, fontWeight: 500 }}>
                                    Available for Allocation: {(Math.max(0, item.currentStock || 0) - (item.storeAggregation.totalStoreStock || 0)).toLocaleString()} units
                                  </Typography>
                                )}
                                {Math.max(0, item.currentStock || 0) - (item.storeAggregation.totalStoreStock || 0) < 0 && (
                                  <Typography variant="caption" display="block" color="error.main" sx={{ mt: 0.5, fontWeight: 600 }}>
                                    ⚠️ Data Inconsistency: Store allocation exceeds total inventory
                                  </Typography>
                                )}
                              </>
                            )}
                            {(!item.storeAggregation || item.storeAggregation.storeCount === 0) && (
                              <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>
                                All {Math.max(0, item.currentStock || 0)} units available for allocation
                              </Typography>
                            )}
                          </Box>
                        }
                        arrow
                      >
                        <Typography 
                          variant="body2" 
                          fontWeight={600} 
                          sx={{ 
                            fontSize: '0.875rem', 
                            cursor: 'help',
                            color: isZero ? 'error.main' : isLowStock ? 'warning.main' : 'text.primary',
                          }}
                        >
                          {Math.max(0, item.currentStock || 0).toLocaleString()}
                        </Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell 
                      align="right" 
                      sx={{ 
                        px: 2, 
                        py: 1,
                        display: preferences.storeStock?.visible === false ? 'none' : 'table-cell',
                      }} 
                      onClick={(e) => e.stopPropagation()}
                    >
                      {item.storeAggregation && item.storeAggregation.storeCount > 0 ? (
                        <Tooltip
                          title={
                            <Box>
                              <Typography variant="caption" display="block" fontWeight={600}>
                                Store Stock Allocation
                              </Typography>
                              <Typography variant="caption" display="block" sx={{ mt: 0.5, fontWeight: 600 }}>
                                Total Allocated: {(item.storeAggregation.totalStoreStock || 0).toLocaleString()} units
                              </Typography>
                              <Typography variant="caption" display="block">
                                Across {item.storeAggregation.storeCount} store{item.storeAggregation.storeCount !== 1 ? 's' : ''}
                              </Typography>
                              {item.storeAggregation.storesWithLowStock > 0 && (
                                <Typography variant="caption" display="block" color="warning.main" sx={{ mt: 0.5 }}>
                                  ⚠️ {item.storeAggregation.storesWithLowStock} store{item.storeAggregation.storesWithLowStock !== 1 ? 's' : ''} with low stock
                                </Typography>
                              )}
                              {(() => {
                                const totalStoreStock = item.storeAggregation?.totalStoreStock || 0;
                                const totalInventory = Math.max(0, item.currentStock || 0);
                                const availableForAllocation = totalInventory - totalStoreStock;
                                const isInconsistent = totalStoreStock > totalInventory;
                                
                                if (isInconsistent) {
                                  return (
                                    <Typography variant="caption" display="block" color="error.main" sx={{ mt: 0.5, pt: 0.5, borderTop: '1px solid rgba(255,255,255,0.2)', fontWeight: 600 }}>
                                      ⚠️ Data Inconsistency: Allocation ({totalStoreStock.toLocaleString()}) exceeds total inventory ({totalInventory.toLocaleString()})
                                    </Typography>
                                  );
                                }
                                
                                if (availableForAllocation > 0) {
                                  return (
                                    <Typography variant="caption" display="block" color="info.main" sx={{ mt: 0.5, pt: 0.5, borderTop: '1px solid rgba(255,255,255,0.2)' }}>
                                      Available for Allocation: {availableForAllocation.toLocaleString()} units
                                    </Typography>
                                  );
                                }
                                
                                if (availableForAllocation === 0 && totalInventory > 0) {
                                  return (
                                    <Typography variant="caption" display="block" color="success.main" sx={{ mt: 0.5, pt: 0.5, borderTop: '1px solid rgba(255,255,255,0.2)' }}>
                                      ✓ Fully allocated across stores
                                    </Typography>
                                  );
                                }
                                
                                return null;
                              })()}
                              <Typography variant="caption" display="block" sx={{ mt: 0.5, pt: 0.5, borderTop: '1px solid rgba(255,255,255,0.2)' }}>
                                Click to view all stores with this item
                              </Typography>
                            </Box>
                          }
                          arrow
                        >
                          <Box 
                            display="flex" 
                            alignItems="center" 
                            justifyContent="flex-end" 
                            gap={0.5}
                            sx={{
                              cursor: 'pointer',
                              '&:hover': {
                                opacity: 0.8,
                              },
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              // Open dialog to show stores with inventory
                              setSelectedItemForStores(item);
                              setStoresDialogOpen(true);
                            }}
                          >
                            <Typography
                              variant="body2"
                              fontWeight={600}
                              sx={{
                                fontSize: '0.875rem',
                                color:
                                  item.storeAggregation.storesWithLowStock > 0
                                    ? item.storeAggregation.storesWithLowStock === item.storeAggregation.storeCount
                                      ? 'error.main'
                                      : 'warning.main'
                                    : 'success.main',
                                textDecoration: 'underline',
                                textDecorationColor: 'transparent',
                                transition: 'text-decoration-color 0.2s',
                                '&:hover': {
                                  textDecorationColor: 'inherit',
                                },
                              }}
                            >
                              {item.storeAggregation.totalStoreStock.toLocaleString()}
                            </Typography>
                            <Chip
                              label={item.storeAggregation.storeCount}
                              size="small"
                              sx={{
                                height: 16,
                                fontSize: '0.625rem',
                                '& .MuiChip-label': {
                                  px: 0.5,
                                  fontSize: '0.625rem',
                                },
                              }}
                            />
                          </Box>
                        </Tooltip>
                      ) : (
                        <Tooltip
                          title={
                            <Box>
                              <Typography variant="caption" display="block">
                                Item not configured in any stores
                              </Typography>
                              <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                                All {Math.max(0, item.currentStock || 0)} units are in warehouse
                              </Typography>
                            </Box>
                          }
                          arrow
                        >
                          <Typography variant="body2" color="text.disabled" sx={{ fontSize: '0.75rem', cursor: 'help' }}>
                            -
                          </Typography>
                        </Tooltip>
                      )}
                    </TableCell>
                    <TableCell align="right" sx={{ px: 2, py: 1 }} onClick={(e) => e.stopPropagation()}>
                      <Box display="flex" gap={0.5} justifyContent="flex-end">
                        <Tooltip title="View Details">
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/inventory/${item.id}`);
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
                        <Tooltip title="Edit Item">
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/inventory/${item.id}/edit`);
                            }}
                            sx={{ 
                              p: 0.75,
                              '&:hover': { 
                                bgcolor: 'action.hover',
                              },
                            }}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete Item">
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteClick(item.id);
                            }}
                            color="error"
                            sx={{ 
                              p: 0.75,
                              '&:hover': { 
                                bgcolor: 'error.light',
                                color: 'error.contrastText',
                              },
                            }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={12} align="center" sx={{ py: 10 }}>
                  <EmptyState
                    icon={<InventoryIcon sx={{ fontSize: 64, color: 'primary.main', opacity: 0.5 }} />}
                    title={
                      searchTerm || statusFilter !== 'all' || lowStockOnly || inStoresOnly
                        ? 'No items found'
                        : 'No inventory items yet'
                    }
                    description={
                      searchTerm || statusFilter !== 'all' || lowStockOnly || inStoresOnly
                        ? 'Try adjusting your search or filter criteria to find what you\'re looking for.'
                        : 'Get started by adding your first product to track inventory levels, stock movements, and manage your warehouse efficiently.'
                    }
                    action={
                      !searchTerm && statusFilter === 'all' && !lowStockOnly && !inStoresOnly
                        ? {
                            label: 'Add Your First Item',
                            onClick: () => navigate('/inventory/create'),
                            icon: <AddIcon />,
                          }
                        : {
                            label: 'Clear Filters',
                            onClick: () => {
                              setSearchInput('');
                              setSearchTerm('');
                              setStatusFilter('all');
                              setLowStockOnly(false);
                              setInStoresOnly(false);
                            },
                          }
                    }
                    secondaryAction={
                      !searchTerm && statusFilter === 'all' && !lowStockOnly && !inStoresOnly
                        ? {
                            label: 'Bulk Add Items',
                            onClick: () => setBulkAddDialogOpen(true),
                          }
                        : undefined
                    }
                    onboardingTips={
                      !searchTerm && statusFilter === 'all' && !lowStockOnly && !inStoresOnly
                        ? [
                            'Track stock levels and get alerts when items run low',
                            'Set reorder levels to automatically know when to restock',
                            'Link items to stores for multi-location inventory management',
                            'Use SKUs and barcodes for easy item identification',
                          ]
                        : undefined
                    }
                    variant="minimal"
                  />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <ConfirmDialog
        open={deleteConfirmOpen}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        title="Delete Inventory Item"
        message="Are you sure you want to delete this inventory item? This action cannot be undone. If this item is linked to invoices, deletion will be prevented."
        confirmText="Delete"
        cancelText="Cancel"
        confirmColor="error"
        loading={deleteItem.isPending}
        severity="error"
      />

      <ConfirmDialog
        open={bulkDeleteConfirmOpen}
        onClose={handleBulkDeleteCancel}
        onConfirm={handleBulkDeleteConfirm}
        title="Delete Multiple Items"
        message={`Are you sure you want to delete ${selectedItems.size} item(s)? This action cannot be undone. Items linked to invoices will not be deleted.`}
        confirmText={`Delete ${selectedItems.size}`}
        cancelText="Cancel"
        confirmColor="error"
        loading={bulkDeleteItems.isPending}
        severity="error"
      />

      <BulkAddInventoryDialog
        open={bulkAddDialogOpen}
        onClose={() => setBulkAddDialogOpen(false)}
      />

      <ExportProgressDialog
        open={exportProgress.open}
        current={exportProgress.current}
        total={exportProgress.total}
        filename="inventory"
        onCancel={() => {
          setExportProgress({ open: false, current: 0, total: 0 });
          setIsExporting(false);
        }}
      />

      <ImportDialog
        open={importDialogOpen}
        onClose={() => {
          setImportDialogOpen(false);
          setImportFile(null);
        }}
        onFileSelect={(data, file) => {
          handleImportFileSelect(data, file);
        }}
        acceptedFormats={['.csv', '.xlsx', '.xls']}
        maxFileSize={10}
      />

      {importResult && (
        <ImportPreview
          open={importPreviewOpen}
          onClose={() => {
            setImportPreviewOpen(false);
            setImportResult(null);
            setImportFile(null);
          }}
          onConfirm={handleImportConfirm}
          result={importResult}
          isLoading={isImporting}
        />
      )}

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

export default InventoryList;

