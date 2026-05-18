import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Autocomplete,
  TextField,
  Chip,
  Button,
} from '@mui/material';
import { useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useStoresAnalytics } from '../../hooks/useAnalytics';
import { analyticsApi } from '../../api/analytics';
import { useAuthStore } from '../../store/authStore';
import { formatCurrency } from '../../utils/formatters';
import type { StoreSummary } from '../../api/analytics';
import { exportToCSV } from '../../utils/export';
import DownloadIcon from '@mui/icons-material/Download';

interface StoreComparisonDashboardProps {
  selectedStoreIds?: string[];
  onStoreSelectionChange?: (storeIds: string[]) => void;
}

const StoreComparisonDashboard = ({
  selectedStoreIds: initialSelectedStoreIds,
  onStoreSelectionChange,
}: StoreComparisonDashboardProps) => {
  const { data: allStores, isLoading: storesLoading } = useStoresAnalytics();
  const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>(initialSelectedStoreIds || []);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const hasToken = typeof window !== 'undefined' && !!localStorage.getItem('accessToken');

  // Fetch detailed analytics for each selected store using useQueries
  const storeAnalyticsQueries = useQueries({
    queries: selectedStoreIds.map((storeId) => ({
      queryKey: ['analytics', 'stores', storeId],
      queryFn: () => analyticsApi.getStoreAnalytics(storeId),
      enabled: isAuthenticated && hasToken && !!storeId,
    })),
  });

  const isLoading = storesLoading || storeAnalyticsQueries.some((q) => q.isLoading);

  const handleStoreSelectionChange = (newStoreIds: string[]) => {
    setSelectedStoreIds(newStoreIds);
    if (onStoreSelectionChange) {
      onStoreSelectionChange(newStoreIds);
    }
  };

  const handleExport = () => {
    if (!allStores || selectedStoreIds.length === 0) return;

    const comparisonData = selectedStoreIds.map((storeId) => {
      const store = allStores.find((s) => s.storeId === storeId);
      const analytics = storeAnalyticsQueries.find((q) => q.data?.storeId === storeId)?.data;

      return {
        'Store Name': store?.storeName || '',
        'Store Code': store?.storeCode || '',
        // Status removed - all stores are always active
        'Total Revenue': store?.totalRevenue || 0,
        'Paid Revenue': store?.paidRevenue || 0,
        'Total Invoices': store?.totalInvoices || 0,
        'Average Invoice Value': store?.averageInvoiceValue || 0,
        'Inventory Turnover': analytics?.turnover?.turnover || 0,
        'Unique Items': analytics?.turnover?.uniqueItems || 0,
        'Total Sales': analytics?.turnover?.totalSales || 0,
        'Current Stock': analytics?.turnover?.currentStock || 0,
      };
    });

    exportToCSV(comparisonData, {
      filename: 'store-comparison',
      title: 'STORE COMPARISON EXPORT',
      description: 'Store performance comparison data',
      includeMetadata: true,
      formatNumbers: true,
      formatCurrencyFields: false,
      formatDates: true,
    });
  };

  if (isLoading && selectedStoreIds.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  const selectedStores = allStores?.filter((s) => selectedStoreIds.includes(s.storeId)) || [];

  // Prepare comparison data
  const comparisonData = selectedStores.map((store) => {
    const analytics = storeAnalyticsQueries.find((q) => q.data?.storeId === store.storeId)?.data;
    return {
      store,
      analytics,
    };
  });

  // Prepare chart data
  const chartData = selectedStores.map((store) => ({
    name: store.storeName,
    // FIX: Ensure numeric values are properly parsed
    revenue: typeof store.totalRevenue === 'number' ? store.totalRevenue : parseFloat(String(store.totalRevenue || 0)) || 0,
    invoices: typeof store.totalInvoices === 'number' ? store.totalInvoices : parseInt(String(store.totalInvoices || 0), 10) || 0,
    avgValue: typeof store.averageInvoiceValue === 'number' ? store.averageInvoiceValue : (store.totalInvoices > 0 && store.totalRevenue > 0 ? store.totalRevenue / store.totalInvoices : 0),
  }));

  const COLORS = ['#1976d2', '#2e7d32', '#ed6c02', '#d32f2f', '#9c27b0', '#0288d1'];

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h6" fontWeight={600}>
          Store Comparison
        </Typography>
        <Box display="flex" gap={2} alignItems="center">
          <Autocomplete
            multiple
            options={allStores || []}
            getOptionLabel={(option) => `${option.storeName} (${option.storeCode})`}
            value={selectedStores}
            onChange={(_, newValue) => {
              handleStoreSelectionChange(newValue.map((s) => s.storeId));
            }}
            renderInput={(params) => <TextField {...params} label="Select Stores" size="small" />}
            sx={{ minWidth: 300 }}
            disabled={storesLoading}
          />
          {selectedStoreIds.length > 0 && (
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={handleExport}
              size="small"
            >
              Export CSV
            </Button>
          )}
        </Box>
      </Box>

      {selectedStoreIds.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            Select stores to compare
          </Typography>
        </Paper>
      ) : (
        <>
          {/* Comparison Chart */}
          {chartData.length > 0 && (
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="subtitle1" fontWeight={600} mb={2}>
                Revenue Comparison
              </Typography>
              <Box sx={{ width: '100%', height: 300, minWidth: 0, minHeight: 300, position: 'relative' }}>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis tickFormatter={(value) => formatCurrency(value, 'USD')} />
                    <Tooltip
                      formatter={(value: number) => formatCurrency(value, 'USD')}
                      labelStyle={{ fontWeight: 600 }}
                    />
                    <Legend />
                    <Bar dataKey="revenue" fill="#1976d2" name="Total Revenue" />
                    <Bar dataKey="avgValue" fill="#2e7d32" name="Avg Invoice Value" />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </Paper>
          )}

          {/* Comparison Table */}
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Store</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>
                    Total Revenue
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>
                    Paid Revenue
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>
                    Invoices
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>
                    Avg. Value
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>
                    Turnover
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {comparisonData.map(({ store, analytics }) => (
                  <TableRow key={store.storeId} hover>
                    <TableCell>
                      <Box>
                        <Typography variant="body2" fontWeight={600}>
                          {store.storeName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {store.storeCode}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight={600}>
                        {formatCurrency(typeof store.totalRevenue === 'number' ? store.totalRevenue : parseFloat(String(store.totalRevenue || 0)) || 0, 'USD')}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      {formatCurrency(typeof store.paidRevenue === 'number' ? store.paidRevenue : parseFloat(String(store.paidRevenue || 0)) || 0, 'USD')}
                    </TableCell>
                    <TableCell align="right">
                      {typeof store.totalInvoices === 'number' ? store.totalInvoices : parseInt(String(store.totalInvoices || 0), 10) || 0}
                    </TableCell>
                    <TableCell align="right">
                      {formatCurrency(
                        typeof store.averageInvoiceValue === 'number' 
                          ? store.averageInvoiceValue 
                          : (store.totalInvoices > 0 && store.totalRevenue > 0 
                              ? (typeof store.totalRevenue === 'number' ? store.totalRevenue : parseFloat(String(store.totalRevenue || 0)) || 0) / (typeof store.totalInvoices === 'number' ? store.totalInvoices : parseInt(String(store.totalInvoices || 0), 10) || 1)
                              : 0), 
                        'USD'
                      )}
                    </TableCell>
                    <TableCell align="right">
                      {analytics?.turnover?.turnover ? analytics.turnover.turnover.toFixed(2) : '-'}
                    </TableCell>
                    {/* Active status removed - all stores are always active */}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}
    </Box>
  );
};

export default StoreComparisonDashboard;

