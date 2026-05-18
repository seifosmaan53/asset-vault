import { Box, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, CircularProgress, Typography, Chip } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useTopItems } from '../../hooks/useAnalytics';
import { useInvoices } from '../../hooks/useInvoices';
import { useInventory } from '../../hooks/useInventory';
import { formatCurrency } from '../../utils/formatters';
import InventoryIcon from '@mui/icons-material/Inventory';
import { useMemo } from 'react';

const TopItemsTable = () => {
  const navigate = useNavigate();
  const { data, isLoading, error } = useTopItems();
  const { data: invoices } = useInvoices();
  const { data: inventoryItems } = useInventory();

  // Handle error or non-array data
  // Ensure data is an array before processing
  const itemsArray = Array.isArray(data) ? data : [];

  // Calculate actual revenue (profit) for each item
  // This hook must be called before any early returns
  const itemsWithProfit = useMemo(() => {
    if (!itemsArray || itemsArray.length === 0 || !invoices || !inventoryItems) return itemsArray;

    // Create cost price map
    const costPriceMap = new Map<string, number>();
    if (Array.isArray(inventoryItems)) {
      inventoryItems.forEach((item) => {
        if (item.id && item.costPrice !== undefined && item.costPrice !== null) {
          costPriceMap.set(item.id, item.costPrice);
        }
      });
    }

    // Calculate profit for each item
    return itemsArray.map((item) => {
      // Find all invoice items for this inventory item
      const itemInvoices = Array.isArray(invoices)
        ? invoices.filter((inv: any) => 
            inv.items && Array.isArray(inv.items) && 
            inv.items.some((invItem: any) => invItem.inventoryItemId === item.inventoryItemId)
          )
        : [];

      let totalProfit = 0;
      itemInvoices.forEach((invoice: any) => {
        if (invoice.items && Array.isArray(invoice.items)) {
          invoice.items.forEach((invItem: any) => {
            if (invItem.inventoryItemId === item.inventoryItemId) {
              const quantity = Number(invItem.quantity) || 0;
              const unitPrice = Number(invItem.unitPrice) || 0;
              const sellingPrice = quantity * unitPrice;

              if (costPriceMap.has(item.inventoryItemId)) {
                const costPrice = costPriceMap.get(item.inventoryItemId)!;
                const cost = quantity * costPrice;
                totalProfit += sellingPrice - cost;
              } else {
                totalProfit += sellingPrice;
              }
            }
          });
        }
      });

      return {
        ...item,
        totalRevenue: Math.round(totalProfit * 100) / 100, // Use profit instead of total sales
      };
    });
  }, [itemsArray, invoices, inventoryItems]);

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (error || !data || itemsArray.length === 0) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <InventoryIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1, opacity: 0.5 }} />
        <Typography variant="body2" color="text.secondary">
          No item data available
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          Create invoices with items to see top sellers
        </Typography>
      </Box>
    );
  }

  // Sort by revenue descending to match backend ordering
  const sortedData = [...itemsWithProfit].sort((a, b) => b.totalRevenue - a.totalRevenue);

  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 600, width: '40px' }}>#</TableCell>
            <TableCell sx={{ fontWeight: 600 }}>Item</TableCell>
            <TableCell sx={{ fontWeight: 600 }}>SKU</TableCell>
            <TableCell align="right" sx={{ fontWeight: 600 }}>Qty</TableCell>
            <TableCell align="right" sx={{ fontWeight: 600 }}>Revenue</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {sortedData.map((item, index) => (
            <TableRow
              key={item.inventoryItemId}
              hover
              sx={{
                cursor: 'pointer',
                '&:hover': {
                  bgcolor: 'action.hover',
                },
              }}
              onClick={() => navigate(`/inventory/${item.inventoryItemId}`)}
            >
              <TableCell>
                <Box
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    bgcolor: index === 0 ? 'success.main' : index === 1 ? 'info.main' : index === 2 ? 'warning.main' : 'primary.light',
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
              </TableCell>
              <TableCell>
                <Typography variant="body2" fontWeight="medium">
                  {item.itemName || 'Unknown Item'}
                </Typography>
              </TableCell>
              <TableCell>
                <Chip
                  label={item.sku || 'N/A'}
                  size="small"
                  variant="outlined"
                  sx={{ 
                    fontSize: '0.7rem',
                    fontFamily: 'monospace',
                  }}
                />
              </TableCell>
              <TableCell align="right">
                <Typography variant="body2" fontWeight="medium" color="text.secondary">
                  {Math.round(item.totalQuantity)}
                </Typography>
              </TableCell>
              <TableCell align="right">
                <Typography 
                  variant="body2" 
                  fontWeight="bold" 
                  color="success.main"
                  sx={{
                    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
                    letterSpacing: '-0.01em',
                  }}
                >
                  {formatCurrency(item.totalRevenue)}
                </Typography>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default TopItemsTable;

