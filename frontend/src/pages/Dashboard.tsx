import { Box, Typography, Paper, CircularProgress, Card, CardContent, Button, Chip, IconButton, Tooltip, Divider, Alert, Skeleton } from '@mui/material';
import Grid from '../components/common/Grid';
import { logger } from '../utils/logger';
import { useNavigate } from 'react-router-dom';
import { useInvoiceStats } from '../hooks/useInvoices';
import { useLowStock, useInventory } from '../hooks/useInventory';
import { formatCurrency } from '../utils/formatters';
import RevenueChart from '../components/dashboard/RevenueChart';
import StatusPieChart from '../components/dashboard/StatusPieChart';
import TopClientsTable from '../components/dashboard/TopClientsTable';
import TopItemsTable from '../components/dashboard/TopItemsTable';
import RevenueByClientChart from '../components/dashboard/RevenueByClientChart';
import DateRangeFilter from '../components/dashboard/DateRangeFilter';
import SalesByCategoryChart from '../components/analytics/SalesByCategoryChart';
import RevenueByPaymentMethodChart from '../components/analytics/RevenueByPaymentMethodChart';
import ReceiptIcon from '@mui/icons-material/Receipt';
import WarningIcon from '@mui/icons-material/Warning';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import AddIcon from '@mui/icons-material/Add';
import InventoryIcon from '@mui/icons-material/Inventory';
import PersonIcon from '@mui/icons-material/Person';
import DownloadIcon from '@mui/icons-material/Download';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { invoicesApi } from '../api/invoices';
import { subMonths, format, startOfMonth, endOfMonth, eachMonthOfInterval, parseISO, startOfDay, endOfDay } from 'date-fns';
import { validateDateRange } from '../utils/dates';
import { useInvoices } from '../hooks/useInvoices';
import { useAuthStore } from '../store/authStore';
import { useTopClients, useTopItems, useSalesByCategory, useRevenueByPaymentMethod, useInvoicesByStatus } from '../hooks/useAnalytics';
import { exportToCSV } from '../utils/export';
import { getErrorMessage } from '../utils/errorHandling';
import { useToast } from '../contexts/ToastContext';
import { TIMEOUTS } from '../constants/timeouts';
// Cache clearing is done manually below

const Dashboard = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const { data: stats, isLoading: statsLoading, isError: statsIsError, error: statsError, refetch } = useInvoiceStats();
  const { data: lowStockItems, isLoading: lowStockLoading } = useLowStock();
  const { data: invoices, isLoading: invoicesLoading, isError: invoicesError, refetch: refetchInvoices } = useInvoices();
  const { data: inventoryItems } = useInventory(); // Fetch all inventory items to get cost prices
  
  // Listen for invoice mutations to ensure Dashboard updates immediately
  // The cache update in useUpdateInvoice should already update the data
  // We invalidate queries which will trigger automatic refetch when components become active
  useEffect(() => {
    const unsubscribe = queryClient.getMutationCache().subscribe((event) => {
      // When an invoice update mutation succeeds, invalidate queries
      // React Query will automatically refetch when components are active
      if (event?.type === 'success' && event?.mutation?.options?.mutationKey) {
        const mutationKey = event.mutation.options.mutationKey;
        if (Array.isArray(mutationKey) && mutationKey[0] === 'invoices' && mutationKey[1] === 'update') {
          // Invalidate queries - React Query will refetch automatically for active queries
          // No setTimeout needed - invalidation is synchronous and fast
          queryClient.invalidateQueries({ queryKey: ['invoices'], exact: false });
          queryClient.invalidateQueries({ queryKey: ['invoices', 'stats'], exact: false });
        }
      }
    });
    return () => unsubscribe();
  }, [queryClient]);
  
  // Debug authentication state and API responses (must be before any early returns)
  // Removed debug logging for production
  const hasBackfilled = useRef(false);
  const [dateRangeWarning, setDateRangeWarning] = useState<string | null>(null);
  const warningTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Clear old organization-scoped cache on mount (one-time fix)
  useEffect(() => {
    // Clear any old organization-scoped query keys
    queryClient.removeQueries({ predicate: (query) => {
      const key = query.queryKey;
      // Remove queries that have 'org' in the key (old organization-scoped queries)
      if (Array.isArray(key) && key.includes('org')) {
        return true;
      }
      return false;
    }});
    
    // Also clear any queries that might have organizationId in them
    queryClient.removeQueries({ predicate: (query) => {
      const key = query.queryKey;
      if (Array.isArray(key)) {
        const keyStr = JSON.stringify(key);
        // Remove if it contains organization-related keys
        if (keyStr.includes('organization') || keyStr.includes('org')) {
          return true;
        }
      }
      return false;
    }});
  }, [queryClient]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (warningTimeoutRef.current) {
        clearTimeout(warningTimeoutRef.current);
        warningTimeoutRef.current = null;
      }
    };
  }, []);
  
  // Initialize date range to last 6 months using validation utility
  const [dateRange, setDateRange] = useState<{ start: Date | null; end: Date | null }>(() => {
    const validated = validateDateRange(null, null, 6);
    return { start: validated.start, end: validated.end };
  });
  
  // Validate and fix date range whenever dates change
  useEffect(() => {
    const validated = validateDateRange(dateRange.start, dateRange.end, 6);
    
    // Only update if dates actually changed (prevents infinite loops)
    if (
      dateRange.start?.getTime() !== validated.start.getTime() ||
      dateRange.end?.getTime() !== validated.end.getTime()
    ) {
      setDateRange({ start: validated.start, end: validated.end });
    }
  }, [dateRange.start, dateRange.end]);
  
  // Get validated date range for use in analytics (always valid, never future dates)
  const validatedDateRange = useMemo(() => {
    return validateDateRange(dateRange.start, dateRange.end, 6);
  }, [dateRange.start, dateRange.end]);
  
  // Analytics hooks (using validated date range)
  const { data: topClients, isLoading: clientsLoading } = useTopClients();
  const { data: topItems, isLoading: itemsLoading } = useTopItems();
  const { data: salesByCategory, isLoading: categoryLoading } = useSalesByCategory(validatedDateRange.start, validatedDateRange.end);
  const { data: revenueByPaymentMethod, isLoading: paymentLoading } = useRevenueByPaymentMethod(validatedDateRange.start, validatedDateRange.end);
  const { data: invoiceStatus, isLoading: statusLoading } = useInvoicesByStatus();

  // Helper function to calculate actual revenue (profit) for an invoice
  // Moved outside useMemo for better performance and reusability
  const calculateInvoiceProfit = useCallback((invoice: any, costMap: Map<string, number>): number => {
    if (!invoice.items || !Array.isArray(invoice.items) || invoice.items.length === 0) {
      return 0;
    }

    let profit = 0;
    // Use for loop for better performance than forEach
    for (let i = 0; i < invoice.items.length; i++) {
      const item = invoice.items[i];
      const quantity = Number(item.quantity) || 0;
      const unitPrice = Number(item.unitPrice) || 0;
      const sellingPrice = quantity * unitPrice;

      if (item.inventoryItemId && costMap.has(item.inventoryItemId)) {
        const costPrice = costMap.get(item.inventoryItemId)!;
        profit += sellingPrice - (quantity * costPrice);
      } else {
        // If no inventory item linked, assume 0 cost (service/item without cost tracking)
        profit += sellingPrice;
      }
    }

    return Math.round(profit * 100) / 100;
  }, []);

  // Calculate stats from invoices array - always use invoices if available for accuracy
  // This ensures stat cards show correct data even if stats endpoint has issues
  // ENHANCED: Match backend calculation exactly with UTC dates and precise math
  // ENHANCED: Calculate actual revenue (profit) = selling price - cost price
  const computedStats = useMemo(() => {
    // Create a map of inventory item ID to cost price for quick lookup
    const costPriceMap = new Map<string, number>();
    if (inventoryItems && Array.isArray(inventoryItems)) {
      // Use for loop for better performance
      for (let i = 0; i < inventoryItems.length; i++) {
        const item = inventoryItems[i];
        if (item.id && item.costPrice !== undefined && item.costPrice !== null) {
          costPriceMap.set(item.id, item.costPrice);
        }
      }
    }

    // If we have invoices, always calculate from them for accuracy
    if (invoices && Array.isArray(invoices) && invoices.length > 0) {
      // Calculate stats from invoices array
      // ENHANCED: Use UTC dates to match backend exactly (backend uses UTC)
      const now = new Date();
      const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
      const endOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));

      let unpaidCount = 0;
      let unpaidAmount = 0;
      let overdueCount = 0;
      let overdueAmount = 0;
      let monthlyTotal = 0;
      let totalAmount = 0; // Total Revenue (profit)
      let totalSales = 0; // Total Sales (selling price only)

      // Use for loop for better performance with large datasets
      for (let i = 0; i < invoices.length; i++) {
        const invoice = invoices[i];
        // Calculate actual revenue (profit) for this invoice
        const invoiceProfit = calculateInvoiceProfit(invoice, costPriceMap);
        
        // ENHANCED: Use precise number conversion to avoid floating point errors
        const invoiceTotal = typeof invoice.total === 'number' 
          ? invoice.total 
          : (typeof invoice.total === 'string' 
            ? parseFloat(invoice.total) || 0 
            : 0);
        
        // ENHANCED: Round to 2 decimal places to match database precision
        const roundedTotal = Math.round(invoiceTotal * 100) / 100;
        
        // Use profit for Total Revenue (actual revenue = selling price - cost price)
        totalAmount += invoiceProfit;
        
        // Track total sales (selling price only) for "Total Sales" card
        totalSales += roundedTotal;
        
        // Keep monthlyTotal as total sales (not profit) for "Sales this month" card

        // Match backend logic exactly:
        // - unpaidCount = only 'sent' (not including 'overdue')
        // - unpaidAmount = 'sent' + 'overdue'
        // - overdueCount = 'overdue'
        // - overdueAmount = 'overdue'
        if (invoice.status === 'sent') {
          unpaidCount++;
          unpaidAmount += roundedTotal;
        } else if (invoice.status === 'overdue') {
          overdueCount++;
          overdueAmount += roundedTotal;
          // overdue is also counted in unpaidAmount (but not in unpaidCount)
          unpaidAmount += roundedTotal;
        } else if (invoice.status === 'paid') {
          // ENHANCED: Match backend logic - count if paidAt exists and is in current month (UTC)
          // Also fall back to updatedAt or issueDate for invoices without paidAt (for display purposes)
          // This ensures monthly revenue shows even if paidAt wasn't set for older invoices
          let paidAtDate: Date | null = null;
          
          if (invoice.paidAt) {
            paidAtDate = new Date(invoice.paidAt);
          } else if (invoice.updatedAt) {
            // Fallback: Use updatedAt if paidAt is not set (likely when invoice was marked as paid)
            // This helps display revenue for invoices that were paid before paidAt field was added
            paidAtDate = new Date(invoice.updatedAt);
          } else if (invoice.issueDate) {
            // Fallback: Use issueDate as last resort
            paidAtDate = new Date(invoice.issueDate);
          }
          
          if (paidAtDate) {
            // ENHANCED: Use UTC date comparison to match backend exactly
            // Create UTC date from the paidAtDate for comparison
            const paidAtUTC = new Date(Date.UTC(
              paidAtDate.getUTCFullYear(),
              paidAtDate.getUTCMonth(),
              paidAtDate.getUTCDate(),
              paidAtDate.getUTCHours(),
              paidAtDate.getUTCMinutes(),
              paidAtDate.getUTCSeconds()
            ));
            
            // ENHANCED: Compare UTC timestamps to match backend query exactly
            // Backend uses: invoice.paidAt >= :startOfMonth AND invoice.paidAt <= :endOfMonth
            // Compare timestamps directly for accuracy
            const paidAtTime = paidAtUTC.getTime();
            const startTime = startOfMonth.getTime();
            const endTime = endOfMonth.getTime();
            
            if (paidAtTime >= startTime && paidAtTime <= endTime) {
              // Use total sales (not profit) for monthly sales
              monthlyTotal += roundedTotal;
            }
          }
        }
      }

      // ENHANCED: Round all amounts to 2 decimal places for display accuracy
      const computedMonthlyTotal = Math.round(monthlyTotal * 100) / 100;
      
      // If we have stats API, use it as authoritative source, but fall back to computed if backend is 0
      // This handles cases where backend requires paidAt but invoices don't have it set yet
      const statsMonthlyTotal = stats ? Math.round(Number(stats.monthlyTotal || 0) * 100) / 100 : 0;
      
      // Use backend value if it's greater than 0 (authoritative), otherwise use computed with fallback dates
      // This ensures we show revenue even if paidAt wasn't set for older invoices
      const finalMonthlyTotal = statsMonthlyTotal > 0 ? statsMonthlyTotal : computedMonthlyTotal;
      
      return {
        totalCount: invoices.length,
        unpaidCount,
        unpaidAmount: Math.round(unpaidAmount * 100) / 100,
        overdueCount,
        overdueAmount: Math.round(overdueAmount * 100) / 100,
        monthlyTotal: finalMonthlyTotal, // Use backend if available, otherwise computed with fallback
        totalAmount: Math.round(totalAmount * 100) / 100, // Total Revenue (profit = selling price - cost price)
        totalSales: Math.round(totalSales * 100) / 100, // Total Sales (selling price only)
      };
    }

    // Fallback to stats API if invoices aren't loaded yet
    // Note: Stats API returns total sales, not profit, so we can't calculate actual revenue from it
    // We'll show 0 for revenue until invoices are loaded, but show total sales from stats
    if (stats) {
      const statsTotalSales = Math.round(Number(stats.totalAmount || 0) * 100) / 100;
      return {
        totalCount: Number(stats.totalCount || 0),
        unpaidCount: Number(stats.unpaidCount || 0),
        unpaidAmount: Math.round(Number(stats.unpaidAmount || 0) * 100) / 100,
        overdueCount: Number(stats.overdueCount || 0),
        overdueAmount: Math.round(Number(stats.overdueAmount || 0) * 100) / 100,
        monthlyTotal: Math.round(Number(stats.monthlyTotal || 0) * 100) / 100,
        totalAmount: 0, // Can't calculate profit from stats API alone
        totalSales: statsTotalSales, // Use stats API for total sales
      };
    }

    return {
      totalCount: 0,
      unpaidCount: 0,
      unpaidAmount: 0,
      overdueCount: 0,
      overdueAmount: 0,
      monthlyTotal: 0,
      totalAmount: 0,
      totalSales: 0,
    };
  }, [stats, invoices, inventoryItems, calculateInvoiceProfit]);

  // Automatically backfill if monthly revenue is 0 but total revenue exists
  useEffect(() => {
    if (!statsLoading && computedStats && computedStats.monthlyTotal === 0 && computedStats.totalAmount > 0 && !hasBackfilled.current) {
      hasBackfilled.current = true;
      // Fix Bug #11: Proper error handling instead of silent failure
      invoicesApi.backfillPaidAt()
        .then(() => {
          // Refresh stats after backfill
          refetch();
        })
        .catch((error) => {
          // Log error for debugging and show warning to user (non-critical operation)
          logger.warn('Failed to backfill paidAt dates:', error);
          showToast('Failed to update invoice payment dates. Revenue calculations may be incomplete.', 'warning');
        });
    }
  }, [computedStats, statsLoading, refetch]);

  // Check if there's any data at all
  // Show dashboard if there are any invoices, even if all amounts are 0 (e.g., draft invoices)
  // Also check invoices array directly in case stats haven't loaded yet or are stale
  const hasAnyData = useMemo(() => {
    // First check if we have invoices directly (more reliable)
    if (invoices && Array.isArray(invoices) && invoices.length > 0) {
      return true;
    }
    // Fallback to stats if invoices haven't loaded yet
    if (!stats) {
      return false;
    }
    const hasStats = stats.totalCount > 0 || 
           stats.unpaidCount > 0 || 
           stats.overdueCount > 0 || 
           stats.monthlyTotal > 0 || 
           stats.totalAmount > 0;
    return hasStats;
  }, [stats, invoices, statsLoading, invoicesLoading]);

  // Show loading if either stats or invoices are loading
  // This prevents showing welcome message prematurely when invoices exist but stats haven't loaded yet
  if (statsLoading || invoicesLoading) {
    return (
      <Box>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Skeleton variant="text" width={200} height={40} />
          <Skeleton variant="rectangular" width={150} height={40} />
        </Box>
        <Grid container spacing={2.5} sx={{ mb: 2.5, width: '100%', margin: 0 }}>
          {[1, 2, 3, 4].map((i) => (
            <Grid item xs={12} sm={6} md={3} key={i} sx={{ display: 'flex' }}>
              <Paper sx={{ p: 2.5, width: '100%', borderRadius: 2 }}>
                <Skeleton variant="rectangular" width={48} height={48} sx={{ mb: 2, borderRadius: 2 }} />
                <Skeleton variant="text" width={120} height={24} sx={{ mb: 1 }} />
                <Skeleton variant="text" width={80} height={32} />
              </Paper>
            </Grid>
          ))}
        </Grid>
        <Paper sx={{ p: 2, mb: 2.5, borderRadius: 2 }}>
          <Skeleton variant="text" width={200} height={24} sx={{ mb: 2 }} />
          <Skeleton variant="rectangular" width="100%" height={300} />
        </Paper>
      </Box>
    );
  }
  
  // If stats failed to load, don't show the "empty" welcome screen (it would be misleading)
  if (statsIsError) {
    const errorMessage = getErrorMessage(statsError, 'Failed to load dashboard statistics');

    return (
      <Box>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h4" component="h1" fontWeight="bold">
            Dashboard
          </Typography>
          <Button variant="contained" onClick={() => refetch()} sx={{ borderRadius: 2 }}>
            Retry
          </Button>
        </Box>
        <Paper sx={{ p: 4, borderRadius: 2 }}>
          <Typography variant="h6" gutterBottom>
            Couldn’t load your data
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            {errorMessage}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Please try refreshing the page or contact support if the problem persists.
          </Typography>
        </Paper>
      </Box>
    );
  }

  // Show welcome message if no data exists
  if (!hasAnyData) {
    return (
      <Box>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h4" component="h1" fontWeight="bold">
            Dashboard
          </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                try {
                  navigate('/invoices/create');
                } catch (error) {
                  logger.error('Error navigating to create invoice:', error);
                  // Fallback navigation
                  window.location.href = '/invoices/create';
                }
              }}
              sx={{ borderRadius: 2 }}
            >
              New Invoice
            </Button>
        </Box>


        <Paper 
          sx={{ 
            p: 6, 
            textAlign: 'center',
            bgcolor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 2,
          }}
        >
          <ReceiptIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2, opacity: 0.7 }} />
          <Typography variant="h5" fontWeight="bold" gutterBottom>
            Welcome to Your Dashboard!
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3, maxWidth: 500, mx: 'auto' }}>
            Get started by creating your first invoice. Once you have invoices, you'll see revenue statistics, 
            client analytics, and inventory insights here.
          </Typography>
          <Box display="flex" gap={2} justifyContent="center" flexWrap="wrap">
            <Button
              variant="contained"
              size="large"
              startIcon={<AddIcon />}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                try {
                  navigate('/invoices/create');
                } catch (error) {
                  logger.error('Error navigating to create invoice:', error);
                  // Fallback navigation
                  window.location.href = '/invoices/create';
                }
              }}
              sx={{ borderRadius: 2 }}
            >
              Create Your First Invoice
            </Button>
            <Button
              variant="outlined"
              size="large"
              onClick={() => navigate('/clients')}
              sx={{ borderRadius: 2 }}
            >
              Add Clients
            </Button>
            <Button
              variant="outlined"
              size="large"
              onClick={() => navigate('/inventory')}
              sx={{ borderRadius: 2 }}
            >
              Manage Inventory
            </Button>
          </Box>
        </Paper>
      </Box>
    );
  }

  const statCards = [
    {
      title: 'Unpaid Invoices',
      value: computedStats?.unpaidCount || 0,
      amount: computedStats?.unpaidAmount || 0,
      color: '#1976d2',
      icon: <ReceiptIcon sx={{ fontSize: 40 }} />,
      onClick: () => navigate('/invoices?status=sent'),
      description: 'Awaiting payment',
    },
    {
      title: 'Overdue',
      value: computedStats?.overdueCount || 0,
      amount: computedStats?.overdueAmount || 0,
      color: '#d32f2f',
      icon: <WarningIcon sx={{ fontSize: 40 }} />,
      onClick: () => navigate('/invoices?status=overdue'),
      description: 'Past due date',
    },
    {
      title: 'Sales this month',
      value: null,
      amount: computedStats?.monthlyTotal || 0,
      color: '#2e7d32',
      icon: <TrendingUpIcon sx={{ fontSize: 40 }} />,
      onClick: () => navigate('/invoices?status=paid'),
      description: 'Sales this month',
    },
    {
      title: 'Total Revenue',
      value: null,
      amount: computedStats?.totalAmount || 0,
      color: '#ed6c02',
      icon: <AccountBalanceIcon sx={{ fontSize: 40 }} />,
      onClick: () => navigate('/invoices'),
      description: 'Profit (all time)',
    },
    {
      title: 'Total Sales',
      value: null,
      amount: computedStats?.totalSales || 0,
      color: '#9c27b0',
      icon: <ReceiptIcon sx={{ fontSize: 40 }} />,
      onClick: () => navigate('/invoices'),
      description: 'All time',
    },
  ];

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2} sx={{ position: 'relative', zIndex: 1 }}>
        <Typography variant="h4" component="h1" fontWeight="bold">
          Dashboard
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            try {
              navigate('/invoices/create');
            } catch (error) {
              logger.error('Error navigating to create invoice:', error);
              // Fallback navigation
              window.location.href = '/invoices/create';
            }
          }}
          sx={{ 
            borderRadius: 2,
            position: 'relative',
            zIndex: 10,
            pointerEvents: 'auto',
          }}
        >
          New Invoice
        </Button>
      </Box>

      <Grid container spacing={2.5} sx={{ mb: 2.5, width: '100%', margin: 0 }}>
        {statCards.map((card, index) => (
          <Grid item xs={12} sm={6} md={3} key={index} sx={{ display: 'flex' }}>
            <Card
              sx={{
                height: '100%',
                width: '100%',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                position: 'relative',
                overflow: 'hidden',
                borderLeft: `4px solid ${card.color}`,
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: 6,
                  '& .stat-card-icon': {
                    transform: 'scale(1.1)',
                  },
                },
              }}
              onClick={card.onClick}
            >
              <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 }, position: 'relative', zIndex: 1 }}>
                <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                  <Box 
                    className="stat-card-icon"
                    sx={{ 
                      color: card.color,
                      transition: 'transform 0.3s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 48,
                      height: 48,
                      borderRadius: 2,
                      bgcolor: `${card.color}10`,
                    }}
                  >
                    {card.icon}
                  </Box>
                  <Chip
                    label={card.description}
                    size="small"
                    sx={{
                      bgcolor: `${card.color}15`,
                      color: card.color,
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      height: 24,
                      border: `1px solid ${card.color}30`,
                    }}
                  />
                </Box>
                <Typography 
                  variant="h6" 
                  color="text.secondary" 
                  gutterBottom 
                  sx={{ 
                    fontSize: '0.9375rem', 
                    fontWeight: 600, 
                    mb: 1.5,
                    textTransform: card.title === 'Sales this month' ? 'none' : 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  {card.title}
                </Typography>
                {card.value !== null && (
                  <Typography 
                    variant="h3" 
                    fontWeight="bold" 
                    sx={{ 
                      color: card.color, 
                      mb: 1.5, 
                      fontSize: '2.25rem',
                      lineHeight: 1.2,
                    }}
                  >
                    {card.value.toLocaleString()}
                  </Typography>
                )}
                <Typography 
                  variant="h5" 
                  fontWeight="bold" 
                  sx={{ 
                    color: card.color, 
                    mb: 2.5, 
                    fontSize: '1.625rem',
                    lineHeight: 1.2,
                    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
                    letterSpacing: '-0.02em',
                  }}
                >
                  {formatCurrency(card.amount)}
                </Typography>
                <Box 
                  display="flex" 
                  alignItems="center" 
                  sx={{ 
                    opacity: 0.8,
                    transition: 'opacity 0.2s ease',
                    '&:hover': {
                      opacity: 1,
                    },
                  }}
                >
                  <Typography 
                    variant="body2" 
                    color="text.secondary" 
                    sx={{ 
                      fontSize: '0.875rem', 
                      fontWeight: 500,
                    }}
                  >
                    Click to view
                  </Typography>
                  <ArrowForwardIcon sx={{ fontSize: 16, ml: 0.75, transition: 'transform 0.2s ease' }} />
                </Box>
              </CardContent>
              {/* Subtle background gradient */}
              <Box
                sx={{
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  width: '60%',
                  height: '100%',
                  background: `linear-gradient(135deg, ${card.color}08 0%, transparent 100%)`,
                  pointerEvents: 'none',
                  zIndex: 0,
                }}
              />
            </Card>
          </Grid>
        ))}
      </Grid>

      <Paper 
        sx={{ 
          p: 2, 
          mb: 2.5,
          mt: 2.5,
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
        }}
      >
        <Typography variant="subtitle2" color="text.secondary" fontWeight={600} mb={1.5}>
          Filter Analytics by Date Range
        </Typography>
        <Divider sx={{ mb: 2 }} />
        {dateRangeWarning && (
          <Alert 
            severity="info" 
            sx={{ mb: 2 }}
            onClose={() => {
              // Clear timeout if user manually closes warning
              if (warningTimeoutRef.current) {
                clearTimeout(warningTimeoutRef.current);
                warningTimeoutRef.current = null;
              }
              setDateRangeWarning(null);
            }}
          >
            {dateRangeWarning}
          </Alert>
        )}
        <DateRangeFilter
          startDate={validatedDateRange.start}
          endDate={validatedDateRange.end}
          onRangeChange={(range) => {
            // Validate the range using utility function
            const validated = validateDateRange(range.start, range.end, 6);
            let showWarning = false;
            let warningMessage = '';
            
            // Check if dates were adjusted
            if (range.start && range.start.getTime() !== validated.start.getTime()) {
              showWarning = true;
              warningMessage = 'Start date was in the future and has been adjusted.';
            }
            if (range.end && range.end.getTime() !== validated.end.getTime()) {
              showWarning = true;
              warningMessage = warningMessage || 'End date was in the future and has been adjusted to today.';
            }
            
            // Validate date range is not too large (prevent performance issues)
            const daysDiff = Math.abs((validated.end.getTime() - validated.start.getTime()) / (1000 * 60 * 60 * 24));
            if (daysDiff > 365 * 5) { // Max 5 years
              logger.warn('Date range too large, limiting to 5 years');
              const today = new Date();
              today.setHours(23, 59, 59, 999);
              const fiveYearsAgo = subMonths(today, 60);
              fiveYearsAgo.setHours(0, 0, 0, 0);
              const limitedRange = validateDateRange(fiveYearsAgo, today, 6);
              setDateRange({ start: limitedRange.start, end: limitedRange.end });
              showWarning = true;
              warningMessage = 'Date range exceeds 5 years. Range has been limited to 5 years for performance.';
            } else {
              setDateRange({ start: validated.start, end: validated.end });
            }
            
            // Show user-friendly warning if dates were adjusted
            if (showWarning && warningMessage) {
              // Clear any existing timeout
              if (warningTimeoutRef.current) {
                clearTimeout(warningTimeoutRef.current);
                warningTimeoutRef.current = null;
              }
              setDateRangeWarning(warningMessage);
              // Auto-hide warning after configured duration
              warningTimeoutRef.current = setTimeout(() => {
                setDateRangeWarning(null);
                warningTimeoutRef.current = null;
              }, TIMEOUTS.DATE_RANGE_WARNING_DURATION);
            }
          }}
        />
      </Paper>

      <Grid container spacing={2.5}>
        <Grid item xs={12} md={8}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Box>
                  <Typography variant="h6" fontWeight="bold">
                    Revenue Over Time
                  </Typography>
                  {validatedDateRange.start && validatedDateRange.end && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                      {format(validatedDateRange.start, 'MMM d, yyyy') === format(validatedDateRange.end, 'MMM d, yyyy')
                        ? format(validatedDateRange.start, 'MMM d, yyyy')
                        : `${format(validatedDateRange.start, 'MMM d, yyyy')} - ${format(validatedDateRange.end, 'MMM d, yyyy')}`}
                    </Typography>
                  )}
                </Box>
                <Box display="flex" gap={1}>
                  <Tooltip title="Export revenue data">
                    <IconButton
                      size="small"
                      onClick={() => {
                        if (!invoices || invoices.length === 0) {
                          return;
                        }
                        
                        const now = new Date();
                        // Use actual date range for filtering, but group by months for export
                        const rangeStart = validatedDateRange.start ? startOfDay(new Date(validatedDateRange.start)) : startOfDay(subMonths(now, 5));
                        const rangeEnd = validatedDateRange.end ? endOfDay(new Date(validatedDateRange.end)) : endOfDay(now);
                        
                        // Generate months in the range for grouping
                        const monthStart = startOfMonth(rangeStart);
                        const monthEnd = endOfMonth(rangeEnd);
                        const months = eachMonthOfInterval({ start: monthStart, end: monthEnd }).map(date => ({
                          month: format(date, 'MMM yyyy'),
                          monthDate: startOfMonth(date),
                          revenue: 0,
                        }));
                        
                        invoices.forEach((invoice) => {
                          if (invoice.status === 'paid' && invoice.total) {
                            let invoiceDate: Date;
                            try {
                              if (invoice.paidAt) {
                                invoiceDate = parseISO(invoice.paidAt);
                              } else if (invoice.issueDate) {
                                invoiceDate = parseISO(invoice.issueDate);
                              } else {
                                return;
                              }
                              
                              // Normalize invoice date to start and end of day for accurate comparison
                              const invoiceDayStart = startOfDay(invoiceDate);
                              const invoiceDayEnd = endOfDay(invoiceDate);
                              
                              // Check if invoice date overlaps with the selected range
                              // An invoice is included if its day overlaps with the range
                              const isInRange = (invoiceDayStart <= rangeEnd && invoiceDayEnd >= rangeStart);
                              
                              if (!isInRange) {
                                return;
                              }
                              
                              const invoiceMonth = startOfMonth(invoiceDate);
                              const monthData = months.find((m) => m.monthDate.getTime() === invoiceMonth.getTime());
                              
                              if (monthData) {
                                // Fix Bug #53: Add validation for number conversion
                                const total = typeof invoice.total === 'number' 
                                  ? invoice.total 
                                  : (typeof invoice.total === 'string' 
                                    ? (Number(invoice.total) || 0)
                                    : 0);
                                if (isNaN(total) || !isFinite(total) || total < 0) {
                                  logger.warn('Invalid invoice total:', invoice.total, 'for invoice:', invoice.id);
                                  return;
                                }
                                monthData.revenue += total;
                              }
                            } catch (error) {
                              // Fix Bug #52: Log error instead of silently ignoring
                              logger.warn('Failed to parse invoice date for export:', error, 'invoice:', invoice.id);
                              // Skip invalid dates but log for debugging
                            }
                          }
                        });
                        
                        const exportData = months.map(m => ({
                          Month: m.month,
                          Revenue: Math.round(m.revenue * 100) / 100,
                        }));
                        
                        exportToCSV(exportData, {
                          filename: 'revenue',
                          title: 'REVENUE EXPORT',
                          description: 'Revenue data from paid invoices',
                          includeMetadata: true,
                          formatNumbers: true,
                          formatCurrencyFields: false,
                          formatDates: true,
                        });
                      }}
                    >
                      <DownloadIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Revenue from paid invoices">
                    <IconButton size="small">
                      <TrendingUpIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>
              <RevenueChart startDate={validatedDateRange.start} endDate={validatedDateRange.end} />
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6" fontWeight="bold">
                  Status Distribution
                </Typography>
                <Button
                  size="small"
                  endIcon={<ArrowForwardIcon />}
                  onClick={() => navigate('/invoices')}
                >
                  View All
                </Button>
              </Box>
              <StatusPieChart />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={2.5} sx={{ mt: 1 }}>
        <Grid item xs={12} md={7}>
          <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, p: 2 }}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Box>
                  <Typography variant="h6" fontWeight="bold">
                    Revenue by Client
                  </Typography>
                  {validatedDateRange.start && validatedDateRange.end && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                      Filtered by date range
                    </Typography>
                  )}
                </Box>
                <Tooltip title="Top 10 clients by revenue">
                  <IconButton size="small">
                    <PersonIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
              <Box sx={{ flex: 1, minHeight: 0 }}>
                <RevenueByClientChart startDate={validatedDateRange.start} endDate={validatedDateRange.end} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={5}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: 2 }}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Box display="flex" alignItems="center" gap={1}>
                  <PersonIcon color="primary" />
                  <Typography variant="h6" fontWeight="bold">
                    Top Clients
                  </Typography>
                </Box>
                <Button
                  size="small"
                  endIcon={<ArrowForwardIcon />}
                  onClick={() => navigate('/clients')}
                >
                  View All
                </Button>
              </Box>
              <Box>
                <TopClientsTable />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Sales Analysis Row - Analytics Features */}
      <Grid container spacing={2.5} sx={{ mt: 1 }}>
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Box>
                  <Typography variant="h6" fontWeight="bold" sx={{ mb: 0.5 }}>
                    Sales by Category
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Revenue breakdown by product category
                  </Typography>
                </Box>
              </Box>
              <SalesByCategoryChart startDate={validatedDateRange.start} endDate={validatedDateRange.end} />
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Box>
                  <Typography variant="h6" fontWeight="bold" sx={{ mb: 0.5 }}>
                    Revenue by Payment Method
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Payment method distribution
                  </Typography>
                </Box>
              </Box>
              <RevenueByPaymentMethodChart startDate={validatedDateRange.start} endDate={validatedDateRange.end} />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={2.5} sx={{ mt: 1 }}>
        <Grid item xs={12}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Box display="flex" alignItems="center" gap={1}>
                  <TrendingUpIcon color="primary" />
                  <Typography variant="h6" fontWeight="bold">
                    Top Items
                  </Typography>
                </Box>
                <Button
                  size="small"
                  endIcon={<ArrowForwardIcon />}
                  onClick={() => navigate('/inventory')}
                >
                  View All
                </Button>
              </Box>
              <TopItemsTable />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={2.5} sx={{ mt: 1 }}>
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Box display="flex" alignItems="center" gap={1}>
                  <WarningIcon color="error" />
                  <Typography variant="h6" fontWeight="bold">
                    Low Stock Items
                  </Typography>
                  {lowStockItems && lowStockItems.length > 0 && (
                    <Chip
                      label={lowStockItems.length}
                      size="small"
                      color="error"
                      sx={{ ml: 1 }}
                    />
                  )}
                </Box>
                <Button
                  size="small"
                  endIcon={<ArrowForwardIcon />}
                  onClick={() => navigate('/inventory')}
                >
                  Manage Inventory
                </Button>
              </Box>
              {lowStockLoading ? (
                <Box display="flex" justifyContent="center" py={4}>
                  <CircularProgress size={24} />
                </Box>
              ) : lowStockItems && lowStockItems.length > 0 ? (
                <Box>
                  {[...lowStockItems]
                    .sort((a, b) => {
                      // Sort by urgency: 0 stock first, then by how far below reorder level
                      const stockA = Math.max(0, a.currentStock || 0);
                      const stockB = Math.max(0, b.currentStock || 0);
                      const reorderA = a.reorderLevel || 0;
                      const reorderB = b.reorderLevel || 0;
                      
                      // Out of stock first
                      if (stockA === 0 && stockB !== 0) return -1;
                      if (stockA !== 0 && stockB === 0) return 1;
                      
                      // Then by how far below reorder level (more urgent first)
                      const deficitA = reorderA - stockA;
                      const deficitB = reorderB - stockB;
                      if (deficitA !== deficitB) return deficitB - deficitA;
                      
                      // Finally by stock level (lower first)
                      return stockA - stockB;
                    })
                    .slice(0, 5)
                    .map((item, index) => {
                      const currentStock = Math.max(0, item.currentStock || 0);
                      const reorderLevel = item.reorderLevel || 0;
                      const deficit = Math.max(0, reorderLevel - currentStock);
                      const isOutOfStock = currentStock === 0;
                      const isCritical = reorderLevel > 0 && currentStock < reorderLevel * 0.5;
                      
                      return (
                        <Box
                          key={item.id}
                          sx={{
                            py: 1.25,
                            px: 1.5,
                            mb: 1,
                            borderRadius: 1.5,
                            border: '1px solid',
                            borderColor: isOutOfStock ? 'error.main' : isCritical ? 'warning.main' : 'divider',
                            borderLeftWidth: isOutOfStock ? 4 : isCritical ? 3 : 2,
                            bgcolor: isOutOfStock 
                              ? 'rgba(211, 47, 47, 0.04)' 
                              : isCritical 
                                ? 'rgba(237, 108, 2, 0.04)' 
                                : 'background.paper',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease-in-out',
                            position: 'relative',
                            overflow: 'hidden',
                            '&::before': {
                              content: '""',
                              position: 'absolute',
                              left: 0,
                              top: 0,
                              bottom: 0,
                              width: isOutOfStock ? 4 : isCritical ? 3 : 2,
                              bgcolor: isOutOfStock ? 'error.main' : isCritical ? 'warning.main' : 'divider',
                            },
                            '&:hover': {
                              bgcolor: isOutOfStock 
                                ? 'rgba(211, 47, 47, 0.08)' 
                                : isCritical 
                                  ? 'rgba(237, 108, 2, 0.08)' 
                                  : 'action.hover',
                              transform: 'translateX(2px)',
                              boxShadow: isOutOfStock 
                                ? '0 2px 8px rgba(211, 47, 47, 0.2)' 
                                : isCritical 
                                  ? '0 2px 8px rgba(237, 108, 2, 0.2)' 
                                  : 1,
                            },
                          }}
                          onClick={() => navigate(`/inventory/${item.id}`)}
                        >
                          <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                            {/* Header Row: Name + Status Badge */}
                            <Box display="flex" alignItems="center" justifyContent="space-between" gap={1}>
                              <Typography 
                                variant="body2" 
                                fontWeight="600" 
                                sx={{ 
                                  fontSize: '0.875rem',
                                  lineHeight: 1.3,
                                  flex: 1,
                                  minWidth: 0,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {item.name}
                              </Typography>
                              {isOutOfStock ? (
                                <Chip
                                  label="OUT"
                                  size="small"
                                  color="error"
                                  sx={{ 
                                    height: 20, 
                                    fontSize: '0.7rem',
                                    fontWeight: 'bold',
                                    px: 1,
                                    minWidth: 40,
                                  }}
                                />
                              ) : (
                                <Chip
                                  label="LOW"
                                  size="small"
                                  color="warning"
                                  sx={{ 
                                    height: 20, 
                                    fontSize: '0.7rem',
                                    fontWeight: 'bold',
                                    px: 1,
                                    minWidth: 40,
                                  }}
                                />
                              )}
                            </Box>
                            
                            {/* Info Grid: Compact layout with accurate calculations */}
                            <Box 
                              display="grid"
                              gridTemplateColumns="repeat(auto-fit, minmax(80px, 1fr))"
                              gap={1.5}
                              sx={{
                                '& > *': {
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: 0.25,
                                },
                              }}
                            >
                              <Box>
                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', fontWeight: 500 }}>
                                  Stock
                                </Typography>
                                <Typography 
                                  variant="body2" 
                                  fontWeight="bold"
                                  color={isOutOfStock ? 'error.main' : isCritical ? 'warning.main' : 'text.primary'}
                                  sx={{ fontSize: '0.875rem' }}
                                >
                                  {currentStock.toLocaleString()}
                                </Typography>
                              </Box>
                              <Box>
                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', fontWeight: 500 }}>
                                  SKU
                                </Typography>
                                <Typography 
                                  variant="body2" 
                                  sx={{ 
                                    fontFamily: 'monospace', 
                                    fontSize: '0.75rem', 
                                    fontWeight: 600,
                                    color: 'text.primary',
                                  }}
                                >
                                  {item.sku || 'N/A'}
                                </Typography>
                              </Box>
                              <Box>
                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', fontWeight: 500 }}>
                                  Reorder
                                </Typography>
                                <Typography variant="body2" fontSize="0.875rem" fontWeight="bold" color="text.primary">
                                  {reorderLevel.toLocaleString()}
                                </Typography>
                              </Box>
                              {deficit > 0 && (
                                <Box>
                                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', fontWeight: 500 }}>
                                    Deficit
                                  </Typography>
                                  <Chip
                                    label={`${deficit.toLocaleString()} below`}
                                    size="small"
                                    variant="outlined"
                                    color={isOutOfStock ? 'error' : 'warning'}
                                    sx={{ 
                                      height: 22, 
                                      fontSize: '0.75rem',
                                      fontWeight: 'bold',
                                      px: 0.75,
                                      mt: 0.25,
                                      width: 'fit-content',
                                    }}
                                  />
                                </Box>
                              )}
                            </Box>
                          </Box>
                          <Box sx={{ ml: 1.5, flexShrink: 0, pt: 0.5 }}>
                            {isOutOfStock ? (
                              <WarningIcon color="error" sx={{ fontSize: 22 }} />
                            ) : (
                              <WarningIcon color="warning" sx={{ fontSize: 22 }} />
                            )}
                          </Box>
                        </Box>
                      );
                    })}
                  {lowStockItems.length > 5 && (
                    <Box 
                      sx={{ 
                        mt: 2, 
                        pt: 1.5, 
                        borderTop: '1px solid',
                        borderColor: 'divider',
                        textAlign: 'center',
                      }}
                    >
                      <Typography variant="caption" color="text.secondary">
                        +{lowStockItems.length - 5} more items need attention
                      </Typography>
                    </Box>
                  )}
                </Box>
              ) : (
                <Box textAlign="center" py={4}>
                  <InventoryIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1, opacity: 0.5 }} />
                  <Typography variant="body2" color="text.secondary">
                    All items are well stocked
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;
