import { Box, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, CircularProgress, Typography, Chip } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useTopClients } from '../../hooks/useAnalytics';
import { useInvoices } from '../../hooks/useInvoices';
import { useInventory } from '../../hooks/useInventory';
import { formatCurrency } from '../../utils/formatters';
import PersonIcon from '@mui/icons-material/Person';
import { useMemo } from 'react';

const TopClientsTable = () => {
  const navigate = useNavigate();
  const { data, isLoading } = useTopClients();
  const { data: invoices } = useInvoices();
  const { data: inventoryItems } = useInventory();

  // Calculate actual revenue (profit) for each client
  const clientsWithProfit = useMemo(() => {
    if (!data) return [];
    if (!invoices || !inventoryItems) return data;

    // Create a map of inventory item ID to cost price for quick lookup
    const costPriceMap = new Map<string, number>();
    if (Array.isArray(inventoryItems)) {
      inventoryItems.forEach((item) => {
        if (item.id && item.costPrice !== undefined && item.costPrice !== null) {
          costPriceMap.set(item.id, item.costPrice);
        }
      });
    }

    // Helper function to calculate actual revenue (profit) for an invoice
    const calculateInvoiceProfit = (invoice: any): number => {
      if (!invoice.items || !Array.isArray(invoice.items)) {
        return 0;
      }

      let profit = 0;
      invoice.items.forEach((item: any) => {
        const quantity = Number(item.quantity) || 0;
        const unitPrice = Number(item.unitPrice) || 0;
        const sellingPrice = quantity * unitPrice;

        if (item.inventoryItemId && costPriceMap.has(item.inventoryItemId)) {
          const costPrice = costPriceMap.get(item.inventoryItemId)!;
          const cost = quantity * costPrice;
          profit += sellingPrice - cost;
        } else {
          // If no inventory item linked, assume 0 cost (service/item without cost tracking)
          profit += sellingPrice;
        }
      });

      return Math.round(profit * 100) / 100;
    };

    // Calculate profit for each client
    return data.map((client) => {
      // Find all invoices for this client
      const clientInvoices = Array.isArray(invoices)
        ? invoices.filter((inv: any) => inv.clientId === client.clientId)
        : [];

      // Calculate total profit for this client
      let totalProfit = 0;
      clientInvoices.forEach((invoice: any) => {
        totalProfit += calculateInvoiceProfit(invoice);
      });

      return {
        ...client,
        totalRevenue: Math.round(totalProfit * 100) / 100, // Use profit instead of total sales
      };
    });
  }, [data, invoices, inventoryItems]);

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <PersonIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1, opacity: 0.5 }} />
        <Typography variant="body2" color="text.secondary">
          No client data available
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          Create invoices to see top clients
        </Typography>
      </Box>
    );
  }

  return (
    <TableContainer>
      <Table size="small" sx={{ '& .MuiTableCell-root': { py: 1.5 } }}>
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 600, pb: 1.5 }}>Client</TableCell>
            <TableCell align="right" sx={{ fontWeight: 600, pb: 1.5 }}>Invoices</TableCell>
            <TableCell align="right" sx={{ fontWeight: 600, pb: 1.5 }}>Revenue</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {clientsWithProfit.map((client, index) => (
            <TableRow
              key={client.clientId}
              hover
              sx={{
                cursor: 'pointer',
                '&:hover': {
                  bgcolor: 'action.hover',
                },
              }}
              onClick={() => navigate(`/clients/${client.clientId}`)}
            >
              <TableCell sx={{ py: 1.5 }}>
                <Box display="flex" alignItems="center" gap={1}>
                  <Box
                    sx={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      bgcolor: 'primary.main',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.875rem',
                      fontWeight: 'bold',
                    }}
                  >
                    {index + 1}
                  </Box>
                  <Typography variant="body2" fontWeight="medium">
                    {client.clientName || 'Unknown Client'}
                  </Typography>
                </Box>
              </TableCell>
              <TableCell align="right" sx={{ py: 1.5 }}>
                <Chip
                  label={client.invoiceCount}
                  size="small"
                  color="primary"
                  variant="outlined"
                />
              </TableCell>
              <TableCell align="right" sx={{ py: 1.5 }}>
                <Typography 
                  variant="body2" 
                  fontWeight="bold" 
                  color="primary"
                  sx={{
                    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
                    letterSpacing: '-0.01em',
                  }}
                >
                  {formatCurrency(client.totalRevenue)}
                </Typography>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default TopClientsTable;

