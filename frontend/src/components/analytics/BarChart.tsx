import { BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { Box, CircularProgress, Typography } from '@mui/material';
import { useMemo } from 'react';

// Default color palette for bars
const DEFAULT_COLORS = [
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

export interface BarChartData {
  [key: string]: string | number;
}

export interface BarChartSeries {
  dataKey: string;
  name?: string;
  color?: string;
}

export interface BarChartProps {
  data: BarChartData[];
  xKey: string;
  yKey?: string; // For single series
  series?: BarChartSeries[]; // For multiple series
  layout?: 'vertical' | 'horizontal';
  colors?: string[];
  height?: number;
  isLoading?: boolean;
  error?: Error | null;
  emptyMessage?: string;
  emptyIcon?: React.ReactNode;
  xAxisLabel?: string;
  yAxisLabel?: string;
  formatXValue?: (value: string | number) => string;
  formatYValue?: (value: number) => string;
  formatTooltip?: (value: number, name: string) => [string, string];
  showLegend?: boolean;
  barRadius?: number | [number, number, number, number];
  showGrid?: boolean;
  margin?: { top?: number; right?: number; bottom?: number; left?: number };
}

const BarChart = ({
  data,
  xKey,
  yKey,
  series,
  layout = 'horizontal',
  colors = DEFAULT_COLORS,
  height = 450,
  isLoading = false,
  error = null,
  emptyMessage = 'No data available',
  emptyIcon,
  xAxisLabel,
  yAxisLabel,
  formatXValue,
  formatYValue,
  formatTooltip,
  showLegend = true,
  barRadius = [0, 4, 4, 0],
  showGrid = true,
  margin = { top: 10, right: 20, left: 10, bottom: 10 },
}: BarChartProps) => {
  // Determine if we're using single or multiple series
  const isMultiSeries = Boolean(series && series.length > 0);
  const chartSeries = useMemo(() => {
    if (isMultiSeries && series) {
      return series;
    } else if (yKey) {
      return [{ dataKey: yKey, name: yKey }];
    }
    return [];
  }, [isMultiSeries, series, yKey]);

  // Prepare chart data with colors
  const chartData = useMemo(() => {
    return data.map((item, index) => ({
      ...item,
      _index: index,
    }));
  }, [data]);

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height }}>
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
          height,
          p: 3,
        }}
      >
        {emptyIcon}
        <Typography variant="body1" color="error.main" fontWeight={600} gutterBottom>
          Error Loading Data
        </Typography>
        <Typography variant="body2" color="text.secondary" textAlign="center">
          {error.message || 'Unable to load chart data. Please try again later.'}
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
          height,
          p: 3,
        }}
      >
        {emptyIcon}
        <Typography variant="body2" color="text.secondary" textAlign="center">
          {emptyMessage}
        </Typography>
      </Box>
    );
  }

  if (chartSeries.length === 0) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          height,
          p: 3,
        }}
      >
        <Typography variant="body2" color="text.secondary" textAlign="center">
          No series configured. Please provide yKey or series prop.
        </Typography>
      </Box>
    );
  }

  const isVertical = layout === 'vertical';

  return (
    <Box sx={{ width: '100%', height: '100%', minHeight: height, minWidth: 0 }}>
      <ResponsiveContainer width="100%" height="100%" minHeight={height}>
        <RechartsBarChart
          data={chartData}
          layout={layout}
          margin={margin}
        >
          {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" horizontal={!isVertical} vertical={isVertical} />}
          
          {isVertical ? (
            <>
              <XAxis
                type="number"
                tickFormatter={formatYValue || ((value) => String(value))}
                tick={{ fontSize: 11 }}
                width={60}
                label={yAxisLabel ? { value: yAxisLabel, angle: -90, position: 'insideLeft' } : undefined}
              />
              <YAxis
                type="category"
                dataKey={xKey}
                tick={{ fontSize: 10 }}
                width={65}
                tickFormatter={formatXValue || ((value) => String(value || ''))}
              />
            </>
          ) : (
            <>
              <XAxis
                dataKey={xKey}
                tick={{ fontSize: 11 }}
                tickFormatter={formatXValue || ((value) => String(value || ''))}
                angle={-45}
                textAnchor="end"
                height={80}
                label={xAxisLabel ? { value: xAxisLabel, position: 'insideBottom', offset: -5 } : undefined}
              />
              <YAxis
                tickFormatter={formatYValue || ((value) => String(value))}
                tick={{ fontSize: 11 }}
                width={80}
                label={yAxisLabel ? { value: yAxisLabel, angle: -90, position: 'insideLeft' } : undefined}
              />
            </>
          )}

          <Tooltip
            formatter={formatTooltip || ((value: number, name: string) => {
              if (formatYValue) {
                return [formatYValue(value), name];
              }
              return [String(value), name];
            })}
            contentStyle={{
              backgroundColor: 'rgba(255, 255, 255, 0.98)',
              border: '1px solid #ccc',
              borderRadius: '4px',
              padding: '8px 12px',
            }}
            labelStyle={{ fontWeight: 'bold', marginBottom: '4px' }}
            cursor={{ fill: 'rgba(0, 0, 0, 0.05)' }}
          />

          {showLegend && <Legend wrapperStyle={{ paddingTop: '10px' }} />}

          {chartSeries.map((serie, index) => {
            const color = serie.color || colors[index % colors.length];
            return (
              <Bar
                key={serie.dataKey}
                dataKey={serie.dataKey}
                name={serie.name || serie.dataKey}
                radius={barRadius}
                minPointSize={2}
                fill={isMultiSeries ? color : undefined}
              >
                {!isMultiSeries && data.map((entry, idx) => (
                  <Cell key={`cell-${idx}`} fill={colors[idx % colors.length]} />
                ))}
              </Bar>
            );
          })}
        </RechartsBarChart>
      </ResponsiveContainer>
    </Box>
  );
};

export default BarChart;

