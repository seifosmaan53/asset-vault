import { useState, useCallback } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Typography,
  IconButton,
  Chip,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Collapse,
} from '@mui/material';
import FilterListIcon from '@mui/icons-material/FilterList';
import CloseIcon from '@mui/icons-material/Close';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ClearIcon from '@mui/icons-material/Clear';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

export type DateRangeFilter = {
  field: string;
  label: string;
  startDate: Date | null;
  endDate: Date | null;
};

export type AmountRangeFilter = {
  field: string;
  label: string;
  min: number | null;
  max: number | null;
};

export type AdvancedFiltersState = {
  dateRanges: DateRangeFilter[];
  amountRanges: AmountRangeFilter[];
};

interface AdvancedFiltersProps {
  open: boolean;
  onClose: () => void;
  onApply: (filters: AdvancedFiltersState) => void;
  dateRangeFields?: Array<{ field: string; label: string }>;
  amountRangeFields?: Array<{ field: string; label: string }>;
  initialFilters?: AdvancedFiltersState;
}

export const AdvancedFilters = ({
  open,
  onClose,
  onApply,
  dateRangeFields = [],
  amountRangeFields = [],
  initialFilters,
}: AdvancedFiltersProps) => {
  const [dateRanges, setDateRanges] = useState<DateRangeFilter[]>(
    initialFilters?.dateRanges || dateRangeFields.map(f => ({ ...f, startDate: null, endDate: null }))
  );
  const [amountRanges, setAmountRanges] = useState<AmountRangeFilter[]>(
    initialFilters?.amountRanges || amountRangeFields.map(f => ({ ...f, min: null, max: null }))
  );
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    dateRanges: dateRangeFields.length > 0,
    amountRanges: amountRangeFields.length > 0,
  });

  const toggleSection = useCallback((section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  }, []);

  const updateDateRange = useCallback((index: number, field: 'startDate' | 'endDate', value: Date | null) => {
    setDateRanges(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }, []);

  const updateAmountRange = useCallback((index: number, field: 'min' | 'max', value: number | null) => {
    setAmountRanges(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }, []);

  const handleApply = useCallback(() => {
    onApply({ dateRanges, amountRanges });
    onClose();
  }, [dateRanges, amountRanges, onApply, onClose]);

  const handleClear = useCallback(() => {
    setDateRanges(dateRangeFields.map(f => ({ ...f, startDate: null, endDate: null })));
    setAmountRanges(amountRangeFields.map(f => ({ ...f, min: null, max: null })));
  }, [dateRangeFields, amountRangeFields]);

  const hasActiveFilters = useCallback(() => {
    return (
      dateRanges.some(r => r.startDate || r.endDate) ||
      amountRanges.some(r => r.min !== null || r.max !== null)
    );
  }, [dateRanges, amountRanges]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
        },
      }}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center" gap={1.5}>
            <FilterListIcon sx={{ color: 'primary.main' }} />
            <Typography variant="h6" fontWeight={600}>
              Advanced Filters
            </Typography>
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent>
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 1 }}>
            {dateRangeFields.length > 0 && (
              <Box>
                <Button
                  onClick={() => toggleSection('dateRanges')}
                  endIcon={expandedSections.dateRanges ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  sx={{ mb: 1, textTransform: 'none', fontWeight: 600 }}
                >
                  Date Ranges
                </Button>
                <Collapse in={expandedSections.dateRanges}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pl: 2 }}>
                    {dateRanges.map((range, index) => (
                      <Box key={range.field} sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                        <Typography variant="subtitle2" fontWeight={600}>
                          {range.label}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                          <DatePicker
                            label="Start Date"
                            value={range.startDate}
                            onChange={(date) => updateDateRange(index, 'startDate', date)}
                            slotProps={{
                              textField: {
                                size: 'small',
                                fullWidth: true,
                                sx: { minWidth: 200 },
                              },
                            }}
                          />
                          <DatePicker
                            label="End Date"
                            value={range.endDate}
                            onChange={(date) => updateDateRange(index, 'endDate', date)}
                            slotProps={{
                              textField: {
                                size: 'small',
                                fullWidth: true,
                                sx: { minWidth: 200 },
                              },
                            }}
                          />
                        </Box>
                        {(range.startDate || range.endDate) && (
                          <Chip
                            icon={<ClearIcon />}
                            label="Clear"
                            onClick={() => updateDateRange(index, 'startDate', null)}
                            onDelete={() => {
                              updateDateRange(index, 'startDate', null);
                              updateDateRange(index, 'endDate', null);
                            }}
                            size="small"
                            variant="outlined"
                          />
                        )}
                      </Box>
                    ))}
                  </Box>
                </Collapse>
              </Box>
            )}

            {amountRangeFields.length > 0 && (
              <>
                {dateRangeFields.length > 0 && <Divider />}
                <Box>
                  <Button
                    onClick={() => toggleSection('amountRanges')}
                    endIcon={expandedSections.amountRanges ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    sx={{ mb: 1, textTransform: 'none', fontWeight: 600 }}
                  >
                    Amount Ranges
                  </Button>
                  <Collapse in={expandedSections.amountRanges}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pl: 2 }}>
                      {amountRanges.map((range, index) => (
                        <Box key={range.field} sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                          <Typography variant="subtitle2" fontWeight={600}>
                            {range.label}
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                            <TextField
                              label="Min"
                              type="number"
                              value={range.min ?? ''}
                              onChange={(e) => updateAmountRange(index, 'min', e.target.value ? parseFloat(e.target.value) : null)}
                              size="small"
                              sx={{ minWidth: 150 }}
                              InputProps={{
                                inputProps: { min: 0, step: 0.01 },
                              }}
                            />
                            <TextField
                              label="Max"
                              type="number"
                              value={range.max ?? ''}
                              onChange={(e) => updateAmountRange(index, 'max', e.target.value ? parseFloat(e.target.value) : null)}
                              size="small"
                              sx={{ minWidth: 150 }}
                              InputProps={{
                                inputProps: { min: 0, step: 0.01 },
                              }}
                            />
                          </Box>
                          {(range.min !== null || range.max !== null) && (
                            <Chip
                              icon={<ClearIcon />}
                              label="Clear"
                              onClick={() => {
                                updateAmountRange(index, 'min', null);
                                updateAmountRange(index, 'max', null);
                              }}
                              onDelete={() => {
                                updateAmountRange(index, 'min', null);
                                updateAmountRange(index, 'max', null);
                              }}
                              size="small"
                              variant="outlined"
                            />
                          )}
                        </Box>
                      ))}
                    </Box>
                  </Collapse>
                </Box>
              </>
            )}
          </Box>
        </LocalizationProvider>
      </DialogContent>
      <DialogActions sx={{ p: 2, pt: 1 }}>
        <Button onClick={handleClear} disabled={!hasActiveFilters()}>
          Clear All
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleApply} variant="contained" disabled={!hasActiveFilters()}>
          Apply Filters
        </Button>
      </DialogActions>
    </Dialog>
  );
};
