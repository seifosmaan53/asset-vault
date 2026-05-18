import { useNavigate, useParams } from 'react-router-dom';
import { useForm, useWatch, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import ErrorBoundary from '../../components/common/ErrorBoundary';
import {
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  InputAdornment,
  IconButton,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Skeleton,
  CircularProgress,
  Autocomplete,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert,
} from '@mui/material';
import { useInventoryItem, useCreateInventoryItem, useUpdateInventoryItem, useInventory } from '../../hooks/useInventory';
import { useStores } from '../../hooks/useStore';
import { useStoreItemSettingsByItem, useCreateOrUpdateStoreItemSettings } from '../../hooks/useStoreItemSettings';
import type { CreateInventoryItemDto } from '../../api/inventory';
import { useEffect, useRef, useState, useMemo } from 'react';
import { TIMEOUTS } from '../../constants/timeouts';
import { inventoryItemSchema } from '../../utils/validationSchemas';
import { useToast } from '../../contexts/ToastContext';
import Grid from '../../components/common/Grid';
import { logger } from '../../utils/logger';
import { getErrorMessage } from '../../utils/errorHandling';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { useUndo } from '../../hooks/useUndo';
import { inventoryApi } from '../../api/inventory';
import StoreIcon from '@mui/icons-material/Store';
import InventoryIcon from '@mui/icons-material/Inventory';
import NumbersIcon from '@mui/icons-material/Numbers';
import CategoryIcon from '@mui/icons-material/Category';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import WarehouseIcon from '@mui/icons-material/Warehouse';
import LabelIcon from '@mui/icons-material/Label';
import Checkbox from '@mui/material/Checkbox';
// FormControlLabel imported but not currently used
// import FormControlLabel from '@mui/material/FormControlLabel';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import QrCodeIcon from '@mui/icons-material/QrCode';
import RefreshIcon from '@mui/icons-material/Refresh';
import DownloadIcon from '@mui/icons-material/Download';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import PrintIcon from '@mui/icons-material/Print';
import DeleteIcon from '@mui/icons-material/Delete';
import ClearIcon from '@mui/icons-material/Clear';
import SearchIcon from '@mui/icons-material/Search';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import ViewListIcon from '@mui/icons-material/ViewList';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
// ExpandLessIcon imported but not currently used
// import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import SelectAllIcon from '@mui/icons-material/SelectAll';

interface InventoryFormData {
  sku: string;
  name: string;
  description?: string;
  unit: string;
  barcode?: string;
  costPrice?: number;
  defaultUnitPrice: number;
  defaultTaxRate?: number;
  currentStock: number;
  reorderLevel: number;
  maxStockLevel?: number;
  status: 'active' | 'inactive';
  // Bundle / Pack Information
  bundleSize?: number;
  bundleUnit?: string;
  // Space / Container Planning
  spacePerBundle?: number;
  bundlesPerContainer?: number;
  targetBundles?: number;
  // Pack Size
  packSize?: number;
  // Container Planning
  unitsPerContainer?: number;
  // Planning Fields
  weeksSupplyTargetOverride?: number;
  averageWeeklyUsage?: number;
}

const InventoryForm = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const { data: item, isLoading } = useInventoryItem(id || '');
  const { data: allInventoryItems } = useInventory();
  const { data: stores } = useStores();
  const { data: existingStoreSettings } = useStoreItemSettingsByItem(id || '');
  const createItem = useCreateInventoryItem();
  const updateItem = useUpdateInventoryItem();
  const createStoreSettings = useCreateOrUpdateStoreItemSettings();
  const { showToast } = useToast();
  const { createCreateUndo, createUpdateUndo } = useUndo();
  
  // Store selection state
  const [selectedStores, setSelectedStores] = useState<string[]>([]);
  const [storeStockValues, setStoreStockValues] = useState<Record<string, { stock: number; minQty: number }>>({});
  const [storeSearchQuery, setStoreSearchQuery] = useState('');
  const [storeViewMode, setStoreViewMode] = useState<'grid' | 'list'>('grid');

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    setError,
    control,
  } = useForm<InventoryFormData>({
    // Type assertion needed due to zod schema preprocessing creating unknown types
    resolver: zodResolver(inventoryItemSchema) as any,
    mode: 'onChange', // Show errors as user types for real-time feedback
    defaultValues: {
      status: 'active',
      currentStock: 0,
      reorderLevel: 0,
      costPrice: 0,
      defaultUnitPrice: 0,
      defaultTaxRate: 0,
    },
  });

  // SKU watched for potential future validation (currently unused)
  // const sku = useWatch({ control, name: 'sku' });
  const barcode = useWatch({ control, name: 'barcode' });
  const barcodeCanvasRef = useRef<HTMLCanvasElement>(null);
  // Fix Bug #100: Store timeout ID for cleanup
  const navigationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Fix Memory Leak: Store timeout refs for barcode and print operations
  const barcodeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const printTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);


  // Fix Bug #100 & Memory Leak: Cleanup all timeouts on unmount
  useEffect(() => {
    return () => {
      if (navigationTimeoutRef.current) {
        clearTimeout(navigationTimeoutRef.current);
        navigationTimeoutRef.current = null;
      }
      if (barcodeTimeoutRef.current) {
        clearTimeout(barcodeTimeoutRef.current);
        barcodeTimeoutRef.current = null;
      }
      if (printTimeoutRef.current) {
        clearTimeout(printTimeoutRef.current);
        printTimeoutRef.current = null;
      }
    };
  }, []);

  // Load existing store settings when editing
  useEffect(() => {
    if (existingStoreSettings && existingStoreSettings.length > 0) {
      const storeIds = existingStoreSettings.map(s => s.storeId);
      setSelectedStores(storeIds);
      const stockValues: Record<string, { stock: number; minQty: number }> = {};
      existingStoreSettings.forEach(s => {
        if (s.storeId) {
          stockValues[s.storeId] = {
            stock: s.currentStock || 0,
            minQty: s.minQty || 0,
          };
        }
      });
      setStoreStockValues(stockValues);
    }
  }, [existingStoreSettings]);

  useEffect(() => {
    if (item) {
      reset({
        sku: item.sku,
        name: item.name,
        description: item.description || '',
        unit: item.unit,
        barcode: item.barcode || '',
        costPrice: item.costPrice || 0,
        defaultUnitPrice: item.defaultUnitPrice,
        defaultTaxRate: item.defaultTaxRate || 0,
        currentStock: item.currentStock,
        reorderLevel: item.reorderLevel,
        maxStockLevel: item.maxStockLevel || 0,
        status: item.status,
        bundleSize: item.bundleSize,
        bundleUnit: item.bundleUnit || '',
        spacePerBundle: item.spacePerBundle,
        bundlesPerContainer: item.bundlesPerContainer,
        targetBundles: item.targetBundles,
        packSize: item.packSize,
        unitsPerContainer: item.unitsPerContainer,
        weeksSupplyTargetOverride: item.weeksSupplyTargetOverride,
        averageWeeklyUsage: item.averageWeeklyUsage,
      });
      
      // Render existing barcode if available
      if (item.barcode && barcodeCanvasRef.current) {
        // Fix Memory Leak: Clear any existing timeout before setting new one
        if (barcodeTimeoutRef.current) {
          clearTimeout(barcodeTimeoutRef.current);
        }
        
        barcodeTimeoutRef.current = setTimeout(async () => {
          try {
            const JsBarcode = (await import('jsbarcode')).default;
            JsBarcode(barcodeCanvasRef.current!, item.barcode!, {
              format: 'CODE128',
              width: 2,
              height: 60,
              displayValue: true,
              fontSize: 14,
              margin: 10,
            });
            barcodeTimeoutRef.current = null;
          } catch (error) {
            logger.error('Barcode rendering error:', error);
            barcodeTimeoutRef.current = null;
          }
        }, TIMEOUTS.BARCODE_RENDER_DELAY);
      }
    }
  }, [item, reset]);


  // Update barcode preview when barcode value changes
  useEffect(() => {
    if (barcode && barcodeCanvasRef.current) {
      (async () => {
        try {
          const JsBarcode = (await import('jsbarcode')).default;
          JsBarcode(barcodeCanvasRef.current!, barcode, {
            format: 'CODE128',
            width: 2,
            height: 60,
            displayValue: true,
            fontSize: 14,
            margin: 10,
          });
        } catch (error) {
          logger.error('Barcode preview error:', error);
        }
      })();
    }
  }, [barcode]);

  const generateBarcode = async () => {
    // Generate a professional, unique barcode that's completely independent of SKU
    // Format: Company Prefix (200) + Date (YYMMDD = 6) + Time (HHMMSS = 6) + Random (1) = 13 digits (EAN-13 compatible)
    // Example: 2002412251430257
    
    const companyPrefix = '200'; // InvoiceMe company prefix (3 digits)
    
    // Get current timestamp components
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2); // Last 2 digits of year
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    
    // Create date component (YYMMDD = 6 digits)
    const dateComponent = `${year}${month}${day}`;
    
    // Create time component (HHMMSS = 6 digits)
    const timeComponent = `${hours}${minutes}${seconds}`;
    
    // Add random digit for additional uniqueness (0-9)
    const randomDigit = Math.floor(Math.random() * 10).toString();
    
    // Combine: 200 + YYMMDD + HHMMSS + R = 13 digits (EAN-13 format)
    // This creates a unique numeric barcode like: 2002412251430257
    const barcodeValue = `${companyPrefix}${dateComponent}${timeComponent}${randomDigit}`;
    
    setValue('barcode', barcodeValue);
    
    // Render barcode preview - dynamically import jsbarcode
    if (barcodeCanvasRef.current) {
      try {
        const JsBarcode = (await import('jsbarcode')).default;
        JsBarcode(barcodeCanvasRef.current, barcodeValue, {
          format: 'CODE128',
          width: 2,
          height: 60,
          displayValue: true,
          fontSize: 14,
          margin: 10,
          background: '#ffffff',
          lineColor: '#000000',
        });
        showToast('Professional barcode generated successfully', 'success');
      } catch (error) {
        logger.error('Barcode generation error:', error);
        showToast('Barcode generated, but preview failed', 'warning');
      }
    } else {
      showToast('Professional barcode generated successfully', 'success');
    }
  };

  const downloadBarcode = () => {
    if (!barcodeCanvasRef.current || !barcode) return;
    
    try {
      const canvas = barcodeCanvasRef.current;
      const url = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `barcode-${barcode}.png`;
      link.href = url;
      link.click();
      showToast('Barcode downloaded successfully', 'success');
    } catch (error) {
      logger.error('Download error:', error);
      showToast(getErrorMessage(error, 'Failed to download barcode image', {
        operation: 'download',
        resource: 'barcode',
      }), 'error');
    }
  };

  const copyBarcode = async () => {
    if (!barcode) return;
    
    try {
      await navigator.clipboard.writeText(barcode);
      showToast('Barcode copied to clipboard', 'success');
    } catch (error) {
      logger.error('Copy error:', error);
      showToast(getErrorMessage(error, 'Failed to copy barcode to clipboard', {
        operation: 'copy',
        resource: 'barcode',
      }), 'error');
    }
  };

  const printBarcode = () => {
    if (!barcodeCanvasRef.current || !barcode) return;
    
    try {
      const canvas = barcodeCanvasRef.current;
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        // Escape barcode to prevent XSS
        const escapedBarcode = barcode.replace(/[<>&"']/g, (char) => {
          const map: Record<string, string> = {
            '<': '&lt;',
            '>': '&gt;',
            '&': '&amp;',
            '"': '&quot;',
            "'": '&#x27;',
          };
          return map[char] || char;
        });
        
        // Use safer DOM manipulation instead of document.write
        printWindow.document.open();
        printWindow.document.write('<!DOCTYPE html><html><head>');
        printWindow.document.write(`<title>Barcode - ${escapedBarcode}</title>`);
        printWindow.document.write(`
          <style>
            body {
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              margin: 0;
              font-family: Arial, sans-serif;
            }
            .barcode-container {
              text-align: center;
            }
            .barcode-label {
              margin-bottom: 10px;
              font-size: 16px;
              font-weight: bold;
            }
            img {
              max-width: 100%;
              height: auto;
            }
          </style>
        `);
        printWindow.document.write('</head><body>');
        printWindow.document.write('<div class="barcode-container">');
        printWindow.document.write(`<div class="barcode-label">Barcode: ${escapedBarcode}</div>`);
        printWindow.document.write(`<img src="${canvas.toDataURL('image/png')}" alt="Barcode" />`);
        printWindow.document.write('</div></body></html>');
        printWindow.document.close();
        printWindow.focus();
        
        // Fix Memory Leak: Clear any existing timeout before setting new one
        if (printTimeoutRef.current) {
          clearTimeout(printTimeoutRef.current);
        }
        
        printTimeoutRef.current = setTimeout(() => {
          try {
            printWindow.print();
            printWindow.close();
          } catch (error) {
            logger.error('Print window error:', error);
            printWindow.close();
          }
          printTimeoutRef.current = null;
        }, TIMEOUTS.PRINT_WINDOW_DELAY);
        
        // Note: Timeout cleanup is handled by browser when print window closes
        // No need for explicit cleanup as the timeout completes quickly (250ms)
      }
    } catch (error) {
      logger.error('Print error:', error);
      showToast(getErrorMessage(error, 'Failed to print barcode', {
        operation: 'print',
        resource: 'barcode',
      }), 'error');
    }
  };

  const clearBarcode = () => {
    setValue('barcode', '');
    if (barcodeCanvasRef.current) {
      const ctx = barcodeCanvasRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, barcodeCanvasRef.current.width, barcodeCanvasRef.current.height);
      }
    }
    showToast('Barcode cleared', 'info');
  };

  // Keyboard shortcuts
  useKeyboardShortcuts({
    shortcuts: [
      {
        key: 's',
        ctrl: true,
        meta: true,
        handler: () => {
          // Trigger form submission
          const form = document.querySelector('form');
          if (form) {
            const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
            form.dispatchEvent(submitEvent);
          }
        },
        description: 'Save inventory item',
        ignoreWhenTyping: true,
      },
    ],
  });

  const onSubmit = async (data: InventoryFormData) => {
    try {
      // Validate reorder level doesn't exceed max stock level
      if (data.maxStockLevel !== undefined && data.maxStockLevel !== null && 
          data.reorderLevel > data.maxStockLevel) {
        showToast('Reorder level cannot exceed maximum stock level', 'error');
        setError('reorderLevel', { 
          type: 'manual', 
          message: 'Reorder level cannot exceed maximum stock level' 
        });
        return;
      }

      // Validate current stock is not negative
      if (data.currentStock < 0) {
        showToast('Current stock cannot be negative', 'error');
        setError('currentStock', { 
          type: 'manual', 
          message: 'Current stock cannot be negative' 
        });
        return;
      }

      // Clean up NaN values from optional number fields - convert to undefined
      // Fix Bug #1: Replace 'any' with proper type
      const cleanedData: Partial<InventoryFormData> = { ...data };
      
      // List of optional number fields that should be undefined if NaN
      const optionalNumberFields = [
        'maxStockLevel',
        'bundleSize',
        'spacePerBundle',
        'bundlesPerContainer',
        'targetBundles',
        'packSize',
        'unitsPerContainer',
        'weeksSupplyTargetOverride',
        'averageWeeklyUsage',
      ];
      
      optionalNumberFields.forEach((field) => {
        const fieldValue = cleanedData[field as keyof InventoryFormData];
        if (fieldValue !== undefined && (typeof fieldValue === 'number' && (isNaN(fieldValue) || fieldValue === null))) {
          (cleanedData as any)[field] = undefined;
        } else if (fieldValue === null) {
          (cleanedData as any)[field] = undefined;
        }
      });
      
      let itemId = id;
      
      // Ensure required fields are present for CreateInventoryItemDto
      if (!cleanedData.sku || !cleanedData.name || !cleanedData.unit || 
          cleanedData.defaultUnitPrice === undefined || 
          cleanedData.currentStock === undefined || 
          cleanedData.reorderLevel === undefined || 
          !cleanedData.status) {
        showToast('Missing required fields: SKU, name, unit, default unit price, current stock, reorder level, and status are required', 'error');
        return;
      }
      
      if (isEdit && id) {
        // Get previous data for undo
        const previousItem = item;
        const updatedItem = await updateItem.mutateAsync({ id, data: cleanedData });
        itemId = id;
        showToast('Inventory item updated successfully', 'success');
        
        // Add undo operation for update
        if (previousItem) {
          createUpdateUndo(
            'inventory',
            `Item ${cleanedData.name}`,
            previousItem,
            async (prevItem) => {
              await inventoryApi.update(id, {
                sku: prevItem.sku,
                name: prevItem.name,
                description: prevItem.description,
                unit: prevItem.unit,
                defaultUnitPrice: prevItem.defaultUnitPrice,
                currentStock: prevItem.currentStock,
                reorderLevel: prevItem.reorderLevel,
                status: prevItem.status,
              });
              showToast(`Item ${prevItem.name} restored`, 'success');
            },
          );
        }
      } else {
        // Type assertion is safe here because we validated required fields above
        const newItem = await createItem.mutateAsync(cleanedData as CreateInventoryItemDto);
        itemId = newItem.id;
        showToast('Inventory item created successfully', 'success');
        
        // Add undo operation for create
        if (newItem && newItem.id) {
          createCreateUndo(
            'inventory',
            `Item ${cleanedData.name}`,
            newItem,
            async (createdItem) => {
              await inventoryApi.delete(createdItem.id);
              showToast(`Item ${createdItem.name} removed`, 'success');
            },
          );
        }
      }
      
      // Handle store assignments
      if (itemId && selectedStores.length > 0) {
        const storePromises = selectedStores.map(storeId => {
          const stockData = storeStockValues[storeId] || { stock: 0, minQty: 0 };
          return createStoreSettings.mutateAsync({
            storeId,
            inventoryItemId: itemId,
            currentStock: stockData.stock,
            minQty: stockData.minQty,
          }).catch((error) => {
            // Log individual store assignment errors but don't fail the entire operation
            logger.error(`Failed to assign item to store ${storeId}`, error);
            throw error; // Re-throw to be caught by Promise.allSettled
          });
        });
        
        // Use Promise.allSettled to handle individual failures gracefully
        const results = await Promise.allSettled(storePromises);
        const successful = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;
        
        if (failed === 0) {
          showToast(`Item ${isEdit ? 'updated' : 'created'} and assigned to ${successful} store(s)`, 'success');
        } else if (successful > 0) {
          showToast(`Item ${isEdit ? 'updated' : 'created'} and assigned to ${successful} store(s), ${failed} failed`, 'warning');
        } else {
          throw new Error('Failed to assign item to any stores');
        }
      }
      
      // Small delay to ensure query invalidation completes before navigation
      // Fix Bug #100: Store timeout ID for cleanup
      navigationTimeoutRef.current = setTimeout(() => {
        navigate('/inventory');
        navigationTimeoutRef.current = null;
      }, TIMEOUTS.NAVIGATION_DELAY);
    } catch (error: unknown) {
      // Use the imported getErrorMessage utility for consistent error handling
      const { getErrorMessage } = await import('../../utils/errorHandling');
      const errorMessage = getErrorMessage(error, 'An error occurred');
      
      // Check if it's a duplicate SKU error
      if (errorMessage.includes('SKU') && errorMessage.includes('already exists')) {
        showToast(errorMessage, 'error');
        // Set error on SKU field
        setError('sku', {
          type: 'manual',
          message: 'This SKU already exists. Please use a different SKU.',
        });
      } else {
        showToast(errorMessage, 'error');
      }
    }
  };

  if (isLoading) {
    return (
      <Box>
        <Skeleton variant="text" width={300} height={40} sx={{ mb: 3 }} />
        <Box display="flex" flexDirection="column" gap={3}>
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} variant="rectangular" width="100%" height={56} />
          ))}
        </Box>
      </Box>
    );
  }

  return (
    <ErrorBoundary>
      <Box>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 600, fontSize: '1.5rem' }}>
            {isEdit ? 'Edit Inventory Item' : 'Create Inventory Item'}
          </Typography>
        </Box>

        {/* Type assertion needed for form submit handler due to zod schema type inference */}
        <form onSubmit={handleSubmit(onSubmit as any)}>
          <Grid container spacing={3}>
            {/* Basic Information Section */}
            <Grid item xs={12}>
              <Paper 
                elevation={0}
                sx={{ 
                  p: 2, 
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                  bgcolor: 'background.paper',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                  <InventoryIcon color="primary" sx={{ fontSize: 20 }} />
                  <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1rem' }}>
                    Basic Information
                  </Typography>
                </Box>
                <Divider sx={{ mb: 2.5 }} />
                <Grid container spacing={2.5}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                size="small"
                label={
                  <span>
                    SKU <span style={{ color: '#d32f2f', marginLeft: '4px', fontSize: '12px', fontWeight: 'bold' }}>★</span>
                  </span>
                }
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <NumbersIcon fontSize="small" color="action" />
                    </InputAdornment>
                  ),
                }}
                {...register('sku', { required: 'SKU is required' })}
                error={!!errors.sku}
                helperText={errors.sku?.message}
                disabled={isEdit}
                InputLabelProps={{
                  required: false,
                }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                size="small"
                label={
                  <span>
                    Name <span style={{ color: '#d32f2f', marginLeft: '4px', fontSize: '12px', fontWeight: 'bold' }}>★</span>
                  </span>
                }
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <InventoryIcon fontSize="small" color="action" />
                    </InputAdornment>
                  ),
                }}
                {...register('name', { required: 'Name is required' })}
                error={!!errors.name}
                helperText={errors.name?.message}
                InputLabelProps={{
                  required: false,
                }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                size="small"
                label="Description"
                multiline
                rows={2}
                {...register('description')}
              />
            </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      size="small"
                      label={
                        <span>
                          Unit <span style={{ color: '#d32f2f', marginLeft: '4px', fontSize: '12px', fontWeight: 'bold' }}>★</span>
                        </span>
                      }
                      {...register('unit', { required: 'Unit is required' })}
                      error={!!errors.unit}
                      helperText={errors.unit?.message}
                      placeholder="pcs, box, hour, etc."
                      InputLabelProps={{
                        required: false,
                      }}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Barcode"
                      {...register('barcode')}
                      error={!!errors.barcode}
                      helperText={errors.barcode?.message || 'Generate a unique barcode for this item'}
                      InputLabelProps={{
                        shrink: !!barcode,
                      }}
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            <Tooltip title="Generate Barcode">
                              <IconButton
                                onClick={generateBarcode}
                                edge="end"
                                color="primary"
                                size="small"
                                sx={{ 
                                  '&:hover': {
                                    bgcolor: 'primary.light',
                                    color: 'white',
                                  }
                                }}
                              >
                                <QrCodeIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </InputAdornment>
                        ),
                      }}
                    />
                    {barcode && (
                      <Box 
                        sx={{ 
                          mt: 2, 
                          p: 2, 
                          bgcolor: 'background.paper', 
                          borderRadius: 1, 
                          border: '1px solid', 
                          borderColor: 'divider',
                        }}
                      >
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 500 }}>
                            Barcode Preview:
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 0.5 }}>
                            <Tooltip title="Copy Barcode">
                              <IconButton
                                size="small"
                                onClick={copyBarcode}
                                color="primary"
                                sx={{ 
                                  '&:hover': {
                                    bgcolor: 'primary.light',
                                    color: 'white',
                                  }
                                }}
                              >
                                <ContentCopyIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Download Barcode">
                              <IconButton
                                size="small"
                                onClick={downloadBarcode}
                                color="primary"
                                sx={{ 
                                  '&:hover': {
                                    bgcolor: 'primary.light',
                                    color: 'white',
                                  }
                                }}
                              >
                                <DownloadIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Print Barcode">
                              <IconButton
                                size="small"
                                onClick={printBarcode}
                                color="primary"
                                sx={{ 
                                  '&:hover': {
                                    bgcolor: 'primary.light',
                                    color: 'white',
                                  }
                                }}
                              >
                                <PrintIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Regenerate Barcode">
                              <IconButton
                                size="small"
                                onClick={generateBarcode}
                                color="primary"
                                sx={{ 
                                  '&:hover': {
                                    bgcolor: 'primary.light',
                                    color: 'white',
                                  }
                                }}
                              >
                                <RefreshIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Clear Barcode">
                              <IconButton
                                size="small"
                                onClick={clearBarcode}
                                color="error"
                                sx={{ 
                                  '&:hover': {
                                    bgcolor: 'error.light',
                                    color: 'white',
                                  }
                                }}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </Box>
                        <Box 
                          sx={{ 
                            display: 'flex', 
                            justifyContent: 'center', 
                            alignItems: 'center', 
                            bgcolor: 'white', 
                            p: 2, 
                            borderRadius: 1,
                            border: '1px solid',
                            borderColor: 'grey.300',
                            minHeight: 80,
                          }}
                        >
                          <canvas ref={barcodeCanvasRef} style={{ maxWidth: '100%', height: 'auto', display: 'block' }} />
                        </Box>
                      </Box>
                    )}
                  </Grid>
                </Grid>
              </Paper>
            </Grid>
            
            {/* Pricing & Stock Section */}
            <Grid item xs={12}>
              <Paper 
                elevation={0}
                sx={{ 
                  p: 2, 
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                  bgcolor: 'background.paper',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                  <AttachMoneyIcon color="primary" sx={{ fontSize: 20 }} />
                  <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1rem' }}>
                    Pricing & Stock
                  </Typography>
                </Box>
                <Divider sx={{ mb: 2.5 }} />
                <Grid container spacing={2.5}>
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      size="small"
                      label={
                        <span>
                          Cost Price <span style={{ color: '#d32f2f', marginLeft: '4px', fontSize: '12px', fontWeight: 'bold' }}>★</span>
                        </span>
                      }
                      type="number"
                      inputProps={{ step: '0.01' }}
                      {...register('costPrice', { 
                        required: 'Cost price is required',
                        valueAsNumber: true,
                        validate: (value: number | undefined) => {
                          if (value === undefined || value === null || isNaN(value)) {
                            return 'Cost price is required';
                          }
                          if (value < 0) {
                            return 'Cost price must be positive';
                          }
                          return true;
                        },
                      })}
                      error={!!errors.costPrice}
                      helperText={errors.costPrice?.message}
                      InputLabelProps={{
                        required: false,
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      size="small"
                      label={
                        <span>
                          Default Unit Price <span style={{ color: '#d32f2f', marginLeft: '4px', fontSize: '12px', fontWeight: 'bold' }}>★</span>
                        </span>
                      }
                      type="number"
                      inputProps={{ step: '0.01' }}
                      {...register('defaultUnitPrice', {
                        required: 'Default unit price is required',
                        valueAsNumber: true,
                      })}
                      error={!!errors.defaultUnitPrice}
                      helperText={errors.defaultUnitPrice?.message}
                      InputLabelProps={{
                        required: false,
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      size="small"
                      label={
                        <span>
                          Default Tax Rate (%) <span style={{ color: '#d32f2f', marginLeft: '4px', fontSize: '12px', fontWeight: 'bold' }}>★</span>
                        </span>
                      }
                      type="number"
                      inputProps={{ step: '0.01' }}
                      {...register('defaultTaxRate', { 
                        required: 'Default tax rate is required',
                        valueAsNumber: true,
                        validate: (value: number | undefined) => {
                          if (value === undefined || value === null || isNaN(value)) {
                            return 'Default tax rate is required';
                          }
                          if (value < 0) {
                            return 'Tax rate cannot be negative';
                          }
                          if (value > 100) {
                            return 'Tax rate cannot exceed 100%';
                          }
                          return true;
                        },
                      })}
                      error={!!errors.defaultTaxRate}
                      helperText={errors.defaultTaxRate?.message}
                      InputLabelProps={{
                        required: false,
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      size="small"
                      label={
                        <span>
                          Current Stock <span style={{ color: '#d32f2f', marginLeft: '4px', fontSize: '12px', fontWeight: 'bold' }}>★</span>
                        </span>
                      }
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <WarehouseIcon fontSize="small" color="action" />
                          </InputAdornment>
                        ),
                      }}
                      type="number"
                      {...register('currentStock', {
                        required: 'Current stock is required',
                        valueAsNumber: true,
                        min: { value: 0, message: 'Stock cannot be negative' },
                      })}
                      error={!!errors.currentStock}
                      helperText={errors.currentStock?.message}
                      InputLabelProps={{
                        required: false,
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      size="small"
                      label={
                        <span>
                          Reorder Level <span style={{ color: '#d32f2f', marginLeft: '4px', fontSize: '12px', fontWeight: 'bold' }}>★</span>
                        </span>
                      }
                      type="number"
                      {...register('reorderLevel', {
                        required: 'Reorder level is required',
                        valueAsNumber: true,
                        min: { value: 0, message: 'Reorder level cannot be negative' },
                      })}
                      error={!!errors.reorderLevel}
                      helperText={errors.reorderLevel?.message}
                      InputLabelProps={{
                        required: false,
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Max Stock Level"
                      type="number"
                      {...register('maxStockLevel', { valueAsNumber: true })}
                      helperText="Maximum stock level (optional)"
                      inputProps={{ min: 0 }}
                      InputLabelProps={{
                        required: false,
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth error={!!errors.status}>
                      <InputLabel>Status</InputLabel>
                      <Controller
                        name="status"
                        control={control}
                        rules={{ required: 'Status is required' }}
                        render={({ field }) => (
                          <Select
                            {...field}
                            label="Status"
                          >
                            <MenuItem value="active">Active</MenuItem>
                            <MenuItem value="inactive">Inactive</MenuItem>
                          </Select>
                        )}
                      />
                      {errors.status && (
                        <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.75 }}>
                          {errors.status.message}
                        </Typography>
                      )}
                    </FormControl>
                  </Grid>
                </Grid>
              </Paper>
            </Grid>

            {/* Store Assignment Section - Always visible */}
            <Grid item xs={12}>
              <Paper 
                sx={{ 
                  p: 3,
                  border: '2px solid',
                  borderColor: 'primary.main',
                  borderRadius: 2,
                  bgcolor: 'primary.50',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                  <StoreIcon color="primary" sx={{ fontSize: 24 }} />
                  <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1.1rem' }}>
                    Allocate to Stores
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
                    (Optional - Select stores and set initial stock levels)
                  </Typography>
                  {selectedStores.length > 0 && (
                    <Chip 
                      label={`${selectedStores.length} selected`}
                      size="small"
                      color="primary"
                      sx={{ ml: 'auto' }}
                    />
                  )}
                </Box>
                
                {!stores || stores.length === 0 ? (
                  <Alert severity="info" sx={{ mt: 2 }}>
                    <Typography variant="body2">
                      No stores available. Please create a store first before allocating inventory items.
                      <Button 
                        size="small" 
                        sx={{ ml: 1 }}
                        onClick={() => navigate('/stores/create')}
                      >
                        Create Store
                      </Button>
                    </Typography>
                  </Alert>
                ) : (
                  <Box sx={{ mt: 2 }}>
                    <Box sx={{ mb: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <TextField
                          fullWidth
                          size="small"
                          placeholder={`Search ${stores.length} stores by name or code...`}
                          value={storeSearchQuery}
                          onChange={(e) => {
                            setStoreSearchQuery(e.target.value);
                          }}
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">
                                <SearchIcon fontSize="small" color="action" />
                              </InputAdornment>
                            ),
                            endAdornment: storeSearchQuery && (
                              <InputAdornment position="end">
                                <IconButton
                                  size="small"
                                  onClick={() => {
                                    setStoreSearchQuery('');
                                  }}
                                  edge="end"
                                  aria-label="Clear search"
                                >
                                  <ClearIcon fontSize="small" />
                                </IconButton>
                              </InputAdornment>
                            ),
                          }}
                        />
                        {stores.length > 6 && (
                          <ToggleButtonGroup
                            value={storeViewMode}
                            exclusive
                            onChange={(_, newMode) => {
                              if (newMode !== null) setStoreViewMode(newMode);
                            }}
                            size="small"
                          >
                            <ToggleButton value="grid" aria-label="grid view">
                              <ViewModuleIcon fontSize="small" />
                            </ToggleButton>
                            <ToggleButton value="list" aria-label="list view">
                              <ViewListIcon fontSize="small" />
                            </ToggleButton>
                          </ToggleButtonGroup>
                        )}
                      </Box>
                    </Box>
                    <Grid container spacing={2}>
                      <Grid item xs={12}>
                        {(() => {
                    // Safety check - ensure stores is an array
                    if (!stores || !Array.isArray(stores) || stores.length === 0) {
                      return null;
                    }

                    // Filter stores based on search query
                    const filteredStores = stores.filter(store => {
                      if (!storeSearchQuery) return true;
                      const query = storeSearchQuery.toLowerCase();
                      return (
                        store.name?.toLowerCase().includes(query) ||
                        (store.code && store.code.toLowerCase().includes(query))
                      );
                    });

                    if (filteredStores.length === 0) {
                      return (
                        <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
                          <Typography color="text.secondary">
                            No stores found matching "{storeSearchQuery}"
                          </Typography>
                        </Paper>
                      );
                    }

                    // Show only first 6 stores initially, rest will be scrollable
                    const hasMoreStores = filteredStores.length > 6;
                    const allFilteredSelected = filteredStores.every(store => selectedStores.includes(store.id));
                    // Check if some filtered stores are selected (for potential future use)
                    // const someFilteredSelected = filteredStores.some(store => selectedStores.includes(store.id));

                    // List view (compact for many stores)
                    if (storeViewMode === 'list') {
                      return (
                        <Paper variant="outlined" sx={{ p: 2 }}>
                          {/* Select All / Deselect All for filtered results */}
                          {filteredStores.length > 1 && (
                            <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5} pb={1.5} borderBottom="1px solid" borderColor="divider">
                              <Typography variant="caption" color="text.secondary" fontWeight={500}>
                                {hasMoreStores 
                                  ? `Showing 6 of ${filteredStores.length} stores (scroll for more)`
                                  : `${filteredStores.length} store${filteredStores.length !== 1 ? 's' : ''} ${storeSearchQuery ? 'found' : 'available'}`
                                }
                              </Typography>
                              <Button
                                size="small"
                                startIcon={<SelectAllIcon />}
                                onClick={() => {
                                  if (allFilteredSelected) {
                                    // Deselect all filtered stores
                                    setSelectedStores(selectedStores.filter(id => !filteredStores.find(s => s.id === id)));
                                    const newValues = { ...storeStockValues };
                                    filteredStores.forEach(store => {
                                      delete newValues[store.id];
                                    });
                                    setStoreStockValues(newValues);
                                  } else {
                                    // Select all filtered stores
                                    const newStoreIds = filteredStores
                                      .filter(store => !selectedStores.includes(store.id))
                                      .map(store => store.id);
                                    setSelectedStores([...selectedStores, ...newStoreIds]);
                                    const newValues = { ...storeStockValues };
                                    filteredStores.forEach(store => {
                                      if (!newValues[store.id]) {
                                        newValues[store.id] = { stock: 0, minQty: 0 };
                                      }
                                    });
                                    setStoreStockValues(newValues);
                                  }
                                }}
                                variant={allFilteredSelected ? "outlined" : "contained"}
                              >
                                {allFilteredSelected ? 'Deselect All' : 'Select All'}
                              </Button>
                            </Box>
                          )}
                          <Box 
                            display="flex" 
                            flexDirection="column" 
                            gap={1}
                            sx={{
                              height: hasMoreStores ? '180px' : 'auto', // Fixed height to show exactly 6 stores
                              maxHeight: hasMoreStores ? '180px' : 'none',
                              minHeight: hasMoreStores ? '180px' : 'auto',
                              overflowY: hasMoreStores ? 'auto' : 'visible',
                              overflowX: 'hidden',
                              position: 'relative',
                              '&::-webkit-scrollbar': {
                                width: 8,
                              },
                              '&::-webkit-scrollbar-track': {
                                backgroundColor: 'grey.100',
                                borderRadius: 4,
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
                            {filteredStores.map((store) => {
                              const isSelected = selectedStores.includes(store.id);
                              return (
                                <Box
                                  key={store.id}
                                  sx={{
                                    p: 1.5,
                                    borderRadius: 1,
                                    border: isSelected ? 2 : 1,
                                    borderColor: isSelected ? 'primary.main' : 'divider',
                                    bgcolor: isSelected ? 'primary.50' : 'background.paper',
                                    transition: 'all 0.2s ease',
                                    cursor: 'pointer',
                                    '&:hover': {
                                      borderColor: 'primary.main',
                                      bgcolor: isSelected ? 'primary.50' : 'grey.50',
                                    },
                                  }}
                                  onClick={() => {
                                    if (!isSelected) {
                                      setSelectedStores([...selectedStores, store.id]);
                                      setStoreStockValues({
                                        ...storeStockValues,
                                        [store.id]: storeStockValues[store.id] || { stock: 0, minQty: 0 },
                                      });
                                    } else {
                                      setSelectedStores(selectedStores.filter(id => id !== store.id));
                                      const newValues = { ...storeStockValues };
                                      delete newValues[store.id];
                                      setStoreStockValues(newValues);
                                    }
                                  }}
                                >
                                  <Box display="flex" alignItems="center" gap={1}>
                                    <Checkbox
                                      checked={isSelected}
                                      onChange={(e) => {
                                        e.stopPropagation();
                                        if (e.target.checked) {
                                          setSelectedStores([...selectedStores, store.id]);
                                          setStoreStockValues({
                                            ...storeStockValues,
                                            [store.id]: storeStockValues[store.id] || { stock: 0, minQty: 0 },
                                          });
                                        } else {
                                          setSelectedStores(selectedStores.filter(id => id !== store.id));
                                          const newValues = { ...storeStockValues };
                                          delete newValues[store.id];
                                          setStoreStockValues(newValues);
                                        }
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                      size="small"
                                    />
                                    <StoreIcon 
                                      fontSize="small" 
                                      color={isSelected ? 'primary' : 'action'}
                                      sx={{ mr: 0.5 }}
                                    />
                                    <Box flex={1} minWidth={0}>
                                      <Box display="flex" alignItems="center" gap={1} mb={0.25}>
                                        <Typography 
                                          variant="body2" 
                                          fontWeight={isSelected ? 600 : 500}
                                          sx={{ 
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                            fontSize: '0.875rem',
                                          }}
                                        >
                                          {store.name}
                                        </Typography>
                                        {store.code && (
                                          <Chip 
                                            label={store.code} 
                                            size="small" 
                                            variant="outlined"
                                            sx={{ 
                                              height: 22, 
                                              fontSize: '0.7rem',
                                              fontWeight: 600,
                                              borderColor: isSelected ? 'primary.main' : 'divider',
                                              bgcolor: isSelected ? 'primary.lighter' : 'transparent',
                                            }}
                                          />
                                        )}
                                        {/* Active status removed - all stores are always active */}
                                      </Box>
                                    </Box>
                                    {isSelected && (
                                      <Box 
                                        display="flex" 
                                        gap={1} 
                                        ml="auto"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <TextField
                                          size="small"
                                          label="Stock"
                                          type="number"
                                          value={storeStockValues[store.id]?.stock || 0}
                                          onChange={(e) => {
                                            setStoreStockValues({
                                              ...storeStockValues,
                                              [store.id]: {
                                                ...storeStockValues[store.id],
                                                stock: parseInt(e.target.value) || 0,
                                              },
                                            });
                                          }}
                                          inputProps={{ min: 0 }}
                                          sx={{ width: 100 }}
                                        />
                                        <TextField
                                          size="small"
                                          label="Min Qty"
                                          type="number"
                                          value={storeStockValues[store.id]?.minQty || 0}
                                          onChange={(e) => {
                                            setStoreStockValues({
                                              ...storeStockValues,
                                              [store.id]: {
                                                ...storeStockValues[store.id],
                                                minQty: (() => {
                                                  const value = e.target.value.trim();
                                                  if (!value) return 0;
                                                  const parsed = parseInt(value, 10);
                                                  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
                                                })(),
                                              },
                                            });
                                          }}
                                          inputProps={{ min: 0 }}
                                          sx={{ width: 100 }}
                                        />
                                      </Box>
                                    )}
                                  </Box>
                                </Box>
                              );
                            })}
                          </Box>
                        </Paper>
                      );
                    }

                    // Grid view (default)
                    return (
                      <>
                        {/* Select All / Deselect All for filtered results */}
                        {filteredStores.length > 1 && (
                          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2} pb={1.5} borderBottom="1px solid" borderColor="divider">
                            <Typography variant="body2" color="text.secondary">
                              {filteredStores.length} store{filteredStores.length !== 1 ? 's' : ''} available
                            </Typography>
                            <Button
                              size="small"
                              startIcon={<SelectAllIcon />}
                              onClick={() => {
                                if (allFilteredSelected) {
                                  // Deselect all filtered stores
                                  setSelectedStores(selectedStores.filter(id => !filteredStores.find(s => s.id === id)));
                                  const newValues = { ...storeStockValues };
                                  filteredStores.forEach(store => {
                                    delete newValues[store.id];
                                  });
                                  setStoreStockValues(newValues);
                                } else {
                                  // Select all filtered stores
                                  const newStoreIds = filteredStores
                                    .filter(store => !selectedStores.includes(store.id))
                                    .map(store => store.id);
                                  setSelectedStores([...selectedStores, ...newStoreIds]);
                                  const newValues = { ...storeStockValues };
                                  filteredStores.forEach(store => {
                                    if (!newValues[store.id]) {
                                      newValues[store.id] = { stock: 0, minQty: 0 };
                                    }
                                  });
                                  setStoreStockValues(newValues);
                                }
                              }}
                              variant={allFilteredSelected ? "outlined" : "contained"}
                            >
                              {allFilteredSelected ? 'Deselect All' : 'Select All'}
                            </Button>
                          </Box>
                        )}
                        <Box
                          sx={{
                            height: hasMoreStores ? '220px' : 'auto', // Fixed height to show exactly 6 stores (2 rows of 3)
                            maxHeight: hasMoreStores ? '220px' : 'none',
                            minHeight: hasMoreStores ? '220px' : 'auto',
                            overflowY: hasMoreStores ? 'auto' : 'visible',
                            overflowX: 'hidden',
                            position: 'relative',
                            '&::-webkit-scrollbar': {
                              width: 8,
                            },
                            '&::-webkit-scrollbar-track': {
                              backgroundColor: 'grey.100',
                              borderRadius: 4,
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
                          <Grid container spacing={2}>
                            {filteredStores.map((store) => {
                      const isSelected = selectedStores.includes(store.id);
                      return (
                        <Grid item xs={12} sm={6} md={4} key={store.id}>
                          <Paper
                            variant="outlined"
                            sx={{
                              p: 2,
                              borderRadius: 2,
                              border: isSelected ? 2 : 1,
                              borderColor: isSelected ? 'primary.main' : 'divider',
                              bgcolor: isSelected ? 'primary.50' : 'background.paper',
                              transition: 'all 0.2s ease',
                              cursor: 'pointer',
                              '&:hover': {
                                borderColor: 'primary.main',
                                boxShadow: 1,
                              },
                            }}
                            onClick={() => {
                              if (!isSelected) {
                                setSelectedStores([...selectedStores, store.id]);
                                setStoreStockValues({
                                  ...storeStockValues,
                                  [store.id]: storeStockValues[store.id] || { stock: 0, minQty: 0 },
                                });
                              } else {
                                setSelectedStores(selectedStores.filter(id => id !== store.id));
                                const newValues = { ...storeStockValues };
                                delete newValues[store.id];
                                setStoreStockValues(newValues);
                              }
                            }}
                          >
                            <Box display="flex" alignItems="flex-start" gap={1.5}>
                              <Checkbox
                                checked={isSelected}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  if (e.target.checked) {
                                    setSelectedStores([...selectedStores, store.id]);
                                    setStoreStockValues({
                                      ...storeStockValues,
                                      [store.id]: storeStockValues[store.id] || { stock: 0, minQty: 0 },
                                    });
                                  } else {
                                    setSelectedStores(selectedStores.filter(id => id !== store.id));
                                    const newValues = { ...storeStockValues };
                                    delete newValues[store.id];
                                    setStoreStockValues(newValues);
                                  }
                                }}
                                onClick={(e) => e.stopPropagation()}
                                sx={{ mt: -1, ml: -1 }}
                              />
                              <Box flex={1} minWidth={0}>
                                <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                                  <StoreIcon 
                                    fontSize="small" 
                                    color={isSelected ? 'primary' : 'action'}
                                    sx={{ flexShrink: 0 }}
                                  />
                                  <Typography 
                                    variant="body1" 
                                    fontWeight={isSelected ? 600 : 500}
                                    sx={{ 
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    {store.name}
                                  </Typography>
                                </Box>
                                {store.code && (
                                  <Box display="flex" alignItems="center" gap={1} mb={1}>
                                    <Chip 
                                      label={store.code} 
                                      size="small" 
                                      variant="outlined"
                                      sx={{ 
                                        height: 20, 
                                        fontSize: '0.6875rem',
                                        borderColor: isSelected ? 'primary.main' : 'divider',
                                      }}
                                    />
                                    {/* Active status removed - all stores are always active */}
                                  </Box>
                                )}
                                {isSelected && (
                                  <Box 
                                    mt={1.5} 
                                    pt={1.5} 
                                    borderTop="1px solid"
                                    borderColor="divider"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <Grid container spacing={1.5}>
                                      <Grid item xs={6}>
                                        <TextField
                                          fullWidth
                                          size="small"
                                          label="Initial Stock"
                                          type="number"
                                          value={storeStockValues[store.id]?.stock || 0}
                                          onChange={(e) => {
                                            setStoreStockValues({
                                              ...storeStockValues,
                                              [store.id]: {
                                                ...storeStockValues[store.id],
                                                stock: parseInt(e.target.value) || 0,
                                              },
                                            });
                                          }}
                                          inputProps={{ min: 0 }}
                                          InputProps={{
                                            startAdornment: (
                                              <InputAdornment position="start">
                                                <WarehouseIcon fontSize="small" color="action" />
                                              </InputAdornment>
                                            ),
                                          }}
                                        />
                                      </Grid>
                                      <Grid item xs={6}>
                                        <TextField
                                          fullWidth
                                          size="small"
                                          label="Min Quantity"
                                          type="number"
                                          value={storeStockValues[store.id]?.minQty || 0}
                                          onChange={(e) => {
                                            setStoreStockValues({
                                              ...storeStockValues,
                                              [store.id]: {
                                                ...storeStockValues[store.id],
                                                minQty: (() => {
                                                  const value = e.target.value.trim();
                                                  if (!value) return 0;
                                                  const parsed = parseInt(value, 10);
                                                  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
                                                })(),
                                              },
                                            });
                                          }}
                                          inputProps={{ min: 0 }}
                                          InputProps={{
                                            startAdornment: (
                                              <InputAdornment position="start">
                                                <LabelIcon fontSize="small" color="action" />
                                              </InputAdornment>
                                            ),
                                          }}
                                        />
                                      </Grid>
                                    </Grid>
                                  </Box>
                                )}
                              </Box>
                            </Box>
                          </Paper>
                        </Grid>
                      );
                            })}
                          </Grid>
                        </Box>
                      </>
                    );
                        })()}
                      </Grid>
                    </Grid>
                  </Box>
                )}
              </Paper>
            </Grid>


            {/* Bundle / Pack Information Section - Collapsible */}
            <Grid item xs={12}>
              <Accordion 
                defaultExpanded={false}
                sx={{
                  '&:before': { display: 'none' },
                  boxShadow: 'none',
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 2,
                }}
              >
                <AccordionSummary 
                  expandIcon={<ExpandMoreIcon />}
                  sx={{
                    '&:hover': {
                      bgcolor: 'action.hover',
                    },
                  }}
                >
                  <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1rem' }}>
                    Bundle / Pack Information
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                    (Optional)
                  </Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ pt: 3 }}>
                  <Grid container spacing={2.5}>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="Bundle Size"
                        type="number"
                        {...register('bundleSize', { valueAsNumber: true })}
                        helperText="How many pieces per bundle (e.g. 50, 100)"
                        inputProps={{ min: 0 }}
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="Bundle Unit"
                        {...register('bundleUnit')}
                        placeholder="e.g. boxes, liners, pieces"
                        helperText="Unit for bundles"
                      />
                    </Grid>
                  </Grid>
                </AccordionDetails>
              </Accordion>
            </Grid>

            {/* Pack Size - Collapsible */}
            <Grid item xs={12}>
              <Accordion 
                defaultExpanded={false}
                sx={{
                  '&:before': { display: 'none' },
                  boxShadow: 'none',
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 2,
                }}
              >
                <AccordionSummary 
                  expandIcon={<ExpandMoreIcon />}
                  sx={{
                    '&:hover': {
                      bgcolor: 'action.hover',
                    },
                  }}
                >
                  <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1rem' }}>
                    Pack Size
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                    (Optional)
                  </Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ pt: 3 }}>
                  <Grid container spacing={2.5}>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="Pack Size"
                        type="number"
                        {...register('packSize', { valueAsNumber: true })}
                        helperText="Units per bundle/case (e.g. 50, 100, 1000)"
                        inputProps={{ min: 0 }}
                      />
                    </Grid>
                  </Grid>
                </AccordionDetails>
              </Accordion>
            </Grid>

            {/* Container Planning Section - Collapsible */}
            <Grid item xs={12}>
              <Accordion 
                defaultExpanded={false}
                sx={{
                  '&:before': { display: 'none' },
                  boxShadow: 'none',
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 2,
                }}
              >
                <AccordionSummary 
                  expandIcon={<ExpandMoreIcon />}
                  sx={{
                    '&:hover': {
                      bgcolor: 'action.hover',
                    },
                  }}
                >
                  <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1rem' }}>
                    Container Planning
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                    (Optional)
                  </Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ pt: 3 }}>
                  <Grid container spacing={2.5}>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="Units Per Container"
                        type="number"
                        {...register('unitsPerContainer', { valueAsNumber: true })}
                        helperText="Total units per container (e.g. 1000)"
                        inputProps={{ min: 0 }}
                      />
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <TextField
                        fullWidth
                        label="Space Per Bundle"
                        type="number"
                        inputProps={{ step: '0.01' }}
                        {...register('spacePerBundle', { valueAsNumber: true })}
                        helperText="Space column value"
                      />
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <TextField
                        fullWidth
                        label="Bundles Per Container"
                        type="number"
                        {...register('bundlesPerContainer', { valueAsNumber: true })}
                        helperText="Container fit value"
                        inputProps={{ min: 0 }}
                      />
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <TextField
                        fullWidth
                        label="Target Bundles"
                        type="number"
                        {...register('targetBundles', { valueAsNumber: true })}
                        helperText="Target bundles for planning"
                        inputProps={{ min: 0 }}
                      />
                    </Grid>
                  </Grid>
                </AccordionDetails>
              </Accordion>
            </Grid>

            {/* Planning & Supply Section - Collapsible */}
            <Grid item xs={12}>
              <Accordion 
                defaultExpanded={false}
                sx={{
                  '&:before': { display: 'none' },
                  boxShadow: 'none',
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 2,
                }}
              >
                <AccordionSummary 
                  expandIcon={<ExpandMoreIcon />}
                  sx={{
                    '&:hover': {
                      bgcolor: 'action.hover',
                    },
                  }}
                >
                  <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1rem' }}>
                    Planning & Supply
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                    (Optional - Advanced)
                  </Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ pt: 3 }}>
                  <Grid container spacing={2.5}>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="Weeks Supply Target Override"
                        type="number"
                        {...register('weeksSupplyTargetOverride', { valueAsNumber: true })}
                        helperText="Override global weeks supply target (leave empty to use global default)"
                        inputProps={{ min: 1, max: 52 }}
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="Average Weekly Usage"
                        type="number"
                        {...register('averageWeeklyUsage', { valueAsNumber: true })}
                        helperText="Average units used per week (for planning calculations)"
                        inputProps={{ step: '0.01', min: 0 }}
                      />
                    </Grid>
                  </Grid>
                </AccordionDetails>
              </Accordion>
            </Grid>

            {/* Action Buttons */}
            <Grid item xs={12}>
              <Box 
                display="flex" 
                gap={2} 
                justifyContent="flex-end" 
                sx={{ 
                  mt: 3,
                  pt: 3,
                  borderTop: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <Button 
                  variant="outlined" 
                  onClick={() => navigate('/inventory')}
                  disabled={createItem.isPending || updateItem.isPending}
                  size="large"
                  sx={{ minWidth: 120 }}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  variant="contained"
                  disabled={createItem.isPending || updateItem.isPending}
                  startIcon={(createItem.isPending || updateItem.isPending) ? <CircularProgress size={16} /> : null}
                  size="large"
                  sx={{ minWidth: 160 }}
                >
                  {isEdit ? 'Update Item' : 'Create Item'}
                </Button>
              </Box>
            </Grid>
          </Grid>
        </form>
      </Box>
    </ErrorBoundary>
  );
};

export default InventoryForm;

