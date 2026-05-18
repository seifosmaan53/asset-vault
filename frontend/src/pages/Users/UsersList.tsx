import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
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
  Skeleton,
  Chip,
  Tooltip,
  Dialog,
  InputAdornment,
  Link,
  TableSortLabel,
  alpha,
  useTheme,
  CircularProgress,
  Avatar,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import PersonIcon from '@mui/icons-material/Person';
import BusinessIcon from '@mui/icons-material/Business';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import { useQueryClient } from '@tanstack/react-query';
import { useUsers, useDeleteUser } from '../../hooks/useUsers';
import { formatDate } from '../../utils/dates';
import { useToast } from '../../contexts/ToastContext';
import { useAuthStore } from '../../store/authStore';
import { getErrorMessage } from '../../utils/errorHandling';
import UserForm from './UserForm';
import ConfirmDialog from '../../components/common/ConfirmDialog';

type SortField = 'name' | 'email' | 'role' | 'createdAt' | 'companyName';
type SortDirection = 'asc' | 'desc';

const UsersList = () => {
  const { data: users, isLoading, isRefetching } = useUsers();
  const deleteUser = useDeleteUser();
  const { showToast } = useToast();
  const { user: currentUser } = useAuthStore();
  const theme = useTheme();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const queryClient = useQueryClient();

  // Clear cache and invalidate queries on mount to ensure fresh data
  useEffect(() => {
    // Invalidate all user-related queries to force fresh fetch
    queryClient.invalidateQueries({ queryKey: ['users'], exact: false });
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

  // Real-time search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchTerm(searchInput.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Memoize filtered and sorted users
  const filteredAndSortedUsers = useMemo(() => {
    if (!users) return undefined;
    
    // Filter users
    const searchLower = searchTerm.toLowerCase();
    let filtered = users.filter((user) => {
      const nameMatch = user.name?.toLowerCase().includes(searchLower) || false;
      const emailMatch = user.email?.toLowerCase().includes(searchLower) || false;
      const companyMatch = user.companyName?.toLowerCase().includes(searchLower) || false;
      const roleMatch = user.role?.toLowerCase().includes(searchLower) || false;
      
      return nameMatch || emailMatch || companyMatch || roleMatch;
    });

    // Sort users
    filtered = [...filtered].sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      switch (sortField) {
        case 'name':
          aValue = a.name || '';
          bValue = b.name || '';
          break;
        case 'email':
          aValue = a.email || '';
          bValue = b.email || '';
          break;
        case 'role':
          aValue = a.role || '';
          bValue = b.role || '';
          break;
        case 'companyName':
          aValue = a.companyName || '';
          bValue = b.companyName || '';
          break;
        case 'createdAt':
          aValue = new Date(a.createdAt).getTime();
          bValue = new Date(b.createdAt).getTime();
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [users, searchTerm, sortField, sortDirection]);

  // Count owners to check if user is last owner (memoized)
  const ownerCount = useMemo(() => {
    return users?.filter((u) => u.role === 'owner').length || 0;
  }, [users]);

  const handleDeleteClick = useCallback((id: string) => {
    setUserToDelete(id);
    setDeleteConfirmOpen(true);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!userToDelete) return;
    try {
      await deleteUser.mutateAsync(userToDelete);
      showToast('User deleted successfully', 'success');
      setDeleteConfirmOpen(false);
      setUserToDelete(null);
    } catch (error: unknown) {
      showToast(getErrorMessage(error, 'Failed to delete user'), 'error');
    }
  }, [userToDelete, deleteUser, showToast]);

  const handleDeleteCancel = useCallback(() => {
    setDeleteConfirmOpen(false);
    setUserToDelete(null);
  }, []);

  const handleCreate = () => {
    setEditingUser(null);
    setDialogOpen(true);
  };

  const handleEdit = (id: string) => {
    setEditingUser(id);
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingUser(null);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getRoleColor = (role: string) => {
    switch (role?.toLowerCase()) {
      case 'owner':
        return 'primary';
      case 'admin':
        return 'info';
      default:
        return 'default';
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role?.toLowerCase()) {
      case 'owner':
        return <AdminPanelSettingsIcon fontSize="small" />;
      case 'admin':
        return <PersonIcon fontSize="small" />;
      default:
        return <PersonIcon fontSize="small" />;
    }
  };

  const getInitials = (name: string) => {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const canDelete = (user: { id: string; role: string }) => {
    if (user.id === currentUser?.id) return false;
    if (user.role === 'owner' && ownerCount <= 1) return false;
    return true;
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
                    <TableCell align="right"><Skeleton width={80} /></TableCell>
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
    <Box component="main">
      {/* Skip to main content link for accessibility */}
      <Link
        href="#users-table"
        sx={{
          position: 'absolute',
          left: '-9999px',
          zIndex: 1,
          '&:focus': {
            position: 'static',
            left: 'auto',
            display: 'inline-block',
            padding: theme.spacing(1, 2),
            backgroundColor: theme.palette.primary.main,
            color: theme.palette.primary.contrastText,
            textDecoration: 'none',
            borderRadius: 1,
            mb: 2,
          },
        }}
      >
        Skip to main content
      </Link>

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
                <PersonIcon sx={{ fontSize: 28 }} />
              </Box>
              <Box>
                <Typography variant="h4" component="h1" sx={{ fontWeight: 600, mb: 0.5 }} id="page-title">
                  Users
                </Typography>
                {filteredAndSortedUsers && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip
                      label={`${filteredAndSortedUsers.length} ${filteredAndSortedUsers.length === 1 ? 'user' : 'users'}`}
                      size="small"
                      color="primary"
                      variant="outlined"
                      sx={{ height: 22, fontSize: '0.75rem', fontWeight: 600 }}
                    />
                    {searchTerm && (
                      <Chip
                        label={`Search: "${searchTerm}"`}
                        size="small"
                        onDelete={() => {
                          setSearchInput('');
                          setSearchTerm('');
                        }}
                        sx={{ height: 22, fontSize: '0.75rem' }}
                      />
                    )}
                    {isRefetching && (
                      <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                        <CircularProgress size={12} />
                        <Typography component="span" variant="caption">Refreshing...</Typography>
                      </Box>
                    )}
                  </Box>
                )}
              </Box>
            </Box>
          </Box>
          <Button
            variant="contained"
            startIcon={<PersonAddIcon />}
            onClick={handleCreate}
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
            Create User
          </Button>
        </Box>
      </Paper>

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
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6" fontWeight={600}>
            Search & Filter
          </Typography>
          {searchTerm && (
            <Chip
              label={`${filteredAndSortedUsers?.length || 0} result${(filteredAndSortedUsers?.length || 0) !== 1 ? 's' : ''}`}
              size="small"
              color="primary"
              variant="outlined"
            />
          )}
        </Box>
        <TextField
          inputRef={searchInputRef}
          fullWidth
          placeholder="Search users by name, email, company, or role..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          sx={{ 
            '& .MuiOutlinedInput-root': {
              borderRadius: 2,
              bgcolor: 'background.paper',
              transition: 'all 0.2s ease-in-out',
              '&:hover': {
                boxShadow: 1,
              },
              '&.Mui-focused': {
                boxShadow: 2,
              },
            },
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: 'text.secondary' }} />
              </InputAdornment>
            ),
            endAdornment: searchInput && (
              <InputAdornment position="end">
                <IconButton
                  size="small"
                  onClick={() => {
                    setSearchInput('');
                    setSearchTerm('');
                    searchInputRef.current?.focus();
                  }}
                  edge="end"
                  aria-label="Clear search"
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
        {searchInput && !searchTerm && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            Type to search in real-time...
          </Typography>
        )}
      </Paper>

      <TableContainer 
        component={Paper} 
        id="users-table"
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
              <TableCell sx={{ fontWeight: 600, py: 2 }}>
                <TableSortLabel
                  active={sortField === 'name'}
                  direction={sortField === 'name' ? sortDirection : 'asc'}
                  onClick={() => handleSort('name')}
                >
                  Name
                </TableSortLabel>
              </TableCell>
              <TableCell sx={{ fontWeight: 600, py: 2 }}>
                <TableSortLabel
                  active={sortField === 'email'}
                  direction={sortField === 'email' ? sortDirection : 'asc'}
                  onClick={() => handleSort('email')}
                >
                  Email
                </TableSortLabel>
              </TableCell>
              <TableCell sx={{ fontWeight: 600, py: 2 }}>
                <TableSortLabel
                  active={sortField === 'companyName'}
                  direction={sortField === 'companyName' ? sortDirection : 'asc'}
                  onClick={() => handleSort('companyName')}
                >
                  Company
                </TableSortLabel>
              </TableCell>
              <TableCell sx={{ fontWeight: 600, py: 2 }}>
                <TableSortLabel
                  active={sortField === 'role'}
                  direction={sortField === 'role' ? sortDirection : 'asc'}
                  onClick={() => handleSort('role')}
                >
                  Role
                </TableSortLabel>
              </TableCell>
              <TableCell sx={{ fontWeight: 600, py: 2 }}>
                <TableSortLabel
                  active={sortField === 'createdAt'}
                  direction={sortField === 'createdAt' ? sortDirection : 'asc'}
                  onClick={() => handleSort('createdAt')}
                >
                  Created
                </TableSortLabel>
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 600, py: 2 }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredAndSortedUsers && filteredAndSortedUsers.length > 0 ? (
              filteredAndSortedUsers.map((user) => {
                const isDeletable = canDelete(user);
                const isCurrentUser = user.id === currentUser?.id;
                return (
                  <TableRow 
                    key={user.id} 
                    hover
                    sx={{
                      '&:hover': {
                        backgroundColor: alpha(theme.palette.primary.main, 0.04),
                      },
                    }}
                  >
                    <TableCell sx={{ py: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Avatar
                          sx={{
                            width: 40,
                            height: 40,
                            bgcolor: isCurrentUser ? 'primary.main' : 'secondary.main',
                            fontSize: '0.875rem',
                            fontWeight: 600,
                            boxShadow: 1,
                          }}
                        >
                          {getInitials(user.name || user.email)}
                        </Avatar>
                        <Box>
                          <Typography variant="body1" fontWeight={500} sx={{ lineHeight: 1.3 }}>
                            {user.name || 'No name'}
                          </Typography>
                          {isCurrentUser && (
                            <Chip
                              label="(You)"
                              size="small"
                              color="primary"
                              variant="outlined"
                              sx={{
                                height: 18,
                                fontSize: '0.65rem',
                                mt: 0.5,
                                fontWeight: 600,
                              }}
                            />
                          )}
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ py: 2 }}>
                      <Typography variant="body2" sx={{ color: 'text.primary' }}>
                        {user.email}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ py: 2 }}>
                      {user.companyName ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                          <BusinessIcon fontSize="small" sx={{ color: 'primary.main' }} />
                          <Typography variant="body2" fontWeight={500}>
                            {user.companyName}
                          </Typography>
                        </Box>
                      ) : (
                        <Typography variant="body2" color="text.disabled" sx={{ fontStyle: 'italic' }}>
                          No company
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell sx={{ py: 2 }}>
                      <Chip
                        icon={getRoleIcon(user.role)}
                        label={user.role?.toUpperCase() || 'N/A'}
                        color={getRoleColor(user.role)}
                        size="small"
                        sx={{
                          fontWeight: 600,
                          fontSize: '0.75rem',
                        }}
                      />
                    </TableCell>
                    <TableCell sx={{ py: 2 }}>
                      <Typography variant="body2" color="text.secondary">
                        {formatDate(user.createdAt)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right" sx={{ py: 2 }} onClick={(e) => e.stopPropagation()}>
                      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
                        <Tooltip title="Edit user" arrow>
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(user.id);
                            }}
                            aria-label={`Edit user ${user.name || user.email}`}
                            sx={{
                              color: 'primary.main',
                              '&:hover': {
                                bgcolor: alpha(theme.palette.primary.main, 0.1),
                              },
                            }}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip
                          title={
                            !isDeletable
                              ? isCurrentUser
                                ? 'Cannot delete your own account'
                                : 'Cannot delete the last owner'
                              : 'Delete user'
                          }
                          arrow
                        >
                          <span>
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteClick(user.id);
                              }}
                              color="error"
                              disabled={!isDeletable}
                              aria-label={`Delete user ${user.name || user.email}`}
                              sx={{
                                '&:hover:not(:disabled)': {
                                  bgcolor: alpha(theme.palette.error.main, 0.1),
                                },
                              }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 8 }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <PersonIcon 
                      sx={{ 
                        fontSize: 64, 
                        color: theme.palette.text.disabled,
                        opacity: 0.5,
                      }} 
                    />
                    <Typography variant="h6" color="text.secondary" fontWeight={500}>
                      {searchTerm ? 'No users found' : 'No users yet'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 400, textAlign: 'center' }}>
                      {searchTerm
                        ? `No users match "${searchTerm}". Try adjusting your search.`
                        : 'Get started by creating your first user'}
                    </Typography>
                    {!searchTerm && (
                      <Button
                        variant="contained"
                        startIcon={<PersonAddIcon />}
                        onClick={handleCreate}
                        sx={{ mt: 1 }}
                      >
                        Create User
                      </Button>
                    )}
                    {searchTerm && (
                      <Button
                        variant="outlined"
                        startIcon={<ClearIcon />}
                        onClick={() => {
                          setSearchInput('');
                          setSearchTerm('');
                          searchInputRef.current?.focus();
                        }}
                        sx={{ mt: 1 }}
                      >
                        Clear Search
                      </Button>
                    )}
                  </Box>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogOpen} onClose={handleDialogClose} maxWidth="sm" fullWidth>
        <UserForm
          userId={editingUser}
          onSuccess={handleDialogClose}
          onCancel={handleDialogClose}
        />
      </Dialog>

      <ConfirmDialog
        open={deleteConfirmOpen}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        title="Delete User"
        message="Are you sure you want to delete this user? This action cannot be undone. You cannot delete your own account or the last owner."
        confirmText="Delete"
        cancelText="Cancel"
        confirmColor="error"
        loading={deleteUser.isPending}
        severity="error"
      />
    </Box>
  );
};

export default UsersList;

