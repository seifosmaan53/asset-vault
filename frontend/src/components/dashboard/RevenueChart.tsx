import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { Box, ToggleButton, ToggleButtonGroup, CircularProgress, Typography } from '@mui/material';
import { useState, useMemo } from 'react';
import { useInvoices } from '../../hooks/useInvoices';
import { formatCurrency } from '../../utils/formatters';
import { 
  format, 
  parseISO, 
  subMonths, 
  eachMonthOfInterval, 
  startOfMonth, 
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  differenceInCalendarDays,
  startOfYear,
  eachYearOfInterval,
} from 'date-fns';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';

interface RevenueChartProps {
  startDate?: Date | null;
  endDate?: Date | null;
}

type GroupingType = 'daily' | 'weekly' | 'monthly' | 'yearly';

interface ChartDataPoint {
  label: string;
  periodStart: Date;
  revenue: number;
}

const RevenueChart = ({ startDate, endDate }: RevenueChartProps) => {
  const { data: invoices, isLoading } = useInvoices();
  const [chartType, setChartType] = useState<'line' | 'area'>('line');

  // Generate period intervals based on grouping type
  const generatePeriods = (start: Date, end: Date, grouping: GroupingType): ChartDataPoint[] => {
    const periods: ChartDataPoint[] = [];

    switch (grouping) {
      case 'daily': {
        const days = eachDayOfInterval({ start, end });
        days.forEach(day => {
          periods.push({
            label: format(day, 'MMM d'),
            periodStart: startOfDay(day),
            revenue: 0,
          });
        });
        break;
      }
      case 'weekly': {
        // Generate weeks starting from the week containing the start date
        let currentWeekStart = startOfWeek(start, { weekStartsOn: 1 });
        
        while (currentWeekStart <= end) {
          const weekEndDate = endOfWeek(currentWeekStart, { weekStartsOn: 1 });
          const actualEnd = weekEndDate > end ? end : weekEndDate;
          const actualStart = currentWeekStart < start ? start : currentWeekStart;
          const weekLabel = `${format(actualStart, 'MMM d')} – ${format(actualEnd, 'MMM d')}`;
          periods.push({
            label: weekLabel,
            periodStart: new Date(currentWeekStart), // Always use week start for grouping
            revenue: 0,
          });
          // Move to next week (7 days later)
          currentWeekStart = new Date(currentWeekStart);
          currentWeekStart.setDate(currentWeekStart.getDate() + 7);
        }
        break;
      }
      case 'monthly': {
        const months = eachMonthOfInterval({ start: startOfMonth(start), end });
        months.forEach(month => {
          periods.push({
            label: format(month, 'MMM yyyy'),
            periodStart: startOfMonth(month),
            revenue: 0,
          });
        });
        break;
      }
      case 'yearly': {
        const years = eachYearOfInterval({ start: startOfYear(start), end });
        years.forEach(year => {
          periods.push({
            label: format(year, 'yyyy'),
            periodStart: startOfYear(year),
            revenue: 0,
          });
        });
        break;
      }
    }

    return periods;
  };

  // Get the period key for an invoice date based on grouping type
  const getPeriodKey = (invoiceDate: Date, grouping: GroupingType): Date => {
    switch (grouping) {
      case 'daily':
        return startOfDay(invoiceDate);
      case 'weekly':
        return startOfWeek(invoiceDate, { weekStartsOn: 1 });
      case 'monthly':
        return startOfMonth(invoiceDate);
      case 'yearly':
        return startOfYear(invoiceDate);
    }
  };

  // Postgres DATE -> "YYYY-MM-DD" (no timezone). Treat as local calendar date.
  const parseInvoiceDate = (s: string): Date => {
    // Postgres DATE -> "YYYY-MM-DD" (no timezone). Treat as local calendar date.
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const [y, m, d] = s.split('-').map(Number);
      return new Date(y, m - 1, d); // local midnight
    }

    // Try parsing as ISO string, but normalize to local date
    const parsed = parseISO(s);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
    
    // Fallback: try to parse as date string
    return new Date(s);
  };

  // Process data with optional date range
  const data = useMemo(() => {
    const now = new Date();

    // Range
    let rangeStart: Date;
    let rangeEnd: Date;

    if (startDate && endDate) {
      rangeStart = startOfDay(startDate);
      rangeEnd = endOfDay(endDate);
    } else {
      rangeStart = startOfDay(subMonths(now, 5));
      rangeEnd = endOfDay(now);
    }

    if (rangeStart > rangeEnd) [rangeStart, rangeEnd] = [rangeEnd, rangeStart];

    // Grouping (calendar-safe + inclusive)
    const days = differenceInCalendarDays(rangeEnd, rangeStart) + 1;
    const grouping: GroupingType =
      days <= 31 ? 'daily' :
      days <= 84 ? 'weekly' :
      days <= 730 ? 'monthly' :
      'yearly';

    // Buckets
    const periods = generatePeriods(rangeStart, rangeEnd, grouping);

    // O(1) lookup by period key
    const periodIndexByKey = new Map<number, number>();
    periods.forEach((p, idx) => {
      const key = getPeriodKey(p.periodStart, grouping).getTime();
      periodIndexByKey.set(key, idx);
    });

    // Sum paid invoices - ensure invoices is an array
    if (invoices && Array.isArray(invoices) && invoices.length > 0) {
      for (const invoice of invoices) {
        if (invoice.status !== 'paid') continue;

        const total = Number(invoice.total);
        if (!Number.isFinite(total) || total <= 0) continue;

        try {
          // Explicit handling: paidAt is ISO timestamp, issueDate is Postgres DATE (YYYY-MM-DD)
          // For revenue calculation, prefer paidAt (when payment was received) over issueDate
          let invoiceDate: Date | null = null;
          
          if (invoice.paidAt) {
            // paidAt is an ISO timestamp - parse it and use local date
            const parsedPaidAt = parseISO(invoice.paidAt);
            if (!isNaN(parsedPaidAt.getTime())) {
              invoiceDate = parsedPaidAt;
            }
          }
          
          // Fallback to issueDate if paidAt is not available or invalid
          if (!invoiceDate && invoice.issueDate) {
            invoiceDate = parseInvoiceDate(invoice.issueDate);
          }

          if (!invoiceDate || isNaN(invoiceDate.getTime())) {
            continue;
          }

          // Normalize to local date boundaries for accurate comparison
          const invoiceDayStart = startOfDay(invoiceDate);
          const invoiceDayEnd = endOfDay(invoiceDate);

          // Check if invoice date overlaps with the selected range
          // An invoice is included if its day overlaps with the range
          if (!(invoiceDayStart <= rangeEnd && invoiceDayEnd >= rangeStart)) {
            continue;
          }

          const key = getPeriodKey(invoiceDayStart, grouping).getTime();
          const idx = periodIndexByKey.get(key);
          if (idx === undefined) {
            continue;
          }

          periods[idx].revenue += total;
        } catch (error) {
          // Log error for debugging but continue processing other invoices
          // Error silently skipped to prevent chart rendering issues
        }
      }
    }

    return periods.map(p => ({
      label: p.label,
      revenue: Math.round(p.revenue * 100) / 100,
    }));
  }, [invoices, startDate, endDate]);

  // Show loading state
  if (isLoading) {
    return (
      <Box sx={{ width: '100%', height: 300, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }
  
  // Show empty state if no data
  if (!data || data.length === 0 || data.every(d => d.revenue === 0)) {
    return (
      <Box sx={{ width: '100%', height: 300, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', p: 3 }}>
        <TrendingUpIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1, opacity: 0.5 }} />
        <Typography variant="body2" color="text.secondary" fontWeight="medium" mb={0.5}>
          No revenue data available
        </Typography>
        <Typography variant="caption" color="text.secondary" textAlign="center">
          {startDate && endDate 
            ? `No paid invoices found between ${format(startDate, 'MMM d, yyyy')} and ${format(endDate, 'MMM d, yyyy')}`
            : 'Create and mark invoices as paid to see revenue trends'}
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%', height: 300, minWidth: 0, minHeight: 300 }}>
      <Box display="flex" justifyContent="flex-end" mb={1}>
        <ToggleButtonGroup
          value={chartType}
          exclusive
          onChange={(_, newType) => newType && setChartType(newType)}
          size="small"
        >
          <ToggleButton value="line">Line</ToggleButton>
          <ToggleButton value="area">Area</ToggleButton>
        </ToggleButtonGroup>
      </Box>
      <Box sx={{ width: '100%', height: 280, minWidth: 0, minHeight: 280 }}>
        <ResponsiveContainer width="100%" height={280}>
        {chartType === 'line' ? (
          <LineChart data={data || []} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
            <XAxis 
              dataKey="label" 
              tick={{ fontSize: 12 }}
              angle={-45}
              textAnchor="end"
              height={80}
              interval="preserveStartEnd"
              minTickGap={20}
            />
            <YAxis 
              tickFormatter={(value) => formatCurrency(value)} 
              tick={{ fontSize: 12 }}
              width={80}
            />
            <Tooltip 
              formatter={(value: number) => formatCurrency(value)} 
              labelStyle={{ fontWeight: 'bold' }}
              contentStyle={{ 
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                border: '1px solid #ccc',
                borderRadius: '4px',
              }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="revenue"
              stroke="#1976d2"
              strokeWidth={2}
              name="Revenue"
              dot={{ r: 4, fill: '#1976d2' }}
              activeDot={{ r: 6, fill: '#1976d2' }}
              connectNulls={false}
            />
          </LineChart>
        ) : (
          <AreaChart data={data || []} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
            <XAxis 
              dataKey="label" 
              tick={{ fontSize: 12 }}
              angle={-45}
              textAnchor="end"
              height={80}
              interval="preserveStartEnd"
              minTickGap={20}
            />
            <YAxis 
              tickFormatter={(value) => formatCurrency(value)} 
              tick={{ fontSize: 12 }}
              width={80}
            />
            <Tooltip 
              formatter={(value: number) => formatCurrency(value)} 
              labelStyle={{ fontWeight: 'bold' }}
              contentStyle={{ 
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                border: '1px solid #ccc',
                borderRadius: '4px',
              }}
            />
            <Legend />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="#1976d2"
              fill="#1976d2"
              fillOpacity={0.3}
              name="Revenue"
              connectNulls={false}
            />
          </AreaChart>
        )}
        </ResponsiveContainer>
      </Box>
    </Box>
  );
};

export default RevenueChart;

