import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDebounce } from '../../utils/useDebounce';
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
  alpha,
  useTheme,
  CircularProgress,
  InputAdornment,
  TablePagination,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import ReceiptIcon from '@mui/icons-material/Receipt';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import SendIcon from '@mui/icons-material/Send';
import DraftIcon from '@mui/icons-material/Drafts';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import DownloadIcon from '@mui/icons-material/Download';
import FileCopyIcon from '@mui/icons-material/FileCopy';
import PersonIcon from '@mui/icons-material/Person';
import NumbersIcon from '@mui/icons-material/Numbers';
import FilterListIcon from '@mui/icons-material/FilterList';
import { useInvoicesPaged, useDeleteInvoice, useCreateInvoice, useUpdateInvoice } from '../../hooks/useInvoices';
// Organizations removed - data is now user-scoped
import { invoicesApi, type CreateInvoiceDto } from '../../api/invoices';
import { formatCurrency } from '../../utils/formatters';
import { formatDate } from '../../utils/dates';
import type { InvoiceStatus, Invoice } from '../../types/invoice';
import { useToast } from '../../contexts/ToastContext';
import { useUndo } from '../../hooks/useUndo';
import { logger } from '../../utils/logger';
import { getErrorMessage } from '../../utils/errorHandling';
import { exportToCSV } from '../../utils/export';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { AdvancedFilters } from '../../components/common/AdvancedFilters';
import type { AdvancedFiltersState } from '../../components/common/AdvancedFilters';
import { useQueryClient } from '@tanstack/react-query';
import { InvoiceQuickActions } from '../../components/invoices/InvoiceQuickActions';
import { EmptyState } from '../../components/common/EmptyState';
import { SearchBar } from '../../components/common/SearchBar';
import { useSearch } from '../../contexts/SearchContext';
import { useTableColumns } from '../../hooks/useTableColumns';

// Helper to generate local date-only string (YYYY-MM-DD) to avoid UTC shifting issues
const toDateOnlyLocal = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const InvoicesList = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const PAGE_SIZE = 100;
  const [page, setPage] = useState(0); // MUI TablePagination is 0-based
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  // FIX #155: Debounce search input to reduce API calls
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  // Initialize status filter from URL query param first, then localStorage, then default to 'all'
  const [statusFilter, setStatusFilter] = useState<string>(() => {
    const urlStatus = searchParams.get('status');
    if (urlStatus) {
      return urlStatus;
    }
    return localStorage.getItem('invoices_statusFilter') || 'all';
  });
  // Type filter removed - all invoices are now just invoices (no estimates)
  // Keep state for backward compatibility but always use 'all'
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<string | null>(null);
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFiltersState | null>(null);
  const updateInvoice = useUpdateInvoice();
  const { showToast } = useToast();
  const { createDeleteUndo } = useUndo();
  const { addToHistory } = useSearch();
  const queryClient = useQueryClient();
  // Organizations removed - data is now user-scoped
  
  // Clear cache and invalidate queries on mount to ensure fresh data
  useEffect(() => {
    // Invalidate all invoice-related queries to force fresh fetch
    queryClient.invalidateQueries({ queryKey: ['invoices'], exact: false });
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
  
  // Get URL status param once
  const urlStatus = searchParams.get('status');
  const prevUrlStatusRef = useRef<string | null>(null);
  
  // If URL has status, URL always wins
  useEffect(() => {
    if (urlStatus) {
      setStatusFilter(urlStatus);
    }
  }, [urlStatus]);
  
  // If URL status gets removed, restore localStorage ONLY if we were still URL-controlled
  useEffect(() => {
    const prev = prevUrlStatusRef.current;
    prevUrlStatusRef.current = urlStatus;

    if (!urlStatus && prev) {
      setStatusFilter((current) => {
        // Only restore from localStorage if the current value matches what URL was controlling
        if (current === prev) {
          return localStorage.getItem('invoices_statusFilter') || 'all';
        }
        // User changed it (ex: Clear Filters), so don't override
        return current;
      });
    }
  }, [urlStatus]);
  
  // Helper to sync status filter with URL
  const setStatusAndSyncUrl = useCallback((nextStatus: string) => {
    setStatusFilter(nextStatus);

    const next = new URLSearchParams(searchParams);
    if (nextStatus === 'all') {
      next.delete('status');
    } else {
      next.set('status', nextStatus);
    }

    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);
  
  // Persist filters to localStorage (only when not controlled by URL)
  useEffect(() => {
    if (!urlStatus) {
      localStorage.setItem('invoices_statusFilter', statusFilter);
    }
  }, [statusFilter, urlStatus]);
  
  // Type filter removed - no longer persisting to localStorage

  // FIX #114: Filter state persisted in query key via useMemo
  // FIX #155: Use debounced search term to reduce API calls
  const invoiceFilters = useMemo(() => {
    const filters: {
      status?: string;
      type?: string;
      search?: string;
      issueDateFrom?: string;
      issueDateTo?: string;
      dueDateFrom?: string;
      dueDateTo?: string;
      paidDateFrom?: string;
      paidDateTo?: string;
      createdAtFrom?: string;
      createdAtTo?: string;
      totalMin?: number;
      totalMax?: number;
      subtotalMin?: number;
      subtotalMax?: number;
    } = {};
    if (statusFilter && statusFilter !== 'all') {
      filters.status = statusFilter;
    }
    // Type filter removed - all invoices are now just invoices (no estimates)
    // Always use 'invoice' type, no filtering needed
    if (debouncedSearchTerm && debouncedSearchTerm.trim()) {
      filters.search = debouncedSearchTerm.trim();
    }
    
    // Apply advanced filters
    if (advancedFilters) {
      // Date ranges
      advancedFilters.dateRanges.forEach(range => {
        if (range.startDate) {
          const fieldMap: Record<string, string> = {
            'Issue Date': 'issueDateFrom',
            'Due Date': 'dueDateFrom',
            'Paid Date': 'paidDateFrom',
            'Created Date': 'createdAtFrom',
          };
          const key = fieldMap[range.label];
          if (key) {
            filters[key as keyof typeof filters] = range.startDate.toISOString().split('T')[0];
          }
        }
        if (range.endDate) {
          const fieldMap: Record<string, string> = {
            'Issue Date': 'issueDateTo',
            'Due Date': 'dueDateTo',
            'Paid Date': 'paidDateTo',
            'Created Date': 'createdAtTo',
          };
          const key = fieldMap[range.label];
          if (key) {
            filters[key as keyof typeof filters] = range.endDate.toISOString().split('T')[0];
          }
        }
      });
      
      // Amount ranges
      advancedFilters.amountRanges.forEach(range => {
        if (range.min !== null) {
          const fieldMap: Record<string, string> = {
            'Total': 'totalMin',
            'Subtotal': 'subtotalMin',
          };
          const key = fieldMap[range.label];
          if (key) {
            filters[key as keyof typeof filters] = range.min;
          }
        }
        if (range.max !== null) {
          const fieldMap: Record<string, string> = {
            'Total': 'totalMax',
            'Subtotal': 'subtotalMax',
          };
          const key = fieldMap[range.label];
          if (key) {
            filters[key as keyof typeof filters] = range.max;
          }
        }
      });
    }
    
    return Object.keys(filters).length > 0 ? filters : undefined;
  }, [statusFilter, debouncedSearchTerm, advancedFilters]); // typeFilter removed

  // Reset to first page when filters/search change (use debounced term)
  useEffect(() => {
    setPage(0);
  }, [statusFilter, debouncedSearchTerm]); // typeFilter removed

  const { data: invoicesPage, isLoading, isRefetching, refetch } = useInvoicesPaged({
    ...(invoiceFilters || {}),
    page: page + 1,
    limit: PAGE_SIZE,
  });
  
  // CRITICAL FIX: Invalidate and refetch when filters change to ensure fresh data
  // This prevents showing stale cached data when switching between filters
  const prevFiltersRef = useRef<string | null>(null);
  useEffect(() => {
    // Serialize filters to compare
    const filtersKey = JSON.stringify(invoiceFilters);
    // Check if filters actually changed
    if (prevFiltersRef.current !== filtersKey) {
      prevFiltersRef.current = filtersKey;
      // Invalidate queries to ensure fresh data when filters change
      queryClient.invalidateQueries({ 
        queryKey: ['invoices', 'paged'], 
        exact: false 
      });
      // Force refetch to get fresh data immediately
      refetch();
    }
  }, [invoiceFilters, refetch, queryClient]);
  
  // FIX #111: Show loading indicator during background refetch
  const isDataLoading = isLoading || isRefetching;

  // CRITICAL FIX: The mutation's onSuccess handler already updates the cache directly
  // We don't need a subscription refetch because:
  // 1. The cache update happens synchronously in onSuccess
  // 2. React Query will automatically re-render when cache changes
  // 3. A refetch could cause race conditions where stale data overwrites our update
  // Removed mutation subscription to prevent interference with cache updates

  // Backend already sorts by createdAt DESC, updatedAt DESC, number DESC
  // Just use the data as-is from the backend
  const invoices = invoicesPage?.data;

  const totalCount = invoicesPage?.meta?.total ?? (invoices?.length ?? 0);
  
  const deleteInvoice = useDeleteInvoice();
  const createInvoice = useCreateInvoice();
  const [isExporting, setIsExporting] = useState(false);
  
  // Column visibility management
  const defaultColumns = ['number', 'client', 'store', 'status', 'total', 'issueDate', 'dueDate'];
  const {
    preferences,
    toggleColumnVisibility,
    resetPreferences,
  } = useTableColumns('invoices-list', defaultColumns);
  
  const columnControls = useMemo(() => [
    { id: 'number', label: 'Number', visible: preferences.number?.visible !== false },
    { id: 'client', label: 'Client', visible: preferences.client?.visible !== false },
    { id: 'store', label: 'Store', visible: preferences.store?.visible !== false },
    { id: 'status', label: 'Status', visible: preferences.status?.visible !== false },
    { id: 'total', label: 'Total', visible: preferences.total?.visible !== false },
    { id: 'issueDate', label: 'Issue Date', visible: preferences.issueDate?.visible !== false },
    { id: 'dueDate', label: 'Due Date', visible: preferences.dueDate?.visible !== false },
  ], [preferences]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isTyping =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        (target as HTMLElement)?.isContentEditable;

      const key = e.key.toLowerCase();

      // Allow Ctrl/Cmd+K to work even while typing (common pattern for search focus)
      // But prevent other shortcuts when typing
      if (isTyping && !((e.ctrlKey || e.metaKey) && key === 'k')) {
        return;
      }

      // Ctrl/Cmd + K: Focus search
      if ((e.ctrlKey || e.metaKey) && key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      // Ctrl/Cmd + N: New invoice
      if ((e.ctrlKey || e.metaKey) && key === 'n') {
        e.preventDefault();
        navigate('/invoices/create');
      }
      // Escape: Clear search
      if (key === 'escape' && searchTerm) {
        setSearchInput('');
        setSearchTerm('');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate, searchTerm]);

  const handleExportCSV = useCallback(async () => {
    // Export ALL invoices matching current filters (not just the current page)
    if (!totalCount || totalCount === 0) {
      showToast('No invoices to export', 'warning');
      return;
    }
    setIsExporting(true);
    try {
      const exportLimit = 500; // faster export while staying reasonable
      const pages = Math.max(1, Math.ceil(totalCount / exportLimit));
      const allInvoices: Invoice[] = [];

      // Show progress for large exports
      if (totalCount > 100) {
        showToast(`Exporting ${totalCount} invoices... This may take a moment.`, 'info');
      }

      for (let p = 1; p <= pages; p++) {
        const res = await invoicesApi.getPaged({
          ...(invoiceFilters || {}),
          page: p,
          limit: exportLimit,
        });
        allInvoices.push(...(res.data || []));
        
        // Update progress for large exports
        if (totalCount > 100 && p < pages) {
          const progress = Math.round((p / pages) * 100);
          logger.info(`Export progress: ${progress}% (${p}/${pages} pages)`);
        }
      }

      const exportData = allInvoices.map(inv => ({
        'Invoice Number': inv.number || '',
        'Client': inv.client?.name || '',
        'Store': inv.store ? `${inv.store.name} (${inv.store.code})` : 'Global',
        'Status': inv.status ? inv.status.charAt(0).toUpperCase() + inv.status.slice(1) : '',
        'Type': inv.type ? inv.type.charAt(0).toUpperCase() + inv.type.slice(1) : '',
        'Issue Date': inv.issueDate ? formatDate(inv.issueDate) : '',
        'Due Date': inv.dueDate ? formatDate(inv.dueDate) : '',
        'Subtotal': inv.subtotal ?? 0,
        'Tax': inv.taxTotal ?? 0,
        'Discount': inv.discountTotal ?? 0,
        'Total': inv.total ?? 0,
        'Currency': inv.currency || 'USD',
        'Paid Date': inv.paidAt ? formatDate(inv.paidAt) : '',
        'Payment Method': inv.paymentMethodNote || '',
        'Notes': (inv.notes || '').replace(/\n/g, ' ').replace(/\r/g, ' ').trim(),
        'Created': inv.createdAt ? formatDate(inv.createdAt) : '',
      }));
      
      exportToCSV(exportData, {
        filename: 'invoices',
        title: 'INVOICES EXPORT',
        description: 'Complete invoice data export with all financial details',
        includeMetadata: true,
        formatNumbers: true,
        formatCurrencyFields: false, // Currency is in separate column
        formatDates: true,
      });
      
      showToast('Invoices exported successfully', 'success');
    } catch (error) {
      logger.error('Export error:', error);
      showToast('Failed to export invoices', 'error');
    } finally {
      setIsExporting(false);
    }
  }, [invoiceFilters, showToast, totalCount]);

  const handleDuplicateInvoice = useCallback(async (invoiceId: string) => {
    try {
      const invoice = invoices?.find(inv => inv.id === invoiceId);
      if (!invoice) return;

      // Allow duplication of invoices in ANY status (draft, sent, paid, cancelled, overdue)
      // The duplicated invoice will always be created as a new draft invoice
      // with the next available invoice number and a due date one week from today

      // Calculate due date: one week from today
      const today = new Date();
      const oneWeekFromToday = new Date(today);
      oneWeekFromToday.setDate(today.getDate() + 7);

      const duplicateData = {
        clientId: invoice.clientId,
        storeId: invoice.storeId, // Include store if it exists
        type: invoice.type,
        issueDate: toDateOnlyLocal(new Date()), // Today's date
        dueDate: toDateOnlyLocal(oneWeekFromToday), // One week from today
        currency: invoice.currency,
        notes: invoice.notes || '',
        // Copy all invoice items with all their fields (regardless of source invoice status)
        items: invoice.items?.map(item => ({
          inventoryItemId: item.inventoryItemId,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          taxRate: item.taxRate,
          discountRate: item.discountRate,
          // Include any additional fields that might exist
          ...('printSpecifications' in item && item.printSpecifications && { printSpecifications: item.printSpecifications }),
        })) || [],
        isDuplicate: true, // Flag to skip quota check
        // Note: Invoice number will be automatically generated by backend (next available number)
        // Note: Duplicated invoice will always be created with 'draft' status regardless of source status
      };

      const newInvoice = await createInvoice.mutateAsync(duplicateData);
      
      // Ensure we have a valid UUID (not a temp ID from optimistic update)
      // The mutation should return the real invoice from the server, but double-check
      if (!newInvoice || !newInvoice.id || newInvoice.id.startsWith('temp-') || typeof newInvoice.id !== 'string') {
        throw new Error('Invalid invoice ID received from server. Please try again.');
      }
      
      // Remove any temp invoice entries from cache to prevent navigation issues
      queryClient.removeQueries({ 
        predicate: (query) => {
          const key = query.queryKey;
          if (Array.isArray(key)) {
            // Remove queries with temp IDs in any position
            const hasTempId = key.some(k => typeof k === 'string' && k.startsWith('temp-'));
            if (hasTempId) return true;
            // Also remove detail queries with temp IDs
            if (key.length >= 2 && typeof key[1] === 'string' && key[1].startsWith('temp-')) {
              return true;
            }
          }
          return false;
        }
      });
      
      // No delay needed - mutation's onSuccess handler updates cache synchronously
      // React Query will handle the cache update immediately
      
      // Fetch the full invoice with all relations (items, client, etc.) before navigating
      // The create endpoint returns the invoice without relations, so we need to fetch it
      const fullInvoice = await invoicesApi.getById(newInvoice.id);
      
      // Verify we got a valid invoice
      if (!fullInvoice || !fullInvoice.id) {
        throw new Error('Failed to fetch invoice details. Please try again.');
      }
      
      // Update the cache with the full invoice data
      queryClient.setQueryData(['invoices', fullInvoice.id], fullInvoice);
      
      // Invalidate list queries to ensure the new invoice appears in lists
      queryClient.invalidateQueries({ queryKey: ['invoices'], exact: false });
      
      showToast('Invoice duplicated successfully', 'success');
      // Navigate using the verified invoice ID
      navigate(`/invoices/${fullInvoice.id}/edit`);
    } catch (error: unknown) {
      logger.error('Duplicate invoice error:', error);
      // Fix Issue #2: Use proper error handling utility instead of 'as any'
      const errorMessage = getErrorMessage(error, 'Failed to duplicate invoice');
      showToast(errorMessage, 'error');
    }
  }, [invoices, createInvoice, showToast, navigate]);

  const handleDeleteClick = useCallback((id: string) => {
    setInvoiceToDelete(id);
    setDeleteConfirmOpen(true);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!invoiceToDelete) return;
    
    // Get invoice data before deletion for undo - try cache first, then fetch
    let invoiceData = queryClient.getQueryData<Invoice>(['invoices', invoiceToDelete]);
    
    // If not in cache, try to find it in the current list
    if (!invoiceData) {
      const pagedData = queryClient.getQueryData<{ data: Invoice[] }>(['invoices', 'paged']);
      invoiceData = pagedData?.data?.find(inv => inv.id === invoiceToDelete);
    }
    
    // If still not found, fetch it
    if (!invoiceData) {
      try {
        invoiceData = await invoicesApi.getById(invoiceToDelete);
      } catch (error) {
        logger.warn('Could not fetch invoice for undo:', error);
      }
    }
    
    try {
      await deleteInvoice.mutateAsync(invoiceToDelete);
      
      // Create undo operation if we have invoice data
      if (invoiceData) {
        createDeleteUndo(
          'invoice',
          `Invoice ${invoiceData.number}`,
          invoiceData,
          async (invoice: Invoice) => {
            // Restore invoice by creating it again
            try {
              const restoreData: CreateInvoiceDto = {
                clientId: invoice.clientId,
                storeId: invoice.storeId,
                type: invoice.type,
                issueDate: invoice.issueDate instanceof Date 
                  ? invoice.issueDate.toISOString().split('T')[0]
                  : typeof invoice.issueDate === 'string' 
                    ? invoice.issueDate
                    : new Date(invoice.issueDate).toISOString().split('T')[0],
                dueDate: invoice.dueDate 
                  ? (invoice.dueDate instanceof Date
                      ? invoice.dueDate.toISOString().split('T')[0]
                      : typeof invoice.dueDate === 'string'
                        ? invoice.dueDate
                        : new Date(invoice.dueDate).toISOString().split('T')[0])
                  : undefined,
                currency: invoice.currency,
                notes: invoice.notes || undefined,
                items: invoice.items?.map(item => ({
                  inventoryItemId: item.inventoryItemId,
                  description: item.description,
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                  taxRate: item.taxRate,
                  discountRate: item.discountRate,
                })) || [],
              };
              
              await invoicesApi.create(restoreData);
              queryClient.invalidateQueries({ queryKey: ['invoices'], exact: false });
              showToast(`Invoice ${invoice.number} restored`, 'success');
            } catch (error) {
              showToast(getErrorMessage(error, 'Failed to restore invoice'), 'error');
              throw error;
            }
          },
        );
      } else {
        showToast('Invoice deleted successfully', 'success');
      }
      
      setDeleteConfirmOpen(false);
      setInvoiceToDelete(null);
    } catch (error: unknown) {
      showToast(getErrorMessage(error, 'Failed to delete invoice'), 'error');
    }
  }, [invoiceToDelete, deleteInvoice, showToast, createDeleteUndo, queryClient]);

  const handleDeleteCancel = useCallback(() => {
    setDeleteConfirmOpen(false);
    setInvoiceToDelete(null);
  }, []);

  const theme = useTheme();

  const getStatusConfig = useCallback((status: InvoiceStatus) => {
    switch (status) {
      case 'paid':
        return {
          color: theme.palette.success.main,
          bgColor: alpha(theme.palette.success.main, 0.1),
          Icon: CheckCircleIcon,
          label: 'Paid',
        };
      case 'overdue':
        return {
          color: theme.palette.error.main,
          bgColor: alpha(theme.palette.error.main, 0.1),
          Icon: ErrorIcon,
          label: 'Overdue',
        };
      case 'sent':
        return {
          color: theme.palette.info.main,
          bgColor: alpha(theme.palette.info.main, 0.1),
          Icon: SendIcon,
          label: 'Sent',
        };
      case 'draft':
        return {
          color: theme.palette.grey[600],
          bgColor: alpha(theme.palette.grey[500], 0.1),
          Icon: DraftIcon,
          label: 'Draft',
        };
      case 'cancelled':
        return {
          color: theme.palette.grey[500],
          bgColor: alpha(theme.palette.grey[500], 0.1),
          Icon: ErrorIcon,
          label: 'Cancelled',
        };
      default:
        return {
          color: theme.palette.grey[600],
          bgColor: alpha(theme.palette.grey[500], 0.1),
          Icon: null,
          label: status,
        };
    }
  }, [theme]);

  // Show loading skeleton only on initial load, not when refetching
  if (isLoading && !invoicesPage) {
    return (
      <Box>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Skeleton variant="text" width={200} height={40} />
          <Skeleton variant="rectangular" width={150} height={40} />
        </Box>
        <Box display="flex" gap={2} mb={2}>
          <Skeleton variant="rectangular" width={200} height={56} />
          <Skeleton variant="rectangular" width={150} height={56} />
          <Skeleton variant="rectangular" width={150} height={56} />
        </Box>
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
    <Box component="main" aria-labelledby="page-title">
      <Box 
        display="flex" 
        justifyContent="space-between" 
        alignItems="center" 
        mb={3}
        sx={{
          flexDirection: { xs: 'column', sm: 'row' },
          gap: { xs: 2, sm: 0 },
          alignItems: { xs: 'stretch', sm: 'center' },
        }}
      >
        <Box>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 600, mb: 0.5 }} id="page-title">
            Invoices
          </Typography>
          {(invoicesPage?.meta || invoices) && (
            <Typography variant="body2" color="text.secondary">
              {totalCount} {totalCount === 1 ? 'invoice' : 'invoices'}
              {statusFilter !== 'all' && ` • ${statusFilter}`}
              {/* Type filter removed - no longer showing type in header */}
              {isRefetching && (
                <Box component="span" sx={{ ml: 1, opacity: 0.7, display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                  • <CircularProgress size={12} />
                  Refreshing...
                </Box>
              )}
            </Typography>
          )}
        </Box>
        <Box 
          display="flex" 
          gap={1}
          sx={{
            flexDirection: { xs: 'column', sm: 'row' },
            width: { xs: '100%', sm: 'auto' },
          }}
        >
          <Tooltip title="Export all invoices to CSV (Excel compatible)">
            <span>
              <Button
                variant="outlined"
                startIcon={isExporting ? <CircularProgress size={16} /> : <DownloadIcon />}
                onClick={handleExportCSV}
                disabled={!invoices || invoices.length === 0 || isExporting}
                size="large"
                aria-label="Export invoices to CSV"
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
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/invoices/create')}
            size="large"
            sx={{ 
              minWidth: { xs: '100%', sm: 160 },
              width: { xs: '100%', sm: 'auto' },
            }}
          >
            Create Invoice
          </Button>
        </Box>
      </Box>

      <Box 
        display="flex" 
        gap={2} 
        mb={3}
        sx={{
          flexWrap: { xs: 'wrap', sm: 'nowrap' },
          '& > *': {
            minWidth: { xs: '100%', sm: 'auto' },
          },
        }}
      >
        <Box sx={{ flexGrow: 1, minWidth: { xs: '100%', sm: 200 } }}>
          <SearchBar
            value={searchInput}
            onChange={(value) => {
              setSearchInput(value);
              setSearchTerm(value.trim());
            }}
            onSearch={(value) => {
              addToHistory(value, 'invoices');
              setSearchTerm(value.trim());
            }}
            placeholder="Search invoices by number, client, or any field..."
            context="invoices"
            showHistory={true}
            showSuggestions={false}
          />
        </Box>
        <Button
          variant="outlined"
          startIcon={<FilterListIcon />}
          onClick={() => setAdvancedFiltersOpen(true)}
          sx={{
            minWidth: { xs: '100%', sm: 140 },
            borderRadius: 2,
            whiteSpace: 'nowrap',
            borderColor: advancedFilters ? 'primary.main' : 'divider',
            bgcolor: advancedFilters ? 'primary.50' : 'transparent',
          }}
        >
          Advanced Filters
          {advancedFilters && (
            <Chip
              label="Active"
              size="small"
              sx={{
                ml: 1,
                height: 20,
                fontSize: '0.7rem',
                bgcolor: 'primary.main',
                color: 'primary.contrastText',
              }}
            />
          )}
        </Button>
        {(searchTerm || statusFilter !== 'all' || advancedFilters) && (
          <Button
            variant="outlined"
            startIcon={<ClearIcon />}
            onClick={() => {
              setSearchInput('');
              setSearchTerm('');
              // typeFilter removed - always 'all' now
              setStatusAndSyncUrl('all');
              setAdvancedFilters(null);
              setPage(0); // Reset pagination to first page
            }}
            sx={{
              minWidth: { xs: '100%', sm: 120 },
              borderRadius: 2,
              whiteSpace: 'nowrap',
            }}
          >
            Clear Filters
          </Button>
        )}
        <FormControl 
          sx={{ 
            minWidth: { xs: 'calc(50% - 8px)', sm: 150 },
            '& .MuiOutlinedInput-root': {
              borderRadius: 2,
            },
          }}
        >
          <InputLabel>Status</InputLabel>
          <Select
            value={statusFilter}
            label="Status"
            onChange={(e) => setStatusAndSyncUrl(e.target.value)}
          >
            <MenuItem value="all">All</MenuItem>
            <MenuItem value="draft">Draft</MenuItem>
            <MenuItem value="sent">Sent</MenuItem>
            <MenuItem value="paid">Paid</MenuItem>
            <MenuItem value="overdue">Overdue</MenuItem>
            <MenuItem value="cancelled">Cancelled</MenuItem>
          </Select>
        </FormControl>
        {/* Type filter removed - all invoices are now just invoices (no estimates) */}
      </Box>


      <TableContainer
        component={Paper}
        sx={{
          borderRadius: 2,
          boxShadow: 1,
          overflowX: 'auto',
          overflowY: 'auto',
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
              py: { xs: 1, sm: 1.5 },
              whiteSpace: { xs: 'nowrap', sm: 'normal' },
              fontSize: { xs: '0.75rem', sm: '0.875rem' },
            },
            minWidth: { xs: 800, sm: 'auto' },
            '& .MuiTableRow-root': {
              '&:hover': {
                bgcolor: { xs: 'transparent', sm: 'action.hover' }, // Disable hover on mobile for better touch
              },
            },
          }}
        >
          <TableHead>
            <TableRow sx={{ bgcolor: 'grey.50' }}>
              <TableCell sx={{ fontWeight: 600, py: 2, px: 2.5, whiteSpace: 'nowrap' }}>
                <Box display="flex" alignItems="center" gap={0.75}>
                  <ReceiptIcon fontSize="small" color="primary" />
                  Number
                </Box>
              </TableCell>
              <TableCell sx={{ fontWeight: 600, px: 2.5, whiteSpace: 'nowrap' }}>
                <Box display="flex" alignItems="center" gap={0.75}>
                  <PersonIcon fontSize="small" color="primary" />
                  Client
                </Box>
              </TableCell>
              <TableCell 
                sx={{ 
                  fontWeight: 600, 
                  px: 2.5, 
                  whiteSpace: 'nowrap',
                  display: preferences.store?.visible === false ? 'none' : { xs: 'none', md: 'table-cell' },
                }}
              >
                Store
              </TableCell>
              <TableCell 
                sx={{ 
                  fontWeight: 600, 
                  px: 2.5, 
                  whiteSpace: 'nowrap',
                  display: preferences.status?.visible === false ? 'none' : 'table-cell',
                }}
              >
                Status
              </TableCell>
              <TableCell 
                sx={{ 
                  fontWeight: 600, 
                  px: 2.5, 
                  whiteSpace: 'nowrap',
                  display: preferences.total?.visible === false ? 'none' : 'table-cell',
                }} 
                align="right"
              >
                <Box display="flex" alignItems="center" gap={0.75} justifyContent="flex-end">
                  <NumbersIcon fontSize="small" color="primary" />
                  Total
                </Box>
              </TableCell>
              <TableCell 
                sx={{ 
                  fontWeight: 600, 
                  px: 2.5, 
                  whiteSpace: 'nowrap',
                  display: preferences.issueDate?.visible === false ? 'none' : { xs: 'none', sm: 'table-cell' },
                }}
              >
                Issue Date
              </TableCell>
              <TableCell 
                sx={{ 
                  fontWeight: 600, 
                  px: 2.5, 
                  whiteSpace: 'nowrap',
                  display: preferences.dueDate?.visible === false ? 'none' : { xs: 'none', sm: 'table-cell' },
                }}
              >
                Due Date
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 600, px: 2.5, whiteSpace: 'nowrap' }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {invoices && invoices.length > 0 ? (
              invoices.map((invoice, index) => {
                // Use the updated invoice from cache if available, otherwise use the original
                const currentInvoice = invoice;
                const statusConfig = getStatusConfig(currentInvoice.status);
                
                return (
                  <TableRow
                    key={`${currentInvoice.id}-${currentInvoice.status}-${currentInvoice.updatedAt || ''}`}
                    hover
                    tabIndex={0}
                    role="button"
                    aria-label={`View invoice ${currentInvoice.number}`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        navigate(`/invoices/${currentInvoice.id}`);
                      }
                    }}
                    sx={{
                      '&:hover': {
                        bgcolor: 'grey.50',
                        cursor: 'pointer',
                      },
                      '&:focus-visible': {
                        outline: '2px solid',
                        outlineColor: 'primary.main',
                        outlineOffset: -2,
                      },
                      transition: 'background-color 0.15s ease',
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                      '& .MuiTableCell-root': {
                        borderBottom: '1px solid',
                        borderColor: 'divider',
                      },
                    }}
                    onClick={() => navigate(`/invoices/${currentInvoice.id}`)}
                  >
                    <TableCell sx={{ px: 2.5, py: 1.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <ReceiptIcon 
                          sx={{ 
                            fontSize: 16, 
                            color: 'primary.main',
                            opacity: 0.8,
                          }} 
                        />
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: 500,
                            fontFamily: 'monospace',
                            color: 'primary.main',
                            fontSize: '0.8125rem',
                          }}
                        >
                          {currentInvoice.number}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ px: 2.5, py: 1.5 }}>
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 500,
                          fontSize: '0.8125rem',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: 200,
                        }}
                        title={currentInvoice.client?.name || '-'}
                      >
                        {currentInvoice.client?.name || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell 
                      sx={{ 
                        px: 2.5, 
                        py: 1.5,
                        display: preferences.store?.visible === false ? 'none' : { xs: 'none', md: 'table-cell' },
                      }}
                    >
                      <Typography
                        variant="body2"
                        sx={{
                          color: currentInvoice.store ? 'text.secondary' : 'text.disabled',
                          fontSize: '0.8125rem',
                          fontStyle: currentInvoice.store ? 'normal' : 'italic',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: 150,
                        }}
                        title={currentInvoice.store ? `${currentInvoice.store.name} (${currentInvoice.store.code})` : '-'}
                      >
                        {currentInvoice.store ? `${currentInvoice.store.name} (${currentInvoice.store.code})` : '-'}
                      </Typography>
                    </TableCell>
                    <TableCell 
                      sx={{ 
                        px: 2.5, 
                        py: 1.5,
                        display: preferences.status?.visible === false ? 'none' : 'table-cell',
                      }}
                    >
                      <Chip
                        label={statusConfig.label}
                        size="small"
                        icon={statusConfig.Icon ? <statusConfig.Icon /> : undefined}
                        sx={{
                          backgroundColor: statusConfig.bgColor,
                          color: statusConfig.color,
                          fontWeight: 500,
                          fontSize: '0.6875rem',
                          height: 24,
                          '& .MuiChip-icon': {
                            color: statusConfig.color,
                            fontSize: '0.875rem',
                          },
                        }}
                      />
                    </TableCell>
                    <TableCell 
                      align="right" 
                      sx={{ 
                        px: 2.5, 
                        py: 1.5,
                        display: preferences.total?.visible === false ? 'none' : 'table-cell',
                      }}
                    >
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 600,
                          fontFamily: 'monospace',
                          fontSize: '0.8125rem',
                        }}
                      >
                        {formatCurrency(currentInvoice.total, currentInvoice.currency)}
                      </Typography>
                    </TableCell>
                    <TableCell 
                      sx={{ 
                        px: 2.5, 
                        py: 1.5,
                        display: preferences.issueDate?.visible === false ? 'none' : { xs: 'none', sm: 'table-cell' },
                      }}
                    >
                      <Typography
                        variant="body2"
                        sx={{
                          color: 'text.secondary',
                          fontSize: '0.8125rem',
                        }}
                      >
                        {formatDate(currentInvoice.issueDate)}
                      </Typography>
                    </TableCell>
                    <TableCell 
                      sx={{ 
                        px: 2.5, 
                        py: 1.5,
                        display: preferences.dueDate?.visible === false ? 'none' : { xs: 'none', sm: 'table-cell' },
                      }}
                    >
                      <Typography
                        variant="body2"
                        sx={{
                          color: currentInvoice.dueDate ? 'text.secondary' : 'text.disabled',
                          fontSize: '0.8125rem',
                          fontStyle: currentInvoice.dueDate ? 'normal' : 'italic',
                        }}
                      >
                        {currentInvoice.dueDate ? formatDate(currentInvoice.dueDate) : '-'}
                      </Typography>
                    </TableCell>
                    <TableCell align="right" sx={{ px: 2.5, py: 1.5 }} onClick={(e) => e.stopPropagation()}>
                      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
                        <Tooltip title="View Details">
                          <IconButton
                            type="button"
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/invoices/${currentInvoice.id}`);
                            }}
                            aria-label={`View invoice ${currentInvoice.number} details`}
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
                        <Tooltip title="Edit">
                          <IconButton
                            type="button"
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/invoices/${currentInvoice.id}/edit`);
                            }}
                            aria-label={`Edit invoice ${currentInvoice.number}`}
                            sx={{
                              '&:hover': {
                                bgcolor: 'action.hover',
                              },
                            }}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Duplicate">
                          <IconButton
                            type="button"
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDuplicateInvoice(currentInvoice.id);
                            }}
                            aria-label={`Duplicate invoice ${currentInvoice.number}`}
                            sx={{
                              '&:hover': {
                                bgcolor: 'action.hover',
                              },
                            }}
                          >
                            <FileCopyIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <InvoiceQuickActions
                          invoice={currentInvoice}
                          onMarkAsPaid={async () => {
                            try {
                              await updateInvoice.mutateAsync({
                                id: currentInvoice.id,
                                data: {
                                  status: 'paid',
                                  paidAt: new Date().toISOString(),
                                },
                              });
                              showToast('Invoice marked as paid', 'success');
                            } catch (error) {
                              showToast(getErrorMessage(error, 'Failed to mark invoice as paid'), 'error');
                            }
                          }}
                          onDuplicate={() => handleDuplicateInvoice(currentInvoice.id)}
                          onDownloadPdf={async () => {
                            try {
                              const blob = await invoicesApi.generatePdf(currentInvoice.id);
                              const url = window.URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = `invoice-${currentInvoice.number}.pdf`;
                              document.body.appendChild(a);
                              a.click();
                              window.URL.revokeObjectURL(url);
                              document.body.removeChild(a);
                              showToast('PDF downloaded successfully', 'success');
                            } catch (error) {
                              showToast(getErrorMessage(error, 'Failed to download PDF'), 'error');
                            }
                          }}
                          onSendEmail={async () => {
                            try {
                              await invoicesApi.sendEmail(currentInvoice.id);
                              showToast('Invoice email sent successfully', 'success');
                            } catch (error) {
                              showToast(getErrorMessage(error, 'Failed to send email'), 'error');
                            }
                          }}
                        />
                        <Tooltip title="Delete">
                          <IconButton
                            type="button"
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteClick(currentInvoice.id);
                            }}
                            color="error"
                            aria-label={`Delete invoice ${currentInvoice.number}`}
                            sx={{
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
                <TableCell colSpan={8} align="center" sx={{ py: 0, border: 'none' }}>
                  <EmptyState
                    icon={<ReceiptIcon sx={{ fontSize: 64, color: 'text.disabled', opacity: 0.5 }} />}
                    title={
                      searchTerm || statusFilter !== 'all'
                        ? 'No invoices found'
                        : 'No invoices yet'
                    }
                    description={
                      searchTerm || statusFilter !== 'all'
                        ? 'Try adjusting your filters to see more results'
                        : 'Get started by creating your first invoice'
                    }
                    action={{
                      label: 'Create Invoice',
                      onClick: () => navigate('/invoices/create'),
                      icon: <AddIcon />,
                    }}
                    onboardingTips={
                      !searchTerm && statusFilter === 'all'
                        ? [
                            'Invoices help you track payments and manage cash flow',
                            'Set up automatic numbering and email notifications in settings',
                          ]
                        : undefined
                    }
                  />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Paper
        sx={{
          mt: 1.5,
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
          overflow: 'hidden',
        }}
      >
        <TablePagination
          component="div"
          count={totalCount}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          rowsPerPage={PAGE_SIZE}
          rowsPerPageOptions={[PAGE_SIZE]}
          labelRowsPerPage="Invoices per page"
          showFirstButton
          showLastButton
        />
      </Paper>

      <ConfirmDialog
        open={deleteConfirmOpen}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        title="Delete Invoice"
        message="Are you sure you want to delete this invoice? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        confirmColor="error"
        loading={deleteInvoice.isPending}
        severity="error"
      />

      <AdvancedFilters
        open={advancedFiltersOpen}
        onClose={() => setAdvancedFiltersOpen(false)}
        onApply={(filters) => {
          setAdvancedFilters(filters);
          setPage(0); // Reset to first page when filters change
        }}
        dateRangeFields={[
          { field: 'issueDate', label: 'Issue Date' },
          { field: 'dueDate', label: 'Due Date' },
          { field: 'paidAt', label: 'Paid Date' },
          { field: 'createdAt', label: 'Created Date' },
        ]}
        amountRangeFields={[
          { field: 'total', label: 'Total' },
          { field: 'subtotal', label: 'Subtotal' },
        ]}
        initialFilters={advancedFilters || undefined}
      />
    </Box>
  );
};

export default InvoicesList;

