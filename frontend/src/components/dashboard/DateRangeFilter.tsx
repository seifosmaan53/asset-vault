import { useState, useMemo, useEffect } from 'react';
import { Box, Button, Menu, MenuItem, Typography, Chip, Divider } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { 
  format, 
  subDays, 
  subMonths, 
  subYears, 
  startOfMonth, 
  endOfMonth, 
  startOfYear, 
  endOfYear,
  startOfWeek,
  endOfWeek,
  subWeeks,
  startOfDay,
  endOfDay,
  getQuarter,
} from 'date-fns';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';

interface DateRangeFilterProps {
  startDate: Date | null;
  endDate: Date | null;
  onRangeChange: (range: { start: Date | null; end: Date | null }) => void;
}

const DateRangeFilter = ({ startDate, endDate, onRangeChange }: DateRangeFilterProps) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const now = new Date();
  const today = endOfDay(now);
  const todayForMaxDate = new Date(); // Use current date/time without time manipulation for maxDate
  const yesterday = endOfDay(subDays(now, 1));
  const currentQuarter = getQuarter(now);
  const currentYear = now.getFullYear();
  
  // Validate and clamp dates to prevent future dates from being displayed
  const validatedStartDate = useMemo(() => {
    if (!startDate) return null;
    if (startDate > todayForMaxDate || startDate.getFullYear() > currentYear) {
      return subMonths(todayForMaxDate, 6);
    }
    return startDate;
  }, [startDate, todayForMaxDate, currentYear]);
  
  const validatedEndDate = useMemo(() => {
    if (!endDate) return null;
    if (endDate > todayForMaxDate || endDate.getFullYear() > currentYear) {
      return todayForMaxDate;
    }
    return endDate;
  }, [endDate, todayForMaxDate, currentYear]);
  
  // Auto-correct if dates are invalid (only when dates actually change)
  useEffect(() => {
    const needsCorrection = 
      (startDate && (startDate > todayForMaxDate || startDate.getFullYear() > currentYear)) ||
      (endDate && (endDate > todayForMaxDate || endDate.getFullYear() > currentYear));
    
    if (needsCorrection) {
      const correctedStart = startDate && (startDate > todayForMaxDate || startDate.getFullYear() > currentYear)
        ? subMonths(todayForMaxDate, 6)
        : (validatedStartDate || subMonths(todayForMaxDate, 6));
      const correctedEnd = endDate && (endDate > todayForMaxDate || endDate.getFullYear() > currentYear)
        ? todayForMaxDate
        : (validatedEndDate || todayForMaxDate);
      
      // Only update if dates actually need correction
      if (correctedStart !== startDate || correctedEnd !== endDate) {
        onRangeChange({ start: correctedStart, end: correctedEnd });
      }
    }
  }, [startDate, endDate]); // Only depend on the actual date props, not the validated ones

  // Helper to get quarter start date
  const getQuarterStart = (date: Date): Date => {
    const quarter = getQuarter(date);
    const year = date.getFullYear();
    return new Date(year, (quarter - 1) * 3, 1);
  };

  // Helper to get quarter end date
  const getQuarterEnd = (date: Date): Date => {
    const quarter = getQuarter(date);
    const year = date.getFullYear();
    return new Date(year, quarter * 3, 0, 23, 59, 59, 999);
  };

  // Helper to get previous quarter start
  const getPreviousQuarterStart = (): Date => {
    const currentQuarter = getQuarter(now);
    const currentYear = now.getFullYear();
    let prevQuarter = currentQuarter - 1;
    let prevYear = currentYear;
    if (prevQuarter === 0) {
      prevQuarter = 4;
      prevYear = currentYear - 1;
    }
    return new Date(prevYear, (prevQuarter - 1) * 3, 1);
  };

  // Helper to get previous quarter end
  const getPreviousQuarterEnd = (): Date => {
    const currentQuarter = getQuarter(now);
    const currentYear = now.getFullYear();
    let prevQuarter = currentQuarter - 1;
    let prevYear = currentYear;
    if (prevQuarter === 0) {
      prevQuarter = 4;
      prevYear = currentYear - 1;
    }
    return new Date(prevYear, prevQuarter * 3, 0, 23, 59, 59, 999);
  };

  // Helper to get YTD start (Jan 1 of current year)
  const getYearToDateStart = (): Date => {
    return new Date(currentYear, 0, 1);
  };

  // Helper to get last year YTD start
  const getLastYearToDateStart = (): Date => {
    return new Date(currentYear - 1, 0, 1);
  };

  // Helper to get last year YTD end (same day last year)
  const getLastYearToDateEnd = (): Date => {
    return endOfDay(new Date(currentYear - 1, now.getMonth(), now.getDate()));
  };

  const quickRanges = [
    // Recent
    { label: 'Today', getRange: () => ({ start: startOfDay(now), end: today }), group: 'recent' },
    { label: 'Yesterday', getRange: () => ({ start: startOfDay(subDays(now, 1)), end: yesterday }), group: 'recent' },
    { label: 'Last 7 days', getRange: () => ({ start: subDays(now, 7), end: today }), group: 'recent' },
    { label: 'Last 14 days', getRange: () => ({ start: subDays(now, 14), end: today }), group: 'recent' },
    { label: 'Last 30 days', getRange: () => ({ start: subDays(now, 30), end: today }), group: 'recent' },
    { label: 'Last 90 days', getRange: () => ({ start: subDays(now, 90), end: today }), group: 'recent' },
    
    // This Period
    { label: 'This week', getRange: () => ({ start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) }), group: 'this' },
    { label: 'This month', getRange: () => ({ start: startOfMonth(now), end: endOfMonth(now) }), group: 'this' },
    { label: 'This quarter', getRange: () => ({ start: getQuarterStart(now), end: getQuarterEnd(now) }), group: 'this' },
    { label: 'This year', getRange: () => ({ start: startOfYear(now), end: endOfYear(now) }), group: 'this' },
    { label: 'Year to date', getRange: () => ({ start: getYearToDateStart(), end: today }), group: 'this' },
    
    // Last Period
    { label: 'Last week', getRange: () => ({ start: startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 }), end: endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 }) }), group: 'last' },
    { label: 'Last month', getRange: () => ({ start: startOfMonth(subMonths(now, 1)), end: endOfMonth(subMonths(now, 1)) }), group: 'last' },
    { label: 'Last quarter', getRange: () => ({ start: getPreviousQuarterStart(), end: getPreviousQuarterEnd() }), group: 'last' },
    { label: 'Last year', getRange: () => ({ start: subYears(now, 1), end: today }), group: 'last' },
    { label: 'Last year to date', getRange: () => ({ start: getLastYearToDateStart(), end: getLastYearToDateEnd() }), group: 'last' },
    
    // Quarters (Current Year)
    { label: `Q1 ${currentYear}`, getRange: () => ({ start: new Date(currentYear, 0, 1), end: new Date(currentYear, 2, 31, 23, 59, 59, 999) }), group: 'quarters' },
    { label: `Q2 ${currentYear}`, getRange: () => ({ start: new Date(currentYear, 3, 1), end: new Date(currentYear, 5, 30, 23, 59, 59, 999) }), group: 'quarters' },
    { label: `Q3 ${currentYear}`, getRange: () => ({ start: new Date(currentYear, 6, 1), end: new Date(currentYear, 8, 30, 23, 59, 59, 999) }), group: 'quarters' },
    { label: `Q4 ${currentYear}`, getRange: () => ({ start: new Date(currentYear, 9, 1), end: new Date(currentYear, 11, 31, 23, 59, 59, 999) }), group: 'quarters' },
    
    // Extended ranges
    { label: 'Last 3 months', getRange: () => ({ start: subMonths(now, 3), end: today }), group: 'extended' },
    { label: 'Last 6 months', getRange: () => ({ start: subMonths(now, 6), end: today }), group: 'extended' },
  ];

  // Group ranges by category
  const groupedRanges = {
    recent: quickRanges.filter(r => r.group === 'recent'),
    this: quickRanges.filter(r => r.group === 'this'),
    last: quickRanges.filter(r => r.group === 'last'),
    quarters: quickRanges.filter(r => r.group === 'quarters'),
    extended: quickRanges.filter(r => r.group === 'extended'),
  };

  const handleQuickRange = (range: { start: Date; end: Date }) => {
    onRangeChange(range);
    setAnchorEl(null);
  };

  const handleStartDateChange = (date: Date | null) => {
    if (!date) {
      onRangeChange({ start: null, end: endDate });
      return;
    }
    
    // Prevent future dates - use today as maximum
    const todayStart = startOfDay(todayForMaxDate);
    if (date > todayStart) {
      date = new Date(todayStart);
    }
    
    // Normalize to start of day
    const normalizedDate = startOfDay(date);
    
    // If end date exists and new start date is after end date, adjust end date
    if (endDate && normalizedDate > endDate) {
      onRangeChange({ start: normalizedDate, end: normalizedDate });
    } else {
      onRangeChange({ start: normalizedDate, end: endDate });
    }
  };

  const handleEndDateChange = (date: Date | null) => {
    if (!date) {
      onRangeChange({ start: startDate, end: null });
      return;
    }
    
    // Prevent future dates - use today as maximum
    const todayEnd = endOfDay(todayForMaxDate);
    if (date > todayEnd) {
      date = new Date(todayEnd);
    }
    
    // Normalize to end of day
    const normalizedDate = endOfDay(date);
    
    // If start date exists and new end date is before start date, adjust start date
    if (startDate && normalizedDate < startDate) {
      onRangeChange({ start: normalizedDate, end: normalizedDate });
    } else {
      onRangeChange({ start: startDate, end: normalizedDate });
    }
  };

  const getRangeLabel = () => {
    if (validatedStartDate && validatedEndDate) {
      // If start and end are the same day, show just one date
      const startDay = format(validatedStartDate, 'yyyy-MM-dd');
      const endDay = format(validatedEndDate, 'yyyy-MM-dd');
      if (startDay === endDay) {
        return format(validatedStartDate, 'MMM d, yyyy');
      }
      return `${format(validatedStartDate, 'MMM d, yyyy')} - ${format(validatedEndDate, 'MMM d, yyyy')}`;
    }
    return 'Select date range';
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box 
        display="flex" 
        gap={2} 
        alignItems="center" 
        flexWrap="wrap" 
        sx={{ 
          mt: 1,
          '& > *': {
            flexShrink: 0,
          }
        }}
      >
        <DatePicker
          label="Start Date"
          value={validatedStartDate}
          onChange={handleStartDateChange}
          format="MMM d, yyyy"
          maxDate={validatedEndDate ? (validatedEndDate <= todayForMaxDate ? validatedEndDate : todayForMaxDate) : todayForMaxDate}
          slotProps={{ 
            textField: { 
              size: 'small', 
              sx: { 
                width: { xs: '100%', sm: 200 },
                '& .MuiInputBase-input': {
                  fontSize: '0.875rem',
                  padding: '8.5px 14px',
                },
                '& .MuiInputLabel-root': {
                  fontSize: '0.875rem',
                }
              } 
            } 
          }}
        />
        <DatePicker
          label="End Date"
          value={validatedEndDate}
          onChange={handleEndDateChange}
          format="MMM d, yyyy"
          minDate={validatedStartDate || undefined}
          maxDate={todayForMaxDate}
          slotProps={{ 
            textField: { 
              size: 'small', 
              sx: { 
                width: { xs: '100%', sm: 200 },
                '& .MuiInputBase-input': {
                  fontSize: '0.875rem',
                  padding: '8.5px 14px',
                },
                '& .MuiInputLabel-root': {
                  fontSize: '0.875rem',
                }
              } 
            } 
          }}
        />
        <Button
          variant="outlined"
          startIcon={<CalendarTodayIcon />}
          onClick={(e) => setAnchorEl(e.currentTarget)}
          size="small"
          sx={{ 
            minWidth: { xs: '100%', sm: 140 },
            height: 40,
          }}
        >
          Quick Range
        </Button>
        <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
          {groupedRanges.recent.length > 0 && [
            ...groupedRanges.recent.map((range) => (
              <MenuItem
                key={range.label}
                onClick={() => handleQuickRange(range.getRange())}
              >
                {range.label}
              </MenuItem>
            )),
            <Divider key="recent-divider" />
          ]}
          {groupedRanges.this.length > 0 && [
            ...groupedRanges.this.map((range) => (
              <MenuItem
                key={range.label}
                onClick={() => handleQuickRange(range.getRange())}
              >
                {range.label}
              </MenuItem>
            )),
            <Divider key="this-divider" />
          ]}
          {groupedRanges.last.length > 0 && [
            ...groupedRanges.last.map((range) => (
              <MenuItem
                key={range.label}
                onClick={() => handleQuickRange(range.getRange())}
              >
                {range.label}
              </MenuItem>
            )),
            <Divider key="last-divider" />
          ]}
          {groupedRanges.quarters.length > 0 && [
            ...groupedRanges.quarters.map((range) => (
              <MenuItem
                key={range.label}
                onClick={() => handleQuickRange(range.getRange())}
              >
                {range.label}
              </MenuItem>
            )),
            <Divider key="quarters-divider" />
          ]}
          {groupedRanges.extended.length > 0 &&
            groupedRanges.extended.map((range) => (
              <MenuItem
                key={range.label}
                onClick={() => handleQuickRange(range.getRange())}
              >
                {range.label}
              </MenuItem>
            ))}
        </Menu>
        {validatedStartDate && validatedEndDate && (
          <Chip
            label={getRangeLabel()}
            onDelete={() => onRangeChange({ start: null, end: null })}
            size="small"
            color="primary"
            variant="outlined"
            sx={{ 
              fontSize: '0.75rem',
              height: 40,
              '& .MuiChip-label': {
                px: 1.5,
              }
            }}
          />
        )}
      </Box>
    </LocalizationProvider>
  );
};

export default DateRangeFilter;

