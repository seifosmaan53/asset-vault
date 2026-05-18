import { useState, useMemo, useEffect } from 'react';
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
  Tooltip,
  Alert,
  InputAdornment,
  Skeleton,
  Divider,
  alpha,
  useTheme,
  Grid,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiKeysApi } from '../../api/apiKeys';
import type { CreateApiKeyDto } from '../../api/apiKeys';
import { formatDate } from '../../utils/dates';
import { useToast } from '../../contexts/ToastContext';
import ConfirmDialog from '../../components/common/ConfirmDialog';

const ApiKeysList = () => {
  const [open, setOpen] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [keyToDelete, setKeyToDelete] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const queryClient = useQueryClient();
  const theme = useTheme();

  const { showToast } = useToast();

  // Clear cache and invalidate queries on mount to ensure fresh data
  useEffect(() => {
    // Invalidate all API key-related queries to force fresh fetch
    queryClient.invalidateQueries({ queryKey: ['api-keys'], exact: false });
    // Also clear any old organization-scoped queries
    queryClient.removeQueries({ predicate: (query) => {
      const key = query.queryKey;
      if (Array.isArray(key)) {
        const keyStr = JSON.stringify(key);
        if (keyStr.includes('organization') || keyStr.includes('org')) {
          return true;
        }
      }
      return false;
    }});
  }, [queryClient]);

  const { data: keys, isLoading } = useQuery({
    queryKey: ['api-keys'],
    queryFn: apiKeysApi.getAll,
  });

  // Filter keys based on search term
  const filteredKeys = useMemo(() => {
    if (!keys) return [];
    if (!searchTerm.trim()) return keys;
    const searchLower = searchTerm.toLowerCase();
    return keys.filter(
      (key) =>
        key.name.toLowerCase().includes(searchLower) ||
        key.permissions.some((p) => p.toLowerCase().includes(searchLower))
    );
  }, [keys, searchTerm]);

  // Calculate stats
  const stats = useMemo(() => {
    if (!keys) return { total: 0, active: 0, expired: 0 };
    const now = new Date();
    return {
      total: keys.length,
      active: keys.filter((k) => k.isActive && (!k.expiresAt || new Date(k.expiresAt) > now)).length,
      expired: keys.filter((k) => k.expiresAt && new Date(k.expiresAt) <= now).length,
    };
  }, [keys]);

  const createKey = useMutation({
    mutationFn: (data: CreateApiKeyDto) => apiKeysApi.create(data),
    onSuccess: (data) => {
      setNewKey(data.key || null);
      setShowKey(true);
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      showToast('API key created successfully', 'success');
    },
    onError: (error: unknown) => {
      const errorMessage = error && typeof error === 'object' && 'response' in error
        ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
        : undefined;
      showToast(errorMessage || 'Failed to create API key', 'error');
    },
  });

  const deleteKey = useMutation({
    mutationFn: (id: string) => apiKeysApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      showToast('API key deleted successfully', 'success');
    },
    onError: (error: unknown) => {
      const errorMessage = error && typeof error === 'object' && 'response' in error
        ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
        : undefined;
      showToast(errorMessage || 'Failed to delete API key', 'error');
    },
  });

  const handleCreate = async (name: string, permissions: string[], expiresAt?: string) => {
    try {
      await createKey.mutateAsync({ name, permissions, expiresAt });
    } catch (error) {
      // Error handled in mutation
    }
  };

  const handleDeleteClick = (id: string) => {
    setKeyToDelete(id);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!keyToDelete) return;
    try {
      await deleteKey.mutateAsync(keyToDelete);
      setDeleteConfirmOpen(false);
      setKeyToDelete(null);
    } catch (error) {
      // Error handled in mutation
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirmOpen(false);
    setKeyToDelete(null);
  };

  const handleCopyKey = () => {
    if (newKey) {
      navigator.clipboard.writeText(newKey);
      showToast('API key copied to clipboard', 'success');
    }
  };

  const isExpired = (expiresAt?: string) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) <= new Date();
  };

  if (isLoading) {
    return (
      <Box>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Skeleton variant="text" width={200} height={40} />
          <Skeleton variant="rectangular" width={150} height={40} />
        </Box>
        <Skeleton variant="rectangular" width="100%" height={400} />
      </Box>
    );
  }

  return (
    <Box component="main">
      {/* Header Section */}
      <Paper
        elevation={0}
        sx={{
          p: 3,
          mb: 3,
          borderRadius: 2,
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          sx={{
            flexDirection: { xs: 'column', sm: 'row' },
            gap: { xs: 2, sm: 0 },
            alignItems: { xs: 'stretch', sm: 'center' },
          }}
        >
          <Box>
            <Box display="flex" alignItems="center" gap={2} mb={1}>
              <Box
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  bgcolor: 'primary.main',
                  color: 'primary.contrastText',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <VpnKeyIcon sx={{ fontSize: 28 }} />
              </Box>
              <Box>
                <Typography variant="h4" component="h1" sx={{ fontWeight: 600, mb: 0.5 }}>
                  API Keys
                </Typography>
                <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
                  <Chip
                    label={`${stats.total} Total`}
                    size="small"
                    color="primary"
                    variant="outlined"
                    sx={{ height: 22, fontSize: '0.75rem', fontWeight: 600 }}
                  />
                  <Chip
                    label={`${stats.active} Active`}
                    size="small"
                    color="success"
                    variant="outlined"
                    sx={{ height: 22, fontSize: '0.75rem', fontWeight: 600 }}
                  />
                  {stats.expired > 0 && (
                    <Chip
                      label={`${stats.expired} Expired`}
                      size="small"
                      color="error"
                      variant="outlined"
                      sx={{ height: 22, fontSize: '0.75rem', fontWeight: 600 }}
                    />
                  )}
                </Box>
              </Box>
            </Box>
          </Box>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setOpen(true)}
            size="large"
            sx={{
              minWidth: 160,
              borderRadius: 2,
              fontWeight: 600,
              boxShadow: 2,
              '&:hover': {
                boxShadow: 4,
              },
            }}
          >
            Create API Key
          </Button>
        </Box>
      </Paper>

      {/* Search Section */}
      {keys && keys.length > 0 && (
        <Paper
          elevation={0}
          sx={{
            p: 2.5,
            mb: 3,
            borderRadius: 2,
            bgcolor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <TextField
            fullWidth
            placeholder="Search API keys by name or permissions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
                bgcolor: 'background.paper',
              },
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: 'text.secondary' }} />
                </InputAdornment>
              ),
              endAdornment: searchTerm && (
                <InputAdornment position="end">
                  <IconButton
                    size="small"
                    onClick={() => setSearchTerm('')}
                    edge="end"
                    sx={{
                      '&:hover': {
                        bgcolor: alpha(theme.palette.action.hover, 0.5),
                      },
                    }}
                  >
                    <ClearIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
        </Paper>
      )}

      {filteredKeys && filteredKeys.length > 0 ? (
        <TableContainer
          component={Paper}
          sx={{
            borderRadius: 2,
            overflow: 'hidden',
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: 'grey.50' }}>
                <TableCell sx={{ fontWeight: 600, py: 2 }}>Name</TableCell>
                <TableCell sx={{ fontWeight: 600, py: 2 }}>Permissions</TableCell>
                <TableCell sx={{ fontWeight: 600, py: 2 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 600, py: 2 }}>Expires</TableCell>
                <TableCell sx={{ fontWeight: 600, py: 2 }}>Last Used</TableCell>
                <TableCell sx={{ fontWeight: 600, py: 2 }}>Created</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600, py: 2 }}>
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredKeys.map((key) => {
                const expired = isExpired(key.expiresAt);
                return (
                  <TableRow
                    key={key.id}
                    hover
                    sx={{
                      '&:hover': {
                        backgroundColor: alpha(theme.palette.primary.main, 0.04),
                      },
                    }}
                  >
                    <TableCell sx={{ py: 2 }}>
                      <Typography variant="body1" fontWeight={500}>
                        {key.name}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ py: 2 }}>
                      <Box display="flex" flexWrap="wrap" gap={0.5}>
                        {key.permissions.map((perm) => (
                          <Chip
                            key={perm}
                            label={perm.toUpperCase()}
                            size="small"
                            color={perm === 'delete' ? 'error' : perm === 'write' ? 'warning' : 'default'}
                            sx={{
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              height: 22,
                            }}
                          />
                        ))}
                      </Box>
                    </TableCell>
                    <TableCell sx={{ py: 2 }}>
                      <Chip
                        icon={key.isActive && !expired ? <CheckCircleIcon /> : <CancelIcon />}
                        label={expired ? 'Expired' : key.isActive ? 'Active' : 'Inactive'}
                        color={expired ? 'error' : key.isActive ? 'success' : 'default'}
                        size="small"
                        sx={{
                          fontWeight: 600,
                          fontSize: '0.75rem',
                        }}
                      />
                    </TableCell>
                    <TableCell sx={{ py: 2 }}>
                      {key.expiresAt ? (
                        <Box display="flex" alignItems="center" gap={0.5}>
                          <CalendarTodayIcon fontSize="small" color="action" sx={{ fontSize: 16 }} />
                          <Typography
                            variant="body2"
                            color={expired ? 'error.main' : 'text.secondary'}
                            fontWeight={expired ? 600 : 400}
                          >
                            {formatDate(key.expiresAt)}
                          </Typography>
                        </Box>
                      ) : (
                        <Typography variant="body2" color="text.disabled">
                          Never
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell sx={{ py: 2 }}>
                      {key.lastUsedAt ? (
                        <Box display="flex" alignItems="center" gap={0.5}>
                          <AccessTimeIcon fontSize="small" color="action" sx={{ fontSize: 16 }} />
                          <Typography variant="body2" color="text.secondary">
                            {formatDate(key.lastUsedAt)}
                          </Typography>
                        </Box>
                      ) : (
                        <Typography variant="body2" color="text.disabled">
                          Never
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell sx={{ py: 2 }}>
                      <Typography variant="body2" color="text.secondary">
                        {formatDate(key.createdAt)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right" sx={{ py: 2 }} onClick={(e) => e.stopPropagation()}>
                      <Tooltip title="Delete API key" arrow>
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteClick(key.id);
                          }}
                          color="error"
                          disabled={deleteKey.isPending}
                          sx={{
                            '&:hover': {
                              bgcolor: alpha(theme.palette.error.main, 0.1),
                            },
                          }}
                        >
                          {deleteKey.isPending && keyToDelete === key.id ? (
                            <CircularProgress size={16} />
                          ) : (
                            <DeleteIcon fontSize="small" />
                          )}
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <Paper
          elevation={0}
          sx={{
            p: 6,
            textAlign: 'center',
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Box
            sx={{
              p: 3,
              borderRadius: '50%',
              bgcolor: 'grey.100',
              color: 'text.secondary',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              mb: 3,
            }}
          >
            <VpnKeyIcon sx={{ fontSize: 64, opacity: 0.5 }} />
          </Box>
          <Typography variant="h5" component="h2" gutterBottom fontWeight={600}>
            {searchTerm ? 'No API keys found' : 'No API keys yet'}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 400, mx: 'auto' }}>
            {searchTerm
              ? `No API keys match "${searchTerm}". Try adjusting your search.`
              : 'Create API keys to authenticate external applications and services with your InvoiceMe account.'}
          </Typography>
          {!searchTerm && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setOpen(true)}
              sx={{
                borderRadius: 2,
                fontWeight: 600,
                px: 3,
                py: 1.5,
              }}
            >
              Create Your First API Key
            </Button>
          )}
          {searchTerm && (
            <Button
              variant="outlined"
              startIcon={<ClearIcon />}
              onClick={() => setSearchTerm('')}
              sx={{ mt: 2, borderRadius: 2 }}
            >
              Clear Search
            </Button>
          )}
        </Paper>
      )}

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

      <ConfirmDialog
        open={deleteConfirmOpen}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        title="Delete API Key"
        message="Are you sure you want to delete this API key? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        confirmColor="error"
        loading={deleteKey.isPending}
        severity="error"
      />
    </Box>
  );
};

interface CreateApiKeyDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string, permissions: string[], expiresAt?: string) => void;
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
  const theme = useTheme();
  const [name, setName] = useState('');
  const [permissions, setPermissions] = useState<string[]>(['read', 'write']);
  const [expiresAt, setExpiresAt] = useState<string>('');
  const [hasExpiration, setHasExpiration] = useState(false);

  const handleSubmit = () => {
    onCreate(name, permissions, hasExpiration && expiresAt ? expiresAt : undefined);
  };

  const handleClose = () => {
    if (!showKey) {
      setName('');
      setPermissions(['read', 'write']);
      setExpiresAt('');
      setHasExpiration(false);
    }
    onClose();
  };

  const permissionDescriptions: Record<string, string> = {
    read: 'View data (invoices, clients, inventory)',
    write: 'Create and update data',
    delete: 'Delete data (use with caution)',
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        <Box display="flex" alignItems="center" gap={2}>
          <Box
            sx={{
              p: 1,
              borderRadius: 1.5,
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <VpnKeyIcon />
          </Box>
          <Typography variant="h6" component="div" fontWeight={600}>
            {showKey ? 'API Key Created' : 'Create API Key'}
          </Typography>
        </Box>
      </DialogTitle>
      <Divider />
      <DialogContent sx={{ pt: 3 }}>
        {showKey && newKey ? (
          <Box>
            <Alert severity="warning" sx={{ mb: 3, borderRadius: 2 }}>
              <Typography variant="body2" fontWeight={600} gutterBottom>
                ⚠️ Save this key now!
              </Typography>
              <Typography variant="body2">
                This is the only time you'll be able to see this API key. Make sure to copy it and store it securely.
              </Typography>
            </Alert>
            <TextField
              fullWidth
              label="Your API Key"
              value={newKey}
              InputProps={{
                readOnly: true,
                endAdornment: (
                  <InputAdornment position="end">
                    <Tooltip title="Copy to clipboard" arrow>
                      <IconButton onClick={onCopy} color="primary">
                        <ContentCopyIcon />
                      </IconButton>
                    </Tooltip>
                  </InputAdornment>
                ),
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  fontFamily: 'monospace',
                  fontSize: '0.875rem',
                },
              }}
            />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              Use this key in the Authorization header: <code>Authorization: Bearer {newKey.substring(0, 20)}...</code>
            </Typography>
          </Box>
        ) : (
          <Box>
            {/* Basic Information Section */}
            <Box mb={3}>
              <Typography variant="subtitle2" fontWeight={600} color="text.secondary" sx={{ textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: 1, mb: 1.5 }}>
                Basic Information
              </Typography>
              <TextField
                fullWidth
                label={
                  <span>
                    API Key Name <span style={{ color: '#d32f2f', marginLeft: '4px' }}>*</span>
                  </span>
                }
                placeholder="e.g., Production API, Development Key, Mobile App"
                value={name}
                onChange={(e) => setName(e.target.value)}
                helperText="Give this key a descriptive name to identify its purpose or application"
                required
                InputLabelProps={{ required: false }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <VpnKeyIcon color="action" />
                    </InputAdornment>
                  ),
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                  },
                }}
              />
            </Box>

            <Divider sx={{ my: 3 }} />

            {/* Permissions Section */}
            <Box mb={3}>
              <Typography variant="subtitle2" fontWeight={600} color="text.secondary" sx={{ textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: 1, mb: 1.5 }}>
                Permissions
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Select what this API key can do. Choose the minimum permissions needed for security.
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {['read', 'write', 'delete'].map((perm) => (
                  <Paper
                    key={perm}
                    elevation={0}
                    sx={{
                      p: 2,
                      border: '2px solid',
                      borderColor: permissions.includes(perm) ? 'primary.main' : 'divider',
                      borderRadius: 2,
                      bgcolor: permissions.includes(perm) ? alpha(theme.palette.primary.main, 0.05) : 'transparent',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      '&:hover': {
                        borderColor: 'primary.main',
                        bgcolor: alpha(theme.palette.primary.main, 0.05),
                        transform: 'translateY(-1px)',
                        boxShadow: 1,
                      },
                    }}
                    onClick={() => {
                      if (permissions.includes(perm)) {
                        setPermissions(permissions.filter((p) => p !== perm));
                      } else {
                        setPermissions([...permissions, perm]);
                      }
                    }}
                  >
                    <FormControlLabel
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
                          color="primary"
                        />
                      }
                      label={
                        <Box>
                          <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                            <Typography variant="body1" fontWeight={600}>
                              {perm.toUpperCase()}
                            </Typography>
                            {perm === 'delete' && (
                              <Chip label="Dangerous" size="small" color="error" sx={{ height: 20, fontSize: '0.65rem' }} />
                            )}
                          </Box>
                          <Typography variant="body2" color="text.secondary">
                            {permissionDescriptions[perm]}
                          </Typography>
                        </Box>
                      }
                      sx={{ m: 0, width: '100%' }}
                    />
                  </Paper>
                ))}
              </Box>
              {permissions.length === 0 && (
                <Alert severity="warning" sx={{ mt: 2, borderRadius: 2 }}>
                  At least one permission must be selected.
                </Alert>
              )}
            </Box>

            <Divider sx={{ my: 3 }} />

            {/* Expiration Section */}
            <Box>
              <Typography variant="subtitle2" fontWeight={600} color="text.secondary" sx={{ textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: 1, mb: 1.5 }}>
                Expiration (Optional)
              </Typography>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={hasExpiration}
                    onChange={(e) => {
                      setHasExpiration(e.target.checked);
                      if (!e.target.checked) {
                        setExpiresAt('');
                      }
                    }}
                    color="primary"
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2" fontWeight={500}>
                      Set expiration date
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Automatically disable this key after a specific date
                    </Typography>
                  </Box>
                }
                sx={{ mb: hasExpiration ? 2 : 0 }}
              />
              {hasExpiration && (
                <TextField
                  fullWidth
                  type="datetime-local"
                  label="Expiration Date & Time"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  helperText="The API key will automatically become inactive after this date"
                  InputLabelProps={{
                    shrink: true,
                  }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <CalendarTodayIcon color="action" />
                      </InputAdornment>
                    ),
                  }}
                  sx={{
                    mt: 1,
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                    },
                  }}
                  inputProps={{
                    min: new Date().toISOString().slice(0, 16), // Prevent past dates
                  }}
                />
              )}
            </Box>
          </Box>
        )}
      </DialogContent>
      <Divider />
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={handleClose} variant="outlined" sx={{ borderRadius: 2 }}>
          {showKey ? 'Done' : 'Cancel'}
        </Button>
        {!showKey && (
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={!name || permissions.length === 0}
            sx={{
              borderRadius: 2,
              fontWeight: 600,
              minWidth: 100,
            }}
          >
            Create Key
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default ApiKeysList;

