import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Box, Typography } from '@mui/material';
import { useInvoices } from '../../hooks/useInvoices';
import ReceiptIcon from '@mui/icons-material/Receipt';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

const StatusPieChart = () => {
  const { data: invoices } = useInvoices();

  const processData = () => {
    const statusCounts: Record<string, number> = {
      draft: 0,
      sent: 0,
      paid: 0,
      overdue: 0,
      cancelled: 0,
    };

    // Ensure invoices is an array before processing
    if (invoices && Array.isArray(invoices)) {
      invoices.forEach((invoice) => {
        if (invoice && invoice.status) {
          statusCounts[invoice.status] = (statusCounts[invoice.status] || 0) + 1;
        }
      });
    }

    return Object.entries(statusCounts)
      .filter(([_, count]) => count > 0)
      .map(([status, count]) => ({
        name: status.charAt(0).toUpperCase() + status.slice(1),
        value: count,
      }));
  };

  const data = processData();

  // Show empty state if no data
  if (!data || data.length === 0) {
    return (
      <Box sx={{ width: '100%', height: 300, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', p: 3 }}>
        <ReceiptIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1, opacity: 0.5 }} />
        <Typography variant="body2" color="text.secondary" fontWeight="medium" mb={0.5}>
          No invoice data available
        </Typography>
        <Typography variant="caption" color="text.secondary" textAlign="center">
          Create invoices to see status distribution
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%', height: 300, minWidth: 0, minHeight: 300, display: 'block', position: 'relative' }}>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={(entry: { name?: string; percent?: number }) => `${entry.name || ''} ${((entry.percent ?? 0) * 100).toFixed(0)}%`}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
          >
            {data.map((_entry, index) => (
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

export default StatusPieChart;

