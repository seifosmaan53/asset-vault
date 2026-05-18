import { useState, useMemo } from 'react';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  CircularProgress,
  Paper,
  Chip,
} from '@mui/material';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import ReceiptIcon from '@mui/icons-material/Receipt';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import PersonIcon from '@mui/icons-material/Person';
import InventoryIcon from '@mui/icons-material/Inventory';
import { useTopClients, useTopItems, useSalesByCategory, useRevenueByPaymentMethod, useInvoicesByStatus } from '../../hooks/useAnalytics';
import { useInvoiceStats, useInvoices } from '../../hooks/useInvoices';
import { useInventory } from '../../hooks/useInventory';
import TopClientsTable from '../../components/dashboard/TopClientsTable';
import TopItemsTable from '../../components/dashboard/TopItemsTable';
import SalesByCategoryChart from '../../components/analytics/SalesByCategoryChart';
import RevenueByPaymentMethodChart from '../../components/analytics/RevenueByPaymentMethodChart';
import StatusPieChart from '../../components/dashboard/StatusPieChart';
import RevenueChart from '../../components/dashboard/RevenueChart';
import DateRangeFilter from '../../components/dashboard/DateRangeFilter';
import { formatCurrency } from '../../utils/formatters';
import { format } from 'date-fns';
import Grid from '../../components/common/Grid';

const Analytics = () => {
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);

  const { data: stats } = useInvoiceStats();
  const { data: topClients, isLoading: clientsLoading } = useTopClients();
  const { data: topItems, isLoading: itemsLoading } = useTopItems();
  const { data: salesByCategory, isLoading: categoryLoading } = useSalesByCategory(startDate, endDate);
  const { data: revenueByPaymentMethod, isLoading: paymentLoading } = useRevenueByPaymentMethod(startDate, endDate);
  const { data: invoiceStatus, isLoading: statusLoading } = useInvoicesByStatus();
  const { data: invoices } = useInvoices();
  const { data: inventoryItems } = useInventory();

  const handleDateRangeChange = (range: { start: Date | null; end: Date | null }) => {
    setStartDate(range.start);
    setEndDate(range.end);
  };

  const isLoading = clientsLoading || itemsLoading || categoryLoading || paymentLoading || statusLoading;

  // Calculate summary statistics with actual revenue (profit)
  const summaryStats = useMemo(() => {
    // Calculate actual revenue (profit) from invoices
    let totalRevenue = 0;
    let totalSales = 0;

    if (invoices && Array.isArray(invoices) && inventoryItems && Array.isArray(inventoryItems)) {
      // Create cost price map
      const costPriceMap = new Map<string, number>();
      inventoryItems.forEach((item) => {
        if (item.id && item.costPrice !== undefined && item.costPrice !== null) {
          costPriceMap.set(item.id, item.costPrice);
        }
      });

      // Calculate profit for each invoice
      invoices.forEach((invoice: any) => {
        const invoiceTotal = typeof invoice.total === 'number' 
          ? invoice.total 
          : (typeof invoice.total === 'string' 
            ? parseFloat(invoice.total) || 0 
            : 0);
        totalSales += Math.round(invoiceTotal * 100) / 100;

        if (invoice.items && Array.isArray(invoice.items)) {
          let profit = 0;
          invoice.items.forEach((item: any) => {
            const quantity = Number(item.quantity) || 0;
            const unitPrice = Number(item.unitPrice) || 0;
            const sellingPrice = quantity * unitPrice;

            if (item.inventoryItemId && costPriceMap.has(item.inventoryItemId)) {
              const costPrice = costPriceMap.get(item.inventoryItemId)!;
              const cost = quantity * costPrice;
              profit += sellingPrice - cost;
            } else {
              profit += sellingPrice;
            }
          });
          totalRevenue += Math.round(profit * 100) / 100;
        }
      });
    } else {
      // Fallback to stats if invoices not loaded
      totalRevenue = 0; // Can't calculate profit without invoices
      totalSales = stats?.totalAmount || 0;
    }
    
    // Count unique clients with revenue (from top clients)
    const totalClients = topClients?.length || 0;
    
    // Count items in top items list
    const totalItems = topItems?.length || 0;
    
    // Count categories with sales
    const totalCategories = salesByCategory?.length || 0;
    
    // Calculate total invoices from invoice status data
    const totalInvoices = invoiceStatus?.reduce((sum, s) => sum + (s.count || 0), 0) || 0;

    return {
      totalRevenue,
      totalSales,
      totalClients,
      totalItems,
      totalCategories,
      totalInvoices,
    };
  }, [stats, topClients, topItems, salesByCategory, invoiceStatus, invoices, inventoryItems]);

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      {/* Header Section */}
      <Box mb={4}>
        <Box display="flex" alignItems="center" gap={2} mb={1.5}>
          <Box
            sx={{
              p: 1.5,
              borderRadius: 2,
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 3,
            }}
          >
            <AnalyticsIcon sx={{ fontSize: 32 }} />
          </Box>
          <Box>
            <Typography variant="h4" component="h1" fontWeight={700} sx={{ lineHeight: 1.2, mb: 0.5 }}>
              Business Analytics
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ fontSize: '0.95rem' }}>
              Comprehensive insights into your business performance
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Summary Statistics Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={6} sm={4} md={2.4}>
          <Card
            elevation={3}
            sx={{
              height: '100%',
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              color: 'white',
              position: 'relative',
              overflow: 'hidden',
              borderRadius: 3,
              transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: 6,
              },
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                right: 0,
                width: 80,
                height: 80,
                background: 'rgba(255, 255, 255, 0.15)',
                borderRadius: '50%',
                transform: 'translate(30%, -30%)',
              },
            }}
          >
            <CardContent sx={{ position: 'relative', zIndex: 1, p: 2.5, '&:last-child': { pb: 2.5 } }}>
              <Box display="flex" alignItems="center" justifyContent="flex-start" mb={1.5}>
                <Box
                  sx={{
                    p: 1.5,
                    borderRadius: 2,
                    bgcolor: 'rgba(255, 255, 255, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <AttachMoneyIcon sx={{ fontSize: 28, opacity: 0.95 }} />
                </Box>
              </Box>
              <Typography variant="caption" sx={{ opacity: 0.95, fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Total Revenue
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.8, fontSize: '0.65rem', display: 'block', mt: 0.25 }}>
                Profit (Selling - Cost)
              </Typography>
              <Typography variant="h6" fontWeight={700} sx={{ mt: 0.5, lineHeight: 1.2 }}>
                {formatCurrency(summaryStats.totalRevenue, 'USD')}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={4} md={2.4}>
          <Card
            elevation={3}
            sx={{
              height: '100%',
              background: 'linear-gradient(135deg, #ed6c02 0%, #c55a00 100%)',
              color: 'white',
              position: 'relative',
              overflow: 'hidden',
              borderRadius: 3,
              transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: 6,
              },
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                right: 0,
                width: 80,
                height: 80,
                background: 'rgba(255, 255, 255, 0.15)',
                borderRadius: '50%',
                transform: 'translate(30%, -30%)',
              },
            }}
          >
            <CardContent sx={{ position: 'relative', zIndex: 1, p: 2.5, '&:last-child': { pb: 2.5 } }}>
              <Box display="flex" alignItems="center" justifyContent="flex-start" mb={1.5}>
                <Box
                  sx={{
                    p: 1.5,
                    borderRadius: 2,
                    bgcolor: 'rgba(255, 255, 255, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <TrendingUpIcon sx={{ fontSize: 28, opacity: 0.95 }} />
                </Box>
              </Box>
              <Typography variant="caption" sx={{ opacity: 0.95, fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Total Sales
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.8, fontSize: '0.65rem', display: 'block', mt: 0.25 }}>
                Selling Price Only
              </Typography>
              <Typography variant="h6" fontWeight={700} sx={{ mt: 0.5, lineHeight: 1.2 }}>
                {formatCurrency(summaryStats.totalSales || 0, 'USD')}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={4} md={2.4}>
          <Card
            elevation={3}
            sx={{
              height: '100%',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: 'white',
              position: 'relative',
              overflow: 'hidden',
              borderRadius: 3,
              transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: 6,
              },
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                right: 0,
                width: 80,
                height: 80,
                background: 'rgba(255, 255, 255, 0.15)',
                borderRadius: '50%',
                transform: 'translate(30%, -30%)',
              },
            }}
          >
            <CardContent sx={{ position: 'relative', zIndex: 1, p: 2.5, '&:last-child': { pb: 2.5 } }}>
              <Box display="flex" alignItems="center" justifyContent="flex-start" mb={1.5}>
                <Box
                  sx={{
                    p: 1.5,
                    borderRadius: 2,
                    bgcolor: 'rgba(255, 255, 255, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <ReceiptIcon sx={{ fontSize: 28, opacity: 0.95 }} />
                </Box>
              </Box>
              <Typography variant="caption" sx={{ opacity: 0.95, fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Total Invoices
              </Typography>
              <Typography variant="h6" fontWeight={700} sx={{ mt: 0.5, lineHeight: 1.2 }}>
                {summaryStats.totalInvoices.toLocaleString()}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={4} md={2.4}>
          <Card
            elevation={3}
            sx={{
              height: '100%',
              background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
              color: 'white',
              position: 'relative',
              overflow: 'hidden',
              borderRadius: 3,
              transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: 6,
              },
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                right: 0,
                width: 80,
                height: 80,
                background: 'rgba(255, 255, 255, 0.15)',
                borderRadius: '50%',
                transform: 'translate(30%, -30%)',
              },
            }}
          >
            <CardContent sx={{ position: 'relative', zIndex: 1, p: 2.5, '&:last-child': { pb: 2.5 } }}>
              <Box display="flex" alignItems="center" justifyContent="flex-start" mb={1.5}>
                <Box
                  sx={{
                    p: 1.5,
                    borderRadius: 2,
                    bgcolor: 'rgba(255, 255, 255, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <PersonIcon sx={{ fontSize: 28, opacity: 0.95 }} />
                </Box>
              </Box>
              <Typography variant="caption" sx={{ opacity: 0.95, fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Active Clients
              </Typography>
              <Typography variant="h6" fontWeight={700} sx={{ mt: 0.5, lineHeight: 1.2 }}>
                {summaryStats.totalClients}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={4} md={2.4}>
          <Card
            elevation={3}
            sx={{
              height: '100%',
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              color: 'white',
              position: 'relative',
              overflow: 'hidden',
              borderRadius: 3,
              transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: 6,
              },
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                right: 0,
                width: 80,
                height: 80,
                background: 'rgba(255, 255, 255, 0.15)',
                borderRadius: '50%',
                transform: 'translate(30%, -30%)',
              },
            }}
          >
            <CardContent sx={{ position: 'relative', zIndex: 1, p: 2.5, '&:last-child': { pb: 2.5 } }}>
              <Box display="flex" alignItems="center" justifyContent="flex-start" mb={1.5}>
                <Box
                  sx={{
                    p: 1.5,
                    borderRadius: 2,
                    bgcolor: 'rgba(255, 255, 255, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <InventoryIcon sx={{ fontSize: 28, opacity: 0.95 }} />
                </Box>
              </Box>
              <Typography variant="caption" sx={{ opacity: 0.95, fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Top Items
              </Typography>
              <Typography variant="h6" fontWeight={700} sx={{ mt: 0.5, lineHeight: 1.2 }}>
                {summaryStats.totalItems}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={4} md={2.4}>
          <Card
            elevation={3}
            sx={{
              height: '100%',
              background: 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)',
              color: 'white',
              position: 'relative',
              overflow: 'hidden',
              borderRadius: 3,
              transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: 6,
              },
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                right: 0,
                width: 80,
                height: 80,
                background: 'rgba(255, 255, 255, 0.15)',
                borderRadius: '50%',
                transform: 'translate(30%, -30%)',
              },
            }}
          >
            <CardContent sx={{ position: 'relative', zIndex: 1, p: 2.5, '&:last-child': { pb: 2.5 } }}>
              <Box display="flex" alignItems="center" justifyContent="flex-start" mb={1.5}>
                <Box
                  sx={{
                    p: 1.5,
                    borderRadius: 2,
                    bgcolor: 'rgba(255, 255, 255, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <TrendingUpIcon sx={{ fontSize: 28, opacity: 0.95 }} />
                </Box>
              </Box>
              <Typography variant="caption" sx={{ opacity: 0.95, fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Categories
              </Typography>
              <Typography variant="h6" fontWeight={700} sx={{ mt: 0.5, lineHeight: 1.2 }}>
                {summaryStats.totalCategories}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Date Range Filter */}
      <Paper
        elevation={2}
        sx={{
          p: 3,
          mb: 4,
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 3,
          background: 'linear-gradient(to bottom, rgba(99, 102, 241, 0.03) 0%, rgba(255, 255, 255, 0) 100%)',
        }}
      >
        <Box display="flex" alignItems="center" gap={1.5} mb={2}>
          <Typography variant="h6" fontWeight={700}>
            Filter by Date Range
          </Typography>
          {startDate && endDate && (
            <Chip
              label={`${format(startDate, 'MMM d, yyyy')} - ${format(endDate, 'MMM d, yyyy')}`}
              size="small"
              color="primary"
              sx={{ fontWeight: 600 }}
            />
          )}
        </Box>
        <DateRangeFilter
          startDate={startDate}
          endDate={endDate}
          onRangeChange={handleDateRangeChange}
        />
      </Paper>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
          <CircularProgress size={48} />
        </Box>
      ) : (
        <>
          {/* Revenue Charts Row */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} md={8}>
              <Card elevation={3} sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                    <Box>
                      <Typography variant="h6" fontWeight={700} sx={{ mb: 0.5 }}>
                        Revenue Over Time
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Track revenue trends across selected period
                      </Typography>
                    </Box>
                    {summaryStats.totalRevenue > 0 && (
                      <Chip
                        label={`Total: ${formatCurrency(summaryStats.totalRevenue, 'USD')}`}
                        color="primary"
                        sx={{ fontWeight: 600 }}
                      />
                    )}
                  </Box>
                  <Box sx={{ flex: 1, minHeight: 0 }}>
                    <RevenueChart startDate={startDate} endDate={endDate} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={4}>
              <Card elevation={3} sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                    <Box>
                      <Typography variant="h6" fontWeight={700} sx={{ mb: 0.5 }}>
                        Invoice Status
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Distribution by status
                      </Typography>
                    </Box>
                  </Box>
                  <Box sx={{ flex: 1, minHeight: 0 }}>
                    <StatusPieChart />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Sales Analysis Row */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} md={6}>
              <Card elevation={3} sx={{ height: '100%' }}>
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                    <Box>
                      <Typography variant="h6" fontWeight={700} sx={{ mb: 0.5 }}>
                        Sales by Category
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Revenue breakdown by product category
                      </Typography>
                    </Box>
                  </Box>
                  <SalesByCategoryChart startDate={startDate} endDate={endDate} />
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card elevation={3} sx={{ height: '100%' }}>
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                    <Box>
                      <Typography variant="h6" fontWeight={700} sx={{ mb: 0.5 }}>
                        Revenue by Payment Method
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Payment method distribution
                      </Typography>
                    </Box>
                  </Box>
                  <RevenueByPaymentMethodChart startDate={startDate} endDate={endDate} />
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Top Performers Row */}
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card elevation={3} sx={{ height: '100%' }}>
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                    <Box>
                      <Typography variant="h6" fontWeight={700} sx={{ mb: 0.5 }}>
                        Top Clients by Revenue
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Your highest value customers
                      </Typography>
                    </Box>
                    {summaryStats.totalClients > 0 && (
                      <Chip
                        label={`${summaryStats.totalClients} clients`}
                        size="small"
                        color="primary"
                        variant="outlined"
                        sx={{ fontWeight: 600 }}
                      />
                    )}
                  </Box>
                  <TopClientsTable />
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card elevation={3} sx={{ height: '100%' }}>
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                    <Box>
                      <Typography variant="h6" fontWeight={700} sx={{ mb: 0.5 }}>
                        Top Items by Sales
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Best performing products
                      </Typography>
                    </Box>
                    {summaryStats.totalItems > 0 && (
                      <Chip
                        label={`${summaryStats.totalItems} items`}
                        size="small"
                        color="primary"
                        variant="outlined"
                        sx={{ fontWeight: 600 }}
                      />
                    )}
                  </Box>
                  <TopItemsTable />
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </>
      )}
    </Container>
  );
};

export default Analytics;

