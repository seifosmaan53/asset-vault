import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  TextField,
  IconButton,
  CircularProgress,
  Chip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { useInventory, useDeleteInventoryItem } from '../../hooks/useInventory';
import { formatCurrency } from '../../utils/formatters';
import { useToast } from '../../contexts/ToastContext';

const InventoryList = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const { data: items, isLoading } = useInventory({
    search,
    status: statusFilter !== 'all' ? statusFilter : undefined,
    lowStockOnly,
  });
  const deleteItem = useDeleteInventoryItem();
  const { showToast } = useToast();

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this item?')) {
      try {
        await deleteItem.mutateAsync(id);
        showToast('Inventory item deleted successfully', 'success');
      } catch (error: any) {
        showToast(error.response?.data?.message || 'Failed to delete item', 'error');
      }
    }
  };

  const getStockStatus = (item: any) => {
    if (item.currentStock <= 0) {
      return <Chip label="Out of Stock" color="error" size="small" />;
    }
    if (item.currentStock <= item.reorderLevel) {
      return <Chip label="Low Stock" color="warning" size="small" />;
    }
    return <Chip label="In Stock" color="success" size="small" />;
  };

  if (isLoading) {
    return (
      <Box>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Skeleton variant="text" width={200} height={40} />
          <Skeleton variant="rectangular" width={150} height={40} />
        </Box>
        <Skeleton variant="rectangular" width="100%" height={56} sx={{ mb: 2 }} />
        <Paper>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell><Skeleton /></TableCell>
                  <TableCell><Skeleton /></TableCell>
                  <TableCell><Skeleton /></TableCell>
                  <TableCell><Skeleton /></TableCell>
                  <TableCell><Skeleton /></TableCell>
                  <TableCell align="right"><Skeleton /></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {[1, 2, 3, 4, 5].map((i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton /></TableCell>
                    <TableCell><Skeleton /></TableCell>
                    <TableCell><Skeleton /></TableCell>
                    <TableCell><Skeleton /></TableCell>
                    <TableCell><Skeleton width={60} /></TableCell>
                    <TableCell align="right"><Skeleton width={100} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Inventory
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/inventory/create')}
        >
          Add Item
        </Button>
      </Box>

      <Box display="flex" gap={2} mb={2}>
        <TextField
          placeholder="Search by name, SKU, or barcode..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ flexGrow: 1 }}
        />
        <FormControl sx={{ minWidth: 150 }}>
          <InputLabel>Status</InputLabel>
          <Select
            value={statusFilter}
            label="Status"
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <MenuItem value="all">All</MenuItem>
            <MenuItem value="active">Active</MenuItem>
            <MenuItem value="inactive">Inactive</MenuItem>
          </Select>
        </FormControl>
        <Button
          variant={lowStockOnly ? 'contained' : 'outlined'}
          onClick={() => setLowStockOnly(!lowStockOnly)}
        >
          Low Stock Only
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>SKU</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Category</TableCell>
              <TableCell>On Hand</TableCell>
              <TableCell>Reserved</TableCell>
              <TableCell>Available</TableCell>
              <TableCell>Reorder Level</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items && items.length > 0 ? (
              items.map((item) => (
                <TableRow key={item.id} hover>
                  <TableCell>{item.sku}</TableCell>
                  <TableCell>{item.name}</TableCell>
                  <TableCell>{item.category || '-'}</TableCell>
                  <TableCell>{item.currentStock}</TableCell>
                  <TableCell>{item.reservedStock}</TableCell>
                  <TableCell>{item.currentStock - item.reservedStock}</TableCell>
                  <TableCell>{item.reorderLevel}</TableCell>
                  <TableCell>
                    {getStockStatus(item)}
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={() => navigate(`/inventory/${item.id}`)}
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleDelete(item.id)}
                      color="error"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={9} align="center" sx={{ py: 8 }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <Typography variant="h6" color="text.secondary">
                      No inventory items yet
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Get started by adding your first product
                    </Typography>
                    <Button
                      variant="contained"
                      startIcon={<AddIcon />}
                      onClick={() => navigate('/inventory/create')}
                    >
                      Add Product
                    </Button>
                  </Box>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default InventoryList;

