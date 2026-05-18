import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { Box, CircularProgress, Typography } from '@mui/material';
import { useTopClients } from '../../hooks/useAnalytics';
import { useInvoices } from '../../hooks/useInvoices';
import { formatCurrency } from '../../utils/formatters';
import PersonIcon from '@mui/icons-material/Person';
import { useMemo } from 'react';
import { parseISO, startOfDay, endOfDay } from 'date-fns';

interface RevenueByClientChartProps {
  startDate?: Date | null;
  endDate?: Date | null;
}

// Color palette for bars
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

const RevenueByClientChart = ({ startDate, endDate }: RevenueByClientChartProps) => {
  const { data: allClients, isLoading: clientsLoading } = useTopClients();
  const { data: invoices, isLoading: invoicesLoading } = useInvoices();
  const isLoading = clientsLoading || invoicesLoading;
  
  // Apply client-side date filtering if date range is provided
  const data = useMemo(() => {
    if (!allClients || allClients.length === 0) {
      return [];
    }

    // If no date filter is applied, return all clients
    if (!startDate || !endDate) {
      return allClients;
    }

    // Filter invoices by date range
    const rangeStart = startOfDay(new Date(startDate));
    const rangeEnd = endOfDay(new Date(endDate));

    // Group invoices by client within the date range
    const clientRevenueMap = new Map<string, { clientName: string; totalRevenue: number; invoiceCount: number }>();

    // Ensure invoices is an array before processing
    if (invoices && Array.isArray(invoices) && invoices.length > 0) {
      invoices.forEach((invoice) => {
        // Only include sent, paid, and overdue invoices
        if (!['sent', 'paid', 'overdue'].includes(invoice.status)) {
          return;
        }

        // Determine invoice date (use paidAt if available and status is paid, otherwise use issueDate)
        let invoiceDate: Date;
        try {
          if (invoice.paidAt) {
            invoiceDate = parseISO(invoice.paidAt);
          } else if (invoice.issueDate) {
            invoiceDate = parseISO(invoice.issueDate);
          } else {
            return;
          }

          // Normalize invoice date for comparison
          const invoiceDayStart = startOfDay(invoiceDate);
          const invoiceDayEnd = endOfDay(invoiceDate);

          // Check if invoice is within date range
          const isInRange = invoiceDayStart <= rangeEnd && invoiceDayEnd >= rangeStart;
          if (!isInRange) {
            return;
          }

          // Aggregate by client
          const clientId = invoice.clientId || 'unknown';
          const clientName = invoice.client?.name || 'Unknown Client';
          const existing = clientRevenueMap.get(clientId) || { clientName, totalRevenue: 0, invoiceCount: 0 };
          
          clientRevenueMap.set(clientId, {
            clientName,
            totalRevenue: existing.totalRevenue + (Number(invoice.total) || 0),
            invoiceCount: existing.invoiceCount + 1,
          });
        } catch (error) {
          // Skip invalid dates silently
        }
      });
    }

    // Convert to array and sort by revenue
    const filteredClients = Array.from(clientRevenueMap.entries())
      .map(([clientId, data]) => ({
        clientId,
        clientName: data.clientName,
        totalRevenue: data.totalRevenue,
        invoiceCount: data.invoiceCount,
      }))
      .sort((a, b) => b.totalRevenue - a.totalRevenue);

    return filteredClients.length > 0 ? filteredClients : allClients;
  }, [allClients, invoices, startDate, endDate]);

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 450 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: 450 }}>
        <PersonIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1, opacity: 0.5 }} />
        <Typography variant="body2" color="text.secondary">
          No client revenue data available
        </Typography>
      </Box>
    );
  }

  // Sort by revenue descending and take top 8 for better readability
  const sortedData = [...(data || [])]
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .slice(0, 8);

  // Prepare chart data with better name handling
  const chartData = sortedData.map((client, index) => {
    // Truncate long names but keep more characters, use smart truncation
    let displayName = client.clientName || 'Unknown Client';
    
    // If name is too long for the Y-axis, truncate intelligently at word boundaries
    if (displayName.length > 18) {
      // Try to truncate at word boundary
      const truncated = displayName.substring(0, 15);
      const lastSpace = truncated.lastIndexOf(' ');
      if (lastSpace > 6) {
        displayName = truncated.substring(0, lastSpace) + '...';
      } else {
        // If no good space found, truncate and add ellipsis
        displayName = truncated + '...';
      }
    }
    
    return {
      name: displayName,
      fullName: client.clientName || 'Unknown Client',
      revenue: Math.round(client.totalRevenue * 100) / 100,
      invoiceCount: client.invoiceCount,
      color: COLORS[index % COLORS.length],
    };
  });

  return (
    <Box sx={{ width: '100%', height: '450px', minHeight: '450px', minWidth: 0 }}>
      <ResponsiveContainer width="100%" height={450} minHeight={450}>
        <BarChart 
          data={chartData || []} 
          layout="vertical"
          margin={{ top: 10, right: 20, left: 10, bottom: 10 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" horizontal={true} vertical={false} />
          <XAxis 
            type="number"
            tickFormatter={(value) => formatCurrency(value)}
            tick={{ fontSize: 11 }}
            width={60}
          />
          <YAxis 
            type="category"
            dataKey="name"
            tick={{ fontSize: 10 }}
            width={65}
            tickFormatter={(value) => {
              // Preserve spaces in client names
              return value || '';
            }}
          />
          <Tooltip
            formatter={(value: number) => formatCurrency(value)}
            labelFormatter={(label, payload) => {
              if (payload && payload[0] && payload[0].payload) {
                return payload[0].payload.fullName;
              }
              return label;
            }}
            contentStyle={{ 
              backgroundColor: 'rgba(255, 255, 255, 0.98)',
              border: '1px solid #ccc',
              borderRadius: '4px',
              padding: '8px 12px',
            }}
            labelStyle={{ fontWeight: 'bold', marginBottom: '4px' }}
            cursor={{ fill: 'rgba(0, 0, 0, 0.05)' }}
          />
          <Legend 
            formatter={() => 'Revenue'}
            wrapperStyle={{ paddingTop: '10px' }}
          />
          <Bar 
            dataKey="revenue" 
            name="Revenue"
            radius={[0, 4, 4, 0]}
            minPointSize={2}
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

export default RevenueByClientChart;

