import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  IconButton,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import InventoryIcon from '@mui/icons-material/Inventory';
import { useInventoryItem, useStockMovements, useLinkedInvoices } from '../../hooks/useInventory';
import { formatCurrency } from '../../utils/formatters';
import { formatDate } from '../../utils/dates';
import StockAdjustmentModal from '../../components/inventory/StockAdjustmentModal';
import { useState } from 'react';
import ReceiptIcon from '@mui/icons-material/Receipt';

const InventoryDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: item, isLoading } = useInventoryItem(id || '');
  const { data: movements, isLoading: movementsLoading } = useStockMovements(id || '');
  const { data: linkedInvoices, isLoading: invoicesLoading } = useLinkedInvoices(id || '');
  const [adjustmentModalOpen, setAdjustmentModalOpen] = useState(false);

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (!item) {
    return <Typography>Item not found</Typography>;
  }

  const availableStock = item.currentStock - item.reservedStock;

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          {item.name}
        </Typography>
        <Box display="flex" gap={2}>
          <Button
            variant="outlined"
            startIcon={<InventoryIcon />}
            onClick={() => setAdjustmentModalOpen(true)}
          >
            Adjust Stock
          </Button>
          <Button
            variant="contained"
            startIcon={<EditIcon />}
            onClick={() => navigate(`/inventory/${id}/edit`)}
          >
            Edit
          </Button>
        </Box>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Summary
            </Typography>
            <Box mt={2}>
              <Typography variant="body2" color="text.secondary">
                SKU
              </Typography>
              <Typography variant="body1" fontWeight="bold">
                {item.sku}
              </Typography>
            </Box>
            <Box mt={2}>
              <Typography variant="body2" color="text.secondary">
                Status
              </Typography>
              <Chip
                label={item.status}
                color={item.status === 'active' ? 'success' : 'default'}
                size="small"
              />
            </Box>
            {item.description && (
              <Box mt={2}>
                <Typography variant="body2" color="text.secondary">
                  Description
                </Typography>
                <Typography variant="body1">{item.description}</Typography>
              </Box>
            )}
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Stock Levels
            </Typography>
            <Box mt={2}>
              <Typography variant="body2" color="text.secondary">
                On Hand
              </Typography>
              <Typography variant="h5">{item.currentStock}</Typography>
            </Box>
            <Box mt={2}>
              <Typography variant="body2" color="text.secondary">
                Reserved
              </Typography>
              <Typography variant="h5">{item.reservedStock}</Typography>
            </Box>
            <Box mt={2}>
              <Typography variant="body2" color="text.secondary">
                Available
              </Typography>
              <Typography variant="h5" color={availableStock <= item.reorderLevel ? 'error' : 'inherit'}>
                {availableStock}
              </Typography>
            </Box>
            <Box mt={2}>
              <Typography variant="body2" color="text.secondary">
                Reorder Level
              </Typography>
              <Typography variant="h5">{item.reorderLevel}</Typography>
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Pricing
            </Typography>
            <Box mt={2}>
              <Typography variant="body2" color="text.secondary">
                Default Unit Price
              </Typography>
              <Typography variant="h5">{formatCurrency(item.defaultUnitPrice)}</Typography>
            </Box>
            {item.costPrice && (
              <Box mt={2}>
                <Typography variant="body2" color="text.secondary">
                  Cost Price
                </Typography>
                <Typography variant="h5">{formatCurrency(item.costPrice)}</Typography>
              </Box>
            )}
            {item.defaultTaxRate && (
              <Box mt={2}>
                <Typography variant="body2" color="text.secondary">
                  Default Tax Rate
                </Typography>
                <Typography variant="h5">{item.defaultTaxRate}%</Typography>
              </Box>
            )}
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Linked Invoices
            </Typography>
            {invoicesLoading ? (
              <CircularProgress />
            ) : linkedInvoices && linkedInvoices.length > 0 ? (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Invoice Number</TableCell>
                      <TableCell>Client</TableCell>
                      <TableCell>Date</TableCell>
                      <TableCell>Total</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {linkedInvoices.map((invoice: any) => (
                      <TableRow key={invoice.id} hover>
                        <TableCell>{invoice.number}</TableCell>
                        <TableCell>{invoice.client?.name || '-'}</TableCell>
                        <TableCell>{formatDate(invoice.issueDate)}</TableCell>
                        <TableCell>{formatCurrency(invoice.total, invoice.currency)}</TableCell>
                        <TableCell align="right">
                          <IconButton
                            size="small"
                            onClick={() => navigate(`/invoices/${invoice.id}`)}
                          >
                            <ReceiptIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No invoices linked to this item
              </Typography>
            )}
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Stock Movement History
            </Typography>
            {movementsLoading ? (
              <CircularProgress />
            ) : (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>Quantity</TableCell>
                      <TableCell>Source</TableCell>
                      <TableCell>Note</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {movements && movements.length > 0 ? (
                      movements.map((movement) => (
                        <TableRow key={movement.id}>
                          <TableCell>{formatDate(movement.createdAt)}</TableCell>
                          <TableCell>
                            <Chip label={movement.type} size="small" />
                          </TableCell>
                          <TableCell>{movement.quantity > 0 ? '+' : ''}{movement.quantity}</TableCell>
                          <TableCell>{movement.sourceType}</TableCell>
                          <TableCell>{movement.note || '-'}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} align="center">
                          No movements found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
        </Grid>
      </Grid>

      <StockAdjustmentModal
        open={adjustmentModalOpen}
        onClose={() => setAdjustmentModalOpen(false)}
        inventoryItemId={id || ''}
      />
    </Box>
  );
};

export default InventoryDetail;

