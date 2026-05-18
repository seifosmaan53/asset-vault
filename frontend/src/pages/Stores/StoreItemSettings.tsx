import { useState } from 'react';
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
  TextField,
  IconButton,
  CircularProgress,
  Skeleton,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useStoreItemSettingsByStore, useCreateOrUpdateStoreItemSettings } from '../../hooks/useStoreItemSettings';
import { useStore } from '../../hooks/useStore';
import { useInventory } from '../../hooks/useInventory';
import { useToast } from '../../contexts/ToastContext';
import { getErrorMessage } from '../../utils/errorHandling';

const StoreItemSettings = () => {
  const { id: storeId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: store } = useStore(storeId || '');
  const { data: settings, isLoading: settingsLoading } = useStoreItemSettingsByStore(storeId || '');
  const { data: items } = useInventory();
  const updateSettings = useCreateOrUpdateStoreItemSettings();
  const { showToast } = useToast();

  const [editedSettings, setEditedSettings] = useState<Record<string, {
    currentStock: number;
    minQty: number;
    targetQty?: number;
    weeklyUsage?: number;
  }>>({});

  const handleFieldChange = (itemId: string, field: string, value: number | undefined) => {
    setEditedSettings((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [field]: value,
      },
    }));
  };

  const handleSave = async (itemId: string) => {
    const edited = editedSettings[itemId];
    if (!edited) return;

    try {
      await updateSettings.mutateAsync({
        storeId: storeId!,
        inventoryItemId: itemId,
        ...edited,
      });
      showToast('Settings saved successfully', 'success');
      setEditedSettings((prev) => {
        const newState = { ...prev };
        delete newState[itemId];
        return newState;
      });
    } catch (error: unknown) {
      showToast(getErrorMessage(error, 'Failed to save settings'), 'error');
    }
  };

  if (settingsLoading) {
    return (
      <Box>
        <Skeleton variant="text" width={300} height={40} sx={{ mb: 3 }} />
        <Skeleton variant="rectangular" width="100%" height={400} />
      </Box>
    );
  }

  const settingsMap = new Map(settings?.map((s) => [s.inventoryItemId, s]) || []);

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
            Store Item Settings - {store?.name}
          </Typography>
        </Box>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Item</TableCell>
              <TableCell>Current Stock</TableCell>
              <TableCell>Min Qty</TableCell>
              <TableCell>Target Qty</TableCell>
              <TableCell>Weekly Usage</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items && items.length > 0 ? (
              items.map((item) => {
                const setting = settingsMap.get(item.id);
                const edited = editedSettings[item.id];
                const currentValues = edited || setting || {
                  currentStock: 0,
                  minQty: 0,
                  targetQty: undefined,
                  weeklyUsage: undefined,
                };

                return (
                  <TableRow key={item.id}>
                    <TableCell>{item.name}</TableCell>
                    <TableCell>
                      <TextField
                        type="number"
                        size="small"
                        value={currentValues.currentStock}
                        onChange={(e) => {
                          const val = e.target.value.trim();
                          const numVal = val === '' ? 0 : parseInt(val, 10);
                          const finalVal = Number.isFinite(numVal) && numVal >= 0 ? numVal : 0;
                          handleFieldChange(item.id, 'currentStock', finalVal);
                        }}
                        inputProps={{ min: 0 }}
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        type="number"
                        size="small"
                        value={currentValues.minQty}
                        onChange={(e) => {
                          const val = e.target.value.trim();
                          const numVal = val === '' ? 0 : parseInt(val, 10);
                          const finalVal = Number.isFinite(numVal) && numVal >= 0 ? numVal : 0;
                          handleFieldChange(item.id, 'minQty', finalVal);
                        }}
                        inputProps={{ min: 0 }}
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        type="number"
                        size="small"
                        value={currentValues.targetQty || ''}
                        onChange={(e) => {
                          const val = e.target.value.trim();
                          if (val === '') {
                            handleFieldChange(item.id, 'targetQty', undefined);
                          } else {
                            const numVal = parseInt(val, 10);
                            const finalVal = Number.isFinite(numVal) && numVal >= 0 ? numVal : undefined;
                            handleFieldChange(item.id, 'targetQty', finalVal);
                          }
                        }}
                        inputProps={{ min: 0 }}
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        type="number"
                        size="small"
                        inputProps={{ step: '0.01', min: 0 }}
                        value={currentValues.weeklyUsage || ''}
                        onChange={(e) => {
                          const val = e.target.value.trim();
                          if (val === '') {
                            handleFieldChange(item.id, 'weeklyUsage', undefined);
                          } else {
                            const numVal = parseFloat(val);
                            const finalVal = Number.isFinite(numVal) && numVal >= 0 ? numVal : undefined;
                            handleFieldChange(item.id, 'weeklyUsage', finalVal);
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      {edited && (
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => handleSave(item.id)}
                          disabled={updateSettings.isPending}
                        >
                          {updateSettings.isPending ? (
                            <CircularProgress size={16} />
                          ) : (
                            <SaveIcon fontSize="small" />
                          )}
                        </IconButton>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">
                    No inventory items found. Create items first.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default StoreItemSettings;

