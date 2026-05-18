import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { useToast } from '../../contexts/ToastContext';
import { useSettingsContext } from '../../contexts/SettingsContext';
import {
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  IconButton,
  Alert,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Divider,
  CircularProgress,
  Checkbox,
  FormControlLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Chip,
  InputAdornment,
} from '@mui/material';
import WarningIcon from '@mui/icons-material/Warning';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FileCopyIcon from '@mui/icons-material/FileCopy';
import EmailIcon from '@mui/icons-material/Email';
import PhoneIcon from '@mui/icons-material/Phone';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import SearchIcon from '@mui/icons-material/Search';
import SortIcon from '@mui/icons-material/Sort';
import DescriptionIcon from '@mui/icons-material/Description';
import PersonIcon from '@mui/icons-material/Person';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import FirstPageIcon from '@mui/icons-material/FirstPage';
import LastPageIcon from '@mui/icons-material/LastPage';
import { useInvoice, useCreateInvoice, useUpdateInvoice, useInvoices } from '../../hooks/useInvoices';
import { useClients, useClient } from '../../hooks/useClients';
import { useStores } from '../../hooks/useStore';
import { useStoreStocks } from '../../hooks/useStoreStock';
import InventorySelect from '../../components/inventory/InventorySelect';
import type { InventoryItem } from '../../types/inventory';
import type { Invoice, InvoiceItem } from '../../types/invoice';
import { computeInvoiceTotalsCents, invoiceTotalsToMoney, centsToMoney } from '../../utils/invoice-totals.util';
import { formatCurrency } from '../../utils/formatters';
import { formatDate } from '../../utils/dates';
import { getErrorMessage } from '../../utils/errorHandling';
import Grid from '../../components/common/Grid';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { useFormAutosave } from '../../hooks/useFormAutosave';

interface InvoiceItemForm {
  inventoryItemId?: string;
  inventoryItem?: InventoryItem | null;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  discountRate: number;
}

interface InvoiceFormData {
  clientId: string;
  storeId?: string;
  type: 'invoice'; // Only invoices, no estimates
  issueDate: string;
  dueDate?: string;
  currency: string;
  notes?: string;
  items: InvoiceItemForm[];
}

// Currency options list (matching Settings.tsx)
const CURRENCIES = [
  { value: 'USD', label: 'USD - US Dollar ($)' },
  { value: 'EUR', label: 'EUR - Euro (€)' },
  { value: 'GBP', label: 'GBP - British Pound (£)' },
  { value: 'JPY', label: 'JPY - Japanese Yen (¥)' },
  { value: 'AUD', label: 'AUD - Australian Dollar (A$)' },
  { value: 'CAD', label: 'CAD - Canadian Dollar (C$)' },
  { value: 'CHF', label: 'CHF - Swiss Franc' },
  { value: 'CNY', label: 'CNY - Chinese Yuan (¥)' },
  { value: 'INR', label: 'INR - Indian Rupee (₹)' },
  { value: 'SGD', label: 'SGD - Singapore Dollar (S$)' },
  { value: 'HKD', label: 'HKD - Hong Kong Dollar (HK$)' },
  { value: 'NZD', label: 'NZD - New Zealand Dollar (NZ$)' },
  { value: 'MXN', label: 'MXN - Mexican Peso ($)' },
  { value: 'BRL', label: 'BRL - Brazilian Real (R$)' },
  { value: 'ZAR', label: 'ZAR - South African Rand (R)' },
  { value: 'SEK', label: 'SEK - Swedish Krona (kr)' },
  { value: 'NOK', label: 'NOK - Norwegian Krone (kr)' },
  { value: 'DKK', label: 'DKK - Danish Krone (kr)' },
  { value: 'PLN', label: 'PLN - Polish Zloty (zł)' },
  { value: 'RUB', label: 'RUB - Russian Ruble (₽)' },
  { value: 'TRY', label: 'TRY - Turkish Lira (₺)' },
  { value: 'AED', label: 'AED - UAE Dirham (د.إ)' },
  { value: 'SAR', label: 'SAR - Saudi Riyal (﷼)' },
];

const PAYMENT_TERMS_OPTIONS = [
  { value: 0, label: 'Due on Receipt' },
  { value: 7, label: 'Net 7 Days' },
  { value: 15, label: 'Net 15 Days' },
  { value: 30, label: 'Net 30 Days' },
  { value: 45, label: 'Net 45 Days' },
  { value: 60, label: 'Net 60 Days' },
  { value: 90, label: 'Net 90 Days' },
];

const InvoiceForm = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const { settings } = useSettingsContext();
  const { data: invoice, isLoading } = useInvoice(isEdit && id ? id : '');
  const { data: clients } = useClients();
  const { data: allStores } = useStores(true); // Only active stores
  const { data: invoicesList } = useInvoices(); // For copy from invoice
  const createInvoice = useCreateInvoice();
  const updateInvoice = useUpdateInvoice();
  const { showToast } = useToast();
  const [stockWarnings, setStockWarnings] = useState<Record<number, string>>({});
  const [paymentTermsDays, setPaymentTermsDays] = useState<number>(settings?.defaultPaymentTermsDays || 30);
  const [copyInvoiceDialogOpen, setCopyInvoiceDialogOpen] = useState(false);
  const [copyInvoiceSearchQuery, setCopyInvoiceSearchQuery] = useState('');
  const [copyInvoiceSortBy, setCopyInvoiceSortBy] = useState<'date' | 'amount' | 'number'>('date');
  const [copyInvoicePage, setCopyInvoicePage] = useState(0);
  const INVOICES_PER_PAGE = 50;
  
  // FIX #146: Track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true);
  
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  
  // Get default currency from settings
  const defaultCurrency = settings?.defaultCurrency || 'USD';

  // Update paymentTermsDays when settings load (only for new invoices)
  useEffect(() => {
    if (!isEdit && settings?.defaultPaymentTermsDays !== undefined) {
      setPaymentTermsDays(settings.defaultPaymentTermsDays);
    }
  }, [settings?.defaultPaymentTermsDays, isEdit]);

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors, isDirty },
    reset,
    setValue,
    setError,
  } = useForm<InvoiceFormData>({
    defaultValues: {
      type: 'invoice',
      currency: defaultCurrency,
      issueDate: new Date().toISOString().split('T')[0],
      notes: settings?.defaultInvoiceNotes || '',
      items: [{ description: '', quantity: 1, unitPrice: 0, taxRate: 0, discountRate: 0 }],
    },
    mode: 'onChange', // FIX #149: Validate on change (will be debounced)
  });
  
  // FIX #153: Track form dirty state for unsaved changes warning
  // Enhanced: Track both isDirty from react-hook-form and manual changes
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showNavigationDialog, setShowNavigationDialog] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);
  
  // Track form dirty state
  useEffect(() => {
    setHasUnsavedChanges(isDirty);
  }, [isDirty]);

  // FIX #141: Prevent navigation with unsaved changes
  // Note: useBlocker requires a data router, so we rely on beforeunload and manual checks
  // The beforeunload handler below will catch browser navigation
  // Manual checks are done before programmatic navigation calls
  
  // FIX #141: Warn user before navigating away with unsaved changes (browser navigation)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);
  
  // Handle navigation confirmation
  const handleNavigationConfirm = useCallback(() => {
    if (pendingNavigation) {
      pendingNavigation();
    }
    setShowNavigationDialog(false);
    setPendingNavigation(null);
    setHasUnsavedChanges(false);
  }, [pendingNavigation]);
  
  const handleNavigationCancel = useCallback(() => {
    setShowNavigationDialog(false);
    setPendingNavigation(null);
  }, []);

  const selectedStoreId = watch('storeId');
  const selectedClientId = watch('clientId');
  const selectedCurrency = watch('currency') || 'USD';
  const watchedItems = watch('items');
  
  const { data: selectedClient } = useClient(selectedClientId || '');
  
  // Filter stores by selected client - only show stores belonging to the selected client
  const stores = useMemo(() => {
    try {
      if (!allStores || !Array.isArray(allStores)) return [];
      if (!selectedClientId) return allStores; // Show all stores if no client selected
      return allStores.filter(store => store && store.clientId === selectedClientId);
    } catch (error) {
      console.error('Error filtering stores:', error);
      return [];
    }
  }, [allStores, selectedClientId]);
  
  // Clear store selection if selected store doesn't belong to the selected client
  // FIX: Only run when stores are actually loaded (not empty array from initial state)
  // FIX: Prevent infinite loops by checking if storeId actually needs to be cleared
  useEffect(() => {
    // Only proceed if stores array is actually loaded (not just initialized as empty)
    // We check if allStores exists to know if the query has completed
    if (!allStores) return; // Wait for stores to load
    
    if (selectedClientId && selectedStoreId) {
      const selectedStore = stores.find(s => s && s.id === selectedStoreId);
      if (!selectedStore && stores.length > 0) {
        // Selected store doesn't belong to the client, clear it
        // Only clear if stores are loaded and the store is not found
        setValue('storeId', '', { shouldDirty: false });
      }
    } else if (selectedClientId && !selectedStoreId && stores.length === 0 && allStores.length > 0) {
      // If client is selected but has no stores (after filtering), ensure storeId is cleared
      // Only clear if we know stores have loaded (allStores.length > 0) but filtered result is empty
      setValue('storeId', '', { shouldDirty: false });
    }
  }, [selectedClientId, selectedStoreId, stores, allStores, setValue]);
  const inventoryItemIds = useMemo(() => {
    return watchedItems
      ?.filter((item) => item.inventoryItemId)
      .map((item) => item.inventoryItemId!)
      || [];
  }, [watchedItems]);
  
  // Fetch store stock for all items when store is selected
  const { data: storeStocks } = useStoreStocks(selectedStoreId, inventoryItemIds);

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });

  // FIX #141: Reset form state on navigation - use location key to detect navigation
  // FIX #142: Initialize form from props properly - wait for invoice to load
  useEffect(() => {
    if (isLoading) return; // Wait for invoice to load
    
    if (invoice) {
      reset({
        clientId: invoice.clientId,
        storeId: invoice.storeId,
        type: 'invoice', // Always set to invoice (no estimates)
        issueDate: invoice.issueDate ? invoice.issueDate.split('T')[0] : undefined,
        dueDate: invoice.dueDate ? invoice.dueDate.split('T')[0] : undefined,
        currency: invoice.currency,
        notes: invoice.notes || '',
        items: invoice.items?.map((item) => ({
          inventoryItemId: item.inventoryItemId,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          taxRate: item.taxRate,
          discountRate: item.discountRate,
        })) || [],
      });
      
      // Calculate payment terms from dates if available
      if (invoice.issueDate && invoice.dueDate) {
        const issue = new Date(invoice.issueDate);
        const due = new Date(invoice.dueDate);
        const diffDays = Math.round((due.getTime() - issue.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays >= 0) {
          setPaymentTermsDays(diffDays);
        }
      }
    } else if (!isEdit) {
      // FIX: Don't reset form if a draft exists and hasn't been loaded yet
      // The draft loading effect will handle resetting the form with draft data
      // draftExistsRef.current === null means we haven't checked yet, so wait
      // draftExistsRef.current === true means draft exists but not loaded yet, so wait
      // draftExistsRef.current === false means no draft, so we can reset
      if (draftExistsRef.current === false) {
        // FIX #141: Reset form for new invoices when navigating away and back
        reset({
          type: 'invoice',
          currency: defaultCurrency,
          issueDate: new Date().toISOString().split('T')[0],
          notes: settings?.defaultInvoiceNotes || '',
          items: [{ description: '', quantity: 1, unitPrice: 0, taxRate: 0, discountRate: 0 }],
        });
        // For new invoices, calculate initial due date from payment terms
        const issueDate = new Date().toISOString().split('T')[0];
        const dueDate = new Date(issueDate);
        dueDate.setDate(dueDate.getDate() + paymentTermsDays);
        setValue('dueDate', dueDate.toISOString().split('T')[0]);
      }
    }
  }, [invoice, isLoading, isEdit, reset, setValue, paymentTermsDays, defaultCurrency, settings?.defaultInvoiceNotes]);
  
  // Watch issue date outside useEffect to avoid calling watch() in dependencies
  const issueDate = watch('issueDate');
  
  // Auto-calculate due date when issue date or payment terms change
  useEffect(() => {
    if (issueDate && !isEdit) {
      const dueDate = new Date(issueDate);
      dueDate.setDate(dueDate.getDate() + paymentTermsDays);
      setValue('dueDate', dueDate.toISOString().split('T')[0]);
    }
  }, [issueDate, paymentTermsDays, isEdit, setValue]);

  // FIX #101: Use shared calculation utility that matches backend exactly
  const calculateLineTotal = (item: InvoiceItemForm) => {
    if (!item || item.quantity === undefined || item.unitPrice === undefined) {
      return 0;
    }
    // Use shared utility for consistent calculation
    const totalsResult = computeInvoiceTotalsCents([{
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discountRate: item.discountRate || 0,
      taxRate: item.taxRate || 0,
    }]);
    return centsToMoney(totalsResult.lines[0]?.lineTotalCents || 0);
  };

  // FIX #101: Use shared calculation utility that matches backend exactly
  // FIX #147: Use useMemo to prevent stale closure - recalculate when watchedItems change
  const totals = useMemo(() => {
    if (!watchedItems || !Array.isArray(watchedItems) || watchedItems.length === 0) {
      return {
        subtotal: 0,
        taxTotal: 0,
        discountTotal: 0,
        total: 0,
        overallDiscountPercent: 0,
        overallTaxPercent: 0,
      };
    }

    // Filter out invalid items and convert to format expected by utility
    const validItems = watchedItems
      .filter((item) => 
        item && 
        item.quantity !== undefined && 
        item.quantity !== null && 
        item.unitPrice !== undefined && 
        item.unitPrice !== null
      )
      .map((item) => ({
        quantity: Number(item.quantity) || 0,
        unitPrice: Number(item.unitPrice) || 0,
        discountRate: Number(item.discountRate) || 0,
        taxRate: Number(item.taxRate) || 0,
      }));

    // Use shared utility for consistent calculation (matches backend exactly)
    const totalsResult = computeInvoiceTotalsCents(validItems);
    const calculatedTotals = invoiceTotalsToMoney(totalsResult);

    // Calculate overall percentages for display
    const overallDiscountPercent = calculatedTotals.invoice.subtotal > 0 
      ? (calculatedTotals.invoice.discount / calculatedTotals.invoice.subtotal) * 100 
      : 0;
    const overallTaxPercent = (calculatedTotals.invoice.subtotal - calculatedTotals.invoice.discount) > 0
      ? (calculatedTotals.invoice.tax / (calculatedTotals.invoice.subtotal - calculatedTotals.invoice.discount)) * 100
      : 0;

    return {
      subtotal: calculatedTotals.invoice.subtotal,
      taxTotal: calculatedTotals.invoice.tax,
      discountTotal: calculatedTotals.invoice.discount,
      total: calculatedTotals.invoice.total,
      overallDiscountPercent: Math.round(overallDiscountPercent * 100) / 100,
      overallTaxPercent: Math.round(overallTaxPercent * 100) / 100,
    };
  }, [watchedItems]);

  // FIX #148: Batch setValue calls to prevent multiple re-renders
  const handleInventorySelect = (index: number, item: InventoryItem | null) => {
    if (item) {
      // Batch all setValue calls together - React will batch these automatically
      // but we can also use React.startTransition for better performance
      setValue(`items.${index}.inventoryItem`, item, { shouldDirty: true });
      setValue(`items.${index}.inventoryItemId`, item.id, { shouldDirty: true });
      // Use item description if it exists, otherwise use item name
      setValue(`items.${index}.description`, item.description || item.name, { shouldDirty: true });
      setValue(`items.${index}.unitPrice`, item.defaultUnitPrice || 0, { shouldDirty: true });
      setValue(`items.${index}.taxRate`, item.defaultTaxRate || 0, { shouldDirty: true });

      // Check stock availability (global or store level)
      checkStockAvailability(index, item, watchedItems?.[index]?.quantity || 0);
    } else {
      setValue(`items.${index}.inventoryItem`, null, { shouldDirty: true });
      setValue(`items.${index}.inventoryItemId`, undefined, { shouldDirty: true });
      setStockWarnings(prev => {
        const next = { ...prev };
        delete next[index];
        return next;
      });
    }
  };

  // FIX #143: Fix missing dependencies - use useCallback for checkStockAvailability
  // FIX #147: Prevent stale closure by using useCallback with all dependencies
  // FIX #154: Ensure stock validation updates when store changes
  const checkStockAvailability = useCallback((index: number, item: InventoryItem, quantity: number) => {
    const warnings: string[] = [];
    
    // Check global stock
    const currentStock = item.currentStock ?? 0;
    
    if (quantity > currentStock) {
      warnings.push(`Global stock: Quantity exceeds available stock (available: ${currentStock})`);
    }

    // Check store stock if store is selected and store stock data is available
    if (selectedStoreId && item.id && storeStocks) {
      const storeStock = storeStocks.get(item.id);
      // Only check if store stock value is actually defined in the map
      // Items not in the map haven't been added to the store yet, so we don't warn
      // Items in the map with 0 stock means they're tracked but have 0 stock, so we warn
      if (storeStock !== undefined) {
        if (quantity > storeStock) {
          warnings.push(`Store stock: Quantity exceeds available store stock (available: ${storeStock})`);
        }
      }
    }

    if (warnings.length > 0) {
      setStockWarnings(prev => ({
        ...prev,
        [index]: warnings.join(' | '),
      }));
    } else {
      setStockWarnings(prev => {
        const next = { ...prev };
        delete next[index];
        return next;
      });
    }
  }, [selectedStoreId, storeStocks]);

  const handleQuantityChange = (index: number, quantity: number) => {
    setValue(`items.${index}.quantity`, quantity);
    const item = watchedItems?.[index]?.inventoryItem;
    if (item) {
      checkStockAvailability(index, item, quantity);
    }
  };
  
  // FIX #154: Re-validate stock when store changes or store stocks are updated
  // This ensures stock warnings update immediately when store selection changes
  useEffect(() => {
    if (watchedItems && watchedItems.length > 0) {
      watchedItems.forEach((formItem, index) => {
        if (formItem.inventoryItem) {
          const quantity = formItem.quantity || 0;
          checkStockAvailability(index, formItem.inventoryItem, quantity);
        }
      });
    }
  }, [selectedStoreId, storeStocks, watchedItems, checkStockAvailability]);

  // Autosave form data
  const allFormData = watch();
  const { loadDraft, clearDraft } = useFormAutosave(
    `invoice-${id || 'new'}`,
    allFormData,
    isDirty,
    true,
  );

  // Load draft on mount for new invoices
  // FIX: Use ref to track if draft has been loaded to prevent infinite loops
  const draftLoadedRef = useRef(false);
  const draftExistsRef = useRef<boolean | null>(null); // null = not checked yet, true/false = checked
  
  // Check if draft exists in a separate effect
  useEffect(() => {
    if (!id && draftExistsRef.current === null) {
      const draft = loadDraft();
      draftExistsRef.current = !!draft;
    } else if (id || invoice) {
      // Reset when switching to edit mode
      draftExistsRef.current = null;
    }
  }, [id, invoice, loadDraft]);
  
  useEffect(() => {
    // Only load draft once for new invoices, and only if we haven't loaded it yet
    if (!id && !invoice && !isLoading && !draftLoadedRef.current && draftExistsRef.current === true) {
      const draft = loadDraft();
      if (draft) {
        draftLoadedRef.current = true; // Mark as loaded before reset to prevent re-triggering
        reset(draft);
        showToast('Draft restored', 'info');
      }
    }
    
    // Reset the flag when switching between new/edit modes
    if (id || invoice) {
      draftLoadedRef.current = false;
    }
  }, [id, invoice, isLoading, loadDraft, reset, showToast]); // Load when invoice/id changes

  const onSubmit = async (data: InvoiceFormData) => {
    try {
      // Validate client selection
      if (!data.clientId || data.clientId.trim() === '') {
        showToast('Please select a client', 'error');
        setError('clientId', { type: 'manual', message: 'Client is required' });
        return;
      }

      // Validate items array
      if (!data.items || data.items.length === 0) {
        showToast('At least one item is required', 'error');
        return;
      }

      // FIX #187, #192, #193, #194, #195: Enhanced validation matching backend
      const validItems = data.items.filter(
        (item) => {
          // FIX #195: Validate description length (max 1000 chars)
          if (!item.description || item.description.trim() === '' || item.description.length > 1000) {
            return false;
          }
          // FIX #187: Quantity must be integer >= 1 (not just > 0)
          const quantity = Number(item.quantity);
          if (!Number.isInteger(quantity) || quantity < 1 || quantity > 1000000) {
            return false;
          }
          // FIX #194: Unit price must be >= 0 and have upper bound
          const unitPrice = Number(item.unitPrice);
          if (unitPrice < 0 || unitPrice > 999999999.99) {
            return false;
          }
          // FIX #192: Tax rate must be 0-100 (not negative)
          if (item.taxRate !== undefined && (item.taxRate < 0 || item.taxRate > 100)) {
            return false;
          }
          // FIX #193: Discount rate must be 0-100
          if (item.discountRate !== undefined && (item.discountRate < 0 || item.discountRate > 100)) {
            return false;
          }
          // FIX #193: Discount cannot exceed subtotal (prevent backend rejection)
          const subtotal = quantity * unitPrice;
          const discountAmount = (subtotal * (item.discountRate || 0)) / 100;
          if (discountAmount > subtotal) {
            return false;
          }
          return true;
        }
      );

      if (validItems.length === 0) {
        showToast('At least one valid item with description, quantity > 0, and unit price is required', 'error');
        return;
      }

      // Check for invalid tax or discount rates
      const invalidItems = data.items.filter(
        (item) =>
          (item.taxRate !== undefined && (item.taxRate < 0 || item.taxRate > 100)) ||
          (item.discountRate !== undefined && (item.discountRate < 0 || item.discountRate > 100))
      );

      if (invalidItems.length > 0) {
        showToast('Tax rate and discount rate must be between 0 and 100', 'error');
        return;
      }

      // FIX #188, #197: Date validation with UTC handling to match backend
      if (data.dueDate && data.issueDate) {
        // FIX #188: Use UTC date-only comparison to match backend
        const issueDateUTC = new Date(data.issueDate + 'T00:00:00Z');
        const dueDateUTC = new Date(data.dueDate + 'T00:00:00Z');
        if (dueDateUTC < issueDateUTC) {
          showToast('Due date cannot be before issue date', 'error');
          return;
        }
      }
      
      // FIX #190: Validate UUIDs for clientId and storeId
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (data.clientId && !uuidRegex.test(data.clientId)) {
        showToast('Invalid client ID format', 'error');
        return;
      }
      if (data.storeId && !uuidRegex.test(data.storeId)) {
        showToast('Invalid store ID format', 'error');
        return;
      }
      
      // FIX #191: Validate currency code (ISO 4217)
      if (data.currency && !/^[A-Z]{3}$/.test(data.currency)) {
        showToast('Invalid currency code', 'error');
        return;
      }
      
      // FIX #199: Validate notes field length
      if (data.notes && data.notes.length > 10000) {
        showToast('Notes field cannot exceed 10,000 characters', 'error');
        return;
      }
      
      // FIX #200: Validate metadata JSON structure if provided
      if (data.metadataJson && typeof data.metadataJson !== 'object') {
        showToast('Invalid metadata format', 'error');
        return;
      }

      const invoiceData = {
        ...data,
        type: 'invoice' as const, // Always set to invoice (no estimates)
        items: validItems.map((item) => {
          // Calculate lineTotal for frontend preview (backend will recalculate)
          const subtotal = item.quantity * item.unitPrice;
          const discount = (subtotal * (item.discountRate || 0)) / 100;
          const afterDiscount = subtotal - discount;
          const tax = (afterDiscount * (item.taxRate || 0)) / 100;
          const lineTotal = Math.round((afterDiscount + tax) * 100) / 100;
          
          return {
            inventoryItemId: item.inventoryItemId,
            description: item.description.trim(),
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            taxRate: item.taxRate || 0,
            discountRate: item.discountRate || 0,
            lineTotal, // Include for TypeScript, backend will recalculate
          };
        }),
      };

      if (isEdit && id) {
        await updateInvoice.mutateAsync({ id, data: invoiceData });
        showToast('Invoice updated successfully', 'success');
        clearDraft(); // Clear draft after successful update
      } else {
        await createInvoice.mutateAsync(invoiceData);
        showToast('Invoice created successfully', 'success');
        clearDraft(); // Clear draft after successful create
      }
      // Navigate immediately - the mutation's onSuccess handler will refetch queries
      // and the list will refetch on mount due to refetchOnMount: true
      navigate('/invoices');
    } catch (error: unknown) {
      showToast(getErrorMessage(error, 'An error occurred'), 'error');
    }
  };
  
  // Handle copy from invoice
  const handleCopyFromInvoice = useCallback((sourceInvoice: Invoice) => {
    if (!sourceInvoice) return;
    
    // Calculate payment terms from source invoice dates (if available)
    const nextTerms =
      sourceInvoice.issueDate && sourceInvoice.dueDate
        ? Math.max(0, Math.round((new Date(sourceInvoice.dueDate).getTime() - new Date(sourceInvoice.issueDate).getTime()) / (1000 * 60 * 60 * 24)))
        : paymentTermsDays;
    
    setPaymentTermsDays(nextTerms);
    
    // Calculate new due date based on current issue date using computed terms
    const issueDate = new Date().toISOString().split('T')[0];
    const dueDate = new Date(issueDate);
    dueDate.setDate(dueDate.getDate() + nextTerms);
    
    reset({
      clientId: sourceInvoice.clientId,
      storeId: sourceInvoice.storeId,
      type: sourceInvoice.type,
      issueDate,
      dueDate: dueDate.toISOString().split('T')[0],
      currency: sourceInvoice.currency,
      notes: sourceInvoice.notes || '',
      items: sourceInvoice.items?.map((item: InvoiceItem) => ({
        inventoryItemId: item.inventoryItemId,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxRate: item.taxRate,
        discountRate: item.discountRate,
        printSpecifications: item.printSpecifications,
      })) || [{ description: '', quantity: 1, unitPrice: 0, taxRate: 0, discountRate: 0 }],
    });
    
    // Reset dialog state before closing to ensure pagination resets properly
    setCopyInvoiceSearchQuery('');
    setCopyInvoiceSortBy('date');
    setCopyInvoicePage(0);
    setCopyInvoiceDialogOpen(false);
    showToast('Invoice data copied. Review and update as needed.', 'success');
  }, [reset, paymentTermsDays, showToast]);
  
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
        description: 'Save invoice',
        ignoreWhenTyping: true,
      },
    ],
  });

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
          {isEdit ? 'Edit Invoice' : 'Create Invoice'}
        </Typography>
        {!isEdit && (
          <Button
            variant="outlined"
            startIcon={<FileCopyIcon />}
            onClick={() => setCopyInvoiceDialogOpen(true)}
            sx={{ borderRadius: 2 }}
          >
            Copy from Invoice
          </Button>
        )}
      </Box>

      <form onSubmit={handleSubmit(onSubmit)}>
        <Grid container spacing={3}>
          {/* Invoice Details Section */}
          <Grid item xs={12}>
            <Paper 
              elevation={0}
              sx={{ 
                p: 4, 
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.paper',
              }}
            >
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                <Typography variant="h6" fontWeight="600" color="text.primary">
                  Invoice Details
                </Typography>
                {!isEdit && settings?.autoGenerateInvoiceNumber && (
                  <Typography 
                    variant="caption" 
                    color="primary.main" 
                    sx={{ 
                      fontStyle: 'italic',
                      fontWeight: 500,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                    }}
                  >
                    <Box component="span" sx={{ fontSize: '0.9rem' }}>ℹ️</Box>
                    Invoice number will be auto-generated on save
                  </Typography>
                )}
              </Box>
              <Divider sx={{ mb: 3.5 }} />
              
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <FormControl 
                    fullWidth 
                    variant="outlined" 
                    error={!!errors.clientId}
                    sx={{
                      '& .MuiInputBase-root': {
                        fontSize: '1rem',
                        height: '56px',
                      },
                      '& .MuiInputLabel-root': {
                        fontSize: '1rem',
                      },
                    }}
                  >
                    <InputLabel>Client *</InputLabel>
                    <Controller
                      name="clientId"
                      control={control}
                      rules={{ required: 'Client is required' }}
                      render={({ field }) => {
                        // FIX: Validate that field.value exists in clients array to prevent "out-of-range value" warning
                        const validValue = clients && field.value && clients.some(c => c.id === field.value)
                          ? field.value
                          : '';
                        return (
                          <Select
                            value={validValue}
                            label="Client *"
                            onChange={field.onChange}
                            sx={{
                              fontSize: '1rem',
                              '& .MuiSelect-select': {
                                padding: '16.5px 14px',
                              },
                            }}
                          >
                            {clients?.map((client) => (
                              <MenuItem key={client.id} value={client.id} sx={{ fontSize: '1rem' }}>
                                {client.name}
                              </MenuItem>
                            ))}
                          </Select>
                        );
                      }}
                    />
                  </FormControl>
                  {selectedClient && (
                    <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1.5, border: '1px solid', borderColor: 'divider' }}>
                      <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5 }}>
                        Client Information
                      </Typography>
                      {selectedClient.email && (
                        <Box display="flex" alignItems="center" gap={1} mb={1}>
                          <EmailIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                          <Typography variant="body2" color="text.secondary">
                            {selectedClient.email}
                          </Typography>
                        </Box>
                      )}
                      {selectedClient.phone && (
                        <Box display="flex" alignItems="center" gap={1} mb={1}>
                          <PhoneIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                          <Typography variant="body2" color="text.secondary">
                            {selectedClient.phone}
                          </Typography>
                        </Box>
                      )}
                      {selectedClient.addressJson && (
                        <Box display="flex" alignItems="flex-start" gap={1}>
                          <LocationOnIcon sx={{ fontSize: 18, color: 'text.secondary', mt: 0.25 }} />
                          <Typography variant="body2" color="text.secondary">
                            {[
                              selectedClient.addressJson.street,
                              selectedClient.addressJson.city,
                              selectedClient.addressJson.state,
                              selectedClient.addressJson.zip,
                            ].filter(Boolean).join(', ')}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  )}
                </Grid>
                <Grid item xs={12}>
                  <FormControl 
                    fullWidth 
                    variant="outlined"
                    sx={{
                      '& .MuiInputBase-root': {
                        fontSize: '1rem',
                        height: '56px',
                      },
                      '& .MuiInputLabel-root': {
                        fontSize: '1rem',
                      },
                    }}
                  >
                    <InputLabel>Store</InputLabel>
                    <Controller
                      name="storeId"
                      control={control}
                      render={({ field }) => {
                        // FIX: Validate that field.value exists in stores array to prevent "out-of-range value" warning
                        const validValue = stores && field.value && stores.some(s => s && s.id === field.value)
                          ? field.value
                          : '';
                        return (
                          <Select
                            value={validValue}
                            label="Store"
                            onChange={(e) => {
                              field.onChange(e);
                              // FIX #154: Trigger stock validation when store changes
                              // Use setTimeout to ensure storeStocks query has time to update
                              setTimeout(() => {
                                if (watchedItems && watchedItems.length > 0) {
                                  watchedItems.forEach((formItem, index) => {
                                    if (formItem.inventoryItem) {
                                      const quantity = formItem.quantity || 0;
                                      checkStockAvailability(index, formItem.inventoryItem, quantity);
                                    }
                                  });
                                }
                              }, 100);
                            }}
                            sx={{
                              fontSize: '1rem',
                              '& .MuiSelect-select': {
                                padding: '16.5px 14px',
                              },
                            }}
                          >
                            <MenuItem value="" sx={{ fontSize: '1rem' }}>
                              <em>{selectedClientId ? 'No Stores Available' : 'All Stores'}</em>
                            </MenuItem>
                            {stores && stores.length > 0 ? (
                              stores.map((store) => (
                                <MenuItem key={store.id} value={store.id} sx={{ fontSize: '1rem' }}>
                                  {store.name} ({store.code})
                                </MenuItem>
                              ))
                            ) : selectedClientId ? (
                              <MenuItem disabled sx={{ fontSize: '1rem' }}>
                                No stores available for this client
                              </MenuItem>
                            ) : null}
                          </Select>
                        );
                      }}
                    />
                  </FormControl>
                </Grid>
                {/* Type field removed - all invoices are now just invoices (no estimates) */}
                <Grid item xs={12} md={3}>
                  <FormControl fullWidth variant="outlined" size="medium">
                    <InputLabel>Currency *</InputLabel>
                    <Controller
                      name="currency"
                      control={control}
                      rules={{ required: true }}
                      render={({ field }) => (
                    <Select
                          value={field.value || defaultCurrency}
                      label="Currency *"
                          onChange={field.onChange}
                    >
                      {CURRENCIES.map((currency) => (
                        <MenuItem key={currency.value} value={currency.value}>
                          {currency.label}
                        </MenuItem>
                      ))}
                    </Select>
                      )}
                    />
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    label="Issue Date *"
                    type="date"
                    {...register('issueDate', { required: true })}
                    InputLabelProps={{ shrink: true }}
                    variant="outlined"
                    size="medium"
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <FormControl fullWidth variant="outlined" size="medium">
                    <InputLabel>Payment Terms</InputLabel>
                    <Select
                      value={paymentTermsDays}
                      label="Payment Terms"
                      renderValue={(value) => {
                        const term = PAYMENT_TERMS_OPTIONS.find(t => t.value === value);
                        return term ? term.label : value.toString();
                      }}
                      onChange={(e) => {
                        const days = Number(e.target.value);
                        setPaymentTermsDays(days);
                        if (issueDate) {
                          const dueDate = new Date(issueDate);
                          dueDate.setDate(dueDate.getDate() + days);
                          setValue('dueDate', dueDate.toISOString().split('T')[0]);
                        }
                      }}
                    >
                      {PAYMENT_TERMS_OPTIONS.map((term) => (
                        <MenuItem key={term.value} value={term.value}>
                          {term.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    label="Due Date"
                    type="date"
                    {...register('dueDate')}
                    InputLabelProps={{ shrink: true }}
                    variant="outlined"
                    size="medium"
                  />
                            </Grid>
                          </Grid>
            </Paper>
          </Grid>

          {/* Line Items Section */}
          <Grid item xs={12} md={8}>
            <Paper 
              elevation={0}
              sx={{ 
                p: 4, 
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.paper',
              }}
            >
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                <Box>
                  <Typography variant="h6" fontWeight="600" color="text.primary">
                    Line Items
                  </Typography>
                  {selectedStoreId && watch('type') !== 'estimate' && (
                    <Typography variant="caption" color="primary.main" sx={{ mt: 1, display: 'block', fontWeight: 500 }}>
                      📦 Stock will be deducted from: {stores?.find(s => s.id === selectedStoreId)?.name || 'Selected Store'}
                      {' (deducted when invoice is sent/paid)'}
                    </Typography>
                  )}
                </Box>
                <Button
                  variant="contained"
                  size="medium"
                  startIcon={<AddIcon />}
                  onClick={() =>
                    append({
                      description: '',
                      quantity: 1,
                      unitPrice: 0,
                      taxRate: 0,
                      discountRate: 0,
                    })
                  }
                  sx={{ borderRadius: 2 }}
                >
                  Add Item
                </Button>
              </Box>
              <Divider sx={{ mb: 3.5 }} />

              {fields.map((field, index) => (
                <Box
                  key={field.id}
                  sx={{
                    p: 3,
                    mb: 3,
                    borderRadius: 2,
                    border: '1px solid',
                    borderColor: 'divider',
                    bgcolor: index % 2 === 0 ? 'background.paper' : 'action.hover',
                    transition: 'all 0.2s',
                    '&:hover': {
                      boxShadow: 2,
                      borderColor: 'primary.main',
                    }
                  }}
                >
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={2.5}>
                    <Typography variant="subtitle1" fontWeight="600" color="text.primary">
                      Item #{index + 1}
                    </Typography>
                    <IconButton
                      onClick={() => remove(index)}
                      color="error"
                      size="medium"
                      disabled={fields.length === 1}
                      aria-label={`Remove item ${index + 1}`}
                      aria-disabled={fields.length === 1}
                      sx={{ 
                        '&:hover': { 
                          bgcolor: 'error.lighter' 
                        } 
                      }}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Box>

                  <Grid container spacing={2.5}>
                    <Grid item xs={12}>
                      <InventorySelect
                        value={watchedItems[index]?.inventoryItem || null}
                        onChange={(item) => handleInventorySelect(index, item)}
                        storeId={selectedStoreId}
                        storeStocks={storeStocks}
                      />
                      {watchedItems[index]?.inventoryItem && selectedStoreId && storeStocks && (
                        <Box sx={{ mt: 1.5, mb: stockWarnings[index] ? 0.5 : 0 }}>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box component="span" sx={{ fontWeight: 600 }}>Available stock:</Box>
                            <Box component="span">
                              Global: {watchedItems[index]?.inventoryItem?.currentStock ?? 0}
                            </Box>
                            {(() => {
                              const itemId = watchedItems[index]?.inventoryItem?.id;
                              const stock = itemId ? storeStocks.get(itemId) : undefined;
                              if (stock !== undefined) {
                                const store = stores?.find(s => s.id === selectedStoreId);
                                return (
                                  <Box component="span" sx={{ fontWeight: 600, color: 'primary.main' }}>
                                    | {store?.name || 'Selected Store'}: {stock}
                                  </Box>
                                );
                              }
                              return null;
                            })()}
                          </Typography>
                        </Box>
                      )}
                      {stockWarnings[index] && (
                        <Alert 
                          severity="warning" 
                          sx={{ 
                            borderRadius: 1.5,
                            mt: 2,
                          }}
                        >
                          {stockWarnings[index]}
                        </Alert>
                      )}
                    </Grid>

                    {(!watchedItems[index]?.inventoryItem || !watchedItems[index]?.inventoryItem?.description) && (
                      <Grid item xs={12}>
                        <Controller
                          name={`items.${index}.description`}
                          control={control}
                          rules={{ required: true }}
                          render={({ field }) => (
                        <TextField
                              {...field}
                          fullWidth
                          label="Description *"
                          variant="outlined"
                          size="medium"
                          InputLabelProps={{
                                shrink: true,
                          }}
                            />
                          )}
                        />
                      </Grid>
                    )}

                    <Grid item xs={6} sm={3} md={2}>
                      <Controller
                        name={`items.${index}.quantity`}
                        control={control}
                        rules={{
                          required: 'Quantity is required',
                          min: {
                            value: 1,
                            message: 'Quantity must be at least 1',
                          },
                          validate: (value) => {
                            if (value < 1) return 'Quantity must be at least 1';
                            if (!Number.isInteger(value)) return 'Quantity must be a whole number';
                            return true;
                          },
                        }}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            fullWidth
                            label="Quantity *"
                            type="number"
                            inputProps={{ step: '1', min: 1 }}
                            onChange={(e) => {
                              const inputValue = e.target.value;
                              // Allow empty input while typing
                              if (inputValue === '' || inputValue === '-') {
                                field.onChange('');
                                return;
                              }
                              // Remove leading zeros (e.g., "050" -> "50")
                              const cleanValue = inputValue.replace(/^0+/, '') || '0';
                              const numValue = parseInt(cleanValue, 10);
                              if (!isNaN(numValue) && numValue >= 1 && numValue <= 1000000) {
                                field.onChange(numValue);
                                handleQuantityChange(index, numValue);
                              } else if (numValue > 1000000) {
                                field.onChange(1000000);
                                handleQuantityChange(index, 1000000);
                              }
                            }}
                            onBlur={field.onBlur}
                            value={field.value ?? ''}
                            error={!!errors.items?.[index]?.quantity}
                            helperText={errors.items?.[index]?.quantity?.message}
                            variant="outlined"
                            size="medium"
                          />
                        )}
                      />
                    </Grid>

                    <Grid item xs={6} sm={3} md={2}>
                      <Controller
                        name={`items.${index}.unitPrice`}
                        control={control}
                        rules={{
                          required: 'Unit price is required',
                          min: {
                            value: 0,
                            message: 'Unit price cannot be negative',
                          },
                          validate: (value) => {
                            if (value < 0) return 'Unit price cannot be negative';
                            return true;
                          },
                        }}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            fullWidth
                            label="Unit Price *"
                            type="number"
                            inputProps={{ step: '0.01', min: 0 }}
                            onChange={(e) => {
                              const inputValue = e.target.value;
                              // Allow empty input while typing
                              if (inputValue === '' || inputValue === '-') {
                                field.onChange('');
                                return;
                              }
                              // Remove leading zeros for whole numbers (e.g., "050" -> "50")
                              // But preserve decimals (e.g., "0.50" stays "0.50")
                              let cleanValue = inputValue;
                              if (!inputValue.includes('.') && inputValue.startsWith('0') && inputValue.length > 1) {
                                cleanValue = inputValue.replace(/^0+/, '') || '0';
                              }
                              const numValue = parseFloat(cleanValue);
                              if (!isNaN(numValue) && numValue >= 0 && numValue <= 10000000) {
                                field.onChange(numValue);
                              } else if (numValue > 10000000) {
                                field.onChange(10000000);
                              } else if (numValue < 0) {
                                field.onChange(0);
                              }
                            }}
                            onBlur={field.onBlur}
                            value={field.value ?? ''}
                            error={!!errors.items?.[index]?.unitPrice}
                            helperText={errors.items?.[index]?.unitPrice?.message}
                            variant="outlined"
                            size="medium"
                          />
                        )}
                      />
                    </Grid>

                    <Grid item xs={6} sm={3} md={2}>
                      <Controller
                        name={`items.${index}.taxRate`}
                        control={control}
                        rules={{
                          min: {
                            value: 0,
                            message: 'Tax rate cannot be negative',
                          },
                          max: {
                            value: 100,
                            message: 'Tax rate cannot exceed 100%',
                          },
                          validate: (value) => {
                            if (value < 0) return 'Tax rate cannot be negative';
                            if (value > 100) return 'Tax rate cannot exceed 100%';
                            return true;
                          },
                        }}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            fullWidth
                            label="Tax %"
                            type="number"
                            inputProps={{ step: '0.01', min: 0, max: 100 }}
                            onChange={(e) => {
                              const inputValue = e.target.value;
                              // Allow empty input while typing
                              if (inputValue === '' || inputValue === '-') {
                                field.onChange('');
                                return;
                              }
                              // Remove leading zeros for whole numbers
                              let cleanValue = inputValue;
                              if (!inputValue.includes('.') && inputValue.startsWith('0') && inputValue.length > 1) {
                                cleanValue = inputValue.replace(/^0+/, '') || '0';
                              }
                              const numValue = parseFloat(cleanValue);
                              if (!isNaN(numValue)) {
                                if (numValue < 0) {
                                  field.onChange(0);
                                } else if (numValue > 100) {
                                  field.onChange(100);
                                } else {
                                  field.onChange(numValue);
                                }
                              }
                            }}
                            onBlur={field.onBlur}
                            value={field.value ?? ''}
                            error={!!errors.items?.[index]?.taxRate}
                            helperText={errors.items?.[index]?.taxRate?.message}
                            variant="outlined"
                            size="medium"
                          />
                        )}
                      />
                    </Grid>

                    <Grid item xs={6} sm={3} md={2}>
                      <Controller
                        name={`items.${index}.discountRate`}
                        control={control}
                        rules={{
                          min: {
                            value: 0,
                            message: 'Discount rate cannot be negative',
                          },
                          max: {
                            value: 100,
                            message: 'Discount rate cannot exceed 100%',
                          },
                          validate: (value) => {
                            if (value < 0) return 'Discount rate cannot be negative';
                            if (value > 100) return 'Discount rate cannot exceed 100%';
                            return true;
                          },
                        }}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            fullWidth
                            label="Discount %"
                            type="number"
                            inputProps={{ step: '0.01', min: 0, max: 100 }}
                            onChange={(e) => {
                              const inputValue = e.target.value;
                              // Allow empty input while typing
                              if (inputValue === '' || inputValue === '-') {
                                field.onChange('');
                                return;
                              }
                              // Remove leading zeros for whole numbers
                              let cleanValue = inputValue;
                              if (!inputValue.includes('.') && inputValue.startsWith('0') && inputValue.length > 1) {
                                cleanValue = inputValue.replace(/^0+/, '') || '0';
                              }
                              const numValue = parseFloat(cleanValue);
                              if (!isNaN(numValue)) {
                                if (numValue < 0) {
                                  field.onChange(0);
                                } else if (numValue > 100) {
                                  field.onChange(100);
                                } else {
                                  field.onChange(numValue);
                                }
                              }
                            }}
                            onBlur={field.onBlur}
                            value={field.value ?? ''}
                            error={!!errors.items?.[index]?.discountRate}
                            helperText={errors.items?.[index]?.discountRate?.message}
                            variant="outlined"
                            size="medium"
                          />
                        )}
                      />
                    </Grid>

                    <Grid item xs={12}>
                    </Grid>

                    <Grid item xs={12} sm={12} md={4}>
                      <Box
                        sx={{
                          p: 2.5,
                          bgcolor: 'primary.lighter',
                          borderRadius: 2,
                          textAlign: 'center',
                          height: '100%',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'center',
                          border: '1px solid',
                          borderColor: 'primary.light',
                          minHeight: 64,
                        }}
                      >
                        <Typography variant="caption" color="text.secondary" gutterBottom sx={{ fontWeight: 600, fontSize: '0.75rem', mb: 0.5 }}>
                          Line Total
                        </Typography>
                        <Typography variant="h6" fontWeight="bold" color="primary.main">
                          {formatCurrency(calculateLineTotal(watchedItems?.[index]), selectedCurrency)}
                        </Typography>
                      </Box>
                    </Grid>
                  </Grid>
                </Box>
              ))}
            </Paper>
          </Grid>

          {/* Summary and Notes Section */}
          <Grid item xs={12} md={4}>
            <Box display="flex" flexDirection="column" gap={3}>
              {/* Summary Card */}
              <Paper 
                elevation={2}
                sx={{ 
                  p: 3.5, 
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: 'primary.main',
                  bgcolor: 'background.paper',
                }}
              >
                <Typography 
                  variant="h6" 
                  fontWeight="700" 
                  color="primary.main" 
                  mb={3}
                >
                  Summary
                </Typography>
                {selectedStoreId && watch('type') !== 'estimate' && (
                  <Alert 
                    severity="info" 
                    sx={{ mb: 3, borderRadius: 1.5 }}
                  >
                    <Typography variant="body2">
                      <strong>Store Inventory:</strong> Stock will be deducted from{' '}
                      <strong>{stores?.find(s => s.id === selectedStoreId)?.name || 'selected store'}</strong> when this invoice is sent or paid.
                    </Typography>
                  </Alert>
                )}
                <Divider sx={{ mb: 3 }} />
                <Box display="flex" flexDirection="column" gap={2.5}>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="body1" fontWeight="500" color="text.secondary">
                      Subtotal:
                    </Typography>
                    <Typography variant="body1" fontWeight="600">
                      {formatCurrency(totals.subtotal, selectedCurrency)}
                    </Typography>
                  </Box>
                  
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
                      <Typography variant="body1" fontWeight="500" color="text.secondary">
                        Discount:
                      </Typography>
                      {totals.overallDiscountPercent > 0 && (
                        <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                          ({totals.overallDiscountPercent}%)
                        </Typography>
                      )}
                    </Box>
                    <Typography 
                      variant="body1" 
                      fontWeight="600" 
                      color={totals.discountTotal > 0 ? 'error.main' : 'text.secondary'}
                    >
                      -{formatCurrency(totals.discountTotal, selectedCurrency)}
                    </Typography>
                  </Box>
                  
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
                      <Typography variant="body1" fontWeight="500" color="text.secondary">
                        Tax:
                      </Typography>
                      {totals.overallTaxPercent > 0 && (
                        <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                          ({totals.overallTaxPercent}%)
                        </Typography>
                      )}
                    </Box>
                    <Typography variant="body1" fontWeight="600">
                      {formatCurrency(totals.taxTotal, selectedCurrency)}
                    </Typography>
                  </Box>
                  
                  <Divider sx={{ my: 1 }} />
                  <Box 
                    display="flex" 
                    justifyContent="space-between"
                    alignItems="center"
                    sx={{
                      bgcolor: 'primary.main',
                      borderRadius: 1.5,
                      p: 2,
                      mt: 1,
                    }}
                  >
                    <Typography variant="h6" fontWeight="700" sx={{ color: 'white' }}>
                      Total:
                    </Typography>
                    <Typography variant="h5" fontWeight="800" sx={{ color: 'white' }}>
                      {formatCurrency(totals.total, selectedCurrency)}
                    </Typography>
                  </Box>
                </Box>
              </Paper>

              {/* Notes Card */}
              <Paper 
                elevation={0}
                sx={{ 
                  p: 3.5, 
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                  bgcolor: 'background.paper',
                }}
              >
                <Typography variant="h6" fontWeight="600" mb={2.5} color="text.primary">
                  Notes
                </Typography>
                <Divider sx={{ mb: 2.5 }} />
                <TextField
                  fullWidth
                  label="Notes"
                  multiline
                  rows={6}
                  {...register('notes')}
                  variant="outlined"
                  placeholder="Add any additional notes or terms..."
                  size="medium"
                />
              </Paper>
            </Box>
          </Grid>

          {/* Action Buttons */}
          <Grid item xs={12}>
            <Paper 
              elevation={0}
              sx={{ 
                p: 3.5, 
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.paper',
              }}
            >
              <Box 
                display="flex" 
                gap={2.5} 
                justifyContent="flex-end"
              >
                <Button 
                  variant="outlined" 
                  onClick={() => {
                    if (hasUnsavedChanges) {
                      setShowNavigationDialog(true);
                      setPendingNavigation(() => () => navigate('/invoices'));
                    } else {
                      navigate('/invoices');
                    }
                  }}
                  sx={{ minWidth: 130, px: 3 }}
                  size="large"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  variant="contained"
                  size="large"
                  sx={{ minWidth: 180, px: 4 }}
                  disabled={createInvoice.isPending || updateInvoice.isPending}
                >
                  {createInvoice.isPending || updateInvoice.isPending 
                    ? 'Saving...' 
                    : isEdit ? 'Update Invoice' : 'Create Invoice'}
                </Button>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      </form>

      {/* Copy from Invoice Dialog */}
      <Dialog
        open={copyInvoiceDialogOpen}
        onClose={() => {
          setCopyInvoiceDialogOpen(false);
          setCopyInvoiceSearchQuery(''); // Reset search when closing
          setCopyInvoiceSortBy('date'); // Reset sort
          setCopyInvoicePage(0); // Reset pagination
        }}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            maxHeight: '85vh',
            height: '85vh',
            width: '90vw',
            maxWidth: '900px',
            display: 'flex',
            flexDirection: 'column',
          },
        }}
      >
        <DialogTitle sx={{ pb: 1.5, pt: 2, px: 3, borderBottom: '1px solid', borderColor: 'divider', flexShrink: 0, position: 'relative', zIndex: 1 }}>
          <Box display="flex" alignItems="center" gap={1}>
            <Box
              sx={{
                p: 0.75,
                borderRadius: 1,
                bgcolor: 'primary.lighter',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <FileCopyIcon sx={{ color: 'primary.main', fontSize: 20 }} />
            </Box>
            <Box>
              <Typography variant="subtitle1" component="span" fontWeight={600} color="text.primary" sx={{ fontSize: '1rem' }}>
                Copy from Previous Invoice
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25, fontSize: '0.75rem' }}>
            Select an invoice to copy its details. The issue date will be set to today.
          </Typography>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: 2.5, px: 3, pb: 0, flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative' }}>
          
          {/* Search and Sort Controls - Fixed at top */}
          <Box display="flex" gap={2} sx={{ mb: 2.5, flexShrink: 0, width: '100%', position: 'relative', zIndex: 2, mt: 1 }}>
            <TextField
              fullWidth
              label="Search invoices"
              placeholder="Search by invoice number, client name, date, or amount..."
              value={copyInvoiceSearchQuery}
              onChange={(e) => {
                setCopyInvoiceSearchQuery(e.target.value);
                setCopyInvoicePage(0); // Reset to first page when search changes
              }}
              variant="outlined"
              size="small"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                  </InputAdornment>
                ),
              }}
            />
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel>Sort by</InputLabel>
              <Select
                value={copyInvoiceSortBy}
                label="Sort by"
                onChange={(e) => {
                  setCopyInvoiceSortBy(e.target.value as 'date' | 'amount' | 'number');
                  setCopyInvoicePage(0); // Reset to first page when sort changes
                }}
                startAdornment={
                  <InputAdornment position="start">
                    <SortIcon sx={{ fontSize: 18, color: 'text.secondary', mr: 1 }} />
                  </InputAdornment>
                }
              >
                <MenuItem value="date">Date (Newest)</MenuItem>
                <MenuItem value="amount">Amount (Highest)</MenuItem>
                <MenuItem value="number">Invoice Number</MenuItem>
              </Select>
            </FormControl>
          </Box>

          {/* Filtered and Sorted Invoice List */}
          {(() => {
            // First, filter and sort all invoices
            const allFilteredInvoices = invoicesList
              ?.filter((inv) => {
                // Exclude current invoice if editing
                if (inv.id === id) return false;
                
                // If no search query, show all
                if (!copyInvoiceSearchQuery.trim()) return true;
                
                // Search in multiple fields (case-insensitive)
                const searchLower = copyInvoiceSearchQuery.toLowerCase();
                const invoiceNumber = inv.number?.toLowerCase() || '';
                const clientName = inv.client?.name?.toLowerCase() || '';
                const issueDateStr = inv.issueDate ? formatDate(inv.issueDate).toLowerCase() : '';
                const totalStr = formatCurrency(inv.total || 0, inv.currency).toLowerCase();
                const statusStr = inv.status?.toLowerCase() || '';
                const typeStr = inv.type?.toLowerCase() || '';
                
                return (
                  invoiceNumber.includes(searchLower) ||
                  clientName.includes(searchLower) ||
                  issueDateStr.includes(searchLower) ||
                  totalStr.includes(searchLower) ||
                  statusStr.includes(searchLower) ||
                  typeStr.includes(searchLower)
                );
              })
              .sort((a, b) => {
                if (copyInvoiceSortBy === 'date') {
                  const dateA = a.issueDate ? new Date(a.issueDate).getTime() : 0;
                  const dateB = b.issueDate ? new Date(b.issueDate).getTime() : 0;
                  return dateB - dateA; // Newest first
                } else if (copyInvoiceSortBy === 'amount') {
                  return (b.total || 0) - (a.total || 0); // Highest first
                } else {
                  // Sort by invoice number
                  return (a.number || '').localeCompare(b.number || '');
                }
              }) || [];

            // Get total count before slicing
            const totalCount = allFilteredInvoices.length;
            
            // Calculate pagination
            const startIndex = copyInvoicePage * INVOICES_PER_PAGE;
            const endIndex = startIndex + INVOICES_PER_PAGE;
            const totalPages = Math.ceil(totalCount / INVOICES_PER_PAGE);
            const hasNextPage = endIndex < totalCount;
            const hasPreviousPage = copyInvoicePage > 0;
            
            // Get current page of results
            const filteredInvoices = allFilteredInvoices.slice(startIndex, endIndex);
            const currentPageStart = totalCount > 0 ? startIndex + 1 : 0;
            const currentPageEnd = Math.min(endIndex, totalCount);

            return (
              <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, width: '100%' }}>
                <Box sx={{ flex: 1, overflow: 'auto', pr: 0.5, minHeight: 0 }}>
                  {filteredInvoices.length > 0 ? (
                    <Grid container spacing={1.5}>
                      {filteredInvoices.map((inv) => (
                        <Grid item xs={12} key={inv.id}>
                          <Paper
                            elevation={0}
                            sx={{
                              width: '100%',
                              p: 2.5,
                              border: '1px solid',
                              borderColor: 'divider',
                              borderRadius: 2.5,
                              cursor: 'pointer',
                              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                              bgcolor: 'background.paper',
                              position: 'relative',
                              overflow: 'hidden',
                              '&::before': {
                                content: '""',
                                position: 'absolute',
                                left: 0,
                                top: 0,
                                bottom: 0,
                                width: 4,
                                bgcolor: 'transparent',
                                transition: 'background-color 0.25s',
                              },
                              '&:hover': {
                                borderColor: 'primary.main',
                                boxShadow: 3,
                                transform: 'translateY(-3px)',
                                bgcolor: 'action.hover',
                                '&::before': {
                                  bgcolor: 'primary.main',
                                },
                              },
                            }}
                            onClick={() => handleCopyFromInvoice(inv)}
                          >
                            {/* Header Row */}
                            <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                              {/* Left: Invoice Number and Status */}
                              <Box display="flex" alignItems="flex-start" gap={1.5} flex={1} minWidth={0}>
                                <Box
                                  sx={{
                                    p: 1,
                                    borderRadius: 1.5,
                                    bgcolor: 'primary.lighter',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    minWidth: 40,
                                    height: 40,
                                  }}
                                >
                                  <DescriptionIcon sx={{ color: 'primary.main', fontSize: 20 }} />
                                </Box>
                                <Box flex={1} minWidth={0}>
                                  <Typography 
                                    variant="h6" 
                                    fontWeight={700} 
                                    color="primary.main"
                                    sx={{ 
                                      mb: 0.5,
                                      wordBreak: 'break-word',
                                    }}
                                  >
                              {inv.number}
                            </Typography>
                                  <Box display="flex" alignItems="center" gap={0.75} flexWrap="wrap">
                            <Chip
                              label={inv.status}
                              size="small"
                                      sx={{
                                        height: 22,
                                        fontSize: '0.7rem',
                                        fontWeight: 600,
                                      }}
                              color={
                                inv.status === 'paid'
                                  ? 'success'
                                  : inv.status === 'sent'
                                    ? 'primary'
                                    : inv.status === 'overdue'
                                      ? 'error'
                                      : 'default'
                              }
                            />
                                    <Chip 
                                      label="Invoice" 
                                      size="small"
                                      variant="outlined"
                                      sx={{
                                        height: 22,
                                        fontSize: '0.7rem',
                                        fontWeight: 500,
                                      }}
                                      color="primary"
                                    />
                          </Box>
                                </Box>
                              </Box>
                              
                              {/* Right: Total Amount */}
                              <Box 
                                sx={{ 
                                  ml: 2,
                                  textAlign: 'right',
                                  flexShrink: 0,
                                }}
                              >
                                <Typography 
                                  variant="h5" 
                                  fontWeight={800} 
                                  color="primary.main"
                                  sx={{ lineHeight: 1.2 }}
                                >
                                  {formatCurrency(inv.total || 0, inv.currency)}
                                </Typography>
                                <Typography 
                                  variant="caption" 
                                  color="text.secondary"
                                  sx={{ fontSize: '0.65rem' }}
                                >
                                  Total
                                </Typography>
                              </Box>
                            </Box>
                            
                            {/* Divider */}
                            <Divider sx={{ my: 1.5, opacity: 0.5 }} />
                            
                            {/* Details Row */}
                            <Grid container spacing={2}>
                              <Grid item xs={12} sm={6}>
                                <Box display="flex" alignItems="center" gap={1.25}>
                                  <PersonIcon 
                                    sx={{ 
                                      fontSize: 18, 
                                      color: 'text.secondary',
                                      flexShrink: 0,
                                    }} 
                                  />
                                  <Box minWidth={0} flex={1}>
                                    <Typography 
                                      variant="caption" 
                                      color="text.secondary"
                                      sx={{ 
                                        fontSize: '0.7rem',
                                        textTransform: 'uppercase',
                                        letterSpacing: 0.5,
                                        fontWeight: 600,
                                        display: 'block',
                                        mb: 0.25,
                                      }}
                                    >
                                      Client
                                    </Typography>
                                    <Typography 
                                      variant="body2" 
                                      color="text.primary"
                                      sx={{ 
                                        fontWeight: 500,
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                      }}
                                    >
                              {inv.client?.name || 'Unknown Client'}
                            </Typography>
                                  </Box>
                                </Box>
                              </Grid>
                              
                              <Grid item xs={12} sm={6}>
                                <Box display="flex" alignItems="center" gap={1.25}>
                                  <CalendarTodayIcon 
                                    sx={{ 
                                      fontSize: 18, 
                                      color: 'text.secondary',
                                      flexShrink: 0,
                                    }} 
                                  />
                                  <Box minWidth={0} flex={1}>
                                    <Typography 
                                      variant="caption" 
                                      color="text.secondary"
                                      sx={{ 
                                        fontSize: '0.7rem',
                                        textTransform: 'uppercase',
                                        letterSpacing: 0.5,
                                        fontWeight: 600,
                                        display: 'block',
                                        mb: 0.25,
                                      }}
                                    >
                                      Date
                                    </Typography>
                                    <Typography 
                                      variant="body2" 
                                      color="text.primary"
                                      sx={{ fontWeight: 500 }}
                                    >
                                      {inv.issueDate ? formatDate(inv.issueDate) : 'N/A'}
                            </Typography>
                          </Box>
                                </Box>
                              </Grid>
                              
                              {inv.items && inv.items.length > 0 && (
                                <Grid item xs={12}>
                                  <Box display="flex" alignItems="center" gap={1.25}>
                                    <AttachMoneyIcon 
                                      sx={{ 
                                        fontSize: 18, 
                                        color: 'text.secondary',
                                        flexShrink: 0,
                                      }} 
                                    />
                                    <Box minWidth={0} flex={1}>
                                      <Typography 
                                        variant="caption" 
                                        color="text.secondary"
                                        sx={{ 
                                          fontSize: '0.7rem',
                                          textTransform: 'uppercase',
                                          letterSpacing: 0.5,
                                          fontWeight: 600,
                                          display: 'block',
                                          mb: 0.25,
                                        }}
                                      >
                                        Items
                                      </Typography>
                                      <Typography 
                                        variant="body2" 
                                        color="text.primary"
                                        sx={{ fontWeight: 500 }}
                                      >
                                        {inv.items.length} item{inv.items.length !== 1 ? 's' : ''}
                                      </Typography>
                                    </Box>
                                  </Box>
                                </Grid>
                              )}
                            </Grid>
                          </Paper>
                        </Grid>
                      ))}
                    </Grid>
                  ) : invoicesList && invoicesList.length > 0 ? (
                    <Box
                      sx={{
                        textAlign: 'center',
                        py: 6,
                        px: 3,
                      }}
                    >
                      <SearchIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
                      <Typography variant="h6" color="text.secondary" gutterBottom>
                        No invoices match your search
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Try a different search term or clear the search to see all invoices
                      </Typography>
                    </Box>
                  ) : (
                    <Box
                      sx={{
                        textAlign: 'center',
                        py: 6,
                        px: 3,
                      }}
                    >
                      <DescriptionIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
                      <Typography variant="h6" color="text.secondary" gutterBottom>
                        No invoices found
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Create your first invoice to use this feature
                      </Typography>
                    </Box>
                  )}
                </Box>
                
                {/* Enhanced Pagination Controls */}
                {totalCount > INVOICES_PER_PAGE && (() => {
                  // Calculate page numbers to show (current page ± 2 pages)
                  const currentPageNum = copyInvoicePage + 1;
                  const showPages: number[] = [];
                  const maxVisiblePages = 5;
                  
                  let startPage = Math.max(1, currentPageNum - Math.floor(maxVisiblePages / 2));
                  let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
                  
                  // Adjust if we're near the end
                  if (endPage - startPage < maxVisiblePages - 1) {
                    startPage = Math.max(1, endPage - maxVisiblePages + 1);
                  }
                  
                  for (let i = startPage; i <= endPage; i++) {
                    showPages.push(i);
                  }
                  
                  return (
                    <Box 
                      sx={{ 
                        mt: 1.5, 
                        pt: 1, 
                        borderTop: '1px solid', 
                        borderColor: 'divider',
                        bgcolor: 'grey.50',
                        borderRadius: 1,
                        p: 1,
                      }}
                    >
                      <Box 
                        display="flex" 
                        justifyContent="space-between" 
                        alignItems="center"
                        flexWrap="wrap"
                        gap={1}
                      >
                        {/* Left side - Navigation buttons */}
                        <Box display="flex" alignItems="center" gap={0.5}>
                          <IconButton
                            onClick={() => setCopyInvoicePage(0)}
                            disabled={!hasPreviousPage}
                            size="small"
                            sx={{ 
                              border: '1px solid',
                              borderColor: 'divider',
                              width: 24,
                              height: 24,
                              padding: 0.5,
                              '&:hover': { bgcolor: 'action.hover' },
                              '&:disabled': { opacity: 0.5 }
                            }}
                            title="First page"
                          >
                            <FirstPageIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                          <Button
                            variant="outlined"
                            startIcon={<ChevronLeftIcon sx={{ fontSize: 16 }} />}
                            onClick={() => setCopyInvoicePage(prev => Math.max(0, prev - 1))}
                            disabled={!hasPreviousPage}
                            size="small"
                            sx={{ minWidth: 70, height: 24, fontSize: '0.7rem', padding: '4px 8px' }}
                          >
                            Previous
                          </Button>
                        </Box>

                        {/* Center - Page numbers */}
                        <Box display="flex" alignItems="center" gap={0.25} flexWrap="wrap" justifyContent="center">
                          {startPage > 1 && (
                            <>
                              <IconButton
                                onClick={() => setCopyInvoicePage(0)}
                                size="small"
                                sx={{ 
                                  minWidth: 24,
                                  height: 24,
                                  fontSize: '0.7rem',
                                  padding: 0.5,
                                  '&:hover': { bgcolor: 'action.hover' }
                                }}
                              >
                                1
                              </IconButton>
                              {startPage > 2 && (
                                <Typography variant="caption" color="text.secondary" sx={{ px: 0.25, fontSize: '0.65rem' }}>
                                  ...
                                </Typography>
                              )}
                            </>
                          )}
                          
                          {showPages.map((pageNum) => (
                            <IconButton
                              key={pageNum}
                              onClick={() => setCopyInvoicePage(pageNum - 1)}
                              size="small"
                              sx={{
                                minWidth: 24,
                                height: 24,
                                fontSize: '0.7rem',
                                padding: 0.5,
                                bgcolor: pageNum === currentPageNum ? 'primary.main' : 'transparent',
                                color: pageNum === currentPageNum ? 'white' : 'text.primary',
                                fontWeight: pageNum === currentPageNum ? 700 : 400,
                                '&:hover': {
                                  bgcolor: pageNum === currentPageNum 
                                    ? 'primary.dark' 
                                    : 'action.hover'
                                },
                                border: pageNum === currentPageNum 
                                  ? 'none' 
                                  : '1px solid',
                                borderColor: 'divider',
                              }}
                            >
                              {pageNum}
                            </IconButton>
                          ))}
                          
                          {endPage < totalPages && (
                            <>
                              {endPage < totalPages - 1 && (
                                <Typography variant="caption" color="text.secondary" sx={{ px: 0.25, fontSize: '0.65rem' }}>
                                  ...
                                </Typography>
                              )}
                              <IconButton
                                onClick={() => setCopyInvoicePage(totalPages - 1)}
                                size="small"
                                sx={{ 
                                  minWidth: 24,
                                  height: 24,
                                  fontSize: '0.7rem',
                                  padding: 0.5,
                                  '&:hover': { bgcolor: 'action.hover' }
                                }}
                              >
                                {totalPages}
                              </IconButton>
                            </>
                          )}
                        </Box>

                        {/* Right side - Navigation buttons */}
                        <Box display="flex" alignItems="center" gap={0.5}>
                          <Button
                            variant="outlined"
                            endIcon={<ChevronRightIcon sx={{ fontSize: 16 }} />}
                            onClick={() => setCopyInvoicePage(prev => prev + 1)}
                            disabled={!hasNextPage}
                            size="small"
                            sx={{ minWidth: 70, height: 24, fontSize: '0.7rem', padding: '4px 8px' }}
                          >
                            Next
                          </Button>
                          <IconButton
                            onClick={() => setCopyInvoicePage(totalPages - 1)}
                            disabled={!hasNextPage}
                            size="small"
                            sx={{ 
                              border: '1px solid',
                              borderColor: 'divider',
                              width: 24,
                              height: 24,
                              padding: 0.5,
                              '&:hover': { bgcolor: 'action.hover' },
                              '&:disabled': { opacity: 0.5 }
                            }}
                            title="Last page"
                          >
                            <LastPageIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Box>
                      </Box>
                      
                      {/* Page info */}
                      <Box 
                        display="flex" 
                        justifyContent="center" 
                        alignItems="center" 
                        gap={1}
                        mt={0.75}
                      >
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                          Showing <strong>{currentPageStart}</strong> to <strong>{currentPageEnd}</strong> of <strong>{totalCount}</strong> invoices
                        </Typography>
                      </Box>
                    </Box>
                  );
                })()}
              </Box>
            );
          })()}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider', flexShrink: 0 }}>
          {(() => {
            // Calculate counts for display
            const allFilteredInvoices = invoicesList
              ?.filter((inv) => {
                if (inv.id === id) return false;
                if (!copyInvoiceSearchQuery.trim()) return true;
                const searchLower = copyInvoiceSearchQuery.toLowerCase();
                const invoiceNumber = inv.number?.toLowerCase() || '';
                const clientName = inv.client?.name?.toLowerCase() || '';
                const issueDateStr = inv.issueDate ? formatDate(inv.issueDate).toLowerCase() : '';
                const totalStr = formatCurrency(inv.total || 0, inv.currency).toLowerCase();
                const statusStr = inv.status?.toLowerCase() || '';
                const typeStr = inv.type?.toLowerCase() || '';
                return (
                  invoiceNumber.includes(searchLower) ||
                  clientName.includes(searchLower) ||
                  issueDateStr.includes(searchLower) ||
                  totalStr.includes(searchLower) ||
                  statusStr.includes(searchLower) ||
                  typeStr.includes(searchLower)
                );
              }) || [];
            
            const totalCount = allFilteredInvoices.length;
            const startIndex = copyInvoicePage * INVOICES_PER_PAGE;
            const endIndex = startIndex + INVOICES_PER_PAGE;
            const totalPages = Math.ceil(totalCount / INVOICES_PER_PAGE);
            const currentPageStart = totalCount > 0 ? startIndex + 1 : 0;
            const currentPageEnd = Math.min(endIndex, totalCount);
            
            return (
              <Box display="flex" justifyContent="space-between" alignItems="center" width="100%">
                {totalCount > 0 ? (
                  <Box 
                    sx={{ 
                      p: 1,
                      bgcolor: 'grey.50',
                      borderRadius: 1,
                      border: '1px solid',
                      borderColor: 'divider',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.75,
                    }}
                  >
                    <Box
                      component="span"
                      sx={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        bgcolor: 'primary.main',
                      }}
                    />
                    <Typography 
                      variant="caption" 
                      color="text.primary" 
                      sx={{ 
                        fontWeight: 500,
                        fontSize: '0.7rem',
                      }}
                    >
                      {totalCount > INVOICES_PER_PAGE
                        ? `Showing ${currentPageStart}-${currentPageEnd} of ${totalCount} invoices (Page ${copyInvoicePage + 1} of ${totalPages})`
                        : `${totalCount} invoice${totalCount !== 1 ? 's' : ''} found`
                      }
                    </Typography>
                  </Box>
                ) : (
                  <Box />
                )}
                <Button 
                  onClick={() => {
                    setCopyInvoiceDialogOpen(false);
                    setCopyInvoiceSearchQuery('');
                    setCopyInvoiceSortBy('date');
                    setCopyInvoicePage(0);
                  }}
                  variant="outlined"
                  size="small"
                  sx={{ minWidth: 80, height: 28, fontSize: '0.75rem', padding: '4px 12px' }}
                >
                  Cancel
                </Button>
              </Box>
            );
          })()}
        </DialogActions>
      </Dialog>

      {/* Navigation Confirmation Dialog */}
      <Dialog
        open={showNavigationDialog}
        onClose={handleNavigationCancel}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
          },
        }}
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1.5}>
            <WarningIcon color="warning" />
            <Typography variant="h6" component="span" fontWeight="bold">
              Unsaved Changes
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mt: 1 }}>
            You have unsaved changes. Are you sure you want to leave? Your changes will be lost.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 1 }}>
          <Button onClick={handleNavigationCancel} color="inherit">
            Stay on Page
          </Button>
          <Button
            onClick={handleNavigationConfirm}
            color="warning"
            variant="contained"
            autoFocus
          >
            Leave Without Saving
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default InvoiceForm;

