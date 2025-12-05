import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Box, Typography } from '@mui/material';
import { useInvoices } from '../../hooks/useInvoices';
import { formatCurrency } from '../../utils/formatters';
import { format, parseISO, subMonths } from 'date-fns';

const RevenueChart = () => {
  const { data: invoices } = useInvoices();

  // Process data for last 6 months
  const processData = () => {
    const months = [];
    const now = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const date = subMonths(now, i);
      months.push({
        month: format(date, 'MMM yyyy'),
        revenue: 0,
      });
    }

    if (invoices) {
      invoices.forEach((invoice) => {
        if (invoice.status === 'paid') {
          const invoiceDate = parseISO(invoice.issueDate);
          const monthKey = format(invoiceDate, 'MMM yyyy');
          const monthData = months.find((m) => m.month === monthKey);
          if (monthData) {
            monthData.revenue += invoice.total;
          }
        }
      });
    }

    return months;
  };

  const data = processData();

  return (
    <Box sx={{ width: '100%', height: 300 }}>
      <ResponsiveContainer>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="month" />
          <YAxis tickFormatter={(value) => formatCurrency(value)} />
          <Tooltip formatter={(value: number) => formatCurrency(value)} />
          <Legend />
          <Line
            type="monotone"
            dataKey="revenue"
            stroke="#1976d2"
            strokeWidth={2}
            name="Revenue"
          />
        </LineChart>
      </ResponsiveContainer>
    </Box>
  );
};

export default RevenueChart;

