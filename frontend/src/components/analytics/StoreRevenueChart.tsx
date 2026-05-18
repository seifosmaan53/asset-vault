import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';
import {
  Box,
  ToggleButton,
  ToggleButtonGroup,
  CircularProgress,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
} from '@mui/material';
import { useState, useEffect } from 'react';
import { useStoreTrends, useStoresAnalytics } from '../../hooks/useAnalytics';
import { formatCurrency } from '../../utils/formatters';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';

interface StoreRevenueChartProps {
  storeId?: string; // If undefined, show all stores
  startDate?: Date | null;
  endDate?: Date | null;
  period?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  compareStores?: string[]; // Array of storeIds to compare
}

const StoreRevenueChart = ({
  storeId,
  period = 'monthly',
  compareStores,
}: StoreRevenueChartProps) => {
  const [chartType, setChartType] = useState<'line' | 'area'>('line');
  const [selectedPeriod, setSelectedPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>(
    period,
  );

  // Update selectedPeriod when period prop changes
  useEffect(() => {
    if (period !== selectedPeriod) {
      setSelectedPeriod(period);
    }
  }, [period, selectedPeriod]);

  // Get stores for comparison
  const { data: allStores } = useStoresAnalytics();
  const storesToCompare = compareStores && compareStores.length > 0 ? compareStores : storeId ? [storeId] : [];

  // Fetch trends for each store - only fetch for first store if single, or up to 4 stores for comparison
  const store1Trends = useStoreTrends(storesToCompare[0], selectedPeriod);
  const store2Trends = useStoreTrends(storesToCompare[1], selectedPeriod);
  const store3Trends = useStoreTrends(storesToCompare[2], selectedPeriod);
  const store4Trends = useStoreTrends(storesToCompare[3], selectedPeriod);
  
  const trendQueries = [
    store1Trends,
    store2Trends,
    store3Trends,
    store4Trends,
  ].filter((_, index) => index < storesToCompare.length);
  
  const isLoading = trendQueries.some((q) => q.isLoading);
  const hasError = trendQueries.some((q) => q.error);

  // Process data for chart
  const processData = () => {
    if (!trendQueries.length) return [];

    // Get all unique periods from all stores
    const allPeriods = new Set<string>();
    trendQueries.forEach((query) => {
      query.data?.forEach((trend) => {
        allPeriods.add(trend.period);
      });
    });

    const sortedPeriods = Array.from(allPeriods).sort();

    // Create data points for each period
    return sortedPeriods.map((period) => {
      const dataPoint: Record<string, string | number> = { period };

      trendQueries.forEach((query, index) => {
        const storeId = storesToCompare[index];
        const trend = query.data?.find((t) => t.period === period);
        const storeName = allStores?.find((s) => s.storeId === storeId)?.storeName || `Store ${index + 1}`;

        if (trend) {
          dataPoint[storeName] = trend.revenue;
        } else {
          dataPoint[storeName] = 0;
        }
      });

      return dataPoint;
    });
  };

  const chartData = processData();

  // Get colors for multiple stores
  const COLORS = [
    '#1976d2',
    '#2e7d32',
    '#ed6c02',
    '#d32f2f',
    '#9c27b0',
    '#0288d1',
    '#388e3c',
    '#f57c00',
  ];

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (hasError) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          height: 400,
          p: 3,
        }}
      >
        <TrendingUpIcon sx={{ fontSize: 48, color: 'error.main', mb: 1, opacity: 0.5 }} />
        <Typography variant="body1" color="error.main" fontWeight={600} gutterBottom>
          Error Loading Data
        </Typography>
        <Typography variant="body2" color="text.secondary" textAlign="center">
          Unable to load revenue trends. Please try again later.
        </Typography>
      </Box>
    );
  }

  if (!storeId && (!compareStores || compareStores.length === 0)) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          height: 400,
          p: 3,
        }}
      >
        <TrendingUpIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1, opacity: 0.5 }} />
        <Typography variant="body1" fontWeight={600} gutterBottom>
          Select a Store
        </Typography>
        <Typography variant="body2" color="text.secondary" textAlign="center">
          Choose a store from the cards above or use the dropdown to view revenue trends.
        </Typography>
      </Box>
    );
  }

  // Show loading state while fetching data for the selected store
  if (storeId && storesToCompare.length > 0 && isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
        <CircularProgress />
        <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>
          Loading revenue data for store...
        </Typography>
      </Box>
    );
  }

  if (chartData.length === 0) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          height: 400,
          p: 3,
        }}
      >
        <TrendingUpIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1, opacity: 0.5 }} />
        <Typography variant="body1" fontWeight={600} gutterBottom>
          No Revenue Data
        </Typography>
        <Typography variant="body2" color="text.secondary" textAlign="center">
          This store doesn't have any revenue data yet. Create and pay invoices to see trends here.
        </Typography>
      </Box>
    );
  }

  const storeNames = storesToCompare.map(
    (id, index) => allStores?.find((s) => s.storeId === id)?.storeName || `Store ${index + 1}`,
  );

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6" fontWeight={600}>
          Revenue Trends
        </Typography>
        <Box display="flex" gap={1} alignItems="center">
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Period</InputLabel>
            <Select
              value={selectedPeriod}
              label="Period"
              onChange={(e) => {
                const value = e.target.value;
                if (value === 'daily' || value === 'weekly' || value === 'monthly' || value === 'yearly') {
                  setSelectedPeriod(value);
                }
              }}
            >
              <MenuItem value="daily">Daily</MenuItem>
              <MenuItem value="weekly">Weekly</MenuItem>
              <MenuItem value="monthly">Monthly</MenuItem>
              <MenuItem value="yearly">Yearly</MenuItem>
            </Select>
          </FormControl>
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
      </Box>

      {storeNames.length > 1 && (
        <Box display="flex" gap={1} mb={2} flexWrap="wrap">
          {storeNames.map((name, index) => (
            <Chip
              key={name}
              label={name}
              size="small"
              sx={{
                backgroundColor: COLORS[index % COLORS.length],
                color: 'white',
              }}
            />
          ))}
        </Box>
      )}

      <Box sx={{ width: '100%', height: 400, minWidth: 0, minHeight: 400 }}>
        <ResponsiveContainer width="100%" height={400}>
          {chartType === 'line' ? (
            <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="period" />
              <YAxis tickFormatter={(value) => formatCurrency(value, 'USD')} />
              <Tooltip
                formatter={(value: number) => formatCurrency(value, 'USD')}
                labelStyle={{ fontWeight: 600 }}
              />
              <Legend />
              {storeNames.map((name, index) => (
                <Line
                  key={name}
                  type="monotone"
                  dataKey={name}
                  stroke={COLORS[index % COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              ))}
            </LineChart>
          ) : (
            <AreaChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="period" />
              <YAxis tickFormatter={(value) => formatCurrency(value, 'USD')} />
              <Tooltip
                formatter={(value: number) => formatCurrency(value, 'USD')}
                labelStyle={{ fontWeight: 600 }}
              />
              <Legend />
              {storeNames.map((name, index) => (
                <Area
                  key={name}
                  type="monotone"
                  dataKey={name}
                  stroke={COLORS[index % COLORS.length]}
                  fill={COLORS[index % COLORS.length]}
                  fillOpacity={0.6}
                  strokeWidth={2}
                />
              ))}
          </AreaChart>
        )}
        </ResponsiveContainer>
      </Box>
    </Box>
  );
};

export default StoreRevenueChart;

