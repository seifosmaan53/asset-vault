import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Skeleton
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PrintIcon from '@mui/icons-material/Print';
import { useStoreStockReport } from '../../hooks/useStoreItemSettings';
import { useStore } from '../../hooks/useStore';

/** One row of the store stock report.
 *
 *  The inline annotation this replaces named only `item.name`, `currentStock` and
 *  `minQty`, while the table also renders bundle size, bundle unit, target quantity and
 *  weekly usage — four reads the compiler had no basis to allow. */
interface StoreStockReportRow {
  item?: {
    name?: string;
    bundleSize?: number;
    bundleUnit?: string;
  };
  currentStock: number;
  minQty: number;
  targetQty?: number;
  weeklyUsage?: number;
}

const StoreStockReport = () => {
  const { id: storeId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: store } = useStore(storeId || '');
  const { data: report, isLoading } = useStoreStockReport(storeId || '');

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <Box>
        <Skeleton variant="text" width={300} height={40} sx={{ mb: 3 }} />
        <Skeleton variant="rectangular" width="100%" height={400} />
      </Box>
    );
  }

  if (!report) {
    return (
      <Box>
        <Typography variant="h4">Report not available</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box display="flex" alignItems="center" gap={2}>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate(`/stores/${storeId}`)}
          >
            Back
          </Button>
          <Typography variant="h4" component="h1">
            Stock Report - {store?.name}
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<PrintIcon />}
          onClick={handlePrint}
        >
          Print
        </Button>
      </Box>

      <Paper sx={{ p: 3 }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Item</TableCell>
                <TableCell>Bundle Size</TableCell>
                <TableCell>Current Stock</TableCell>
                <TableCell>Min Qty</TableCell>
                <TableCell>Target Qty</TableCell>
                <TableCell>Weekly Usage</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {report.items && report.items.length > 0 ? (
                report.items.map((item: StoreStockReportRow, index: number) => (
                  <TableRow key={index}>
                    <TableCell>{item.item?.name || '-'}</TableCell>
                    <TableCell>
                      {item.item?.bundleSize ? `${item.item.bundleSize} ${item.item.bundleUnit || ''}` : '-'}
                    </TableCell>
                    <TableCell>{item.currentStock}</TableCell>
                    <TableCell>{item.minQty}</TableCell>
                    <TableCell>{item.targetQty || '-'}</TableCell>
                    <TableCell>{item.weeklyUsage || '-'}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  {/* Six columns, not eight — the count was left behind when the Size and
                      Material columns were removed, so the empty-state cell was spanning
                      two columns that no longer exist. */}
                  <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">
                      No items found for this store.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
};

export default StoreStockReport;

