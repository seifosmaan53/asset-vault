import { useState } from 'react';
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
  IconButton,
  CircularProgress,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Checkbox,
  FormControlLabel,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiKeysApi, CreateApiKeyDto } from '../../api/apiKeys';
import { formatDate } from '../../utils/dates';
import { useToast } from '../../contexts/ToastContext';

const ApiKeysList = () => {
  const [open, setOpen] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const queryClient = useQueryClient();

  const { showToast } = useToast();

  const { data: keys, isLoading } = useQuery({
    queryKey: ['api-keys'],
    queryFn: apiKeysApi.getAll,
  });

  const createKey = useMutation({
    mutationFn: (data: CreateApiKeyDto) => apiKeysApi.create(data),
    onSuccess: (data) => {
      setNewKey(data.key || null);
      setShowKey(true);
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      showToast('API key created successfully', 'success');
    },
    onError: (error: any) => {
      showToast(error.response?.data?.message || 'Failed to create API key', 'error');
    },
  });

  const deleteKey = useMutation({
    mutationFn: (id: string) => apiKeysApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      showToast('API key deleted successfully', 'success');
    },
    onError: (error: any) => {
      showToast(error.response?.data?.message || 'Failed to delete API key', 'error');
    },
  });

  const handleCreate = async (name: string, permissions: string[]) => {
    try {
      await createKey.mutateAsync({ name, permissions });
    } catch (error) {
      // Error handled in mutation
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this API key?')) {
      try {
        await deleteKey.mutateAsync(id);
      } catch (error) {
        // Error handled in mutation
      }
    }
  };

  const handleCopyKey = () => {
    if (newKey) {
      navigator.clipboard.writeText(newKey);
      showToast('API key copied to clipboard', 'success');
    }
  };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          API Keys
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setOpen(true)}
        >
          Create API Key
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Permissions</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Expires</TableCell>
              <TableCell>Last Used</TableCell>
              <TableCell>Created</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {keys && keys.length > 0 ? (
              keys.map((key) => (
                <TableRow key={key.id} hover>
                  <TableCell>{key.name}</TableCell>
                  <TableCell>
                    {key.permissions.map((perm) => (
                      <Chip key={perm} label={perm} size="small" sx={{ mr: 0.5 }} />
                    ))}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={key.isActive ? 'Active' : 'Inactive'}
                      color={key.isActive ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {key.expiresAt ? formatDate(key.expiresAt) : 'Never'}
                  </TableCell>
                  <TableCell>
                    {key.lastUsedAt ? formatDate(key.lastUsedAt) : 'Never'}
                  </TableCell>
                  <TableCell>{formatDate(key.createdAt)}</TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={() => handleDelete(key.id)}
                      color="error"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  No API keys found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <CreateApiKeyDialog
        open={open}
        onClose={() => {
          setOpen(false);
          setNewKey(null);
          setShowKey(false);
        }}
        onCreate={handleCreate}
        newKey={newKey}
        showKey={showKey}
        onCopy={handleCopyKey}
      />
    </Box>
  );
};

interface CreateApiKeyDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string, permissions: string[]) => void;
  newKey: string | null;
  showKey: boolean;
  onCopy: () => void;
}

const CreateApiKeyDialog = ({
  open,
  onClose,
  onCreate,
  newKey,
  showKey,
  onCopy,
}: CreateApiKeyDialogProps) => {
  const [name, setName] = useState('');
  const [permissions, setPermissions] = useState<string[]>(['read', 'write']);

  const handleSubmit = () => {
    onCreate(name, permissions);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Create API Key</DialogTitle>
      <DialogContent>
        {showKey && newKey ? (
          <Box>
            <Typography variant="body2" color="warning.main" gutterBottom>
              Save this key now! You won't be able to see it again.
            </Typography>
            <TextField
              fullWidth
              value={newKey}
              InputProps={{
                readOnly: true,
                endAdornment: (
                  <IconButton onClick={onCopy}>
                    <ContentCopyIcon />
                  </IconButton>
                ),
              }}
              sx={{ mt: 2 }}
            />
          </Box>
        ) : (
          <Box>
            <TextField
              fullWidth
              label="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              sx={{ mb: 2 }}
            />
            <Typography variant="body2" gutterBottom>
              Permissions:
            </Typography>
            {['read', 'write', 'delete'].map((perm) => (
              <FormControlLabel
                key={perm}
                control={
                  <Checkbox
                    checked={permissions.includes(perm)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setPermissions([...permissions, perm]);
                      } else {
                        setPermissions(permissions.filter((p) => p !== perm));
                      }
                    }}
                  />
                }
                label={perm}
              />
            ))}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{showKey ? 'Close' : 'Cancel'}</Button>
        {!showKey && (
          <Button onClick={handleSubmit} variant="contained" disabled={!name}>
            Create
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default ApiKeysList;

