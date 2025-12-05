import { Box, Typography, Grid, Paper, CircularProgress } from '@mui/material';
import { useInvoiceStats } from '../hooks/useInvoices';
import { useLowStock } from '../hooks/useInventory';
import { formatCurrency } from '../utils/formatters';
import RevenueChart from '../components/dashboard/RevenueChart';
import StatusPieChart from '../components/dashboard/StatusPieChart';

const Dashboard = () => {
  const { data: stats, isLoading: statsLoading } = useInvoiceStats();
  const { data: lowStockItems, isLoading: lowStockLoading } = useLowStock();

  if (statsLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Dashboard
      </Typography>
      <Grid container spacing={3} sx={{ mt: 2 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" color="text.secondary">
              Unpaid Invoices
            </Typography>
            <Typography variant="h4">
              {stats?.unpaidCount || 0}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {formatCurrency(stats?.unpaidAmount || 0)}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" color="text.secondary">
              Overdue
            </Typography>
            <Typography variant="h4" color="error">
              {stats?.overdueCount || 0}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {formatCurrency(stats?.overdueAmount || 0)}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" color="text.secondary">
              This Month
            </Typography>
            <Typography variant="h4" color="success.main">
              {formatCurrency(stats?.monthlyTotal || 0)}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" color="text.secondary">
              Total
            </Typography>
            <Typography variant="h4">
              {formatCurrency(stats?.totalAmount || 0)}
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      <Grid container spacing={3} sx={{ mt: 2 }}>
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 2, minHeight: 300 }}>
            <Typography variant="h6" gutterBottom>
              Revenue Over Time
            </Typography>
            <RevenueChart />
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2, minHeight: 300 }}>
            <Typography variant="h6" gutterBottom>
              Status Distribution
            </Typography>
            <StatusPieChart />
          </Paper>
        </Grid>
      </Grid>

      <Grid container spacing={3} sx={{ mt: 2 }}>
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Low Stock Items
            </Typography>
            {lowStockLoading ? (
              <CircularProgress size={24} />
            ) : lowStockItems && lowStockItems.length > 0 ? (
              <Box>
                {lowStockItems.slice(0, 5).map((item) => (
                  <Box key={item.id} sx={{ py: 1, borderBottom: '1px solid #eee' }}>
                    <Typography variant="body2" fontWeight="bold">
                      {item.name}
                    </Typography>
                    <Typography variant="caption" color="error">
                      Stock: {item.currentStock} / Reorder: {item.reorderLevel}
                    </Typography>
                  </Box>
                ))}
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No low stock items
              </Typography>
            )}
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;
