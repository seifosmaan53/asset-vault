import { useState } from 'react';
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
import { useQueryClient } from '@tanstack/react-query';
import type { InventoryItem } from '../../types/inventory';
import { formatCurrency } from '../../utils/formatters';

interface InventorySelectProps {
  value: InventoryItem | null;
  onChange: (item: InventoryItem | null) => void;
  disabled?: boolean;
  storeId?: string;
  storeStocks?: Map<string, number>;
}

const InventorySelect = ({ value, onChange, disabled, storeId, storeStocks }: InventorySelectProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const queryClient = useQueryClient();
  const { data: items, isLoading, refetch } = useInventory({
    search: searchQuery,
    status: 'active',
  });
  
  /* Keep the selected value's reference stable: Autocomplete must not see a "new" value
     on every parent render (that used to loop). The first object resolved for an id
     (preferably the matching option) is held until the selected id changes. This is
     state adjusted during render, React's pattern for deriving from a changing prop. */
  const resolveValue = (): InventoryItem | null =>
    value ? (items?.find((item) => item.id === value.id) ?? value) : null;
  const [stableValue, setStableValue] = useState<InventoryItem | null>(resolveValue);
  if ((value?.id ?? null) !== (stableValue?.id ?? null)) {
    setStableValue(resolveValue());
  }

  const availableStock = (item: InventoryItem) => {
    return Math.max(0, item.currentStock || 0);
  };

  const getStoreStock = (itemId: string | undefined): number | null => {
    if (!storeId || !storeStocks || !itemId) return null;
    const stock = storeStocks.get(itemId);
    return stock !== undefined ? stock : null;
  };

  return (
    <Box sx={{ 
      display: 'flex', 
      alignItems: 'center', 
      width: '100%',
      gap: 1,
    }}>
      <Autocomplete
        options={items || []}
        value={stableValue}
        isOptionEqualToValue={(option, value) => {
          if (!option || !value) return option === value;
          return option.id === value.id;
        }}
        onChange={(_, newValue) => {
          onChange(newValue);
        }}
        onInputChange={() => {
          // CRITICAL FIX: Only update searchQuery when user types and presses Enter
          // Don't control inputValue to prevent infinite loops
          // The Autocomplete will manage inputValue internally based on the selected value
        }}
        onOpen={() => {
          // Refetch inventory data when dropdown opens to ensure fresh stock numbers
          refetch();
          // Also invalidate to force fresh data
          queryClient.invalidateQueries({ queryKey: ['inventory'], exact: false });
        }}
        getOptionLabel={(option) => `${option.name} (${option.sku})`}
        loading={isLoading}
        disabled={disabled}
        fullWidth
        sx={{ 
          flex: 1,
          minWidth: 0,
          '& .MuiOutlinedInput-root': {
            borderRadius: 2,
          },
        }}
        slotProps={{
          popper: {
            placement: 'bottom-start',
            modifiers: [
              {
                name: 'offset',
                options: {
                  offset: [0, 4],
                },
              },
            ],
          }
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            label="Select Product"
            placeholder="Search by name or SKU... (Press Enter to search)"
            variant="outlined"
            fullWidth
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                // Get the current input value from the event target
                const inputElement = e.target as HTMLInputElement;
                const currentInput = inputElement.value || '';
                setSearchQuery(currentInput);
              }
            }}
          />
        )}
        renderOption={(props, option) => {
          const globalStock = availableStock(option);
          const storeStock = getStoreStock(option.id);
          return (
            <Box component="li" {...props} key={option.id}>
              <Box>
                <Typography variant="body1">{option.name}</Typography>
                <Typography variant="caption" color="text.secondary">
                  SKU: {option.sku} | Price: {formatCurrency(option.defaultUnitPrice)}
                  {storeId && storeStock !== null ? (
                    <> | Global: {globalStock} | Store: {storeStock}</>
                  ) : (
                    <> | Stock: {globalStock}</>
                  )}
                </Typography>
              </Box>
            </Box>
          );
        }}
        loadingText={<CircularProgress size={20} />}
        noOptionsText="No products found"
      />
      <Tooltip title="Stock levels are automatically tracked when you create invoices. Selecting an item here will link it to the invoice and update stock accordingly.">
        <InfoIcon 
          aria-label="Inventory stock information"
          role="img"
          color="action" 
          fontSize="small" 
          sx={{ 
            flexShrink: 0,
            cursor: 'help',
            alignSelf: 'flex-start',
            mt: 1.5,
          }} 
        />
      </Tooltip>
    </Box>
  );
};

export default InventorySelect;

