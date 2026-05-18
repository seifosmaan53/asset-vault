import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  Skeleton,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Tooltip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  alpha,
  useTheme,
} from '@mui/material';
import Grid from '../../components/common/Grid';
import {
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
} from '@mui/lab';
import EditIcon from '@mui/icons-material/Edit';
import DownloadIcon from '@mui/icons-material/Download';
import PreviewIcon from '@mui/icons-material/Preview';
import { useInvoice, useUpdateInvoice, useCreateInvoice } from '../../hooks/useInvoices';
import { formatCurrency } from '../../utils/formatters';
import { formatDate, formatDateTime } from '../../utils/dates';
import FileCopyIcon from '@mui/icons-material/FileCopy';
import type { InvoiceStatus } from '../../types/invoice';
import { useToast } from '../../contexts/ToastContext';
import { useRecentItems } from '../../hooks/useRecentItems';
import { getErrorMessage } from '../../utils/errorHandling';
import { invoicesApi } from '../../api/invoices';
import { logger } from '../../utils/logger';
import PrintIcon from '@mui/icons-material/Print';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SendIcon from '@mui/icons-material/Send';
import DraftIcon from '@mui/icons-material/Drafts';
import ErrorIcon from '@mui/icons-material/Error';
import CancelIcon from '@mui/icons-material/Cancel';
import EventIcon from '@mui/icons-material/Event';
import PaymentIcon from '@mui/icons-material/Payment';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { useState, useEffect, useRef, useCallback } from 'react';
import CloseIcon from '@mui/icons-material/Close';
import { settingsApi } from '../../api/settings';
import { useDebounce } from '../../utils/useDebounce';
import { EmailDialog } from '../../components/invoices/EmailDialog';
import { Breadcrumbs } from '../../components/common/Breadcrumbs';

// Valid status transitions (mirrors backend rules from invoice-status.util.ts)
const VALID_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  draft: ['sent', 'paid', 'cancelled'],
  sent: ['paid', 'overdue', 'cancelled', 'draft'],
  paid: ['cancelled'], // Paid invoices can only be cancelled
  overdue: ['paid', 'cancelled', 'sent'],
  cancelled: [], // Terminal state
};

// Get valid transitions from current status
const getValidTransitions = (fromStatus: InvoiceStatus): InvoiceStatus[] => {
  return VALID_TRANSITIONS[fromStatus] || [];
};

// Extract print CSS to constant outside component to avoid re-rendering on every hot update
// This significantly improves dev server performance
const PRINT_CSS = `
        .invoice-content-parent {
          display: block !important;
          visibility: visible !important;
          width: 100% !important;
          max-width: 100% !important;
          min-height: auto !important;
          overflow: visible !important;
          position: relative !important;
        }
        
        #invoice-content {
          display: block !important;
          visibility: visible !important;
          width: 100% !important;
          max-width: 100% !important;
          min-height: auto !important;
          overflow: visible !important;
          position: relative !important;
        }
        
        #invoice-content .MuiGrid-container {
          display: flex !important;
          visibility: visible !important;
          width: 100% !important;
          max-width: 100% !important;
          margin: 0 !important;
        }
        
        #invoice-content * {
          visibility: visible !important;
        }
        
        body {
          overflow-y: auto !important;
          overflow-x: hidden !important;
        }
        
        main {
          overflow-y: visible !important;
          overflow-x: hidden !important;
          min-height: auto !important;
          width: 100% !important;
          max-width: 100% !important;
        }
        
        @media print {
    .MuiAppBar-root, .MuiDrawer-root, .MuiDrawer-paper, .MuiToolbar-root, nav,
    header:not(.invoice-print-header), aside, .MuiBox-root[class*="AppBar"],
    .MuiBox-root[class*="Toolbar"], [class*="AppBar"], [class*="Toolbar"],
    [class*="app-bar"], [class*="toolbar"] {
            display: none !important;
            visibility: hidden !important;
          }
          
    button, .MuiButton-root, .MuiIconButton-root {
            display: none !important;
          }
          
          .MuiBreadcrumbs-root {
            display: none !important;
          }
          
          .no-print:not(.invoice-print-header) {
            display: none !important;
          }
          
          body > *:first-child:not(.invoice-print-header),
          main > *:first-child:not(.invoice-print-header),
          [class*="MuiBox-root"]:first-child:not(.invoice-print-header) {
            background: transparent !important;
          }
          
          .invoice-print-header {
            position: static !important;
            display: block !important;
          }
          
          #invoice-header.invoice-print-header {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            z-index: 9999 !important;
          }
          
          body {
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          
    .MuiBox-root[component="main"], main {
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            background: white !important;
          }
          
    body > div, body > div > div {
            background: white !important;
          }
          
          .invoice-content-parent {
            display: block !important;
            visibility: visible !important;
            width: 100% !important;
          }
          
          #invoice-content {
            display: flex !important;
            visibility: visible !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 15px !important;
            background: white !important;
            page-break-inside: avoid;
          }
          
    #invoice-content *, .invoice-content-parent * {
            visibility: visible !important;
          }
          
          .MuiPaper-root {
            box-shadow: none !important;
            border: 1px solid #ddd !important;
            page-break-inside: avoid;
            margin: 0 !important;
            padding: 10px !important;
            background: white !important;
            display: block !important;
          }
          
          #invoice-content .MuiGrid-container {
            margin: 0 !important;
            width: 100% !important;
          }
          
          #invoice-content .MuiGrid-item {
            padding: 8px !important;
          }
          
    #invoice-content .MuiTypography-h4, #invoice-content .MuiTypography-h5,
    #invoice-content .MuiTypography-h6, .invoice-print-header .MuiTypography-h4,
    .invoice-print-header .MuiTypography-h5, .invoice-print-header .MuiTypography-h6 {
            color: #000 !important;
            font-weight: 600 !important;
            visibility: visible !important;
          }
          
    #invoice-content .MuiTypography-body1, #invoice-content .MuiTypography-body2,
    .invoice-print-header .MuiTypography-body1, .invoice-print-header .MuiTypography-body2 {
            color: #333 !important;
            visibility: visible !important;
          }
          
          #invoice-content .MuiChip-root {
            border: 1px solid #ccc !important;
            background: white !important;
            color: #000 !important;
            visibility: visible !important;
          }
          
          #invoice-content .MuiTable-root {
            border-collapse: collapse;
            visibility: visible !important;
          }
          
          #invoice-content .MuiTableCell-root {
            border: 1px solid #ddd !important;
            padding: 12px !important;
            visibility: visible !important;
          }
          
          #invoice-content .MuiTableHead-root .MuiTableCell-root {
            background: #f5f5f5 !important;
            font-weight: 600 !important;
          }
          
          @page {
      margin: 0.5in;
            size: letter;
    }
    
          .invoice-print-header {
            position: static !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 8px 0.5in !important;
            background: white !important;
            page-break-after: avoid !important;
            page-break-inside: avoid !important;
          }
          
          #invoice-header.invoice-print-header {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            border-bottom: 1px solid #1976d2 !important;
            z-index: 9999 !important;
            height: 50px !important;
            box-sizing: border-box !important;
            max-height: 50px !important;
            overflow: hidden !important;
          }
          
          .invoice-print-footer {
            position: static !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 8px 0.5in !important;
            background: white !important;
            page-break-before: avoid !important;
            page-break-inside: avoid !important;
          }
          
          .invoice-content-parent {
            margin-top: 55px !important;
            padding-top: 0 !important;
          }
          
          #invoice-content {
            margin-top: 0 !important;
            padding-top: 15px !important;
          }
          
          #invoice-content > .MuiGrid-item:first-of-type {
            margin-top: 0 !important;
            padding-top: 0 !important;
          }
          
          #invoice-content .MuiGrid-item[data-line-items="true"] {
            page-break-before: always !important;
            margin-top: 20px !important;
            padding-top: 10px !important;
          }
          
          .invoice-print-header + * {
            page-break-before: avoid !important;
          }
          
    #invoice-content table, #invoice-content tr {
            page-break-inside: avoid;
          }
          
    .invoice-totals-wrapper, .invoice-totals-box {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            margin-top: 60px !important;
            padding-top: 15px !important;
            position: relative !important;
            z-index: 1 !important;
          }
          
          #invoice-content .MuiGrid-item[data-totals="true"] {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            margin-top: 60px !important;
            padding-top: 15px !important;
            min-height: 200px !important;
          }
          
          #invoice-content .MuiGrid-item[data-totals="true"]::before {
            content: "" !important;
            display: block !important;
            height: 60px !important;
            margin-top: 0 !important;
          }
          
          #invoice-content .MuiGrid-item[data-totals="true"] {
            page-break-before: auto !important;
            page-break-after: avoid !important;
          }
          
    .invoice-totals-wrapper, .invoice-totals-box {
            margin-top: 60px !important;
            padding-top: 15px !important;
          }
          
          #invoice-content .MuiGrid-item[data-totals="true"]:first-child,
          #invoice-content .MuiGrid-item[data-totals="true"] {
            padding-top: 60px !important;
            margin-top: 0 !important;
          }
        }
`;

// Helper to generate local date-only string (YYYY-MM-DD) to avoid UTC shifting issues
const toDateOnlyLocal = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const InvoiceDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: invoice, isLoading } = useInvoice(id || '');
  const updateInvoice = useUpdateInvoice();
  const createInvoice = useCreateInvoice();
  const { showToast } = useToast();
  const { trackView } = useRecentItems();
  const queryClient = useQueryClient();
  const theme = useTheme();
  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: settingsApi.getSettings,
  });
  
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<InvoiceStatus | null>(null);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [inFlight, setInFlight] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  
  // Track invoice view in recent items - use ref to prevent infinite loops
  const invoiceIdRef = useRef<string | null>(null);
  
  // Reset state when navigating away from invoice detail page
  const previousPathRef = useRef<string>(location.pathname);
  useEffect(() => {
    const currentPath = location.pathname;
    const previousPath = previousPathRef.current;
    
    // Only process if path actually changed
    if (currentPath === previousPath) {
      return;
    }
    
    // Check if we've navigated away from an invoice detail page
    const wasOnInvoiceDetail = previousPath.startsWith('/invoices/') && 
                               previousPath.match(/^\/invoices\/[^/]+$/);
    const isOnInvoiceDetail = currentPath.startsWith('/invoices/') && 
                              currentPath.match(/^\/invoices\/[^/]+$/);
    
    // If we've navigated away from invoice detail, reset state
    if (wasOnInvoiceDetail && !isOnInvoiceDetail) {
      setCancelDialogOpen(false);
      setSelectedStatus(null);
      setEmailDialogOpen(false);
      setInFlight(false);
      invoiceIdRef.current = null; // Reset invoice tracking
    }
    
    previousPathRef.current = currentPath;
  }, [location.pathname]);
  
  // Inject PRINT_CSS with HMR-safe updates (prevents expensive re-renders + updates on hot reload)
  useEffect(() => {
    const styleId = 'invoice-print-css';

    // If HMR swapped the module and PRINT_CSS changed, update it
    let style = document.getElementById(styleId) as HTMLStyleElement | null;

    if (!style) {
      style = document.createElement('style');
      style.id = styleId;
      document.head.appendChild(style);
    }

    if (style.textContent !== PRINT_CSS) {
      style.textContent = PRINT_CSS;
    }

    return () => {
      // Optional: if you want to remove on unmount (usually not necessary)
      // style?.remove();
    };
  }, []);
  
  // Debounce selectedStatus to prevent rapid changes
  // This pattern avoids stale closure issues and is easier to reason about
  const debouncedStatus = useDebounce(selectedStatus, 350);
  
  // Track invoice view in recent items - use ref to prevent infinite loops
  useEffect(() => {
    if (invoice && id && invoiceIdRef.current !== id) {
      invoiceIdRef.current = id;
      trackView(id, 'invoice', `Invoice ${invoice.number}`, `/invoices/${id}`);
    }
  }, [invoice?.id, invoice?.number, id, trackView]);

  // Extract only the fields we need from invoice to avoid unnecessary effect triggers
  const invoiceStatus = invoice?.status;
  const invoicePaidAt = invoice?.paidAt;
  
  // Extract mutation functions/state to avoid identity changes triggering effects
  const mutateAsync = updateInvoice.mutateAsync;
  const isPending = updateInvoice.isPending;
  
  // Track last sent status to prevent duplicate mutations
  const lastSentStatusRef = useRef<InvoiceStatus | null>(null);
  // Use ref for stable lock check + state for UI re-renders
  const inFlightRef = useRef(false);
  
  // Derive isUpdatingStatus from mutation state + in-flight state (triggers re-renders)
  const isUpdatingStatus = isPending || inFlight;

  // Single path for all status updates - prevents race conditions and duplicate refetches
  // Wrapped in useCallback to stabilize identity and prevent unnecessary effect re-runs
  const updateStatus = useCallback(async (nextStatus: InvoiceStatus) => {
    if (!id || !invoiceStatus) return;

    // Block re-entrancy - use ref for stable lock, state for UI updates
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setInFlight(true);

    try {
      const data: { status: InvoiceStatus } = { status: nextStatus };

      // Backend handles paidAt logic, but we can suggest it for UX
      if (nextStatus === 'paid' && !invoicePaidAt) {
        data.paidAt = new Date().toISOString();
      }
      if (invoiceStatus === 'paid' && nextStatus !== 'paid') {
        data.paidAt = null;
      }

      await mutateAsync({ id, data });

      // Consistent invalidation/refetch everywhere
      // FIX: Use correct query key ['invoices', id] to match useInvoice hook
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['invoices'], exact: false }),
        queryClient.invalidateQueries({ queryKey: ['analytics'], exact: false }),
        queryClient.invalidateQueries({ queryKey: ['invoices', id], exact: true }),
      ]);

      showToast(`Invoice status updated to ${nextStatus}`, 'success');
    } catch (e: unknown) {
      showToast(getErrorMessage(e, 'Failed to update status'), 'error');
      throw e;
    } finally {
      inFlightRef.current = false;
      setInFlight(false);
    }
  }, [id, invoiceStatus, invoicePaidAt, mutateAsync, queryClient, showToast]);

  const handleStatusSelect = (status: InvoiceStatus) => {
    // Clear ref to allow new intent always
    lastSentStatusRef.current = null;
    
    if (status === 'cancelled') {
      setSelectedStatus(null); // Clear any staged status
      setCancelDialogOpen(true);
      return;
    }
    
    // Don't toggle - just set the status if different from current
    if (status === invoiceStatus) return;
    setSelectedStatus(status);
  };

  // Quick action buttons: clear staged status and run immediately
  const runImmediateStatus = useCallback(async (status: InvoiceStatus) => {
    setSelectedStatus(null);
    lastSentStatusRef.current = null;
    await updateStatus(status);
  }, [updateStatus]);

  // Auto-trigger mutation when debounced status changes
  // This pattern avoids stale closures and is safer than debouncing the mutation itself
  useEffect(() => {
    // Hard-block auto mutation while cancel dialog is open
    if (cancelDialogOpen) return;
    if (!debouncedStatus) return;
    if (!id || !invoiceStatus) return;

    // Guard: ignore if same as current invoice status
    if (debouncedStatus === invoiceStatus) {
      setSelectedStatus(null);
      return;
    }

    // Block if mutation is in flight
    if (isUpdatingStatus) return;

    // Guard: prevent duplicate mutations (same status already sent)
    if (lastSentStatusRef.current === debouncedStatus) return;

    // Mark as sent before calling updateStatus
    lastSentStatusRef.current = debouncedStatus;

    updateStatus(debouncedStatus)
      .then(() => {
        setSelectedStatus(null);
        lastSentStatusRef.current = null;
      })
      .catch(() => {
        lastSentStatusRef.current = null; // Allow retry
        // Auto-reset staged status on error after toast (user can retry via Select)
        // Use a small delay to allow error toast to be visible
        setTimeout(() => setSelectedStatus(null), 1500);
      });
  }, [cancelDialogOpen, debouncedStatus, id, invoiceStatus, isUpdatingStatus, updateStatus]);

  const handleCancelStatusChange = () => {
    setSelectedStatus(null);
  };

  const handleConfirmCancel = async () => {
    try {
      await updateStatus('cancelled');
      setCancelDialogOpen(false);
    } catch (error: unknown) {
      // Error already handled in updateStatus
      logger.debug('Invoice cancellation error (already handled)', error);
    }
  };

  const handleSendEmail = async (options: {
    to: string;
    subject: string;
    message: string;
    includePdf: boolean;
  }) => {
    if (!id) return;
    setIsSendingEmail(true);
    try {
      const result = await invoicesApi.sendEmail(id, options);
      if (result.emailError) {
        showToast(`Email sent but with warnings: ${result.emailError}`, 'warning');
      } else {
        showToast(result.message || 'Email sent successfully', 'success');
      }
      // Invalidate queries to refresh invoice data
      await queryClient.invalidateQueries({ queryKey: ['invoices'], exact: false });
      await queryClient.invalidateQueries({ queryKey: ['invoices', id], exact: true });
      setEmailDialogOpen(false);
    } catch (error: unknown) {
      showToast(getErrorMessage(error, 'Failed to send email'), 'error');
      throw error;
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Convert to invoice functionality removed - no estimates in the app

  const handleDuplicateInvoice = useCallback(async () => {
    if (!invoice || !id || isDuplicating) return;
    setIsDuplicating(true);
    try {
      // Calculate due date: one week from today
      const today = new Date();
      const oneWeekFromToday = new Date(today);
      oneWeekFromToday.setDate(today.getDate() + 7);

      const duplicateData = {
        clientId: invoice.clientId,
        storeId: invoice.storeId,
        type: invoice.type,
        issueDate: toDateOnlyLocal(new Date()),
        dueDate: toDateOnlyLocal(oneWeekFromToday),
        currency: invoice.currency,
        notes: invoice.notes || '',
        items: invoice.items?.map(item => ({
          inventoryItemId: item.inventoryItemId,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          taxRate: item.taxRate,
          discountRate: item.discountRate,
          ...('printSpecifications' in item && item.printSpecifications && { printSpecifications: item.printSpecifications }),
        })) || [],
        isDuplicate: true,
      };

      const newInvoice = await createInvoice.mutateAsync(duplicateData);
      
      if (!newInvoice || !newInvoice.id) {
        throw new Error('Invalid invoice ID received from server. Please try again.');
      }
      
      showToast('Invoice duplicated successfully', 'success');
      // Navigate to the new invoice
      navigate(`/invoices/${newInvoice.id}`);
    } catch (error: unknown) {
      showToast(getErrorMessage(error, 'Failed to duplicate invoice'), 'error');
    } finally {
      setIsDuplicating(false);
    }
  }, [invoice, id, isDuplicating, createInvoice, showToast, navigate]);

  if (isLoading) {
    return (
      <Box>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Skeleton variant="text" width={200} height={40} />
          <Box display="flex" gap={1}>
            <Skeleton variant="rectangular" width={120} height={40} />
            <Skeleton variant="rectangular" width={120} height={40} />
            <Skeleton variant="rectangular" width={120} height={40} />
          </Box>
        </Box>
        <Paper sx={{ p: 3, borderRadius: 2 }}>
          <Skeleton variant="text" width={300} height={32} sx={{ mb: 2 }} />
          <Skeleton variant="rectangular" width="100%" height={200} sx={{ mb: 2 }} />
          <Skeleton variant="text" width="100%" height={24} />
          <Skeleton variant="text" width="80%" height={24} />
        </Paper>
      </Box>
    );
  }

  if (!invoice) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '400px',
          gap: 2,
        }}
      >
        <Typography variant="h5" color="text.secondary">
          Invoice not found
        </Typography>
        <Button variant="outlined" onClick={() => navigate('/invoices')}>
          Back to Invoices
        </Button>
      </Box>
    );
  }

  const getStatusColor = (status: InvoiceStatus) => {
    switch (status) {
      case 'paid':
        return 'success';
      case 'overdue':
        return 'error';
      case 'sent':
        return 'info';
      case 'draft':
        return 'default';
      default:
        return 'default';
    }
  };

  return (
    <Box sx={{ maxWidth: '100%', width: '100%' }}>
      <Breadcrumbs
        items={[
          { label: 'Invoices', path: '/invoices' },
          { label: invoice.number },
        ]}
      />
      <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={3} className="no-print">
        <Box>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 700, mb: 1 }}>
            {invoice.number}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Chip
              label={invoice?.status ? invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1) : 'Unknown'}
            color={getStatusColor(invoice.status)}
              sx={{ 
                fontWeight: 600,
                fontSize: '0.875rem',
                height: 32,
              }}
            />
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel id="status-select-label">Change Status</InputLabel>
              <Select
                labelId="status-select-label"
                value={selectedStatus ?? invoice.status}
                label="Change Status"
                onChange={(e) => {
                  handleStatusSelect(e.target.value as InvoiceStatus);
                }}
                disabled={isUpdatingStatus || !!selectedStatus}
                sx={{ height: 32 }}
              >
                {(() => {
                  const validTransitions = getValidTransitions(invoice.status);
                  const allStatuses: InvoiceStatus[] = ['draft', 'sent', 'paid', 'overdue', 'cancelled'];
                  
                  // Helper to check if a transition is allowed
                  const canTransitionTo = (toStatus: InvoiceStatus): boolean => {
                    if (toStatus === invoice.status) return true; // Current status is always selectable
                    return validTransitions.includes(toStatus);
                  };
                  
                  return allStatuses.map(status => (
                    <MenuItem 
                      key={status} 
                      value={status}
                      disabled={!canTransitionTo(status)}
                    >
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </MenuItem>
                  ));
                })()}
              </Select>
            </FormControl>
            {selectedStatus && selectedStatus !== invoice?.status && (
                <Box display="flex" gap={1} alignItems="center">
                  {isUpdatingStatus ? (
                    <CircularProgress size={20} sx={{ ml: 1 }} />
                  ) : (
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
                      Updating in {debouncedStatus === selectedStatus ? 'a moment' : '...'}
                    </Typography>
                  )}
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<CloseIcon />}
                    onClick={handleCancelStatusChange}
                    disabled={isUpdatingStatus}
                    sx={{ height: 32 }}
                  >
                    Cancel
                  </Button>
                </Box>
            )}
            {isUpdatingStatus && !selectedStatus && (
              <CircularProgress size={20} sx={{ ml: 1 }} />
            )}
          </Box>
        </Box>
        <Box display="flex" gap={2} sx={{ flexWrap: 'wrap' }}>
          <Button
            variant="outlined"
            startIcon={<PreviewIcon />}
            onClick={() => {
              if (id) {
                navigate(`/invoices/${id}/preview`);
              }
            }}
            disabled={!id || isUpdatingStatus}
          >
            Preview
          </Button>
            <Button
              variant="outlined"
            startIcon={<PrintIcon />}
            onClick={handlePrint}
            disabled={isUpdatingStatus}
            >
            Print Invoice
            </Button>
          <Button
            variant="outlined"
            startIcon={isDownloadingPdf ? <CircularProgress size={16} /> : <DownloadIcon />}
            onClick={async () => {
              if (!id || isDownloadingPdf) return;
              setIsDownloadingPdf(true);
              try {
                const blob = await invoicesApi.generatePdf(id);
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `invoice-${invoice?.number || id}.pdf`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
                showToast('PDF downloaded successfully', 'success');
              } catch (error: unknown) {
                showToast(getErrorMessage(error, 'Failed to generate PDF'), 'error');
              } finally {
                setIsDownloadingPdf(false);
              }
            }}
            disabled={!id || isUpdatingStatus || isDownloadingPdf}
          >
            {isDownloadingPdf ? 'Generating PDF...' : 'Download PDF'}
          </Button>
          <Button
            variant="outlined"
            startIcon={<EditIcon />}
            onClick={() => {
              if (id) {
                navigate(`/invoices/${id}/edit`);
              }
            }}
            disabled={!id || isUpdatingStatus}
          >
            Edit
          </Button>
          <Button
            variant="outlined"
            startIcon={<FileCopyIcon />}
            onClick={handleDuplicateInvoice}
            disabled={!id || isDuplicating}
          >
            {isDuplicating ? 'Duplicating...' : 'Duplicate'}
          </Button>
          <Button
            variant="outlined"
            color="info"
            startIcon={<SendIcon />}
            onClick={() => setEmailDialogOpen(true)}
            disabled={isSendingEmail}
          >
            {isSendingEmail ? 'Sending...' : 'Send Email'}
          </Button>
          {/* Convert to invoice button removed - no estimates in the app */}
          {/* Quick Status Action Buttons */}
          {invoice.status === 'draft' && (
            <Button
              variant="contained"
              color="info"
              startIcon={<SendIcon />}
              onClick={() => runImmediateStatus('sent')}
              disabled={isUpdatingStatus}
            >
              {isUpdatingStatus ? 'Updating...' : 'Mark as Sent'}
            </Button>
          )}
          {invoice.status === 'sent' && (
            <>
            <Tooltip title="Mark this invoice as manually paid. This is a manual status update - no online payment processing is performed.">
              <span>
                <Button 
                  variant="contained" 
                  color="success"
                  startIcon={<CheckCircleIcon />}
                  onClick={() => runImmediateStatus('paid')}
                  disabled={isUpdatingStatus}
                >
                  {isUpdatingStatus ? 'Updating...' : 'Mark as Paid'}
                </Button>
              </span>
            </Tooltip>
              <Button
                variant="outlined"
                color="error"
                startIcon={<ErrorIcon />}
                onClick={() => runImmediateStatus('overdue')}
                disabled={isUpdatingStatus}
              >
                {isUpdatingStatus ? 'Updating...' : 'Mark as Overdue'}
              </Button>
            </>
          )}
        </Box>
      </Box>

      {/* Header Text */}
      {settings?.invoiceHeaderText && (
        <Box mb={1.5} sx={{ textAlign: 'center', pb: 1, borderBottom: '1px solid #e0e0e0' }} className="invoice-print-header">
          <Typography variant="body2" sx={{ color: '#666', fontSize: '0.875rem' }}>
            {settings.invoiceHeaderText}
          </Typography>
        </Box>
      )}

      {/* Company Header - Compact - Fixed on every page when printing */}
      <Box mb={1.5} className="invoice-print-header" sx={{ borderBottom: '1px solid #1976d2', pb: 1, pt: 1 }} id="invoice-header">
        <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ gap: 3 }}>
          <Box>
            <Typography variant="body1" component="h1" sx={{ fontWeight: 700, color: '#1976d2', fontSize: '0.9375rem', mb: 0.25, lineHeight: 1.2 }}>
              {settings?.companyName || 'InvoiceMe'}
            </Typography>
            {settings?.companyEmail && (
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem', lineHeight: 1.2 }}>
                {settings.companyEmail}
              </Typography>
            )}
          </Box>
          <Box textAlign="right">
            <Typography variant="body1" component="h2" sx={{ fontWeight: 700, color: '#1976d2', fontSize: '0.9375rem', mb: 0.25, lineHeight: 1.2 }}>
              {invoice.type === 'invoice' ? 'INVOICE' : 'ESTIMATE'}
            </Typography>
            <Typography variant="body2" component="h3" sx={{ fontWeight: 600, fontSize: '0.8125rem', color: '#333', lineHeight: 1.2 }}>
              {invoice.number}
            </Typography>
          </Box>
        </Box>
      </Box>

      <Box className="invoice-content-parent">
        <Grid container spacing={3} id="invoice-content">
        <Grid item xs={12} md={6}>
          <Box sx={{ p: 2.5, border: '1px solid #e0e0e0', borderRadius: 2, bgcolor: '#fafafa', height: '100%' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#1976d2', mb: 2, fontSize: '0.9375rem', textTransform: 'uppercase', letterSpacing: '1px', borderBottom: '2px solid #1976d2', pb: 1, display: 'inline-block', width: '100%' }}>
              Bill To:
            </Typography>
            <Box sx={{ mt: 2 }}>
              <Typography variant="h6" fontWeight="bold" sx={{ mb: 1.5, fontSize: '1rem', color: '#333' }}>
                {invoice.client?.name}
              </Typography>
              {invoice.client?.email && (
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>
                    {invoice.client.email}
                  </Typography>
                </Box>
              )}
              {invoice.client?.phone && (
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>
                    {invoice.client.phone}
                  </Typography>
                </Box>
              )}
              {invoice.client?.addressJson && (
                <Box mt={1.5} sx={{ pt: 1.5, borderTop: '1px solid #e0e0e0' }}>
                  <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.8, fontSize: '0.875rem' }}>
                    {invoice.client.addressJson.street}
                    <br />
                    {invoice.client.addressJson.city}, {invoice.client.addressJson.state}{' '}
                    {invoice.client.addressJson.zip}
                    <br />
                    {invoice.client.addressJson.country}
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>
        </Grid>

        <Grid item xs={12} md={6}>
          <Box sx={{ p: 1.5, border: '1px solid #e0e0e0', borderRadius: 1, bgcolor: '#fafafa' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#1976d2', mb: 1, fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Invoice Details:
            </Typography>
            <Box sx={{ mt: 2 }}>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Type:
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Chip
                    label="Invoice"
                    size="small"
                    color="primary"
                    sx={{ textTransform: 'capitalize', height: 24, fontSize: '0.75rem', fontWeight: 600 }}
                  />
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Issue Date:
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#333' }}>
                    {formatDate(invoice.issueDate)}
                  </Typography>
                </Grid>
                {invoice.dueDate && (
                  <>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Due Date:
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography 
                        variant="body2" 
                        sx={{ fontSize: '0.875rem', fontWeight: 600 }}
                        color={new Date(invoice.dueDate) < new Date() && invoice.status !== 'paid' ? 'error.main' : '#333'}
                      >
                        {formatDate(invoice.dueDate)}
                      </Typography>
                    </Grid>
                  </>
                )}
                {invoice.paidAt && (
                  <>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Paid At:
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" sx={{ fontSize: '0.875rem', fontWeight: 600 }} color="success.main">
                        {formatDate(invoice.paidAt)}
                      </Typography>
                    </Grid>
                  </>
                )}
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Currency:
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#333' }}>
                    {invoice.currency}
                  </Typography>
                </Grid>
                {invoice.store && (
                  <>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Store:
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#333' }}>
                        {invoice.store.name} ({invoice.store.code})
                      </Typography>
                    </Grid>
                  </>
                )}
              </Grid>
            </Box>
          </Box>
        </Grid>

        <Grid item xs={12} data-line-items="true" sx={{ '@media print': { marginTop: '20px !important', paddingTop: '10px !important', pageBreakBefore: 'always !important' } }}>
          <Box sx={{ mt: 2, '@media print': { marginTop: '20px !important', paddingTop: '10px !important' } }}>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#1976d2', mb: 2, fontSize: '1.125rem', textTransform: 'uppercase', letterSpacing: '1px', borderBottom: '2px solid #1976d2', pb: 1, display: 'inline-block' }}>
              Line Items
            </Typography>
            <TableContainer sx={{ border: '1px solid #e0e0e0', borderRadius: 2, mt: 2, boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: '#1976d2' }}>
                    <TableCell sx={{ color: 'white', fontWeight: 700, py: 1.5, fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Description</TableCell>
                    <TableCell align="right" sx={{ color: 'white', fontWeight: 700, py: 1.5, fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Quantity</TableCell>
                    <TableCell align="right" sx={{ color: 'white', fontWeight: 700, py: 1.5, fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Unit Price</TableCell>
                    <TableCell align="right" sx={{ color: 'white', fontWeight: 700, py: 1.5, fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tax %</TableCell>
                    <TableCell align="right" sx={{ color: 'white', fontWeight: 700, py: 1.5, fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Discount %</TableCell>
                    <TableCell align="right" sx={{ color: 'white', fontWeight: 700, py: 1.5, fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total</TableCell>
                  </TableRow>
                </TableHead>
                  <TableBody>
                    {invoice.items && invoice.items.length > 0 ? (
                    invoice.items.map((item, index) => (
                      <TableRow 
                        key={item.id}
                        sx={{ 
                          bgcolor: index % 2 === 0 ? 'white' : '#f9f9f9',
                          '&:hover': { bgcolor: '#f5f5f5' },
                          borderBottom: '1px solid #e0e0e0'
                        }}
                      >
                        <TableCell sx={{ py: 1.5, fontSize: '0.875rem', fontWeight: 500 }}>
                          <Box>
                            {item.description}
                          </Box>
                        </TableCell>
                        <TableCell align="right" sx={{ py: 1.5, fontSize: '0.875rem' }}>{item.quantity}</TableCell>
                        <TableCell align="right" sx={{ py: 1.5, fontSize: '0.875rem', fontWeight: 500 }}>
                          {formatCurrency(item.unitPrice, invoice.currency)}
                        </TableCell>
                        <TableCell align="right" sx={{ py: 1.5, fontSize: '0.875rem' }}>{item.taxRate}%</TableCell>
                        <TableCell align="right" sx={{ py: 1.5, fontSize: '0.875rem' }}>{item.discountRate}%</TableCell>
                        <TableCell align="right" sx={{ py: 1.5, fontSize: '0.875rem', fontWeight: 700, color: '#1976d2' }}>
                          {formatCurrency(item.lineTotal, invoice.currency)}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} align="center">
                        No items
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        </Grid>
        
        <Grid item xs={12} data-totals="true" sx={{ '@media print': { pageBreakInside: 'avoid', breakInside: 'avoid', marginTop: '60px !important', paddingTop: '15px !important' } }}>
          <Box display="flex" justifyContent="flex-end" sx={{ mt: 3, '@media print': { pageBreakInside: 'avoid', breakInside: 'avoid', marginTop: '60px !important', paddingTop: '15px !important' } }} className="invoice-totals-wrapper">
            <Box sx={{ p: 3, minWidth: 320, border: '2px solid #1976d2', borderRadius: 2, bgcolor: '#f8f9fa', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', '@media print': { pageBreakInside: 'avoid', breakInside: 'avoid', position: 'relative', zIndex: 1 } }} className="invoice-totals-box">
              <Grid container spacing={2}>
                <Grid item xs={6} textAlign="right">
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem', fontWeight: 500 }}>Subtotal:</Typography>
                </Grid>
                <Grid item xs={6} textAlign="right">
                  <Typography variant="body1" sx={{ fontSize: '0.9375rem', fontWeight: 600, color: '#333' }}>{formatCurrency(invoice.subtotal, invoice.currency)}</Typography>
                </Grid>
                <Grid item xs={6} textAlign="right">
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem', fontWeight: 500 }}>Discount:</Typography>
                </Grid>
                <Grid item xs={6} textAlign="right">
                  <Typography variant="body1" sx={{ fontSize: '0.9375rem', fontWeight: 600 }} color="error.main">-{formatCurrency(invoice.discountTotal, invoice.currency)}</Typography>
                </Grid>
                <Grid item xs={6} textAlign="right">
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem', fontWeight: 500 }}>Tax:</Typography>
                </Grid>
                <Grid item xs={6} textAlign="right">
                  <Typography variant="body1" sx={{ fontSize: '0.9375rem', fontWeight: 600, color: '#333' }}>{formatCurrency(invoice.taxTotal, invoice.currency)}</Typography>
                </Grid>
                <Grid item xs={12}>
                  <Divider sx={{ borderWidth: 2, borderColor: '#1976d2', my: 1 }} />
                </Grid>
                <Grid item xs={6} textAlign="right">
                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#1976d2', fontSize: '1.125rem' }}>Total:</Typography>
                </Grid>
                <Grid item xs={6} textAlign="right">
                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#1976d2', fontSize: '1.125rem' }}>
                    {formatCurrency(invoice.total, invoice.currency)}
                  </Typography>
                </Grid>
              </Grid>
            </Box>
          </Box>
        </Grid>

        {invoice.notes && (
          <Grid item xs={12}>
            <Box sx={{ p: 1.5, border: '1px solid #e0e0e0', borderRadius: 1, bgcolor: '#fafafa' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#1976d2', mb: 0.5, fontSize: '0.875rem' }}>
                Notes
              </Typography>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-line', fontSize: '0.8125rem' }}>{invoice.notes}</Typography>
            </Box>
          </Grid>
        )}

        {settings?.showPaymentInstructions && (settings?.defaultInvoiceTerms || settings?.defaultInvoiceNotes) && (
          <Grid item xs={12}>
            <Box sx={{ p: 1.5, border: '1px solid #e0e0e0', borderRadius: 1, bgcolor: '#fafafa' }}>
              {settings.defaultInvoiceTerms && (
                <Box mb={1.5}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#1976d2', mb: 0.5, fontSize: '0.875rem' }}>
                    Terms & Conditions
                  </Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-line', color: '#555', fontSize: '0.8125rem' }}>
                    {settings.defaultInvoiceTerms}
                  </Typography>
                </Box>
              )}
              {settings.defaultInvoiceNotes && (
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#1976d2', mb: 0.5, fontSize: '0.875rem' }}>
                    Payment Instructions
                  </Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-line', color: '#555', fontSize: '0.8125rem' }}>
                    {settings.defaultInvoiceNotes}
                  </Typography>
                </Box>
              )}
            </Box>
          </Grid>
        )}

        {settings?.invoiceFooterText && (
          <Grid item xs={12}>
            <Box sx={{ textAlign: 'center', pt: 1, borderTop: '1px solid #e0e0e0', mt: 1 }} className="invoice-print-footer">
              <Typography variant="caption" sx={{ color: '#666', fontSize: '0.75rem' }}>
                {settings.invoiceFooterText}
              </Typography>
            </Box>
          </Grid>
        )}

        {(settings?.companyTaxId || settings?.companyRegistrationNumber || settings?.companyVatNumber) && (
          <Grid item xs={12}>
            <Box sx={{ textAlign: 'center', mt: 1, pt: 1, borderTop: '1px solid #e0e0e0' }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                {settings.companyTaxId && `Tax ID: ${settings.companyTaxId}`}
                {settings.companyTaxId && (settings.companyRegistrationNumber || settings.companyVatNumber) && ' | '}
                {settings.companyRegistrationNumber && `Reg. No: ${settings.companyRegistrationNumber}`}
                {settings.companyRegistrationNumber && settings.companyVatNumber && ' | '}
                {settings.companyVatNumber && `VAT: ${settings.companyVatNumber}`}
              </Typography>
            </Box>
          </Grid>
        )}

        <Grid item xs={12} md={6} className="no-print">
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ mb: 3, fontWeight: 600 }}>
              Timeline
            </Typography>
            <Timeline position="right" sx={{ p: 0, m: 0 }}>
              {/* Created */}
              <TimelineItem>
                <TimelineSeparator>
                  <TimelineDot 
                    sx={{ 
                      backgroundColor: theme.palette.primary.main,
                      boxShadow: `0 0 0 4px ${alpha(theme.palette.primary.main, 0.1)}`,
                    }}
                  >
                    <EventIcon sx={{ fontSize: 16, color: 'white' }} />
                  </TimelineDot>
                  <TimelineConnector />
                </TimelineSeparator>
                <TimelineContent sx={{ py: 1 }}>
                  <Typography variant="subtitle2" fontWeight={600} color="primary">
                    Invoice Created
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {formatDateTime(invoice.createdAt)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                    Status: Draft
                  </Typography>
                </TimelineContent>
              </TimelineItem>

              {/* Issue Date */}
              <TimelineItem>
                <TimelineSeparator>
                  <TimelineDot 
                    sx={{ 
                      backgroundColor: theme.palette.info.main,
                      boxShadow: `0 0 0 4px ${alpha(theme.palette.info.main, 0.1)}`,
                    }}
                  >
                    <EventIcon sx={{ fontSize: 16, color: 'white' }} />
                  </TimelineDot>
                  <TimelineConnector />
                </TimelineSeparator>
                <TimelineContent sx={{ py: 1 }}>
                  <Typography variant="subtitle2" fontWeight={600} color="info.main">
                    Issue Date
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {formatDate(invoice.issueDate)}
                  </Typography>
                </TimelineContent>
              </TimelineItem>

              {/* Due Date */}
              {invoice.dueDate && (
                <TimelineItem>
                  <TimelineSeparator>
                    <TimelineDot 
                      variant={new Date(invoice.dueDate) < new Date() && invoice.status !== 'paid' ? 'filled' : 'outlined'}
                      sx={{ 
                        borderColor: theme.palette.warning.main,
                        backgroundColor: new Date(invoice.dueDate) < new Date() && invoice.status !== 'paid' 
                          ? theme.palette.error.main 
                          : 'transparent',
                        boxShadow: `0 0 0 4px ${alpha(theme.palette.warning.main, 0.1)}`,
                      }}
                    >
                      <EventIcon sx={{ fontSize: 16 }} />
                    </TimelineDot>
                    <TimelineConnector />
                  </TimelineSeparator>
                  <TimelineContent sx={{ py: 1 }}>
                    <Typography variant="subtitle2" fontWeight={600} color="warning.main">
                      Due Date
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {formatDate(invoice.dueDate)}
                    </Typography>
                    {new Date(invoice.dueDate) < new Date() && invoice.status !== 'paid' && (
                      <Chip 
                        label="Overdue" 
                        size="small" 
                        color="error" 
                        sx={{ mt: 0.5, height: 20, fontSize: '0.7rem' }} 
                      />
                    )}
                  </TimelineContent>
                </TimelineItem>
              )}

              {/* Status: Sent */}
              {(invoice.status === 'sent' || invoice.status === 'paid' || invoice.status === 'overdue') && (
                <TimelineItem>
                  <TimelineSeparator>
                    <TimelineDot 
                      sx={{ 
                        backgroundColor: theme.palette.info.main,
                        boxShadow: `0 0 0 4px ${alpha(theme.palette.info.main, 0.1)}`,
                      }}
                    >
                      <SendIcon sx={{ fontSize: 16, color: 'white' }} />
                    </TimelineDot>
                    <TimelineConnector />
                  </TimelineSeparator>
                  <TimelineContent sx={{ py: 1 }}>
                    <Typography variant="subtitle2" fontWeight={600} color="info.main">
                      Status Changed: Sent
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {formatDateTime(invoice.updatedAt)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                      Invoice sent to client
                    </Typography>
                  </TimelineContent>
                </TimelineItem>
              )}

              {/* Status: Overdue */}
              {invoice.status === 'overdue' && (
                <TimelineItem>
                  <TimelineSeparator>
                    <TimelineDot 
                      sx={{ 
                        backgroundColor: theme.palette.error.main,
                        boxShadow: `0 0 0 4px ${alpha(theme.palette.error.main, 0.1)}`,
                      }}
                    >
                      <ErrorIcon sx={{ fontSize: 16, color: 'white' }} />
                    </TimelineDot>
                    <TimelineConnector />
                  </TimelineSeparator>
                  <TimelineContent sx={{ py: 1 }}>
                    <Typography variant="subtitle2" fontWeight={600} color="error.main">
                      Status Changed: Overdue
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {formatDateTime(invoice.updatedAt)}
                    </Typography>
                  </TimelineContent>
                </TimelineItem>
              )}

              {/* Paid */}
              {invoice.paidAt && (
                <TimelineItem>
                  <TimelineSeparator>
                    <TimelineDot 
                      sx={{ 
                        backgroundColor: theme.palette.success.main,
                        boxShadow: `0 0 0 4px ${alpha(theme.palette.success.main, 0.1)}`,
                      }}
                    >
                      <PaymentIcon sx={{ fontSize: 16, color: 'white' }} />
                    </TimelineDot>
                    <TimelineConnector />
                  </TimelineSeparator>
                  <TimelineContent sx={{ py: 1 }}>
                    <Typography variant="subtitle2" fontWeight={600} color="success.main">
                      Payment Received
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {formatDateTime(invoice.paidAt)}
                    </Typography>
                    {invoice.paymentMethodNote && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                        {invoice.paymentMethodNote}
                      </Typography>
                    )}
                  </TimelineContent>
                </TimelineItem>
              )}

              {/* Status: Paid */}
              {invoice.status === 'paid' && invoice.paidAt && (
                <TimelineItem>
                  <TimelineSeparator>
                    <TimelineDot 
                      sx={{ 
                        backgroundColor: theme.palette.success.main,
                        boxShadow: `0 0 0 4px ${alpha(theme.palette.success.main, 0.1)}`,
                      }}
                    >
                      <CheckCircleIcon sx={{ fontSize: 16, color: 'white' }} />
                    </TimelineDot>
                    <TimelineConnector />
                  </TimelineSeparator>
                  <TimelineContent sx={{ py: 1 }}>
                    <Typography variant="subtitle2" fontWeight={600} color="success.main">
                      Status Changed: Paid
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {formatDateTime(invoice.updatedAt)}
                    </Typography>
                  </TimelineContent>
                </TimelineItem>
              )}

              {/* Status: Cancelled */}
              {invoice.status === 'cancelled' && (
                <TimelineItem>
                  <TimelineSeparator>
                    <TimelineDot 
                      sx={{ 
                        backgroundColor: theme.palette.grey[600],
                        boxShadow: `0 0 0 4px ${alpha(theme.palette.grey[600], 0.1)}`,
                      }}
                    >
                      <CancelIcon sx={{ fontSize: 16, color: 'white' }} />
                    </TimelineDot>
                  </TimelineSeparator>
                  <TimelineContent sx={{ py: 1 }}>
                    <Typography variant="subtitle2" fontWeight={600} color="text.secondary">
                      Status Changed: Cancelled
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {formatDateTime(invoice.updatedAt)}
                    </Typography>
                  </TimelineContent>
                </TimelineItem>
              )}

              {/* Current Status (if different from above) */}
              {invoice.status === 'draft' && (
                <TimelineItem>
                  <TimelineSeparator>
                    <TimelineDot 
                      variant="outlined"
                      sx={{ 
                        borderColor: theme.palette.grey[400],
                        boxShadow: `0 0 0 4px ${alpha(theme.palette.grey[400], 0.1)}`,
                      }}
                    >
                      <DraftIcon sx={{ fontSize: 16 }} />
                    </TimelineDot>
                  </TimelineSeparator>
                  <TimelineContent sx={{ py: 1 }}>
                    <Typography variant="subtitle2" fontWeight={600} color="text.secondary">
                      Current Status: Draft
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Last updated: {formatDateTime(invoice.updatedAt)}
                    </Typography>
                  </TimelineContent>
                </TimelineItem>
              )}
            </Timeline>
          </Paper>
        </Grid>
        </Grid>
      </Box>

      <Dialog open={cancelDialogOpen} onClose={() => setCancelDialogOpen(false)}>
        <DialogTitle>Cancel Invoice</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to cancel this invoice? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCancelDialogOpen(false)}>No, Keep Invoice</Button>
          <Button onClick={handleConfirmCancel} color="error" variant="contained">
            Yes, Cancel Invoice
          </Button>
        </DialogActions>
      </Dialog>

      <EmailDialog
        open={emailDialogOpen}
        onClose={() => setEmailDialogOpen(false)}
        onSend={handleSendEmail}
        defaultTo={invoice.client?.email || ''}
        defaultSubject={`Invoice ${invoice.number} from ${invoice.store?.name || settings?.companyName || 'Your Company'}`}
        isLoading={isSendingEmail}
      />
    </Box>
  );
};

export default InvoiceDetail;

