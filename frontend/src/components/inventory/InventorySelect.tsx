import { useState, useEffect } from 'react';
import {
  Autocomplete,
  TextField,
  Box,
  Typography,
  CircularProgress,
  Tooltip,
} from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';
import { useInventory } from '../../hooks/useInventory';
import { InventoryItem } from '../../types/inventory';
import { formatCurrency } from '../../utils/formatters';

interface InventorySelectProps {
  value: InventoryItem | null;
  onChange: (item: InventoryItem | null) => void;
  disabled?: boolean;
}

const InventorySelect = ({ value, onChange, disabled }: InventorySelectProps) => {
  const [search, setSearch] = useState('');
  const { data: items, isLoading } = useInventory({
    search,
    status: 'active',
  });

  const availableStock = (item: InventoryItem) => {
    return item.currentStock - item.reservedStock;
  };

  return (
    <Box>
      <Box display="flex" alignItems="center" gap={1} mb={1}>
        <Autocomplete
          options={items || []}
          value={value}
          onChange={(_, newValue) => onChange(newValue)}
          onInputChange={(_, newInputValue) => setSearch(newInputValue)}
          getOptionLabel={(option) => `${option.name} (${option.sku})`}
          loading={isLoading}
          disabled={disabled}
          sx={{ flex: 1 }}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Select Product"
              placeholder="Search by name or SKU..."
            />
          )}
          renderOption={(props, option) => (
            <Box component="li" {...props} key={option.id}>
              <Box>
                <Typography variant="body1">{option.name}</Typography>
                <Typography variant="caption" color="text.secondary">
                  SKU: {option.sku} | Price: {formatCurrency(option.defaultUnitPrice)} | Stock: {availableStock(option)}
                </Typography>
              </Box>
            </Box>
          )}
          loadingText={<CircularProgress size={20} />}
          noOptionsText="No products found"
        />
        <Tooltip title="Stock levels are automatically tracked when you create invoices. Selecting an item here will link it to the invoice and update stock accordingly.">
          <InfoIcon color="action" fontSize="small" />
        </Tooltip>
      </Box>
    </Box>
  );
};

export default InventorySelect;

