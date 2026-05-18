import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Alert,
  Checkbox,
  FormControlLabel,
} from '@mui/material';
import PreviewIcon from '@mui/icons-material/Preview';
import CloseIcon from '@mui/icons-material/Close';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import type { ImportResult } from '../../utils/import';

interface ImportPreviewProps<T> {
  open: boolean;
  onClose: () => void;
  onConfirm: (data: T[]) => void;
  result: ImportResult<T>;
  isLoading?: boolean;
}

export const ImportPreview = <T extends Record<string, any>>({
  open,
  onClose,
  onConfirm,
  result,
  isLoading = false,
}: ImportPreviewProps<T>) => {
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [selectOnlyValid, setSelectOnlyValid] = useState(true);

  const validCount = result.valid.length;
  const invalidCount = result.invalid.length;
  const totalCount = validCount + invalidCount;

  // Auto-select valid rows
  useMemo(() => {
    if (selectOnlyValid && validCount > 0) {
      setSelectedRows(new Set(result.valid.map((_, index) => index)));
    } else {
      setSelectedRows(new Set());
    }
  }, [selectOnlyValid, validCount, result.valid]);

  const handleSelectAll = () => {
    if (selectedRows.size === validCount) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(result.valid.map((_, index) => index)));
    }
  };

  const handleSelectRow = (index: number) => {
    setSelectedRows(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleConfirm = () => {
    const selectedData = result.valid.filter((_, index) => selectedRows.has(index));
    onConfirm(selectedData);
  };

  const sampleColumns = useMemo(() => {
    if (result.valid.length > 0) {
      return Object.keys(result.valid[0]);
    }
    if (result.invalid.length > 0 && result.invalid[0].data) {
      return Object.keys(result.invalid[0].data);
    }
    return [];
  }, [result]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
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
            <PreviewIcon sx={{ color: 'primary.main' }} />
            <Typography variant="h6" fontWeight={600}>
              Import Preview
            </Typography>
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 1 }}>
          <Box display="flex" gap={2} flexWrap="wrap">
            <Chip
              icon={<CheckCircleIcon />}
              label={`${validCount} valid rows`}
              color="success"
              sx={{ fontWeight: 600 }}
            />
            {invalidCount > 0 && (
              <Chip
                icon={<ErrorIcon />}
                label={`${invalidCount} invalid rows`}
                color="error"
                sx={{ fontWeight: 600 }}
              />
            )}
            <Chip label={`${totalCount} total rows`} sx={{ fontWeight: 600 }} />
          </Box>

          {invalidCount > 0 && (
            <Alert severity="warning">
              {invalidCount} row(s) have validation errors and will be skipped. Review the errors below.
            </Alert>
          )}

          {validCount > 0 && (
            <Box>
              <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                <Typography variant="subtitle1" fontWeight={600}>
                  Valid Rows ({validCount})
                </Typography>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={selectOnlyValid}
                      onChange={(e) => setSelectOnlyValid(e.target.checked)}
                    />
                  }
                  label="Select only valid rows"
                />
              </Box>
              <TableContainer component={Paper} sx={{ maxHeight: 400, overflow: 'auto' }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell padding="checkbox">
                        <Checkbox
                          indeterminate={selectedRows.size > 0 && selectedRows.size < validCount}
                          checked={validCount > 0 && selectedRows.size === validCount}
                          onChange={handleSelectAll}
                        />
                      </TableCell>
                      {sampleColumns.map((col) => (
                        <TableCell key={col} sx={{ fontWeight: 600 }}>
                          {col}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {result.valid.map((row, index) => (
                      <TableRow key={index} hover>
                        <TableCell padding="checkbox">
                          <Checkbox
                            checked={selectedRows.has(index)}
                            onChange={() => handleSelectRow(index)}
                          />
                        </TableCell>
                        {sampleColumns.map((col) => (
                          <TableCell key={col}>
                            {row[col] !== undefined && row[col] !== null
                              ? String(row[col])
                              : '-'}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}

          {invalidCount > 0 && (
            <Box>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                Invalid Rows ({invalidCount})
              </Typography>
              <TableContainer component={Paper} sx={{ maxHeight: 300, overflow: 'auto' }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>Row</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Errors</TableCell>
                      {sampleColumns.map((col) => (
                        <TableCell key={col} sx={{ fontWeight: 600 }}>
                          {col}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {result.invalid.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>{item.row}</TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                            {item.errors.map((error, errIndex) => (
                              <Chip
                                key={errIndex}
                                label={error}
                                size="small"
                                color="error"
                                sx={{ fontSize: '0.7rem', height: 20 }}
                              />
                            ))}
                          </Box>
                        </TableCell>
                        {sampleColumns.map((col) => (
                          <TableCell key={col}>
                            {item.data[col] !== undefined && item.data[col] !== null
                              ? String(item.data[col])
                              : '-'}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2, pt: 1 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          disabled={selectedRows.size === 0 || isLoading}
          sx={{ borderRadius: 2 }}
        >
          Import {selectedRows.size} Row{selectedRows.size !== 1 ? 's' : ''}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
