import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Stepper,
  Step,
  StepLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  IconButton,
  Tooltip,
  Alert,
  LinearProgress,
  Chip,
  Divider,
  Select,
  MenuItem,
  FormControl,
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import CloseIcon from '@mui/icons-material/Close';
import DownloadIcon from '@mui/icons-material/Download';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import Collapse from '@mui/material/Collapse';
import { useCreateInventoryItem } from '../../hooks/useInventory';
import { useToast } from '../../contexts/ToastContext';
import { getErrorMessage } from '../../utils/errorHandling';
import type { CreateInventoryItemDto } from '../../api/inventory';
import { formatCurrency } from '../../utils/formatters';

type FieldErrors = Partial<Record<keyof CreateInventoryItemDto, string[]>>;

interface BulkItem extends Omit<Partial<CreateInventoryItemDto>, 'defaultUnitPrice' | 'currentStock' | 'reorderLevel'> {
  _id?: string; // Temporary ID for tracking
  _fieldErrors?: FieldErrors; // Field-specific validation errors
  _errors?: string[]; // General validation errors (for backward compatibility)
  _status?: 'pending' | 'success' | 'error'; // Status for batch creation
  // Note: 'shape' field is NOT in CreateInventoryItemDto, so we don't include it here
  // Allow empty string for numeric fields in UI state (coerced to number in DTO)
  defaultUnitPrice?: number | '';
  currentStock?: number | '';
  reorderLevel?: number | '';
}

interface BulkAddInventoryDialogProps {
  open: boolean;
  onClose: () => void;
}

const STEPS = ['Upload or Add Items', 'Review & Validate', 'Import Results'];

const CSV_TEMPLATE_HEADERS = [
  'SKU',
  'Name',
  'Description',
  'Unit',
  'Barcode',
  'Cost Price',
  'Unit Price',
  'Tax Rate (%)',
  'Current Stock',
  'Reorder Level',
  'Max Stock Level',
  'Status',
  'Size (inches)',
  'Material',
  'Print Type',
  'Flute Type',
  'Container Type',
];

export default function BulkAddInventoryDialog({ open, onClose }: BulkAddInventoryDialogProps) {
  const { showToast } = useToast();
  const createItem = useCreateInventoryItem();
  const [activeStep, setActiveStep] = useState(0);
  const [items, setItems] = useState<BulkItem[]>([]);
  const [importProgress, setImportProgress] = useState(0);
  const [importResults, setImportResults] = useState<{ success: number; errors: number; failedItems: BulkItem[] }>({
    success: 0,
    errors: 0,
    failedItems: [],
  });
  const [showReadme, setShowReadme] = useState(true);
  const [hasValidatedOnce, setHasValidatedOnce] = useState(false);
  const mountedRef = useRef(true);
  
  // Track mounted state to prevent state updates on unmounted component
  useEffect(() => {
    mountedRef.current = true;
    return () => { 
      mountedRef.current = false; 
    };
  }, []);

  // Check if import is in progress
  const isImporting = activeStep === 2 && importProgress < 100;

  // Reset when dialog opens/closes
  const handleClose = useCallback(() => {
    // Block close during import
    if (isImporting) {
      showToast('Please wait for import to complete before closing', 'warning');
      return;
    }
    setActiveStep(0);
    setItems([]);
    setImportProgress(0);
    setImportResults({ success: 0, errors: 0, failedItems: [] });
    setHasValidatedOnce(false);
    onClose();
  }, [onClose, isImporting, showToast]);

  // Helper validator that accepts an array (for CSV upload and import safety)
  const validateItemsArray = useCallback((arr: BulkItem[]): { ok: boolean; next: BulkItem[] } => {
    let hasErrors = false;

    // Count SKUs to detect duplicates within this batch (normalize to uppercase)
    const skuCounts = new Map<string, number>();
    arr.forEach((i) => {
      const sku = String(i.sku || '').trim().toUpperCase();
      if (sku) {
        skuCounts.set(sku, (skuCounts.get(sku) || 0) + 1);
      }
    });

    const next = arr.map((item) => {
      const fieldErrors: FieldErrors = {};
      const errors: string[] = [];

      const addErr = (field: keyof CreateInventoryItemDto, msg: string) => {
        (fieldErrors[field] ||= []).push(msg);
        errors.push(msg);
      };

      // Check required fields - normalize SKU to uppercase for consistent comparison
      const skuRaw = String(item.sku || '');
      const sku = skuRaw.trim().toUpperCase();
      if (!sku) {
        addErr('sku', 'SKU is required');
      } else {
        if (!/^[A-Za-z0-9_-]+$/.test(sku)) {
          addErr('sku', 'SKU can only contain letters, numbers, underscores, and hyphens');
        }
        // Check for duplicate SKU in this batch (using uppercase for comparison)
        if ((skuCounts.get(sku) || 0) > 1) {
          addErr('sku', 'Duplicate SKU in this import batch');
        }
      }

      if (!String(item.name || '').trim()) {
        addErr('name', 'Name is required');
      }

      if (!String(item.unit || '').trim()) {
        addErr('unit', 'Unit is required');
      }

      const p = item.defaultUnitPrice;
      if (p === '' || p == null) {
        addErr('defaultUnitPrice', 'Unit Price is required');
      } else {
        const numPrice = Number(p);
        if (!Number.isFinite(numPrice) || numPrice < 0) {
          addErr('defaultUnitPrice', 'Unit Price must be a valid non-negative number');
        }
      }

      const s = item.currentStock;
      if (s === '' || s == null) {
        addErr('currentStock', 'Current Stock is required');
      } else {
        const numStock = Number(s);
        if (!Number.isFinite(numStock) || numStock < 0) {
          addErr('currentStock', 'Current Stock must be a valid non-negative number');
        }
      }

      const r = item.reorderLevel;
      if (r === '' || r == null) {
        addErr('reorderLevel', 'Reorder Level is required');
      } else {
        const numReorder = Number(r);
        if (!Number.isFinite(numReorder) || numReorder < 0) {
          addErr('reorderLevel', 'Reorder Level must be a valid non-negative number');
        }
      }

      if (!item.status || !['active', 'inactive'].includes(item.status)) {
        addErr('status', 'Status must be "active" or "inactive"');
      }

      // Validate maxStockLevel as integer if provided
      if (item.maxStockLevel != null) {
        const n = Number(item.maxStockLevel);
        if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
          addErr('maxStockLevel', 'Max Stock Level must be a non-negative integer');
        }
      }

      if (errors.length > 0) hasErrors = true;

      // Update item with normalized SKU (uppercase) for consistent storage
      return { ...item, sku: sku, _fieldErrors: fieldErrors, _errors: errors };
    });

    return { ok: !hasErrors, next };
  }, []);

  // Improved CSV parser that handles quoted values
  const parseCSVLine = useCallback((line: string): string[] => {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];
      
      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          current += '"';
          i++; // Skip next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    return values;
  }, []);

  // Handle CSV file upload
  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv')) {
      showToast('Please upload a CSV file (.csv extension)', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        // Handle different line endings and remove BOM
        const cleanText = text.replace(/^\uFEFF/, '');
        const lines = cleanText.split(/\r?\n/).filter((line) => line.trim());
        
        // Check for unbalanced quotes (indicates multi-line cells or malformed CSV)
        const countQuotes = (s: string) => (s.match(/"/g) || []).length;
        const unbalancedLines = lines.filter(line => countQuotes(line) % 2 === 1);
        if (unbalancedLines.length > 0) {
          showToast(
            `CSV file contains ${unbalancedLines.length} line(s) with unbalanced quotes (possibly multi-line cells). Multi-line cells are not supported. Please fix the file and try again.`,
            'error'
          );
          return;
        }
        
        if (lines.length < 2) {
          showToast('CSV file must have at least a header row and one data row', 'error');
          return;
        }

        // Parse headers with improved parser
        const headers = parseCSVLine(lines[0]).map((h) => h.replace(/^"|"$/g, '').trim().toLowerCase());
        const parsedItems: BulkItem[] = [];

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue; // Skip empty lines
          
          const values = parseCSVLine(line).map((v) => v.replace(/^"|"$/g, '').trim());
          
          // Skip if all values are empty
          if (values.every(v => !v)) continue;
          
          const item: BulkItem = {
            _id: `temp-${Date.now()}-${i}`,
            _status: 'pending',
          };

          // Map CSV columns to item properties
          headers.forEach((header, index) => {
            const value = values[index] || '';
            const normalizedHeader = header.replace(/\s+/g, '').replace(/\(.*?\)/g, '');

            switch (normalizedHeader) {
              case 'sku':
                item.sku = value.toUpperCase();
                break;
              case 'name':
                item.name = value;
                break;
              case 'description':
                item.description = value || undefined;
                break;
              case 'unit':
                item.unit = value;
                break;
              case 'barcode':
                item.barcode = value || undefined;
                break;
              case 'costprice': {
                const raw = value.trim();
                const n = raw === '' ? undefined : parseFloat(raw);
                item.costPrice = Number.isFinite(n as number) ? (n as number) : undefined;
                break;
              }
              case 'unitprice': {
                const raw = value.trim();
                const n = raw === '' ? undefined : Number(raw);
                item.defaultUnitPrice = Number.isFinite(n as number) ? (n as number) : '';
                break;
              }
              case 'taxrate': {
                const raw = value.trim();
                const n = raw === '' ? undefined : parseFloat(raw);
                item.defaultTaxRate = Number.isFinite(n as number) ? (n as number) : undefined;
                break;
              }
              case 'currentstock': {
                const raw = value.trim();
                const n = raw === '' ? undefined : Number(raw);
                item.currentStock = Number.isFinite(n as number) ? (n as number) : '';
                break;
              }
              case 'reorderlevel': {
                const raw = value.trim();
                const n = raw === '' ? undefined : Number(raw);
                item.reorderLevel = Number.isFinite(n as number) ? (n as number) : '';
                break;
              }
              case 'maxstocklevel': {
                const raw = value.trim();
                if (raw === '') {
                  item.maxStockLevel = undefined;
                } else {
                  const n = Number(raw);
                  // Keep invalid values so validation can display a clear error
                  // Keep invalid values so validation can display a clear error
                  // Use undefined instead of NaN for cleaner type handling
                  item.maxStockLevel = Number.isFinite(n) ? n : undefined;
                }
                break;
              }
              case 'status':
                item.status = (String(value).toLowerCase() === 'inactive' ? 'inactive' : 'active') as 'active' | 'inactive';
                break;
              case 'sizeinches':
              case 'size':
                item.sizeInches = value || undefined;
                break;
              case 'material':
                item.material = value || undefined;
                break;
              // Note: 'shape' field is not supported in CreateInventoryItemDto, so we skip it
              // case 'shape': - removed as it's not in the DTO
              case 'printtype':
                item.printType = value || undefined;
                break;
              case 'flutetype':
                item.fluteType = value || undefined;
                break;
              case 'containertype':
                item.containerType = value || undefined;
                break;
            }
          });

          // Set defaults - use nullish checks to avoid resetting 0 values
          // Note: numeric fields that are '' (empty string) will be caught by validation
          if (!item.status) item.status = 'active';
          // Don't default numeric fields to 0 if they're '' - let validation catch them

          parsedItems.push(item);
        }

        if (parsedItems.length === 0) {
          showToast('No valid items found in CSV file', 'warning');
          return;
        }
        
        // Validate immediately after parsing to ensure Step 1 shows correct status
        const { next: validatedParsedItems } = validateItemsArray(parsedItems);
        setHasValidatedOnce(true);
        setItems(validatedParsedItems);
        setShowReadme(false); // Collapse README when moving to review
        setActiveStep(1);
        showToast(`Successfully parsed ${parsedItems.length} item(s) from CSV`, 'success');
      } catch (error: unknown) {
        showToast(`Failed to parse CSV: ${getErrorMessage(error, 'Unknown error')}`, 'error');
        // Error logging handled by logger utility if imported
      }
    };

    reader.onerror = () => {
      showToast('Failed to read file', 'error');
    };

    reader.readAsText(file);
    // Reset file input
    event.target.value = '';
  }, [showToast, parseCSVLine, validateItemsArray]);

  // Download CSV template with comprehensive example data
  const downloadTemplate = useCallback(() => {
    const headers = CSV_TEMPLATE_HEADERS.join(',');
    
    // Add comprehensive example rows showing different scenarios
    const exampleRows = [
      // Example 1: Complete product with all fields
      'PROD-001,Widget A,"High quality widget for industrial use, durable and reliable",Widgets,piece,1234567890123,5.00,10.00,10,100,50,200,active,"12x8x4",Cardboard,Color Print,B-Flute,Carton',
      // Example 2: Minimal required fields only
      'PROD-002,Widget B,,Widgets,piece,,,,10.50,75,30,,active,,,',
      // Example 3: Product with custom print and packaging details
      'PROD-003,Widget C,"Premium widget with custom branding",Electronics,box,9876543210987,12.50,25.00,8,50,20,100,active,"10x6x3",Plastic,Full Color,A-Flute,Box',
      // Example 4: Bulk item with bundle information
      'PROD-004,Widget D,"Economy pack of 12 units",Bulk Items,pack,5551234567890,8.00,15.00,5,200,100,500,active,"24x18x12",Cardboard,Black & White,C-Flute,Pallet',
      // Example 5: Inactive product example
      'PROD-005,Widget E,"Discontinued model, last stock",Legacy,piece,1112223334444,3.00,6.00,0,5,0,10,inactive,"8x5x2",Metal,None,,Box',
    ];
    
    // Create CSV content with BOM for Excel compatibility
    const csvContent = '\uFEFF' + headers + '\n' + exampleRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'inventory-bulk-import-template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
    showToast('Template downloaded successfully with 5 example rows', 'success');
  }, [showToast]);

  // Add manual entry row
  const handleAddRow = useCallback(() => {
    const newItem: BulkItem = {
      _id: `temp-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      sku: '',
      name: '',
      unit: 'piece',
      defaultUnitPrice: '',
      currentStock: '',
      reorderLevel: '',
      status: 'active',
      _status: 'pending',
    };
    setItems((prev) => [...prev, newItem]);
  }, []);

  // Remove row
  const handleRemoveRow = useCallback((id: string | undefined) => {
    if (!id) return;
    setItems((prev) => prev.filter((item) => item._id !== id));
  }, []);

  // Update item field
  const handleItemChange = useCallback((id: string | undefined, field: keyof BulkItem, value: unknown) => {
    setItems((prev) =>
      prev.map((item) => (item._id === id ? { ...item, [field]: value } : item))
    );
  }, []);

  // Validate items with field-level error tracking and duplicate SKU detection
  const validateItems = useCallback((): boolean => {
    const { ok, next } = validateItemsArray(items);
    setHasValidatedOnce(true);
    setItems(next);
    return ok;
  }, [items, validateItemsArray]);

  // Helper function for safe numeric conversion
  const toNum = useCallback((v: number | '' | undefined | null): number => {
    if (v === '' || v == null) return 0;
    const n = Number(v);
    if (!Number.isFinite(n)) {
      // Invalid number - return 0 silently
      return 0;
    }
    return n;
  }, []);

  // Strict numeric conversion that throws on invalid values (for DTO building after validation)
  const toNumStrict = useCallback((v: number | '' | undefined | null): number => {
    if (v === '' || v == null) return 0;
    const n = Number(v);
    if (!Number.isFinite(n)) {
      throw new Error(`Invalid number in DTO build: ${String(v)}`);
    }
    return n;
  }, []);

  // Debounced validation for Step 0 - live validation while typing
  // Optimize debounce for large datasets
  const validateTimer = useRef<number | null>(null);
  useEffect(() => {
    if (activeStep !== 0) return;
    if (items.length === 0) return;

    if (validateTimer.current) window.clearTimeout(validateTimer.current);

    // Increase debounce for large datasets to reduce lag
    const debounceMs = items.length > 200 ? 500 : 250;

    validateTimer.current = window.setTimeout(() => {
      validateItems();
    }, debounceMs);

    return () => {
      if (validateTimer.current) window.clearTimeout(validateTimer.current);
    };
  }, [items, activeStep, validateItems]);

  // Handle import
  const handleImport = useCallback(async () => {
    // Validate into a local array to avoid stale state issues
    const { ok, next: validatedItems } = validateItemsArray(items);
    setHasValidatedOnce(true);
    setItems(validatedItems);

    if (!ok) {
      showToast('Please fix validation errors before importing', 'error');
      return;
    }

    // Filter out invalid items as a safety measure (use validated array, not stale state)
    const safeItems = validatedItems.filter(i => !i._errors?.length);
    if (safeItems.length !== validatedItems.length) {
      const skipped = validatedItems.length - safeItems.length;
      showToast(`Skipped ${skipped} invalid item(s). Importing ${safeItems.length} valid item(s).`, 'warning');
    }

    if (safeItems.length === 0) {
      showToast('No valid items to import', 'error');
      return;
    }

    // Guard state updates to prevent warnings if component unmounts during navigation
    if (!mountedRef.current) return;

    setActiveStep(2);
    setImportProgress(0);
    setImportResults({ success: 0, errors: 0, failedItems: [] });

    const totalItems = safeItems.length;
    let successCount = 0;
    let errorCount = 0;
    const failed: BulkItem[] = [];

    for (let i = 0; i < safeItems.length; i++) {
      const item = safeItems[i];
      try {
        // Build DTO explicitly with only allowed fields from CreateInventoryItemDto
        // Use strict numeric conversion (validation should have caught any issues)
        const dto: CreateInventoryItemDto = {
          sku: String(item.sku).trim(),
          name: String(item.name).trim(),
          unit: String(item.unit).trim(),
          defaultUnitPrice: toNumStrict(item.defaultUnitPrice),
          currentStock: toNumStrict(item.currentStock),
          reorderLevel: toNumStrict(item.reorderLevel),
          status: item.status as 'active' | 'inactive',
          description: item.description || undefined,
          barcode: item.barcode || undefined,
          costPrice: item.costPrice ?? undefined,
          defaultTaxRate: item.defaultTaxRate ?? undefined,
          maxStockLevel: item.maxStockLevel ?? undefined,
          sizeInches: item.sizeInches || undefined,
          material: item.material || undefined,
          bundleSize: item.bundleSize ?? undefined,
          bundleUnit: item.bundleUnit || undefined,
          spacePerBundle: item.spacePerBundle ?? undefined,
          bundlesPerContainer: item.bundlesPerContainer ?? undefined,
          targetBundles: item.targetBundles ?? undefined,
          printType: item.printType || undefined,
          fluteType: item.fluteType || undefined,
          packSize: item.packSize ?? undefined,
          unitsPerContainer: item.unitsPerContainer ?? undefined,
          containerType: item.containerType || undefined,
          weeksSupplyTargetOverride: item.weeksSupplyTargetOverride ?? undefined,
          averageWeeklyUsage: item.averageWeeklyUsage ?? undefined,
        };
        
        // Strip undefined, null, and NaN fields to keep payload clean
        Object.keys(dto).forEach((k) => {
          const key = k as keyof typeof dto;
          const v = dto[key];
          if (v === undefined || v === null || (typeof v === 'number' && Number.isNaN(v))) {
            delete dto[key];
          }
        });
        
        await createItem.mutateAsync(dto);
        successCount++;
        if (mountedRef.current) {
          setItems((prev) =>
            prev.map((it) => (it._id === item._id ? { ...it, _status: 'success' } : it))
          );
        }
      } catch (error: unknown) {
        errorCount++;
        failed.push({ ...item, _errors: [getErrorMessage(error, 'Unknown error')] });
        if (mountedRef.current) {
          setItems((prev) =>
            prev.map((it) => (it._id === item._id ? { ...it, _status: 'error' } : it))
          );
        }
      }

      // Prevent state updates if component is unmounted
      if (mountedRef.current) {
        setImportProgress(((i + 1) / totalItems) * 100);
        setImportResults({ success: successCount, errors: errorCount, failedItems: failed });
      }
    }

    // Prevent state updates and toasts if component is unmounted
    if (!mountedRef.current) return;

    if (errorCount === 0) {
      showToast(`Successfully imported ${successCount} item(s)`, 'success');
    } else {
      showToast(`Imported ${successCount} item(s), ${errorCount} failed`, 'warning');
    }
  }, [items, validateItemsArray, createItem, showToast, toNumStrict]);

  return (
    <Dialog open={open} onClose={isImporting ? undefined : handleClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h5" fontWeight={600}>
            Bulk Add Inventory Items
          </Typography>
          <IconButton onClick={handleClose} size="small" disabled={isImporting}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Stepper activeStep={activeStep} sx={{ mb: 3, mt: 2 }}>
          {STEPS.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {activeStep === 0 && (
          <Box>
            {/* README Section */}
            <Paper 
              sx={{ 
                mb: 3, 
                p: 2, 
                bgcolor: 'primary.50',
                border: '1px solid',
                borderColor: 'primary.200',
              }}
            >
              <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                <Box display="flex" alignItems="center" gap={1}>
                  <HelpOutlineIcon color="primary" />
                  <Typography variant="h6" fontWeight={600} color="primary.main">
                    How to Use Bulk Add
                  </Typography>
                </Box>
                <IconButton
                  size="small"
                  onClick={() => setShowReadme(!showReadme)}
                  sx={{ color: 'primary.main' }}
                >
                  {showReadme ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </IconButton>
              </Box>
              
              <Collapse in={showReadme}>
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" paragraph sx={{ fontWeight: 600, color: 'text.primary' }}>
                    What is Bulk Add?
                  </Typography>
                  <Typography variant="body2" paragraph sx={{ color: 'text.secondary', pl: 2 }}>
                    Bulk Add allows you to import multiple inventory items at once, perfect for when you receive containers, 
                    shipments, or need to set up many items quickly. This saves time by avoiding manual entry for each item.
                  </Typography>

                  <Typography variant="body2" paragraph sx={{ fontWeight: 600, color: 'text.primary', mt: 2 }}>
                    Two Ways to Add Items:
                  </Typography>
                  
                  <Box component="ol" sx={{ pl: 4, mb: 2 }}>
                    <li>
                      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
                        <strong>CSV Upload (Recommended for 10+ items):</strong>
                      </Typography>
                      <Box component="ul" sx={{ pl: 3, mb: 2 }}>
                        <li><Typography variant="body2" sx={{ color: 'text.secondary' }}>Download the template CSV below (includes 5 example rows showing different scenarios)</Typography></li>
                        <li><Typography variant="body2" sx={{ color: 'text.secondary' }}>Fill in your inventory data in Excel or Google Sheets (replace example rows with your data)</Typography></li>
                        <li><Typography variant="body2" sx={{ color: 'text.secondary' }}>Upload the completed CSV file</Typography></li>
                        <li><Typography variant="body2" sx={{ color: 'text.secondary' }}>Review and validate your items</Typography></li>
                        <li><Typography variant="body2" sx={{ color: 'text.secondary' }}>Import all items at once</Typography></li>
                      </Box>
                    </li>
                    <li>
                      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
                        <strong>Manual Entry (For a few items):</strong>
                      </Typography>
                      <Box component="ul" sx={{ pl: 3, mb: 2 }}>
                        <li><Typography variant="body2" sx={{ color: 'text.secondary' }}>Click "Add Item Manually"</Typography></li>
                        <li><Typography variant="body2" sx={{ color: 'text.secondary' }}>Fill in the required fields (marked with *)</Typography></li>
                        <li><Typography variant="body2" sx={{ color: 'text.secondary' }}>Add more rows as needed</Typography></li>
                        <li><Typography variant="body2" sx={{ color: 'text.secondary' }}>Review and import</Typography></li>
                      </Box>
                    </li>
                  </Box>

                  <Typography variant="body2" paragraph sx={{ fontWeight: 600, color: 'text.primary', mt: 2 }}>
                    Required Fields (marked with *):
                  </Typography>
                  <Box component="ul" sx={{ pl: 4, mb: 2 }}>
                    <li><Typography variant="body2" sx={{ color: 'text.secondary' }}><strong>SKU:</strong> Unique product code (letters, numbers, hyphens, underscores only)</Typography></li>
                    <li><Typography variant="body2" sx={{ color: 'text.secondary' }}><strong>Name:</strong> Product name</Typography></li>
                    <li><Typography variant="body2" sx={{ color: 'text.secondary' }}><strong>Unit:</strong> Unit of measure (e.g., piece, box, kg, hour)</Typography></li>
                    <li><Typography variant="body2" sx={{ color: 'text.secondary' }}><strong>Unit Price:</strong> Selling price (must be ≥ 0)</Typography></li>
                    <li><Typography variant="body2" sx={{ color: 'text.secondary' }}><strong>Stock:</strong> Current stock quantity (must be ≥ 0)</Typography></li>
                    <li><Typography variant="body2" sx={{ color: 'text.secondary' }}><strong>Reorder Level:</strong> Minimum stock level before reordering (must be ≥ 0)</Typography></li>
                    <li><Typography variant="body2" sx={{ color: 'text.secondary' }}><strong>Status:</strong> "active" or "inactive"</Typography></li>
                  </Box>

                  <Alert severity="info" sx={{ mt: 2 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                      💡 CSV Format Tips:
                    </Typography>
                    <Box component="ul" sx={{ pl: 3, m: 0 }}>
                      <li><Typography variant="body2" sx={{ fontSize: '0.875rem' }}>Use quotes for fields containing commas: <code>"High quality, durable widget"</code></Typography></li>
                      <li><Typography variant="body2" sx={{ fontSize: '0.875rem' }}>Multi-line cells are not supported - keep each row on a single line</Typography></li>
                      <li><Typography variant="body2" sx={{ fontSize: '0.875rem' }}>The template includes 5 example rows showing different use cases</Typography></li>
                    </Box>
                  </Alert>
                </Box>
              </Collapse>
            </Paper>

            <Alert severity="info" sx={{ mb: 3 }}>
              <Box>
                <Typography variant="body2" fontWeight={600} gutterBottom>
                  Quick Start:
                </Typography>
                <Typography variant="body2">
                  • Download the template CSV to see the format with examples
                  • Upload your CSV file OR click "Add Item Manually" to enter items one by one
                  • All items will be validated before import to ensure data quality
                </Typography>
              </Box>
            </Alert>

            <Box display="flex" gap={2} mb={3} flexWrap="wrap">
              <Box flex={1} minWidth={300}>
                <Paper sx={{ p: 2, textAlign: 'center', border: '2px dashed', borderColor: 'divider' }}>
                  <UploadFileIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                  <Typography variant="h6" gutterBottom>
                    Upload CSV File
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Import multiple items at once from a CSV file
                  </Typography>
                  <input
                    accept=".csv"
                    style={{ display: 'none' }}
                    id="csv-upload-input"
                    type="file"
                    onChange={handleFileUpload}
                  />
                  <label htmlFor="csv-upload-input">
                    <Button variant="outlined" component="span" startIcon={<UploadFileIcon />}>
                      Choose CSV File
                    </Button>
                  </label>
                </Paper>
              </Box>
              <Box flex={1} minWidth={300}>
                <Paper sx={{ p: 2, textAlign: 'center', border: '2px dashed', borderColor: 'divider' }}>
                  <DownloadIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                  <Typography variant="h6" gutterBottom>
                    Download Template
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Get a CSV template with all available columns and 5 example rows showing different use cases
                  </Typography>
                  <Button variant="outlined" startIcon={<DownloadIcon />} onClick={downloadTemplate}>
                    Download Template
                  </Button>
                </Paper>
              </Box>
            </Box>

            <Divider sx={{ my: 3 }}>
              <Typography variant="body2" color="text.secondary">
                OR
              </Typography>
            </Divider>

            <Box mb={2}>
              <Button variant="contained" startIcon={<AddIcon />} onClick={handleAddRow}>
                Add Item Manually
              </Button>
            </Box>

            {items.length > 0 && (
              <Box>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography variant="body2" color="text.secondary">
                    {items.length} item(s) added. Fill in all required fields (*) before proceeding.
                  </Typography>
                  <Button
                    size="small"
                    variant="outlined"
                    color="error"
                    startIcon={<DeleteIcon />}
                    onClick={() => setItems([])}
                    disabled={items.length === 0}
                  >
                    Clear All
                  </Button>
                </Box>
                <TableContainer component={Paper} sx={{ maxHeight: 500, overflow: 'auto' }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow sx={{ bgcolor: 'grey.50' }}>
                        <TableCell sx={{ fontWeight: 700, minWidth: 120 }}>SKU *</TableCell>
                        <TableCell sx={{ fontWeight: 700, minWidth: 150 }}>Name *</TableCell>
                        <TableCell sx={{ fontWeight: 700, minWidth: 100 }}>Unit *</TableCell>
                        <TableCell sx={{ fontWeight: 700, minWidth: 110 }}>Unit Price *</TableCell>
                        <TableCell sx={{ fontWeight: 700, minWidth: 100 }}>Stock *</TableCell>
                        <TableCell sx={{ fontWeight: 700, minWidth: 110 }}>Reorder *</TableCell>
                        <TableCell sx={{ fontWeight: 700, minWidth: 100 }}>Status *</TableCell>
                        <TableCell sx={{ fontWeight: 700, minWidth: 100 }}>Description</TableCell>
                        <TableCell sx={{ fontWeight: 700, width: 80 }}>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {items.map((item) => {
                        const hasErrors = item._errors && item._errors.length > 0;
                        const isValid =
                          hasValidatedOnce &&
                          !hasErrors &&
                          !!String(item.sku || '').trim() &&
                          !!String(item.name || '').trim() &&
                          !!String(item.unit || '').trim() &&
                          item.defaultUnitPrice !== '' &&
                          item.currentStock !== '' &&
                          item.reorderLevel !== '';
                        return (
                          <TableRow 
                            key={item._id}
                            sx={{
                              bgcolor: hasErrors ? 'error.50' : 'inherit',
                              '&:hover': { bgcolor: hasErrors ? 'error.100' : 'action.hover' },
                            }}
                          >
                            <TableCell>
                              <Box display="flex" alignItems="center" gap={1}>
                                {isValid && (
                                  <Chip
                                    label="✓"
                                    size="small"
                                    color="success"
                                    sx={{
                                      height: 18,
                                      width: 18,
                                      minWidth: 18,
                                      fontSize: '0.7rem',
                                      p: 0,
                                      '& .MuiChip-label': { px: 0 },
                                    }}
                                  />
                                )}
                                {hasErrors && (
                                  <Chip
                                    label="!"
                                    size="small"
                                    color="error"
                                    sx={{
                                      height: 18,
                                      width: 18,
                                      minWidth: 18,
                                      fontSize: '0.7rem',
                                      p: 0,
                                      '& .MuiChip-label': { px: 0 },
                                    }}
                                  />
                                )}
                                <TextField
                                  size="small"
                                  fullWidth
                                  placeholder="PROD-001"
                                  value={item.sku || ''}
                                  onChange={(e) => handleItemChange(item._id, 'sku', e.target.value.toUpperCase())}
                                  error={!!item._fieldErrors?.sku?.length}
                                  helperText={item._fieldErrors?.sku?.[0]?.substring(0, 50)}
                                />
                              </Box>
                            </TableCell>
                            <TableCell>
                              <TextField
                                size="small"
                                fullWidth
                                placeholder="Product Name"
                                value={item.name || ''}
                                onChange={(e) => handleItemChange(item._id, 'name', e.target.value)}
                                error={!!item._fieldErrors?.name?.length}
                                helperText={item._fieldErrors?.name?.[0]?.substring(0, 50)}
                              />
                            </TableCell>
                            <TableCell>
                              <TextField
                                size="small"
                                fullWidth
                                placeholder="piece"
                                value={item.unit || 'piece'}
                                onChange={(e) => handleItemChange(item._id, 'unit', e.target.value)}
                                error={!!item._fieldErrors?.unit?.length}
                                helperText={item._fieldErrors?.unit?.[0]?.substring(0, 50)}
                              />
                            </TableCell>
                            <TableCell>
                              <TextField
                                size="small"
                                fullWidth
                                type="number"
                                inputProps={{ min: 0, step: 0.01 }}
                                value={item.defaultUnitPrice ?? ''}
                                onChange={(e) => {
                                  const raw = e.target.value;
                                  handleItemChange(item._id, 'defaultUnitPrice', raw === '' ? '' : Number(raw));
                                }}
                                error={!!item._fieldErrors?.defaultUnitPrice?.length}
                                helperText={item._fieldErrors?.defaultUnitPrice?.[0]?.substring(0, 50)}
                              />
                            </TableCell>
                            <TableCell>
                              <TextField
                                size="small"
                                fullWidth
                                type="number"
                                inputProps={{ min: 0 }}
                                value={item.currentStock ?? ''}
                                onChange={(e) => {
                                  const raw = e.target.value;
                                  handleItemChange(item._id, 'currentStock', raw === '' ? '' : Number(raw));
                                }}
                                error={!!item._fieldErrors?.currentStock?.length}
                                helperText={item._fieldErrors?.currentStock?.[0]?.substring(0, 50)}
                              />
                            </TableCell>
                            <TableCell>
                              <TextField
                                size="small"
                                fullWidth
                                type="number"
                                inputProps={{ min: 0 }}
                                value={item.reorderLevel ?? ''}
                                onChange={(e) => {
                                  const raw = e.target.value;
                                  handleItemChange(item._id, 'reorderLevel', raw === '' ? '' : Number(raw));
                                }}
                                error={!!item._fieldErrors?.reorderLevel?.length}
                                helperText={item._fieldErrors?.reorderLevel?.[0]?.substring(0, 50)}
                              />
                            </TableCell>
                            <TableCell>
                              <FormControl size="small" fullWidth>
                                <Select
                                  value={item.status || 'active'}
                                  onChange={(e) => handleItemChange(item._id, 'status', e.target.value)}
                                  error={!!item._fieldErrors?.status?.length}
                                >
                                  <MenuItem value="active">Active</MenuItem>
                                  <MenuItem value="inactive">Inactive</MenuItem>
                                </Select>
                              </FormControl>
                            </TableCell>
                            <TableCell>
                              <TextField
                                size="small"
                                fullWidth
                                placeholder="Optional"
                                value={item.description || ''}
                                onChange={(e) => handleItemChange(item._id, 'description', e.target.value)}
                                multiline
                                maxRows={2}
                              />
                            </TableCell>
                            <TableCell>
                              <Tooltip title="Remove this item">
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => handleRemoveRow(item._id)}
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
                {items.some((item) => item._errors && item._errors.length > 0) && (
                  <Alert severity="warning" sx={{ mt: 2 }}>
                    Some items have validation errors. Please fix them before proceeding.
                  </Alert>
                )}
              </Box>
            )}

            {items.length === 0 && (
              <Box textAlign="center" py={4}>
                <Typography variant="body1" color="text.secondary">
                  Upload a CSV file or click "Add Item Manually" to get started
                </Typography>
              </Box>
            )}
          </Box>
        )}

        {activeStep === 1 && (
          <Box>
            <Alert severity="warning" sx={{ mb: 3 }}>
              Please review all items below. Items with errors will be highlighted and cannot be imported.
            </Alert>

            <TableContainer component={Paper} sx={{ maxHeight: 500, overflow: 'auto' }}>
              <Table stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>SKU</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Unit</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Unit Price</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Stock</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Errors</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.map((item) => {
                    const hasErrors = item._errors && item._errors.length > 0;
                    return (
                      <TableRow
                        key={item._id}
                        sx={{
                          bgcolor: hasErrors ? 'error.50' : 'inherit',
                        }}
                      >
                        <TableCell>{item.sku}</TableCell>
                        <TableCell>{item.name}</TableCell>
                        <TableCell>{item.unit}</TableCell>
                        <TableCell>{formatCurrency(toNum(item.defaultUnitPrice))}</TableCell>
                        <TableCell>{toNum(item.currentStock).toLocaleString()}</TableCell>
                        <TableCell>
                          <Chip
                            label={item.status || 'active'}
                            size="small"
                            color={item.status === 'active' ? 'success' : 'default'}
                          />
                        </TableCell>
                        <TableCell>
                          {hasErrors ? (
                            <Box>
                              <Box display="flex" alignItems="center" gap={0.5} flexWrap="wrap">
                                <ErrorIcon color="error" fontSize="small" />
                                <Typography variant="caption" color="error" sx={{ display: 'block' }}>
                                  {item._errors?.[0]}
                                  {item._errors && item._errors.length > 1 ? ` (+${item._errors.length - 1} more)` : ''}
                                </Typography>
                              </Box>
                              {item._errors && item._errors.length > 1 && (
                                <Tooltip
                                  arrow
                                  title={
                                    <Box>
                                      {item._errors.map((err, idx) => (
                                        <Typography key={idx} variant="caption" sx={{ display: 'block', mb: 0.5 }}>
                                          {err}
                                        </Typography>
                                      ))}
                                    </Box>
                                  }
                                >
                                  <IconButton 
                                    size="small" 
                                    sx={{ 
                                      p: 0.25, 
                                      mt: 0.5,
                                      '&:hover': { bgcolor: 'error.50' }
                                    }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      // Could expand to show all errors inline if needed
                                    }}
                                  >
                                    <ErrorIcon color="error" fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              )}
                            </Box>
                          ) : (
                            <CheckCircleIcon color="success" fontSize="small" />
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {activeStep === 2 && (
          <Box>
            <Box mb={3}>
              <Typography variant="h6" gutterBottom>
                Import Progress
              </Typography>
              <LinearProgress variant="determinate" value={importProgress} sx={{ height: 8, borderRadius: 4 }} />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {Math.round(importProgress)}% complete
              </Typography>
            </Box>

            {importProgress === 100 && (
              <Alert
                severity={importResults.errors === 0 ? 'success' : 'warning'}
                sx={{ mb: 3 }}
              >
                <Typography variant="h6" gutterBottom>
                  Import Complete!
                </Typography>
                <Typography>
                  Successfully imported: <strong>{importResults.success}</strong> items
                  {importResults.errors > 0 && (
                    <> | Failed: <strong>{importResults.errors}</strong> items</>
                  )}
                </Typography>
              </Alert>
            )}

            {importResults.failedItems.length > 0 && (
              <Box mt={3}>
                <Typography variant="h6" gutterBottom color="error">
                  Failed Items
                </Typography>
                <TableContainer component={Paper}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700 }}>SKU</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Error</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {importResults.failedItems.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{item.sku}</TableCell>
                          <TableCell>{item.name}</TableCell>
                          <TableCell>
                            <Typography variant="body2" color="error">
                              {item._errors?.join(', ')}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={isImporting || createItem.isPending}>
          {activeStep === 2 && importProgress === 100 ? 'Close' : 'Cancel'}
        </Button>
        {activeStep === 0 && items.length > 0 && (
          <Button
            variant="contained"
            onClick={() => {
              setShowReadme(false); // Collapse README when moving to review
              validateItems();
              setActiveStep(1);
            }}
          >
            Review & Validate
          </Button>
        )}
        {activeStep === 1 && (() => {
          const invalidCount = items.filter(i => i._errors?.length).length;
          const validCount = items.length - invalidCount;
          return (
            <Box>
              <Button variant="contained" onClick={handleImport} disabled={createItem.isPending || validCount === 0}>
                Import {validCount} Item{validCount === 1 ? '' : 's'}
              </Button>
              {invalidCount > 0 && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block', textAlign: 'center' }}>
                  {invalidCount} will be skipped
                </Typography>
              )}
            </Box>
          );
        })()}
        {activeStep === 2 && importProgress === 100 && (
          <Button variant="contained" onClick={handleClose}>
            Done
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

