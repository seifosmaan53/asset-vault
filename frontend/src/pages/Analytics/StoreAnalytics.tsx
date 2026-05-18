import { useState, useMemo, useEffect, useRef } from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  Tabs,
  Tab,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Alert,
  Chip,
  Divider,
  Card,
  CardContent,
  TextField,
  InputAdornment,
  Pagination,
  Stack,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import TableChartIcon from '@mui/icons-material/TableChart';
import StoreIcon from '@mui/icons-material/Store';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import ReceiptIcon from '@mui/icons-material/Receipt';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import PaymentIcon from '@mui/icons-material/Payment';
import InventoryIcon from '@mui/icons-material/Inventory';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import { useParams, useNavigate } from 'react-router-dom';
import Grid from "../../components/common/Grid";
import { getErrorMessage } from '../../utils/errorHandling';
import StoreAnalyticsCard from '../../components/analytics/StoreAnalyticsCard';
import StoreRevenueChart from '../../components/analytics/StoreRevenueChart';
import StoreComparisonDashboard from '../../components/analytics/StoreComparisonDashboard';
import SalesByCategoryChart from '../../components/analytics/SalesByCategoryChart';
import RevenueByPaymentMethodChart from '../../components/analytics/RevenueByPaymentMethodChart';
import DateRangeFilter from '../../components/dashboard/DateRangeFilter';
import { useStoresAnalytics, useStoreAnalytics } from '../../hooks/useAnalytics';
import { useStores } from '../../hooks/useStore';
import { formatCurrency } from '../../utils/formatters';
import { analyticsApi } from '../../api/analytics';
import { useToast } from '../../contexts/ToastContext';
import { logger } from '../../utils/logger';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel = ({ children, value, index }: TabPanelProps) => {
  return (
    <div role="tabpanel" hidden={value !== index} id={`store-analytics-tabpanel-${index}`}>
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
};

type SortOption = 'name' | 'revenue' | 'invoices' | 'paymentRate' | 'outstanding';

const StoreAnalytics = () => {
  const { storeId: urlStoreId } = useParams<{ storeId?: string }>();
  const navigate = useNavigate();
  const [selectedTab, setSelectedTab] = useState(0);
  const [selectedStoreId, setSelectedStoreId] = useState<string | undefined>(urlStoreId);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly');
  const [compareStoreIds, setCompareStoreIds] = useState<string[]>([]);
  const [exportLoading, setExportLoading] = useState<'csv' | 'excel' | 'pdf' | null>(null);
  const prevUrlStoreIdRef = useRef<string | undefined>(urlStoreId);
  const { showToast } = useToast();

  // Pagination and filtering state
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('revenue');
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all');
  const storesPerPage = 8;

  // Sync selectedStoreId with URL parameter
  useEffect(() => {
    if (urlStoreId !== prevUrlStoreIdRef.current) {
      prevUrlStoreIdRef.current = urlStoreId;
      
      if (urlStoreId) {
        setSelectedStoreId(urlStoreId);
        setSelectedTab(2);
      } else {
        setSelectedStoreId(undefined);
        setSelectedTab(0);
      }
    }
  }, [urlStoreId]);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sortBy, filterActive]);

  const { data: stores, isLoading: storesLoading, error: storesError } = useStoresAnalytics();
  const { data: selectedStoreAnalytics, isLoading: storeAnalyticsLoading } = useStoreAnalytics(
    selectedStoreId,
  );
  const { data: allStores } = useStores(true);

  // Calculate aggregate stats with additional metrics
  const aggregateStats = useMemo(() => {
    if (!stores || stores.length === 0) {
      return {
        totalRevenue: 0,
        paidRevenue: 0,
        outstandingRevenue: 0,
        totalInvoices: 0,
        activeStores: 0,
        totalStores: 0,
        averagePaymentRate: 0,
      };
    }
    // FIX: Ensure numeric values are properly parsed
    const totalRevenue = stores.reduce((sum, store) => {
      const revenue = typeof store.totalRevenue === 'number' ? store.totalRevenue : parseFloat(String(store.totalRevenue || 0)) || 0;
      return sum + revenue;
    }, 0);
    const paidRevenue = stores.reduce((sum, store) => sum + (store.paidRevenue || 0), 0);
    const outstandingRevenue = totalRevenue - paidRevenue;
    const averagePaymentRate = totalRevenue > 0 ? (paidRevenue / totalRevenue) * 100 : 0;
    
    return {
      totalRevenue,
      paidRevenue,
      outstandingRevenue,
      totalInvoices: stores.reduce((sum, store) => {
        const invoices = typeof store.totalInvoices === 'number' ? store.totalInvoices : parseInt(String(store.totalInvoices || 0), 10) || 0;
        return sum + invoices;
      }, 0),
      activeStores: stores.filter((store) => store.active).length,
      totalStores: stores.length,
      averagePaymentRate,
    };
  }, [stores]);

  // Filter and sort stores
  const filteredAndSortedStores = useMemo(() => {
    if (!stores) return [];

    let filtered = [...stores];

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter((store) => {
        const name = (store.storeName || '').toLowerCase();
        const code = (store.storeCode || '').toLowerCase();
        return name.includes(query) || code.includes(query);
      });
    }

    // Filter by active status
    if (filterActive !== 'all') {
      filtered = filtered.filter((store) => 
        filterActive === 'active' ? store.active : !store.active
      );
    }

    // Sort stores
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return (a.storeName || a.storeCode || '').localeCompare(b.storeName || b.storeCode || '');
        case 'revenue':
          return (b.totalRevenue || 0) - (a.totalRevenue || 0);
        case 'invoices':
          return (b.totalInvoices || 0) - (a.totalInvoices || 0);
        case 'paymentRate': {
          const aRate = a.totalRevenue > 0 ? (a.paidRevenue / a.totalRevenue) * 100 : 0;
          const bRate = b.totalRevenue > 0 ? (b.paidRevenue / b.totalRevenue) * 100 : 0;
          return bRate - aRate;
        }
        case 'outstanding': {
          const aOutstanding = (a.totalRevenue || 0) - (a.paidRevenue || 0);
          const bOutstanding = (b.totalRevenue || 0) - (b.paidRevenue || 0);
          return bOutstanding - aOutstanding;
        }
        default:
          return 0;
      }
    });

    return filtered;
  }, [stores, searchQuery, sortBy, filterActive]);

  // Paginate stores
  const paginatedStores = useMemo(() => {
    const startIndex = (currentPage - 1) * storesPerPage;
    const endIndex = startIndex + storesPerPage;
    return filteredAndSortedStores.slice(startIndex, endIndex);
  }, [filteredAndSortedStores, currentPage]);

  const totalPages = Math.ceil(filteredAndSortedStores.length / storesPerPage);

  const handleStoreCardClick = (clickedStoreId: string) => {
    if (clickedStoreId === selectedStoreId) {
      setSelectedTab(2);
      return;
    }
    
    try {
      const targetPath = `/analytics/stores/${clickedStoreId}`;
      navigate(targetPath, { replace: false });
      setSelectedStoreId(clickedStoreId);
      setSelectedTab(2);
    } catch (error) {
      logger.error('Error navigating to store analytics:', error);
      window.location.href = `/analytics/stores/${clickedStoreId}`;
    }
  };

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setSelectedTab(newValue);
    // Update URL when switching tabs to maintain state
    if (newValue === 2 && selectedStoreId) {
      navigate(`/analytics/stores/${selectedStoreId}`, { replace: true });
    } else if (newValue === 0) {
      navigate('/analytics/stores', { replace: true });
    }
  };

  const handleDateRangeChange = (range: { start: Date | null; end: Date | null }) => {
    setStartDate(range.start);
    setEndDate(range.end);
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const handleExportCSV = async () => {
    if (!selectedStoreId) {
      showToast('Please select a store to export', 'warning');
      return;
    }
    
    try {
      setExportLoading('csv');
      const blob = await analyticsApi.exportStoreCSV(selectedStoreId);
      const store = stores?.find((s) => s.storeId === selectedStoreId);
      const storeName = store?.storeName || store?.storeCode || 'store';
      const filename = `store-${storeName.replace(/\s+/g, '-').toLowerCase()}-analytics-${new Date().toISOString().split('T')[0]}.csv`;
      downloadBlob(blob, filename);
      showToast('CSV exported successfully', 'success');
    } catch (error: unknown) {
      logger.error('Error exporting CSV:', error);
      showToast(getErrorMessage(error, 'Failed to export CSV'), 'error');
    } finally {
      setExportLoading(null);
    }
  };

  const handleExportExcel = async () => {
    if (!selectedStoreId) {
      showToast('Please select a store to export', 'warning');
      return;
    }
    
    try {
      setExportLoading('excel');
      const blob = await analyticsApi.exportStoreExcel(selectedStoreId);
      const store = stores?.find((s) => s.storeId === selectedStoreId);
      const storeName = store?.storeName || store?.storeCode || 'store';
      const filename = `store-${storeName.replace(/\s+/g, '-').toLowerCase()}-analytics-${new Date().toISOString().split('T')[0]}.xlsx`;
      downloadBlob(blob, filename);
      showToast('Excel exported successfully', 'success');
    } catch (error: unknown) {
      logger.error('Error exporting Excel:', error);
      showToast(getErrorMessage(error, 'Failed to export Excel'), 'error');
    } finally {
      setExportLoading(null);
    }
  };

  const handleExportPDF = async () => {
    if (!selectedStoreId) {
      showToast('Please select a store to export', 'warning');
      return;
    }
    
    try {
      setExportLoading('pdf');
      const blob = await analyticsApi.exportStorePDF(selectedStoreId);
      const store = stores?.find((s) => s.storeId === selectedStoreId);
      const storeName = store?.storeName || store?.storeCode || 'store';
      const filename = `store-${storeName.replace(/\s+/g, '-').toLowerCase()}-analytics-${new Date().toISOString().split('T')[0]}.pdf`;
      downloadBlob(blob, filename);
      showToast('PDF exported successfully', 'success');
    } catch (error: unknown) {
      logger.error('Error exporting PDF:', error);
      showToast(getErrorMessage(error, 'Failed to export PDF'), 'error');
    } finally {
      setExportLoading(null);
    }
  };

  if (storesLoading) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
          <CircularProgress size={48} />
        </Box>
      </Container>
    );
  }

  if (storesError) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Alert severity="error" sx={{ mb: 3 }}>
          Failed to load store analytics. Please try again later.
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      {/* Header Section */}
      <Box mb={4}>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={3}>
          <Box>
            <Box display="flex" alignItems="center" gap={2} mb={1}>
              <AnalyticsIcon sx={{ fontSize: 32, color: 'primary.main' }} />
              <Box>
                <Typography variant="h4" component="h1" fontWeight={600} sx={{ lineHeight: 1.2 }}>
                  Store Analytics
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  Analyze performance and revenue across all your stores
                </Typography>
              </Box>
            </Box>
          </Box>
          {selectedStoreId && (
            <Box display="flex" gap={1}>
              <Button
                variant="outlined"
                startIcon={exportLoading === 'csv' ? <CircularProgress size={16} /> : <DownloadIcon />}
                onClick={handleExportCSV}
                disabled={exportLoading !== null || !selectedStoreId}
                size="small"
              >
                CSV
              </Button>
              <Button
                variant="outlined"
                startIcon={exportLoading === 'excel' ? <CircularProgress size={16} /> : <TableChartIcon />}
                onClick={handleExportExcel}
                disabled={exportLoading !== null || !selectedStoreId}
                size="small"
              >
                Excel
              </Button>
              <Button
                variant="outlined"
                startIcon={exportLoading === 'pdf' ? <CircularProgress size={16} /> : <PictureAsPdfIcon />}
                onClick={handleExportPDF}
                disabled={exportLoading !== null || !selectedStoreId}
                size="small"
              >
                PDF
              </Button>
            </Box>
          )}
        </Box>

        {/* Aggregate Stats */}
        {stores && stores.length > 0 && (
          <Grid container spacing={2} sx={{ mb: 4 }}>
            <Grid item xs={6} sm={4} md={2.4}>
              <Card
                elevation={2}
                sx={{
                  height: '100%',
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 2,
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    boxShadow: 4,
                    transform: 'translateY(-2px)',
                  },
                }}
              >
                <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
                  <Box display="flex" alignItems="center" justifyContent="space-between" mb={1.5}>
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
                      <StoreIcon sx={{ fontSize: 24 }} />
                    </Box>
                    <Chip
                      label={`${aggregateStats.activeStores} active`}
                      size="small"
                      color="primary"
                      variant="outlined"
                      sx={{ fontSize: '0.7rem', height: 20, fontWeight: 600 }}
                    />
                  </Box>
                  <Typography variant="body2" color="text.secondary" fontWeight={500} sx={{ mb: 0.5, fontSize: '0.875rem' }}>
                    Total Stores
                  </Typography>
                  <Typography variant="h4" fontWeight={700} sx={{ fontSize: '2rem', lineHeight: 1.2 }}>
                    {aggregateStats.totalStores}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6} sm={4} md={2.4}>
              <Card
                elevation={2}
                sx={{
                  height: '100%',
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 2,
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    boxShadow: 4,
                    transform: 'translateY(-2px)',
                  },
                }}
              >
                <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
                  <Box display="flex" alignItems="center" mb={1.5}>
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
                      <AttachMoneyIcon sx={{ fontSize: 24 }} />
                    </Box>
                  </Box>
                  <Typography variant="body2" color="text.secondary" fontWeight={500} sx={{ mb: 0.5, fontSize: '0.875rem' }}>
                    Total Revenue
                  </Typography>
                  <Typography variant="h4" fontWeight={700} sx={{ fontSize: '1.75rem', lineHeight: 1.2 }}>
                    {formatCurrency(aggregateStats.totalRevenue, 'USD')}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6} sm={4} md={2.4}>
              <Card
                elevation={2}
                sx={{
                  height: '100%',
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 2,
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    boxShadow: 4,
                    transform: 'translateY(-2px)',
                  },
                }}
              >
                <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
                  <Box display="flex" alignItems="center" mb={1.5}>
                    <Box sx={{ 
                      p: 1.5, 
                      borderRadius: 2, 
                      bgcolor: 'info.main', 
                      color: 'info.contrastText',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minWidth: 48,
                      height: 48,
                    }}>
                      <ReceiptIcon sx={{ fontSize: 24 }} />
                    </Box>
                  </Box>
                  <Typography variant="body2" color="text.secondary" fontWeight={500} sx={{ mb: 0.5, fontSize: '0.875rem' }}>
                    Total Invoices
                  </Typography>
                  <Typography variant="h4" fontWeight={700} sx={{ fontSize: '2rem', lineHeight: 1.2 }}>
                    {aggregateStats.totalInvoices.toLocaleString()}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6} sm={4} md={2.4}>
              <Card
                elevation={2}
                sx={{
                  height: '100%',
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 2,
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    boxShadow: 4,
                    transform: 'translateY(-2px)',
                  },
                }}
              >
                <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
                  <Box display="flex" alignItems="center" mb={1.5}>
                    <Box sx={{ 
                      p: 1.5, 
                      borderRadius: 2, 
                      bgcolor: 'warning.main', 
                      color: 'warning.contrastText',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minWidth: 48,
                      height: 48,
                    }}>
                      <AccountBalanceIcon sx={{ fontSize: 24 }} />
                    </Box>
                  </Box>
                  <Typography variant="body2" color="text.secondary" fontWeight={500} sx={{ mb: 0.5, fontSize: '0.875rem' }}>
                    Outstanding
                  </Typography>
                  <Typography variant="h4" fontWeight={700} sx={{ fontSize: '1.75rem', lineHeight: 1.2 }}>
                    {formatCurrency(aggregateStats.outstandingRevenue, 'USD')}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6} sm={4} md={2.4}>
              <Card
                elevation={2}
                sx={{
                  height: '100%',
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 2,
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    boxShadow: 4,
                    transform: 'translateY(-2px)',
                  },
                }}
              >
                <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
                  <Box display="flex" alignItems="center" mb={1.5}>
                    <Box sx={{ 
                      p: 1.5, 
                      borderRadius: 2, 
                      bgcolor: 'secondary.main', 
                      color: 'secondary.contrastText',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minWidth: 48,
                      height: 48,
                    }}>
                      <PaymentIcon sx={{ fontSize: 24 }} />
                    </Box>
                  </Box>
                  <Typography variant="body2" color="text.secondary" fontWeight={500} sx={{ mb: 0.5, fontSize: '0.875rem' }}>
                    Payment Rate
                  </Typography>
                  <Typography variant="h4" fontWeight={700} sx={{ fontSize: '2rem', lineHeight: 1.2 }}>
                    {aggregateStats.averagePaymentRate.toFixed(1)}%
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}
      </Box>

      {/* Store Overview Section with Search, Filter, and Sort */}
      <Box mb={4}>
        <Paper
          elevation={1}
          sx={{
            p: 3,
            mb: 3,
            bgcolor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider',
                borderRadius: 2,
          }}
        >
          {/* Header */}
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
            <Box display="flex" alignItems="center" gap={2}>
              <StoreIcon sx={{ fontSize: 28, color: 'primary.main' }} />
            <Box>
                <Typography variant="h5" fontWeight={600} sx={{ lineHeight: 1.3 }}>
                Store Overview
              </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem', mt: 0.5 }}>
                  {filteredAndSortedStores.length} {filteredAndSortedStores.length === 1 ? 'store' : 'stores'} found
              </Typography>
            </Box>
          </Box>
          </Box>

          <Divider sx={{ mb: 3 }} />

          {/* Search, Filter, and Sort Controls */}
          <Grid container spacing={2} alignItems="center" sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                size="small"
                placeholder="Search by name or code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon color="action" />
                    </InputAdornment>
                  ),
                  endAdornment: searchQuery && (
                    <InputAdornment position="end">
                      <IconButton
                        size="small"
                        onClick={() => setSearchQuery('')}
                        edge="end"
                      >
                        <ClearIcon fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={6} sm={3} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Status</InputLabel>
                <Select
                  value={filterActive}
                  label="Status"
                  onChange={(e) => setFilterActive(e.target.value as 'all' | 'active' | 'inactive')}
                >
                  <MenuItem value="all">All</MenuItem>
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="inactive">Inactive</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6} sm={3} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Sort By</InputLabel>
                <Select
                  value={sortBy}
                  label="Sort By"
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                >
                  <MenuItem value="revenue">Revenue</MenuItem>
                  <MenuItem value="invoices">Invoices</MenuItem>
                  <MenuItem value="name">Name</MenuItem>
                  <MenuItem value="paymentRate">Payment Rate</MenuItem>
                  <MenuItem value="outstanding">Outstanding</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={12} md={5}>
              <DateRangeFilter
                startDate={startDate}
                endDate={endDate}
                onRangeChange={handleDateRangeChange}
              />
            </Grid>
          </Grid>

          {/* Store Cards Grid */}
          {paginatedStores.length > 0 ? (
            <>
              <Grid container spacing={3} sx={{ mb: 3 }}>
                {paginatedStores.map((store) => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={store.storeId}>
                <StoreAnalyticsCard store={store} onClick={handleStoreCardClick} />
              </Grid>
                ))}
              </Grid>

              {/* Pagination */}
              {totalPages > 1 && (
                <Box display="flex" justifyContent="center" alignItems="center" mt={3}>
                  <Stack spacing={2}>
                    <Pagination
                      count={totalPages}
                      page={currentPage}
                      onChange={(_, page) => setCurrentPage(page)}
                      color="primary"
                      size="large"
                      showFirstButton
                      showLastButton
                      sx={{
                        '& .MuiPaginationItem-root': {
                          fontSize: '0.95rem',
                          fontWeight: 600,
                        },
                      }}
                    />
                    <Typography variant="body2" color="text.secondary" textAlign="center">
                      Showing {((currentPage - 1) * storesPerPage) + 1} to {Math.min(currentPage * storesPerPage, filteredAndSortedStores.length)} of {filteredAndSortedStores.length} stores
                    </Typography>
                  </Stack>
                </Box>
              )}
            </>
          ) : (
              <Paper
                sx={{
                  p: 6,
                  textAlign: 'center',
                  bgcolor: 'background.paper',
                  border: '2px dashed',
                  borderColor: 'divider',
                  borderRadius: 2,
                }}
              >
                <StoreIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2, opacity: 0.5 }} />
                <Typography variant="h6" fontWeight={600} gutterBottom>
                  No Stores Found
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 400, mx: 'auto' }}>
                {searchQuery || filterActive !== 'all'
                  ? 'Try adjusting your search or filters to find stores.'
                  : 'Create a store to start tracking analytics and revenue performance.'}
                </Typography>
              {(!searchQuery && filterActive === 'all') && (
                <Button
                  variant="contained"
                  startIcon={<StoreIcon />}
                  onClick={() => navigate('/stores/create')}
                  sx={{ borderRadius: 2 }}
                >
                  Create Your First Store
                </Button>
              )}
              {(searchQuery || filterActive !== 'all' || startDate || endDate) && (
                <Button
                  variant="outlined"
                  startIcon={<ClearIcon />}
                  onClick={() => {
                    setSearchQuery('');
                    setFilterActive('all');
                    setStartDate(null);
                    setEndDate(null);
                  }}
                  sx={{ borderRadius: 2 }}
                >
                  Clear Filters
                </Button>
              )}
        </Paper>
      )}
        </Paper>
      </Box>

      {/* Charts Section - Only show when a store is selected or all stores view */}
      {selectedStoreId && (
        <Box mb={3}>
        <Paper
            elevation={1}
          sx={{
            p: 2,
              mb: 2,
              bgcolor: 'background.paper',
            border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2,
          }}
        >
            <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <Box display="flex" alignItems="center" gap={2}>
                <StoreIcon sx={{ fontSize: 24, color: 'primary.main' }} />
                <Box>
                  <Typography variant="h6" fontWeight={600}>
                {(() => {
                  const selectedStore = stores?.find((s) => s.storeId === selectedStoreId);
                  if (selectedStore) {
                    const displayName = selectedStore.storeName && selectedStore.storeName.trim() !== '' 
                      ? selectedStore.storeName 
                      : `Store ${selectedStore.storeCode || 'N/A'}`;
                    return displayName;
                  }
                  const fallbackStore = allStores?.find((s) => s.id === selectedStoreId);
                  return fallbackStore?.name || 'Selected Store';
                })()}
              </Typography>
                  <Box display="flex" alignItems="center" gap={1} mt={0.5}>
                <Chip
                  label={`Code: ${(() => {
                    const selectedStore = stores?.find((s) => s.storeId === selectedStoreId);
                    if (selectedStore) return selectedStore.storeCode || 'N/A';
                    const fallbackStore = allStores?.find((s) => s.id === selectedStoreId);
                    return fallbackStore?.code || 'N/A';
                  })()}`}
                  size="small"
                  variant="outlined"
                      sx={{ fontFamily: 'monospace', fontSize: '0.7rem', height: 20 }}
                />
                {(() => {
                  const selectedStore = stores?.find((s) => s.storeId === selectedStoreId);
                  return selectedStore ? (
                    <Chip
                      label={selectedStore.active ? 'Active' : 'Inactive'}
                      size="small"
                      color={selectedStore.active ? 'success' : 'default'}
                          sx={{ fontSize: '0.7rem', height: 20 }}
                    />
                  ) : null;
                })()}
                  </Box>
              </Box>
            </Box>
            {selectedStoreAnalytics && (
                <Box textAlign="right">
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                  Total Revenue
                </Typography>
                  <Typography variant="h6" fontWeight={600} sx={{ mt: 0.5 }}>
                  {formatCurrency(selectedStoreAnalytics.totalRevenue, 'USD')}
                </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, fontSize: '0.75rem' }}>
                  Paid: {formatCurrency(selectedStoreAnalytics.paidRevenue, 'USD')}
                </Typography>
              </Box>
            )}
          </Box>
        </Paper>
        </Box>
      )}

      {/* Tabs for different views */}
      {stores && stores.length > 0 && (
        <Paper
          elevation={1}
          sx={{
            mb: 3,
            bgcolor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs
              value={selectedTab}
              onChange={handleTabChange}
              sx={{
                '& .MuiTab-root': {
                  fontWeight: 500,
                  textTransform: 'none',
                  minHeight: 56,
                  fontSize: '0.95rem',
                },
              }}
            >
              <Tab label="Revenue Trends" />
              <Tab label="Store Comparison" />
              {selectedStoreId && <Tab label="Store Details" />}
            </Tabs>
          </Box>

          <Box sx={{ p: 3 }}>
            <TabPanel value={selectedTab} index={0}>
              <StoreRevenueChart
                key={`${selectedStoreId || 'all-stores'}-${period}-${startDate?.getTime() || ''}-${endDate?.getTime() || ''}`}
                storeId={selectedStoreId}
                startDate={startDate}
                endDate={endDate}
                period={period}
                compareStores={compareStoreIds.length > 0 ? compareStoreIds : undefined}
              />
              {selectedStoreId && (
                <Box mt={3}>
                  <FormControl size="small" sx={{ minWidth: 150 }}>
                    <InputLabel>Period</InputLabel>
                    <Select
                      value={period}
                      label="Period"
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === 'daily' || value === 'weekly' || value === 'monthly' || value === 'yearly') {
                          setPeriod(value);
                        }
                      }}
                    >
                      <MenuItem value="daily">Daily</MenuItem>
                      <MenuItem value="weekly">Weekly</MenuItem>
                      <MenuItem value="monthly">Monthly</MenuItem>
                      <MenuItem value="yearly">Yearly</MenuItem>
                    </Select>
                  </FormControl>
                </Box>
              )}
            </TabPanel>

            <TabPanel value={selectedTab} index={1}>
              <StoreComparisonDashboard
                selectedStoreIds={compareStoreIds.length > 0 ? compareStoreIds : undefined}
                onStoreSelectionChange={(storeIds) => {
                  setCompareStoreIds(storeIds);
                  if (storeIds.length > 0) {
                    setSelectedStoreId(storeIds[0]);
                  }
                }}
              />
            </TabPanel>

            {selectedStoreId && (
              <TabPanel value={selectedTab} index={2}>
                {storeAnalyticsLoading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                    <CircularProgress />
                  </Box>
                ) : selectedStoreAnalytics ? (
                  <Grid container spacing={3}>
                    {/* Revenue Summary - Enhanced */}
                    <Grid item xs={12} md={6}>
                      <Card
                        elevation={1}
                        sx={{
                          height: '100%',
                          border: '1px solid',
                          borderColor: 'divider',
                        }}
                      >
                        <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
                          <Box display="flex" alignItems="center" gap={1.5} mb={2.5}>
                            <AttachMoneyIcon sx={{ fontSize: 24, color: 'primary.main' }} />
                            <Typography variant="h6" fontWeight={600}>
                              Revenue Summary
                            </Typography>
                          </Box>
                          <Divider sx={{ mb: 3 }} />
                          
                          <Grid container spacing={3}>
                            <Grid item xs={12}>
                              <Box>
                                <Typography variant="body2" color="text.secondary" fontWeight={500} sx={{ mb: 1 }}>
                                  Total Revenue
                                </Typography>
                                <Typography variant="h5" fontWeight={600} sx={{ mb: 2 }}>
                                  {formatCurrency(selectedStoreAnalytics.totalRevenue, 'USD')}
                                </Typography>
                              </Box>
                            </Grid>
                            <Grid item xs={6}>
                              <Box>
                                <Typography variant="body2" color="text.secondary" fontWeight={500} sx={{ mb: 1 }}>
                                  Paid Revenue
                                </Typography>
                                <Typography variant="h6" fontWeight={600} sx={{ mb: 1 }}>
                                  {formatCurrency(selectedStoreAnalytics.paidRevenue, 'USD')}
                                </Typography>
                                {selectedStoreAnalytics.totalRevenue > 0 && (
                                  <Chip
                                    label={`${((selectedStoreAnalytics.paidRevenue / selectedStoreAnalytics.totalRevenue) * 100).toFixed(1)}% paid`}
                                    size="small"
                                    color={((selectedStoreAnalytics.paidRevenue / selectedStoreAnalytics.totalRevenue) * 100) >= 90 ? 'success' : 'warning'}
                                    sx={{ fontSize: '0.7rem', height: 22 }}
                                  />
                                )}
                              </Box>
                            </Grid>
                            <Grid item xs={6}>
                              <Box>
                                <Typography variant="body2" color="text.secondary" fontWeight={500} sx={{ mb: 1 }}>
                                  Total Invoices
                                </Typography>
                                <Typography variant="h6" fontWeight={600} sx={{ mb: 1 }}>
                                  {selectedStoreAnalytics.totalInvoices.toLocaleString()}
                                </Typography>
                                {selectedStoreAnalytics.totalInvoices > 0 && (
                                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>
                                    Avg: {formatCurrency(selectedStoreAnalytics.averageInvoiceValue, 'USD')}
                                  </Typography>
                                )}
                              </Box>
                            </Grid>
                            {selectedStoreAnalytics.revenue && (
                              <>
                                <Grid item xs={6}>
                                  <Box>
                                    <Typography variant="body2" color="text.secondary" fontWeight={500} sx={{ mb: 1 }}>
                                      Sent Revenue
                                    </Typography>
                                    <Typography variant="body1" fontWeight={600}>
                                      {formatCurrency(selectedStoreAnalytics.revenue.sentRevenue || 0, 'USD')}
                                    </Typography>
                                  </Box>
                                </Grid>
                                <Grid item xs={6}>
                                  <Box>
                                    <Typography variant="body2" color="text.secondary" fontWeight={500} sx={{ mb: 1 }}>
                                      Overdue Revenue
                                    </Typography>
                                    <Typography 
                                      variant="body1" 
                                      fontWeight={600}
                                      color={selectedStoreAnalytics.revenue.overdueRevenue > 0 ? 'error.main' : 'text.primary'}
                                    >
                                      {formatCurrency(selectedStoreAnalytics.revenue.overdueRevenue || 0, 'USD')}
                                    </Typography>
                                  </Box>
                                </Grid>
                              </>
                            )}
                          </Grid>
                        </CardContent>
                      </Card>
                    </Grid>
                    
                    {/* Inventory Turnover - Enhanced */}
                    <Grid item xs={12} md={6}>
                      {selectedStoreAnalytics.turnover ? (
                        <Card
                          elevation={1}
                          sx={{
                            height: '100%',
                            border: '1px solid',
                            borderColor: 'divider',
                          }}
                        >
                          <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
                            <Box display="flex" alignItems="center" gap={1.5} mb={2.5}>
                              <InventoryIcon sx={{ fontSize: 24, color: 'primary.main' }} />
                              <Typography variant="h6" fontWeight={600}>
                                Inventory Details
                              </Typography>
                            </Box>
                            <Divider sx={{ mb: 3 }} />
                            
                            <Grid container spacing={3}>
                              <Grid item xs={6}>
                                <Box>
                                  <Typography variant="body2" color="text.secondary" fontWeight={500} sx={{ mb: 1 }}>
                                    Turnover Rate
                                  </Typography>
                                  <Typography variant="h6" fontWeight={600}>
                                    {selectedStoreAnalytics.turnover.turnover.toFixed(2)}
                                  </Typography>
                                </Box>
                              </Grid>
                              <Grid item xs={6}>
                                <Box>
                                  <Typography variant="body2" color="text.secondary" fontWeight={500} sx={{ mb: 1 }}>
                                    Unique Items
                                  </Typography>
                                  <Typography variant="h6" fontWeight={600}>
                                    {selectedStoreAnalytics.turnover.uniqueItems?.toLocaleString() || 0}
                                  </Typography>
                                </Box>
                              </Grid>
                              <Grid item xs={6}>
                                <Box>
                                  <Typography variant="body2" color="text.secondary" fontWeight={500} sx={{ mb: 1 }}>
                                    Current Stock
                                  </Typography>
                                  <Typography variant="h6" fontWeight={600}>
                                    {selectedStoreAnalytics.turnover.currentStock.toLocaleString()} units
                                  </Typography>
                                </Box>
                              </Grid>
                              <Grid item xs={6}>
                                <Box>
                                  <Typography variant="body2" color="text.secondary" fontWeight={500} sx={{ mb: 1 }}>
                                    Total Purchases
                                  </Typography>
                                  <Typography variant="h6" fontWeight={600}>
                                    {selectedStoreAnalytics.turnover.totalPurchases?.toLocaleString() || 0} units
                                  </Typography>
                                </Box>
                              </Grid>
                              {selectedStoreAnalytics.turnover.totalSales > 0 && (
                                <Grid item xs={12}>
                                  <Box>
                                    <Typography variant="body2" color="text.secondary" fontWeight={500} sx={{ mb: 1 }}>
                                      Total Sales
                                    </Typography>
                                    <Typography variant="body1" fontWeight={600}>
                                      {selectedStoreAnalytics.turnover.totalSales.toLocaleString()} units
                                    </Typography>
                                  </Box>
                                </Grid>
                              )}
                            </Grid>
                          </CardContent>
                        </Card>
                      ) : (
                        <Card
                          elevation={1}
                          sx={{
                            height: '100%',
                            border: '1px dashed',
                            borderColor: 'divider',
                          }}
                        >
                          <CardContent sx={{ p: 3, textAlign: 'center', '&:last-child': { pb: 3 } }}>
                            <InventoryIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1, opacity: 0.5 }} />
                            <Typography variant="body2" color="text.secondary">
                              No inventory data available
                            </Typography>
                          </CardContent>
                        </Card>
                      )}
                    </Grid>
                    
                    {/* Top Items */}
                    {selectedStoreAnalytics.topItems && selectedStoreAnalytics.topItems.length > 0 && (
                      <Grid item xs={12} md={6}>
                        <Card
                          elevation={1}
                          sx={{
                            height: '100%',
                            border: '1px solid',
                            borderColor: 'divider',
                          }}
                        >
                          <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
                            <Box sx={{ p: 3, pb: 2 }}>
                              <Box display="flex" alignItems="center" gap={1.5} mb={2}>
                                <ShoppingCartIcon sx={{ fontSize: 24, color: 'primary.main' }} />
                                <Typography variant="h6" fontWeight={600}>
                                  Top Selling Items
                                </Typography>
                              </Box>
                              <Divider />
                            </Box>
                            <TableContainer>
                              <Table size="small">
                                <TableHead>
                                  <TableRow sx={{ bgcolor: 'grey.50' }}>
                                    <TableCell sx={{ fontWeight: 600, px: 3 }}>Item</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 600, px: 3 }}>Quantity</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 600, px: 3 }}>Revenue</TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {selectedStoreAnalytics.topItems.slice(0, 5).map((item) => (
                                    <TableRow key={item.inventoryItemId} hover>
                                      <TableCell sx={{ px: 3 }}>
                                        <Box>
                                          <Typography variant="body2" fontWeight={500}>
                                            {item.itemName}
                                          </Typography>
                                          {item.sku && (
                                            <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                                              SKU: {item.sku}
                                            </Typography>
                                          )}
                                        </Box>
                                      </TableCell>
                                      <TableCell align="right" sx={{ px: 3 }}>
                                        <Typography variant="body2" fontWeight={600}>
                                          {item.totalQuantity.toLocaleString()}
                                        </Typography>
                                      </TableCell>
                                      <TableCell align="right" sx={{ px: 3 }}>
                                        <Typography variant="body2" fontWeight={600}>
                                          {formatCurrency(item.totalRevenue, 'USD')}
                                        </Typography>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </TableContainer>
                          </CardContent>
                        </Card>
                      </Grid>
                    )}
                    {/* Sales by Category */}
                    <Grid item xs={12} md={6}>
                      <Card elevation={1} sx={{ border: '1px solid', borderColor: 'divider' }}>
                        <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
                          <Box display="flex" alignItems="center" gap={1.5} mb={2.5}>
                            <TrendingUpIcon sx={{ fontSize: 24, color: 'primary.main' }} />
                            <Typography variant="h6" fontWeight={600}>
                              Sales by Category
                            </Typography>
                          </Box>
                          <Divider sx={{ mb: 2 }} />
                          <SalesByCategoryChart
                            startDate={startDate}
                            endDate={endDate}
                            storeId={selectedStoreId}
                          />
                        </CardContent>
                      </Card>
                    </Grid>
                    
                    {/* Revenue by Payment Method */}
                    <Grid item xs={12} md={6}>
                      <Card elevation={1} sx={{ border: '1px solid', borderColor: 'divider' }}>
                        <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
                          <Box display="flex" alignItems="center" gap={1.5} mb={2.5}>
                            <ReceiptIcon sx={{ fontSize: 24, color: 'primary.main' }} />
                            <Typography variant="h6" fontWeight={600}>
                              Revenue by Payment Method
                            </Typography>
                          </Box>
                          <Divider sx={{ mb: 2 }} />
                          <RevenueByPaymentMethodChart
                            startDate={startDate}
                            endDate={endDate}
                            storeId={selectedStoreId}
                          />
                        </CardContent>
                      </Card>
                    </Grid>
                  </Grid>
                ) : (
                  <Alert severity="info">
                    No analytics data available for this store. Create invoices to see revenue data.
                  </Alert>
                )}
              </TabPanel>
            )}
          </Box>
        </Paper>
      )}
    </Container>
  );
};

export default StoreAnalytics;
