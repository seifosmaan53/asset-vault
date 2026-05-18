import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Box, CircularProgress } from '@mui/material';
import { useInvoicesByStatus } from '../../hooks/useAnalytics';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

const InvoicesByStatusChart = () => {
  const { data, isLoading } = useInvoicesByStatus();

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
        <CircularProgress />
      </Box>
    );
  }

  const chartData = (data || []).map((item) => ({
    name: item.status.charAt(0).toUpperCase() + item.status.slice(1),
    value: item.count,
  }));

  if (chartData.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
        <Box sx={{ textAlign: 'center', color: 'text.secondary' }}>
          No invoice data available
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%', height: 300, minWidth: 0, minHeight: 300, display: 'block', position: 'relative' }}>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={chartData || []}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={(entry: { name?: string; value?: number }) => `${entry.name || ''}: ${entry.value || 0}`}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
          >
            {chartData.map((_entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </Box>
  );
};

export default InvoicesByStatusChart;

