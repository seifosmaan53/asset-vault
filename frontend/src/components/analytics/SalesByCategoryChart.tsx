import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Box, CircularProgress, Typography } from '@mui/material';
import { useSalesByCategory } from '../../hooks/useAnalytics';
import { formatCurrency } from '../../utils/formatters';
import CategoryIcon from '@mui/icons-material/Category';

const COLORS = [
  '#1976d2', // Primary blue
  '#2e7d32', // Green
  '#ed6c02', // Orange
  '#d32f2f', // Red
  '#9c27b0', // Purple
  '#0288d1', // Light blue
  '#388e3c', // Dark green
  '#f57c00', // Dark orange
  '#c2185b', // Pink
  '#00796b', // Teal
];

interface SalesByCategoryChartProps {
  startDate?: Date | null;
  endDate?: Date | null;
  storeId?: string;
}

const SalesByCategoryChart = ({ startDate, endDate, storeId }: SalesByCategoryChartProps) => {
  const { data, isLoading, error } = useSalesByCategory(startDate, endDate, storeId);

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 280, minHeight: 280 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          height: 280,
          minHeight: 280,
          p: 2,
        }}
      >
        <CategoryIcon sx={{ fontSize: 40, color: 'error.main', mb: 1, opacity: 0.5 }} />
        <Typography variant="body2" color="error.main" fontWeight={600} gutterBottom>
          Error Loading Data
        </Typography>
        <Typography variant="caption" color="text.secondary" textAlign="center">
          Unable to load sales by category data.
        </Typography>
      </Box>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          height: 280,
          minHeight: 280,
          p: 2,
        }}
      >
        <CategoryIcon sx={{ fontSize: 40, color: 'text.secondary', mb: 1, opacity: 0.5 }} />
        <Typography variant="body2" fontWeight={600} gutterBottom>
          No Sales Data
        </Typography>
        <Typography variant="caption" color="text.secondary" textAlign="center">
          No sales data available for the selected period.
        </Typography>
      </Box>
    );
  }

  // Calculate total revenue for percentage calculation
  const totalRevenue = data.reduce((sum, item) => sum + item.totalRevenue, 0);

  // Prepare chart data - sort by revenue descending
  const chartData = data
    .map((item, index) => {
      const category = item.category || 'Uncategorized';
      const revenue = item.totalRevenue;
      const percent = totalRevenue > 0 ? (revenue / totalRevenue) * 100 : 0;
      return {
        name: category,
        revenue: revenue,
        percent: percent,
        quantity: item.totalQuantity,
        invoiceCount: item.invoiceCount,
        color: COLORS[index % COLORS.length],
      };
    })
    .sort((a, b) => b.revenue - a.revenue);

  // Calculate dynamic height based on number of items
  const chartHeight = Math.max(280, Math.min(400, chartData.length * 35 + 60));

  return (
    <Box sx={{ width: '100%', height: `${chartHeight}px`, minWidth: 0, minHeight: '280px' }}>
      <ResponsiveContainer width="100%" height={chartHeight} minHeight={280}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 5, right: 20, left: 5, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" horizontal={true} vertical={false} />
          <XAxis
            type="number"
            tickFormatter={(value) => formatCurrency(value)}
            tick={{ fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 11, fontWeight: 500 }}
            width={85}
            axisLine={false}
            tickLine={false}
            dx={-5}
          />
          <Tooltip
            formatter={(value: number, name: string, props: { payload?: Record<string, unknown> }) => {
              const payload = props.payload;
              return [
                <>
                  <div style={{ fontWeight: 600, marginBottom: '4px' }}>
                    {formatCurrency(payload.revenue)}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#666' }}>
                    {payload.percent.toFixed(1)}% of total
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '4px' }}>
                    Quantity: {payload.quantity.toLocaleString()}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#666' }}>
                    Invoices: {payload.invoiceCount}
                  </div>
                </>,
                'Revenue',
              ];
            }}
            contentStyle={{
              backgroundColor: 'rgba(255, 255, 255, 0.98)',
              border: '1px solid #ccc',
              borderRadius: '6px',
              padding: '10px 12px',
              fontSize: '0.875rem',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            }}
            cursor={{ fill: 'rgba(0, 0, 0, 0.05)' }}
            labelStyle={{ fontWeight: 600 }}
          />
          <Bar
            dataKey="revenue"
            name="Revenue"
            radius={[0, 6, 6, 0]}
            minPointSize={3}
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Box>
  );
};

export default SalesByCategoryChart;

