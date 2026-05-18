import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import ExportProgressDialog from '../../components/common/ExportProgressDialog';
import { BulkActionsBar } from '../../components/common/BulkActionsBar';
import { ImportDialog } from '../../components/import/ImportDialog';
import { ImportPreview } from '../../components/import/ImportPreview';
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
  InputAdornment,
  Tooltip,
  Chip,
  Avatar,
  CircularProgress,
  alpha,
  useTheme,
  Card,
  CardContent,
  Checkbox,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import DownloadIcon from '@mui/icons-material/Download';
import VisibilityIcon from '@mui/icons-material/Visibility';
import PersonIcon from '@mui/icons-material/Person';
import EmailIcon from '@mui/icons-material/Email';
import PhoneIcon from '@mui/icons-material/Phone';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import GroupsIcon from '@mui/icons-material/Groups';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import FilterListIcon from '@mui/icons-material/FilterList';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { useClients, useDeleteClient, useBulkDeleteClients } from '../../hooks/useClients';
import { formatDate } from '../../utils/dates';
import { useToast } from '../../contexts/ToastContext';
import { useUndo } from '../../hooks/useUndo';
import { getErrorMessage } from '../../utils/errorHandling';
import { exportToCSV } from '../../utils/export';
import { useQueryClient } from '@tanstack/react-query';
import Grid from '../../components/common/Grid';
import { TIMEOUTS } from '../../constants/timeouts';
import { formatPhoneNumber, formatAddressSingleLine } from '../../utils/phone';
import { logger } from '../../utils/logger';
import { useDebounce } from '../../utils/useDebounce';
import { AdvancedFilters } from '../../components/common/AdvancedFilters';
import type { AdvancedFiltersState } from '../../components/common/AdvancedFilters';
import { clientsApi } from '../../api/clients';
import { SearchHistoryDropdown } from '../../components/common/SearchHistoryDropdown';
import { useSearch } from '../../contexts/SearchContext';
import HistoryIcon from '@mui/icons-material/History';
import type { ColumnMapping, ImportResult } from '../../utils/import';
import type { Client } from '../../types/client';
import { EmptyState } from '../../components/common/EmptyState';
import { useTableColumns } from '../../hooks/useTableColumns';

const ClientsList = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchInput, setSearchInput] = useState('');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [exportProgress, setExportProgress] = useState({ open: false, current: 0, total: 0 });
  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set());
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFiltersState | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importPreviewOpen, setImportPreviewOpen] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult<Partial<Client>> | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [searchHistoryOpen, setSearchHistoryOpen] = useState(false);
  const searchHistoryAnchorRef = useRef<HTMLDivElement>(null);
  const { addToHistory } = useSearch();
  
  // Column visibility management
  const defaultColumns = ['checkbox', 'name', 'email', 'phone', 'address', 'created', 'actions'];
  const {
    preferences,
    toggleColumnVisibility,
    resetPreferences,
  } = useTableColumns('clients-list', defaultColumns);
  
  const columnControls = useMemo(() => [
    { id: 'name', label: 'Name', visible: preferences.name?.visible !== false },
    { id: 'email', label: 'Email', visible: preferences.email?.visible !== false },
    { id: 'phone', label: 'Phone', visible: preferences.phone?.visible !== false },
    { id: 'address', label: 'Address', visible: preferences.address?.visible !== false },
    { id: 'created', label: 'Created', visible: preferences.created?.visible !== false },
  ], [preferences]);
  
  // Debounced search for real-time filtering
  const debouncedSearchInput = useDebounce(searchInput, 300);
  
  // Update search term when debounced input changes
  useEffect(() => {
    const trimmed = debouncedSearchInput.trim();
    setSearchTerm(trimmed);
    // Add to search history when user searches
    if (trimmed) {
      addToHistory(trimmed, 'clients');
    }
  }, [debouncedSearchInput, addToHistory]);
  
  const handleSearchHistorySelect = (term: string) => {
    setSearchInput(term);
    setSearchTerm(term);
    searchInputRef.current?.focus();
  };

  // Build filter object for API
  const clientFilters = useMemo(() => {
    const filters: {
      search?: string;
      createdAtFrom?: string;
      createdAtTo?: string;
      updatedAtFrom?: string;
      updatedAtTo?: string;
    } = {};
    
    if (searchTerm && searchTerm.trim()) {
      filters.search = searchTerm.trim();
    }
    
    // Apply advanced filters
    if (advancedFilters) {
      advancedFilters.dateRanges.forEach(range => {
        if (range.startDate) {
          const fieldMap: Record<string, string> = {
            'Created Date': 'createdAtFrom',
            'Updated Date': 'updatedAtFrom',
          };
          const key = fieldMap[range.label];
          if (key) {
            filters[key as keyof typeof filters] = range.startDate.toISOString().split('T')[0];
          }
        }
        if (range.endDate) {
          const fieldMap: Record<string, string> = {
            'Created Date': 'createdAtTo',
            'Updated Date': 'updatedAtTo',
          };
          const key = fieldMap[range.label];
          if (key) {
            filters[key as keyof typeof filters] = range.endDate.toISOString().split('T')[0];
          }
        }
      });
    }
    
    return Object.keys(filters).length > 0 ? filters : undefined;
  }, [searchTerm, advancedFilters]);

  const { data: clients, isLoading, refetch: refetchClients } = useClients(clientFilters);
  const deleteClient = useDeleteClient();
  const bulkDeleteClients = useBulkDeleteClients();
  const { showToast } = useToast();
  const { createDeleteUndo } = useUndo();
  const theme = useTheme();

  // Clear cache and invalidate queries on mount to ensure fresh data
  useEffect(() => {
    // Invalidate all client-related queries to force fresh fetch
    queryClient.invalidateQueries({ queryKey: ['clients'], exact: false });
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

  // Enhanced auto-refresh: refetch when page becomes visible and periodically
  useEffect(() => {
    // Edge case: Check if document exists (SSR safety)
    if (typeof document === 'undefined') return;
    
    const handleVisibilityChange = () => {
      try {
        // When page becomes visible, immediately refetch to get latest data
        // Only refetch if there are no pending mutations to avoid race conditions
        if (!document.hidden && refetchClients && !deleteClient.isPending && !bulkDeleteClients.isPending) {
          refetchClients().catch((error) => {
            // Edge case: Handle refetch errors gracefully
            logger.error('ClientsList: Error refetching on visibility change', error);
            showToast('Failed to refresh clients list', 'error');
          });
          queryClient.invalidateQueries({ queryKey: ['clients'], exact: false });
        }
      } catch (error) {
        // Edge case: Handle any errors in visibility handler
        logger.error('ClientsList: Error in visibility change handler', error);
      }
    };

    // Listen for visibility changes
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Periodic refresh - only when page is visible and data is stale
    // Use longer interval to prevent race conditions and excessive API calls
    const interval = setInterval(() => {
      try {
        if (!document.hidden && refetchClients) {
          // Only refetch if there are no pending mutations to avoid race conditions
          if (!deleteClient.isPending && !bulkDeleteClients.isPending) {
            // Only refetch if data is actually stale (older than 5 seconds)
            const lastUpdate = queryClient.getQueryState(['clients'])?.dataUpdatedAt;
            const isStale = !lastUpdate || (Date.now() - lastUpdate) >= TIMEOUTS.REAL_TIME_REFRESH_INTERVAL;
            
            if (isStale) {
              refetchClients().catch((error) => {
                // Edge case: Handle refetch errors gracefully
                logger.error('ClientsList: Error refetching on interval', error);
                showToast('Failed to refresh clients list', 'error');
              });
            }
          }
        }
      } catch (error) {
        // Edge case: Handle any errors in interval handler
        logger.error('ClientsList: Error in interval handler', error);
      }
    }, TIMEOUTS.REAL_TIME_REFRESH_INTERVAL); // 5 seconds for real-time synchronization
    
    // FIX #145: Ensure interval is cleared on unmount - use ref to track interval
    return () => {
      try {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        clearInterval(interval);
      } catch (error) {
        // Edge case: Handle cleanup errors
        logger.error('ClientsList: Error in cleanup', error);
      }
    };
    // FIX #144: Fix infinite loop - refetchClients is stable from React Query
  }, [refetchClients, queryClient, deleteClient.isPending, bulkDeleteClients.isPending]);

  // Listen for focus events to refetch when user returns to the tab
  useEffect(() => {
    // Edge case: Check if window exists (SSR safety)
    if (typeof window === 'undefined') return;
    
    const handleFocus = () => {
      try {
        // Refetch when window regains focus to ensure fresh data
        // Only refetch if there are no pending mutations to avoid race conditions
        if (refetchClients && !deleteClient.isPending && !bulkDeleteClients.isPending) {
          refetchClients().catch((error) => {
            // Edge case: Handle refetch errors gracefully
            logger.error('ClientsList: Error refetching on focus', error);
            showToast('Failed to refresh clients list', 'error');
          });
          queryClient.invalidateQueries({ queryKey: ['clients'], exact: false });
        }
      } catch (error) {
        // Edge case: Handle any errors in focus handler
        logger.error('ClientsList: Error in focus handler', error);
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      try {
        window.removeEventListener('focus', handleFocus);
      } catch (error) {
        // Edge case: Handle cleanup errors
        logger.error('ClientsList: Error in focus cleanup', error);
      }
    };
  }, [refetchClients, queryClient, deleteClient.isPending, bulkDeleteClients.isPending]);
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      // Ctrl/Cmd + K: Focus search
      if ((e.ctrlKey || e.metaKey) && key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      // Ctrl/Cmd + N: New client
      if ((e.ctrlKey || e.metaKey) && key === 'n') {
        e.preventDefault();
        navigate('/clients/create');
      }
      // Escape: Clear search
      if (key === 'escape' && (searchInput || searchTerm)) {
        setSearchInput('');
        setSearchTerm('');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate, searchTerm]);

  // Memoize filtered clients with comprehensive edge case handling
  const filteredClients = useMemo(() => {
    // Edge case: Handle null/undefined clients
    if (!clients || !Array.isArray(clients)) return undefined;
    
    // Edge case: Handle empty clients array
    if (clients.length === 0) return [];
    
    // Edge case: Handle invalid search term
    if (!searchTerm || typeof searchTerm !== 'string' || !searchTerm.trim()) {
      return clients;
    }
    
    try {
      const searchLower = searchTerm.toLowerCase().trim();
      
      return clients.filter(client => {
        // Edge case: Skip invalid clients
        if (!client || typeof client !== 'object' || !client.id) {
          return false;
        }
        
        try {
          // Edge case: Safe string matching with null checks
          const nameMatch = client.name && typeof client.name === 'string' 
            ? client.name.toLowerCase().includes(searchLower) 
            : false;
          
          const emailMatch = client.email && typeof client.email === 'string'
            ? client.email.toLowerCase().includes(searchLower)
            : false;
          
          const phoneMatch = client.phone && typeof client.phone === 'string'
            ? client.phone.toLowerCase().includes(searchLower)
            : false;
          
          const notesMatch = client.notes && typeof client.notes === 'string'
            ? client.notes.toLowerCase().includes(searchLower)
            : false;
          
          // Edge case: Safe object access for address
          const addressMatch = client.addressJson && typeof client.addressJson === 'object'
            ? (
                (client.addressJson.street && typeof client.addressJson.street === 'string' && client.addressJson.street.toLowerCase().includes(searchLower)) ||
                (client.addressJson.city && typeof client.addressJson.city === 'string' && client.addressJson.city.toLowerCase().includes(searchLower)) ||
                (client.addressJson.state && typeof client.addressJson.state === 'string' && client.addressJson.state.toLowerCase().includes(searchLower)) ||
                (client.addressJson.zip && typeof client.addressJson.zip === 'string' && client.addressJson.zip.toLowerCase().includes(searchLower)) ||
                (client.addressJson.country && typeof client.addressJson.country === 'string' && client.addressJson.country.toLowerCase().includes(searchLower))
              )
            : false;
          
          return nameMatch || emailMatch || phoneMatch || notesMatch || addressMatch;
        } catch (error) {
          // Edge case: If filtering fails for a client, exclude it
          logger.warn('ClientsList: Error filtering client', { clientId: client.id, error });
          return false;
        }
      });
    } catch (error) {
      // Edge case: If filtering fails entirely, return all clients
      logger.error('ClientsList: Error in filter', error);
      return clients;
    }
  }, [clients, searchTerm]);

  // Calculate statistics - ensure accurate counts with proper validation and edge case handling
  const stats = useMemo(() => {
    // Edge case: Handle null/undefined/empty clients
    if (!clients || !Array.isArray(clients)) {
      return { total: 0, withEmail: 0, withPhone: 0, withAddress: 0 };
    }
    
    try {
      return {
        total: clients.length,
        withEmail: clients.filter(c => {
          // Edge case: Safe string validation
          return c && c.email && typeof c.email === 'string' && c.email.trim() !== '';
        }).length,
        withPhone: clients.filter(c => {
          // Edge case: Safe string validation
          return c && c.phone && typeof c.phone === 'string' && c.phone.trim() !== '';
        }).length,
        withAddress: clients.filter(c => {
          // Edge case: Safe object validation
          if (!c || !c.addressJson || typeof c.addressJson !== 'object') return false;
          const addr = c.addressJson;
          // Only count if addressJson exists and has at least one non-empty field
          const hasAddress = (
            (addr.street && typeof addr.street === 'string' && addr.street.trim() !== '') ||
            (addr.city && typeof addr.city === 'string' && addr.city.trim() !== '') ||
            (addr.state && typeof addr.state === 'string' && addr.state.trim() !== '') ||
            (addr.zip && typeof addr.zip === 'string' && addr.zip.trim() !== '') ||
            (addr.country && typeof addr.country === 'string' && addr.country.trim() !== '')
          );
          return hasAddress;
        }).length,
      };
    } catch (error) {
      // Edge case: If stats calculation fails, return safe defaults
      logger.error('ClientsList: Error calculating stats', error);
      return { total: 0, withEmail: 0, withPhone: 0, withAddress: 0 };
    }
  }, [clients]);

  const handleDeleteClick = useCallback((id: string) => {
    // Edge case: Validate ID before proceeding
    if (!id || typeof id !== 'string' || id.trim() === '') {
      logger.warn('ClientsList: Invalid client ID for deletion', { id });
      showToast('Invalid client ID', 'error');
      return;
    }
    
    try {
      setClientToDelete(id);
      setDeleteConfirmOpen(true);
    } catch (error) {
      // Edge case: Handle state update errors
      logger.error('ClientsList: Error setting delete state', error);
      showToast('Error preparing delete operation', 'error');
    }
  }, [showToast]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!clientToDelete) {
      setDeleteConfirmOpen(false);
      setClientToDelete(null);
      return;
    }
    
    // Get client data before deletion for undo
    let clientData = queryClient.getQueryData<Client>(['clients', clientToDelete]);
    
    // If not in cache, try to find it in the current list
    if (!clientData && clients) {
      clientData = clients.find(client => client.id === clientToDelete);
    }
    
    // If still not found, fetch it
    if (!clientData) {
      try {
        clientData = await clientsApi.getById(clientToDelete);
      } catch (error) {
        logger.warn('Could not fetch client for undo:', error);
      }
    }
    
    try {
      // The mutation handles optimistic update and delayed refetch
      // Don't refetch immediately here - it causes race conditions
      await deleteClient.mutateAsync(clientToDelete);
      
      // Create undo operation if we have client data
      if (clientData) {
        createDeleteUndo(
          'client',
          `Client ${clientData.name}`,
          clientData,
          async (client: Client) => {
            try {
              await clientsApi.create({
                name: client.name,
                email: client.email,
                phone: client.phone,
                addressJson: client.addressJson,
                notes: client.notes,
              });
              queryClient.invalidateQueries({ queryKey: ['clients'], exact: false });
              showToast(`Client ${client.name} restored`, 'success');
            } catch (error) {
              showToast(getErrorMessage(error, 'Failed to restore client'), 'error');
              throw error;
            }
          },
        );
      } else {
        showToast('Client deleted successfully', 'success');
      }
      
      setDeleteConfirmOpen(false);
      setClientToDelete(null);
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error, 'Failed to delete client', {
        operation: 'delete',
        resource: 'client',
      });
      showToast(errorMessage, 'error');
    }
  }, [clientToDelete, deleteClient, showToast, createDeleteUndo, queryClient, clients]);

  const handleDeleteCancel = useCallback(() => {
    setDeleteConfirmOpen(false);
    setClientToDelete(null);
  }, []);

  // Bulk selection handlers
  const handleSelectClient = useCallback((clientId: string) => {
    setSelectedClients(prev => {
      const next = new Set(prev);
      if (next.has(clientId)) {
        next.delete(clientId);
      } else {
        next.add(clientId);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (!filteredClients) return;
    
    const allSelected = filteredClients.every(client => selectedClients.has(client.id));
    if (allSelected) {
      // Deselect all
      setSelectedClients(new Set());
    } else {
      // Select all filtered clients
      setSelectedClients(new Set(filteredClients.map(client => client.id)));
    }
  }, [filteredClients, selectedClients]);

  const handleClearSelection = useCallback(() => {
    setSelectedClients(new Set());
  }, []);

  const handleBulkDelete = useCallback(() => {
    setBulkDeleteConfirmOpen(true);
  }, []);

  const handleBulkDeleteConfirm = useCallback(async () => {
    if (selectedClients.size === 0) return;
    
    try {
      const ids = Array.from(selectedClients);
      const result = await bulkDeleteClients.mutateAsync(ids);
      
      if (result.failed.length > 0) {
        showToast(
          `Deleted ${result.deleted} client(s). ${result.failed.length} failed: ${result.failed.map(f => f.reason).join(', ')}`,
          'warning'
        );
      } else {
        showToast(`Successfully deleted ${result.deleted} client(s)`, 'success');
      }
      
      setSelectedClients(new Set());
      setBulkDeleteConfirmOpen(false);
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error, 'Failed to delete clients', {
        operation: 'bulk delete',
        resource: 'clients',
      });
      showToast(errorMessage, 'error');
    }
  }, [selectedClients, bulkDeleteClients, showToast]);

  const handleBulkDeleteCancel = useCallback(() => {
    setBulkDeleteConfirmOpen(false);
  }, []);

  // Update selected clients when filtered clients change (remove selections that are no longer visible)
  useEffect(() => {
    if (!filteredClients) return;
    const filteredIds = new Set(filteredClients.map(c => c.id));
    setSelectedClients(prev => {
      const next = new Set(prev);
      let changed = false;
      prev.forEach(id => {
        if (!filteredIds.has(id)) {
          next.delete(id);
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [filteredClients]);

  // Import handlers
  const handleImportFileSelect = useCallback((data: any[], file: File) => {
    setImportFile(file);
    
    // Map columns to client fields - handle multiple possible column names
    const columnMappings: ColumnMapping[] = [];
    
    // Find all possible column names from the data
    const allColumns = new Set<string>();
    data.forEach(row => {
      Object.keys(row).forEach(key => allColumns.add(key));
    });
    
    // Create mappings for each possible column name
    allColumns.forEach(col => {
      const colLower = col.toLowerCase();
      if (colLower.includes('name') && !colLower.includes('email') && !colLower.includes('phone')) {
        columnMappings.push({ sourceColumn: col, targetField: 'name', required: true });
      } else if (colLower.includes('email')) {
        columnMappings.push({ sourceColumn: col, targetField: 'email' });
      } else if (colLower.includes('phone')) {
        columnMappings.push({ sourceColumn: col, targetField: 'phone' });
      } else if (colLower.includes('street') || colLower.includes('address')) {
        columnMappings.push({ sourceColumn: col, targetField: 'addressJson.street' });
      } else if (colLower.includes('city')) {
        columnMappings.push({ sourceColumn: col, targetField: 'addressJson.city' });
      } else if (colLower.includes('state')) {
        columnMappings.push({ sourceColumn: col, targetField: 'addressJson.state' });
      } else if (colLower.includes('zip') || colLower.includes('postal')) {
        columnMappings.push({ sourceColumn: col, targetField: 'addressJson.zip' });
      } else if (colLower.includes('country')) {
        columnMappings.push({ sourceColumn: col, targetField: 'addressJson.country' });
      } else if (colLower.includes('note')) {
        columnMappings.push({ sourceColumn: col, targetField: 'notes' });
      }
    });

    // Transform data - map columns to fields
    const transformed = data.map(row => {
      const mapped: any = { addressJson: {} };
      columnMappings.forEach(mapping => {
        if (row[mapping.sourceColumn] !== undefined && row[mapping.sourceColumn] !== null && row[mapping.sourceColumn] !== '') {
          if (mapping.targetField.startsWith('addressJson.')) {
            const field = mapping.targetField.split('.')[1];
            mapped.addressJson[field] = row[mapping.sourceColumn];
          } else {
            mapped[mapping.targetField] = row[mapping.sourceColumn];
          }
        }
      });
      return mapped;
    });

    // Validate
    const valid: Partial<Client>[] = [];
    const invalid: Array<{ row: number; data: any; errors: string[] }> = [];
    
    transformed.forEach((row, index) => {
      const errors: string[] = [];
      if (!row.name || row.name.trim() === '') {
        errors.push('Name is required');
      }
      if (errors.length > 0) {
        invalid.push({ row: index + 2, data: row, errors });
      } else {
        valid.push(row);
      }
    });

    setImportResult({ valid, invalid });
    setImportPreviewOpen(true);
  }, []);

  const handleImportConfirm = useCallback(async () => {
    if (!importFile) return;
    
    setIsImporting(true);
    try {
      const result = await clientsApi.import(importFile);
      
      if (result.failed.length > 0) {
        showToast(
          `Imported ${result.created} client(s). ${result.failed.length} failed.`,
          'warning'
        );
      } else {
        showToast(`Successfully imported ${result.created} client(s)`, 'success');
      }
      
      // Refresh clients list
      refetchClients();
      queryClient.invalidateQueries({ queryKey: ['clients'], exact: false });
      
      setImportDialogOpen(false);
      setImportPreviewOpen(false);
      setImportResult(null);
      setImportFile(null);
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error, 'Failed to import clients', {
        operation: 'import',
        resource: 'clients',
      });
      showToast(errorMessage, 'error');
    } finally {
      setIsImporting(false);
    }
  }, [importFile, showToast, refetchClients, queryClient]);

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
      <Box 
        display="flex" 
        justifyContent="space-between" 
        alignItems="flex-start" 
        mb={4}
        sx={{
          flexDirection: { xs: 'column', sm: 'row' },
          gap: { xs: 2, sm: 0 },
        }}
      >
        <Box>
          <Box display="flex" alignItems="center" gap={1.5} mb={1.5}>
            <Box sx={{ 
              p: 1, 
              borderRadius: 2, 
              bgcolor: 'primary.main', 
              color: 'primary.contrastText',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <GroupsIcon sx={{ fontSize: 28 }} />
            </Box>
            <Box>
              <Typography 
                variant="h4" 
                component="h1" 
                sx={{ 
                  fontWeight: 700, 
                  fontSize: { xs: '1.5rem', sm: '1.75rem' }, 
                  lineHeight: 1.2, 
                  mb: 0.25 
                }} 
                id="page-title"
              >
                Clients
              </Typography>
              <Box 
                display="flex" 
                alignItems="center" 
                gap={1}
                sx={{
                  flexWrap: 'wrap',
                }}
              >
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem', fontWeight: 500 }}>
                  {stats.total} {stats.total === 1 ? 'client' : 'clients'} in your system
                  {filteredClients && filteredClients.length !== stats.total && (
                    <span> • {filteredClients.length} {filteredClients.length === 1 ? 'match' : 'matches'} your search</span>
                  )}
                </Typography>
                <Chip 
                  label="Live" 
                  size="small" 
                  sx={{ 
                    height: 20, 
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    bgcolor: 'success.main',
                    color: 'success.contrastText',
                    '& .MuiChip-label': { px: 1 },
                  }}
                  icon={
                    <Box
                      sx={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        bgcolor: 'success.contrastText',
                        animation: 'pulse 2s infinite',
                        '@keyframes pulse': {
                          '0%, 100%': { opacity: 1 },
                          '50%': { opacity: 0.5 },
                        },
                      }}
                    />
                  }
                />
              </Box>
            </Box>
          </Box>
        </Box>
        <Box 
          display="flex" 
          gap={1}
          sx={{
            width: { xs: '100%', sm: 'auto' },
            flexDirection: { xs: 'column', sm: 'row' },
          }}
        >
          <Tooltip title="Export all clients to CSV (Excel compatible)">
            <span>
              <Button
                variant="outlined"
                startIcon={isExporting ? <CircularProgress size={16} /> : <DownloadIcon />}
                onClick={async () => {
              if (!filteredClients || filteredClients.length === 0) {
                showToast('No clients to export', 'warning');
                return;
              }
              setIsExporting(true);
              const totalItems = filteredClients.length;
              const showProgress = totalItems > 100;
              
              if (showProgress) {
                setExportProgress({ open: true, current: 0, total: totalItems });
              }
              
              try {
                const exportData = filteredClients.map((client) => {
                  // Edge case: Handle invalid/missing client data
                  if (!client || typeof client !== 'object') {
                    return {
                      'Name': 'Invalid Client',
                      'Email': '',
                      'Phone': '',
                      'Company': '',
                      'Street': '',
                      'City': '',
                      'State': '',
                      'ZIP': '',
                      'Country': '',
                      'Full Address': '',
                      'Notes': '',
                      'Created': '',
                      'Last Updated': '',
                    };
                  }
                  
                  try {
                    // Edge case: Safe property access with fallbacks
                    const name = client.name && typeof client.name === 'string' ? client.name : '';
                    const email = client.email && typeof client.email === 'string' ? client.email : '';
                    const phone = client.phone && typeof client.phone === 'string' ? client.phone : '';
                    const notes = client.notes && typeof client.notes === 'string' ? client.notes : '';
                    
                    // Edge case: Safe address access
                    const address = client.addressJson && typeof client.addressJson === 'object' ? client.addressJson : null;
                    const street = address?.street && typeof address.street === 'string' ? address.street : '';
                    const city = address?.city && typeof address.city === 'string' ? address.city : '';
                    const state = address?.state && typeof address.state === 'string' ? address.state : '';
                    const zip = address?.zip && typeof address.zip === 'string' ? address.zip : '';
                    const country = address?.country && typeof address.country === 'string' ? address.country : '';
                    
                    // Edge case: Safe date formatting
                    const createdAt = client.createdAt ? formatDate(client.createdAt) : '';
                    const updatedAt = client.updatedAt ? formatDate(client.updatedAt) : '';
                    
                    // Edge case: Build full address safely
                    const fullAddress = [street, city, state, zip, country]
                      .filter(part => part && part.trim() !== '')
                      .join(', ') || '';
                    
                    return {
                      'Name': name,
                      'Email': email,
                      'Phone': phone,
                      'Street': street,
                      'City': city,
                      'State': state,
                      'ZIP': zip,
                      'Country': country,
                      'Full Address': fullAddress,
                      'Notes': notes,
                      'Created': createdAt,
                      'Last Updated': updatedAt,
                    };
                  } catch (error) {
                    // Edge case: If processing fails for a client, return minimal data
                    logger.warn('ClientsList: Error processing client for export', { clientId: client.id, error });
                    return {
                      'Name': client.name || 'Unknown',
                      'Email': '',
                      'Phone': '',
                      'Company': '',
                      'Street': '',
                      'City': '',
                      'State': '',
                      'ZIP': '',
                      'Country': '',
                      'Full Address': '',
                      'Notes': '',
                      'Created': '',
                      'Last Updated': '',
                    };
                  }
                });
                
                exportToCSV(exportData, {
                  filename: 'clients',
                  title: 'Clients Export',
                  description: 'Complete client contact and address information',
                  includeMetadata: true,
                  formatDates: true,
                  onProgress: showProgress ? (current, total) => {
                    setExportProgress({ open: true, current, total });
                  } : undefined,
                });
                
                if (showProgress) {
                  // Ensure progress shows 100% before closing
                  setExportProgress({ open: true, current: totalItems, total: totalItems });
                  // Close dialog after a brief delay to show completion
                  setTimeout(() => {
                    setExportProgress({ open: false, current: 0, total: 0 });
                  }, 500);
                }
                
                showToast('Clients exported successfully', 'success');
              } catch (error) {
                if (showProgress) {
                  setExportProgress({ open: false, current: 0, total: 0 });
                }
                const errorMessage = getErrorMessage(error, 'Failed to export clients', {
                  operation: 'export',
                  resource: 'clients',
                  context: { itemCount: filteredClients.length },
                });
                showToast(errorMessage, 'error');
              } finally {
                setIsExporting(false);
              }
            }}
            disabled={!filteredClients || filteredClients.length === 0 || isExporting}
            size="large"
            aria-label="Export clients to CSV"
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 600,
              minWidth: 140,
              borderWidth: 2,
              '&:hover': {
                borderWidth: 2,
                bgcolor: 'action.hover',
              },
            }}
          >
            {isExporting ? 'Exporting...' : 'Export CSV'}
          </Button>
            </span>
          </Tooltip>
          <Button
            variant="outlined"
            startIcon={<UploadFileIcon />}
            onClick={() => setImportDialogOpen(true)}
            size="large"
            sx={{ 
              minWidth: { xs: '100%', sm: 140 },
              width: { xs: '100%', sm: 'auto' },
            }}
          >
            Import
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/clients/create')}
            size="large"
            sx={{ 
              minWidth: { xs: '100%', sm: 140 },
              width: { xs: '100%', sm: 'auto' },
            }}
          >
            Add Client
          </Button>
        </Box>
      </Box>

      {/* Summary Cards */}
      {clients && clients.length > 0 && (
        <Grid container spacing={3} mb={0} sx={{ width: '100%', margin: 0 }}>
          <Grid item xs={6} sm={4} md={2.4} sx={{ display: 'flex', px: 0.5 }}>
            <Card 
              sx={{ 
                p: 2.5, 
                height: '100%',
                width: '100%',
                boxShadow: 2,
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'divider',
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  boxShadow: 4,
                  transform: 'translateY(-2px)',
                },
              }}
            >
              <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
                <Box display="flex" alignItems="center" gap={2}>
                  <Box sx={{ 
                    p: 1.5, 
                    borderRadius: 2, 
                    bgcolor: 'primary.main', 
                    color: 'primary.contrastText',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: 48,
                    height: 48,
                  }}>
                    <GroupsIcon sx={{ fontSize: 24 }} />
                  </Box>
                  <Box flex={1}>
                    <Typography variant="h4" fontWeight={700} sx={{ fontSize: '1.75rem', lineHeight: 1.2, mb: 0.5 }}>
                      {stats.total}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem', fontWeight: 500 }}>
                      Total Clients
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} sm={4} md={2.4} sx={{ display: 'flex', px: 0.5 }}>
            <Card 
              sx={{ 
                p: 2.5, 
                height: '100%',
                width: '100%',
                boxShadow: 2,
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'divider',
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  boxShadow: 4,
                  transform: 'translateY(-2px)',
                },
              }}
            >
              <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
                <Box display="flex" alignItems="center" gap={2}>
                  <Box sx={{ 
                    p: 1.5, 
                    borderRadius: 2, 
                    bgcolor: 'info.main', 
                    color: 'info.contrastText',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: 48,
                    height: 48,
                  }}>
                    <EmailIcon sx={{ fontSize: 24 }} />
                  </Box>
                  <Box flex={1}>
                    <Typography variant="h4" fontWeight={700} sx={{ fontSize: '1.75rem', lineHeight: 1.2, mb: 0.5 }}>
                      {stats.withEmail}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem', fontWeight: 500 }}>
                      With Email
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} sm={4} md={2.4} sx={{ display: 'flex', px: 0.5 }}>
            <Card 
              sx={{ 
                p: 2.5, 
                height: '100%',
                width: '100%',
                boxShadow: 2,
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'divider',
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  boxShadow: 4,
                  transform: 'translateY(-2px)',
                },
              }}
            >
              <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
                <Box display="flex" alignItems="center" gap={2}>
                  <Box sx={{ 
                    p: 1.5, 
                    borderRadius: 2, 
                    bgcolor: 'success.main', 
                    color: 'success.contrastText',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: 48,
                    height: 48,
                  }}>
                    <PhoneIcon sx={{ fontSize: 24 }} />
                  </Box>
                  <Box flex={1}>
                    <Typography variant="h4" fontWeight={700} sx={{ fontSize: '1.75rem', lineHeight: 1.2, mb: 0.5 }}>
                      {stats.withPhone}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem', fontWeight: 500 }}>
                      With Phone
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} sm={4} md={2.4} sx={{ display: 'flex', px: 0.5 }}>
            <Card 
              sx={{ 
                p: 2.5, 
                height: '100%',
                width: '100%',
                boxShadow: 2,
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'divider',
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  boxShadow: 4,
                  transform: 'translateY(-2px)',
                },
              }}
            >
              <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
                <Box display="flex" alignItems="center" gap={2}>
                  <Box sx={{ 
                    p: 1.5, 
                    borderRadius: 2, 
                    bgcolor: 'warning.main', 
                    color: 'warning.contrastText',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: 48,
                    height: 48,
                  }}>
                    <LocationOnIcon sx={{ fontSize: 24 }} />
                  </Box>
                  <Box flex={1}>
                    <Typography variant="h4" fontWeight={700} sx={{ fontSize: '1.75rem', lineHeight: 1.2, mb: 0.5 }}>
                      {stats.withAddress}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem', fontWeight: 500 }}>
                      With Address
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      <Paper sx={{ p: 2.5, mb: 3, mt: 3, borderRadius: 2, boxShadow: 1, border: '1px solid', borderColor: 'divider', position: 'relative' }}>
        <Box ref={searchHistoryAnchorRef}>
          <TextField
            inputRef={searchInputRef}
            fullWidth
            placeholder="Search clients by name, email, or any field..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            inputProps={{
              'aria-label': 'Search clients',
            }}
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
              endAdornment: (
                <InputAdornment position="end">
                  <Box display="flex" alignItems="center" gap={0.5}>
                    <IconButton
                      size="small"
                      onClick={() => setSearchHistoryOpen(!searchHistoryOpen)}
                      edge="end"
                      aria-label="Show search history"
                      sx={{ 
                        '&:hover': {
                          bgcolor: alpha(theme.palette.action.hover, 0.5),
                        },
                      }}
                    >
                      <HistoryIcon fontSize="small" />
                    </IconButton>
                    {searchInput && (
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
                    )}
                  </Box>
                </InputAdornment>
              ),
            }}
          />
        </Box>
        <SearchHistoryDropdown
          open={searchHistoryOpen}
          onClose={() => setSearchHistoryOpen(false)}
          onSelect={handleSearchHistorySelect}
          anchorEl={searchHistoryAnchorRef.current}
        />
      </Paper>

      <Box 
        display="flex" 
        gap={1} 
        mb={2}
        sx={{
          flexDirection: { xs: 'column', sm: 'row' },
          '& > *': {
            minWidth: { xs: '100%', sm: 'auto' },
          },
        }}
      >
        <Button
          variant="outlined"
          startIcon={<FilterListIcon />}
          onClick={() => setAdvancedFiltersOpen(true)}
          sx={{
            minWidth: { xs: '100%', sm: 160 },
            borderRadius: 2,
            whiteSpace: 'nowrap',
            borderColor: advancedFilters ? 'primary.main' : 'divider',
            bgcolor: advancedFilters ? 'primary.50' : 'transparent',
          }}
        >
          Advanced Filters
          {advancedFilters && (
            <Chip
              label="Active"
              size="small"
              sx={{
                ml: 1,
                height: 20,
                fontSize: '0.7rem',
                bgcolor: 'primary.main',
                color: 'primary.contrastText',
              }}
            />
          )}
        </Button>
        {(searchTerm || advancedFilters) && (
          <Button
            variant="outlined"
            startIcon={<ClearIcon />}
            onClick={() => {
              setSearchInput('');
              setSearchTerm('');
              setAdvancedFilters(null);
            }}
            sx={{
              minWidth: { xs: '100%', sm: 120 },
              borderRadius: 2,
              whiteSpace: 'nowrap',
            }}
          >
            Clear Filters
          </Button>
        )}
      </Box>

      <BulkActionsBar
        selectedCount={selectedClients.size}
        onDelete={handleBulkDelete}
        onClearSelection={handleClearSelection}
        isLoading={bulkDeleteClients.isPending}
        resourceName="clients"
      />


      <TableContainer 
        component={Paper} 
        sx={{ 
          borderRadius: 2, 
          boxShadow: 2,
          overflowX: 'auto',
          overflowY: 'auto',
          border: '1px solid',
          borderColor: 'divider',
          '&::-webkit-scrollbar': {
            height: 8,
            width: 8,
          },
          '&::-webkit-scrollbar-track': {
            backgroundColor: 'grey.100',
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: 'grey.400',
            borderRadius: 4,
            '&:hover': {
              backgroundColor: 'grey.500',
            },
          },
        }}
      >
        <Table 
          sx={{ 
            '& .MuiTableCell-root': { 
              py: { xs: 1, sm: 1.5 },
              whiteSpace: { xs: 'nowrap', sm: 'normal' },
              fontSize: { xs: '0.75rem', sm: '0.875rem' },
            },
            minWidth: { xs: 800, sm: 'auto' },
            '& .MuiTableRow-root': {
              '&:hover': {
                bgcolor: { xs: 'transparent', sm: 'action.hover' }, // Disable hover on mobile for better touch
              },
            },
          }}
        >
          <TableHead>
            <TableRow sx={{ bgcolor: 'grey.50', borderBottom: '2px solid', borderColor: 'divider' }}>
              <TableCell padding="checkbox" sx={{ fontWeight: 700, py: 2, px: 2.5 }}>
                <Checkbox
                  indeterminate={selectedClients.size > 0 && selectedClients.size < (filteredClients?.length || 0)}
                  checked={filteredClients && filteredClients.length > 0 && filteredClients.every(client => selectedClients.has(client.id))}
                  onChange={handleSelectAll}
                  inputProps={{ 'aria-label': 'select all clients' }}
                />
              </TableCell>
              <TableCell sx={{ fontWeight: 700, py: 2, px: 2.5, fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'text.secondary' }}>
                <Box display="flex" alignItems="center" gap={0.75}>
                  <PersonIcon fontSize="small" sx={{ color: 'primary.main' }} />
                  Name
                </Box>
              </TableCell>
              <TableCell 
                sx={{ 
                  fontWeight: 700, 
                  py: 2, 
                  px: 2.5, 
                  fontSize: '0.875rem', 
                  textTransform: 'uppercase', 
                  letterSpacing: '0.5px', 
                  color: 'text.secondary',
                  display: preferences.email?.visible === false ? 'none' : { xs: 'none', sm: 'table-cell' },
                }}
              >
                <Box display="flex" alignItems="center" gap={0.75}>
                  <EmailIcon fontSize="small" sx={{ color: 'primary.main' }} />
                  Email
                </Box>
              </TableCell>
              <TableCell 
                sx={{ 
                  fontWeight: 700, 
                  py: 2, 
                  px: 2.5, 
                  fontSize: '0.875rem', 
                  textTransform: 'uppercase', 
                  letterSpacing: '0.5px', 
                  color: 'text.secondary',
                  display: preferences.phone?.visible === false ? 'none' : 'table-cell',
                }}
              >
                <Box display="flex" alignItems="center" gap={0.75}>
                  <PhoneIcon fontSize="small" sx={{ color: 'primary.main' }} />
                  Phone
                </Box>
              </TableCell>
              <TableCell 
                sx={{ 
                  fontWeight: 700, 
                  py: 2, 
                  px: 2.5, 
                  fontSize: '0.875rem', 
                  textTransform: 'uppercase', 
                  letterSpacing: '0.5px', 
                  color: 'text.secondary',
                  display: preferences.address?.visible === false ? 'none' : { xs: 'none', md: 'table-cell' },
                }}
              >
                <Box display="flex" alignItems="center" gap={0.75}>
                  <LocationOnIcon fontSize="small" sx={{ color: 'primary.main' }} />
                  Address
                </Box>
              </TableCell>
              <TableCell 
                sx={{ 
                  fontWeight: 700, 
                  py: 2, 
                  px: 2.5, 
                  fontSize: '0.875rem', 
                  textTransform: 'uppercase', 
                  letterSpacing: '0.5px', 
                  color: 'text.secondary',
                  display: preferences.created?.visible === false ? 'none' : { xs: 'none', sm: 'table-cell' },
                }}
              >
                <Box display="flex" alignItems="center" gap={0.75}>
                  <CalendarTodayIcon fontSize="small" sx={{ color: 'primary.main' }} />
                  Created
                </Box>
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 700, py: 2, px: 2.5, fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'text.secondary' }}>
                Actions
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredClients && filteredClients.length > 0 ? (
              filteredClients.map((client) => (
                <TableRow 
                  key={client.id} 
                  hover
                  tabIndex={0}
                  role="button"
                  aria-label={`View details for ${client.name}`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      // Edge case: Validate client ID before navigation
                      if (client.id && typeof client.id === 'string') {
                        try {
                          navigate(`/clients/${client.id}`);
                        } catch (error) {
                          logger.error('ClientsList: Error navigating to client (keyboard)', { clientId: client.id, error });
                          showToast('Error opening client details', 'error');
                        }
                      } else {
                        logger.warn('ClientsList: Invalid client ID for navigation (keyboard)', client);
                        showToast('Invalid client data', 'error');
                      }
                    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                      // Arrow key navigation between rows
                      e.preventDefault();
                      const rows = Array.from(document.querySelectorAll('tbody tr[role="button"]'));
                      const currentIndex = rows.findIndex(row => row === e.currentTarget);
                      if (currentIndex !== -1) {
                        const nextIndex = e.key === 'ArrowDown' 
                          ? Math.min(currentIndex + 1, rows.length - 1)
                          : Math.max(currentIndex - 1, 0);
                        (rows[nextIndex] as HTMLElement)?.focus();
                      }
                    }
                  }}
                  sx={{ 
                    '&:hover': { 
                      bgcolor: 'action.hover',
                      cursor: 'pointer',
                    },
                    '&:focus-visible': {
                      outline: '2px solid',
                      outlineColor: 'primary.main',
                      outlineOffset: -2,
                    },
                    transition: 'background-color 0.2s ease',
                  }}
                  onClick={() => {
                    // Edge case: Validate client ID before navigation
                    if (client.id && typeof client.id === 'string') {
                      try {
                        navigate(`/clients/${client.id}`);
                      } catch (error) {
                        logger.error('ClientsList: Error navigating to client', { clientId: client.id, error });
                        showToast('Error opening client details', 'error');
                      }
                    } else {
                      logger.warn('ClientsList: Invalid client ID for navigation', client);
                      showToast('Invalid client data', 'error');
                    }
                  }}
                >
                  <TableCell padding="checkbox" sx={{ px: 2.5, py: 2 }} onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedClients.has(client.id)}
                      onChange={() => handleSelectClient(client.id)}
                      inputProps={{ 'aria-label': `select ${client.name}` }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </TableCell>
                  <TableCell sx={{ px: 2.5, py: 2 }}>
                    <Box display="flex" alignItems="center" gap={1.5}>
                      <Avatar 
                        sx={{ 
                          bgcolor: 'primary.main', 
                          width: 40, 
                          height: 40,
                          fontSize: '1rem',
                          fontWeight: 600,
                          boxShadow: 2,
                        }}
                      >
                        {/* Edge case: Safe character extraction */}
                        {client.name && typeof client.name === 'string' && client.name.length > 0
                          ? client.name.charAt(0).toUpperCase()
                          : '?'}
                      </Avatar>
                      <Box flex={1} minWidth={0}>
                        <Typography 
                          variant="body1" 
                          fontWeight={600}
                          sx={{
                            fontSize: '0.9375rem',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            mb: 0.25,
                          }}
                          title={client.name}
                        >
                          {client.name}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell 
                    sx={{ 
                      px: 2.5, 
                      py: 2,
                      display: preferences.email?.visible === false ? 'none' : { xs: 'none', sm: 'table-cell' },
                    }}
                  >
                    {client.email ? (
                      <Box display="flex" alignItems="center" gap={1}>
                        <EmailIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                        <Typography 
                          variant="body2" 
                          sx={{ 
                            fontSize: '0.875rem',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            maxWidth: 250,
                            fontWeight: 500,
                          }}
                          title={client.email}
                        >
                          {client.email}
                        </Typography>
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem', fontStyle: 'italic' }}>
                        No email
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell 
                    sx={{ 
                      px: 2.5, 
                      py: 2,
                      display: preferences.phone?.visible === false ? 'none' : 'table-cell',
                    }}
                  >
                    {client.phone ? (
                      <Tooltip title={client.phone} arrow>
                        <Box display="flex" alignItems="center" gap={1}>
                          <PhoneIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                          <Typography 
                            variant="body2" 
                            sx={{ fontSize: '0.875rem', fontWeight: 500 }}
                            title={client.phone}
                          >
                            {formatPhoneNumber(client.phone)}
                          </Typography>
                        </Box>
                      </Tooltip>
                    ) : (
                      <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem', fontStyle: 'italic' }}>
                        No phone
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell 
                    sx={{ 
                      px: 2.5, 
                      py: 2,
                      display: preferences.address?.visible === false ? 'none' : { xs: 'none', md: 'table-cell' },
                    }}
                  >
                    {client.addressJson && formatAddressSingleLine(client.addressJson) ? (
                      <Tooltip 
                        title={formatAddressSingleLine(client.addressJson)}
                        arrow
                        placement="top"
                      >
                        <Box display="flex" alignItems="center" gap={1}>
                          <LocationOnIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                          <Typography 
                            variant="body2" 
                            sx={{ 
                              fontSize: '0.875rem',
                              fontWeight: 500,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              maxWidth: 200,
                            }}
                            title={formatAddressSingleLine(client.addressJson)}
                          >
                            {formatAddressSingleLine(client.addressJson)}
                          </Typography>
                        </Box>
                      </Tooltip>
                    ) : (
                      <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem', fontStyle: 'italic' }}>
                        No address
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell 
                    sx={{ 
                      px: 2.5, 
                      py: 2,
                      display: preferences.created?.visible === false ? 'none' : { xs: 'none', sm: 'table-cell' },
                    }}
                  >
                    <Box display="flex" alignItems="center" gap={1}>
                      <CalendarTodayIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                      <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem', fontWeight: 500 }}>
                        {/* Edge case: Safe date formatting */}
                        {client.createdAt ? formatDate(client.createdAt) : 'N/A'}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell align="right" sx={{ px: 2.5, py: 2 }} onClick={(e) => e.stopPropagation()}>
                    <Box display="flex" gap={1} justifyContent="flex-end">
                      <Tooltip title="View Details" arrow>
                        <IconButton
                          size="medium"
                          onClick={(e) => {
                            e.stopPropagation();
                            // Edge case: Validate client ID before navigation
                            if (client.id && typeof client.id === 'string') {
                              try {
                                navigate(`/clients/${client.id}`);
                              } catch (error) {
                                logger.error('ClientsList: Error navigating to client details', { clientId: client.id, error });
                                showToast('Error opening client details', 'error');
                              }
                            } else {
                              logger.warn('ClientsList: Invalid client ID for view', client);
                              showToast('Invalid client data', 'error');
                            }
                          }}
                          sx={{ 
                            '&:hover': { 
                              bgcolor: 'primary.main',
                              color: 'primary.contrastText',
                              transform: 'scale(1.1)',
                            },
                            transition: 'all 0.2s',
                          }}
                        >
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Edit Client" arrow>
                        <IconButton
                          size="medium"
                          onClick={(e) => {
                            e.stopPropagation();
                            // Edge case: Validate client ID before navigation
                            if (client.id && typeof client.id === 'string') {
                              try {
                                navigate(`/clients/${client.id}/edit`);
                              } catch (error) {
                                logger.error('ClientsList: Error navigating to edit client', { clientId: client.id, error });
                                showToast('Error opening client editor', 'error');
                              }
                            } else {
                              logger.warn('ClientsList: Invalid client ID for edit', client);
                              showToast('Invalid client data', 'error');
                            }
                          }}
                          sx={{ 
                            '&:hover': { 
                              bgcolor: 'action.hover',
                              transform: 'scale(1.1)',
                            },
                            transition: 'all 0.2s',
                          }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete Client" arrow>
                        <IconButton
                          size="medium"
                          onClick={(e) => {
                            e.stopPropagation();
                            // Edge case: Validate client ID before deletion
                            if (client.id && typeof client.id === 'string') {
                              handleDeleteClick(client.id);
                            } else {
                              logger.warn('ClientsList: Invalid client ID for deletion', client);
                              showToast('Invalid client data', 'error');
                            }
                          }}
                          color="error"
                          sx={{ 
                            '&:hover': { 
                              bgcolor: 'error.main',
                              color: 'error.contrastText',
                              transform: 'scale(1.1)',
                            },
                            transition: 'all 0.2s',
                          }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 8 }}>
                  <EmptyState
                    icon={<PersonIcon sx={{ fontSize: 64, color: 'text.disabled' }} />}
                    title={searchTerm ? 'No clients found' : 'No clients yet'}
                    description={
                      searchTerm 
                        ? 'Try adjusting your search criteria or clear filters to see all clients' 
                        : 'Get started by adding your first client to manage contacts and invoices'
                    }
                    action={!searchTerm ? {
                      label: 'Add Your First Client',
                      onClick: () => navigate('/clients/create'),
                      icon: <AddIcon />,
                    } : {
                      label: 'Clear Search',
                      onClick: () => {
                        setSearchInput('');
                        setSearchTerm('');
                        setAdvancedFilters(null);
                      },
                    }}
                    secondaryAction={!searchTerm ? {
                      label: 'Import Clients',
                      onClick: () => setImportDialogOpen(true),
                    } : undefined}
                    onboardingTips={!searchTerm ? [
                      'Clients are the companies or people you send invoices to',
                      'Add contact information to make invoicing faster',
                      'You can import multiple clients from a CSV file',
                      'Link clients to stores for better organization',
                    ] : undefined}
                    variant="minimal"
                  />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <ConfirmDialog
        open={deleteConfirmOpen}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        title="Delete Client"
        message="Are you sure you want to delete this client? This action cannot be undone. If this client has associated invoices, deletion may be prevented."
        confirmText="Delete"
        cancelText="Cancel"
        confirmColor="error"
        loading={deleteClient.isPending}
        severity="error"
      />

      <ConfirmDialog
        open={bulkDeleteConfirmOpen}
        onClose={handleBulkDeleteCancel}
        onConfirm={handleBulkDeleteConfirm}
        title="Delete Multiple Clients"
        message={`Are you sure you want to delete ${selectedClients.size} client(s)? This action cannot be undone. Clients with associated invoices will not be deleted.`}
        confirmText={`Delete ${selectedClients.size}`}
        cancelText="Cancel"
        confirmColor="error"
        loading={bulkDeleteClients.isPending}
        severity="error"
      />

      <ExportProgressDialog
        open={exportProgress.open}
        current={exportProgress.current}
        total={exportProgress.total}
        filename="clients"
        onCancel={() => {
          setExportProgress({ open: false, current: 0, total: 0 });
          setIsExporting(false);
        }}
      />

      <AdvancedFilters
        open={advancedFiltersOpen}
        onClose={() => setAdvancedFiltersOpen(false)}
        onApply={(filters) => {
          setAdvancedFilters(filters);
        }}
        dateRangeFields={[
          { field: 'createdAt', label: 'Created Date' },
          { field: 'updatedAt', label: 'Updated Date' },
        ]}
        initialFilters={advancedFilters || undefined}
      />

      <ImportDialog
        open={importDialogOpen}
        onClose={() => {
          setImportDialogOpen(false);
          setImportFile(null);
        }}
        onFileSelect={(data, file) => {
          handleImportFileSelect(data, file);
        }}
        acceptedFormats={['.csv', '.xlsx', '.xls']}
        maxFileSize={10}
      />

      {importResult && (
        <ImportPreview
          open={importPreviewOpen}
          onClose={() => {
            setImportPreviewOpen(false);
            setImportResult(null);
            setImportFile(null);
          }}
          onConfirm={handleImportConfirm}
          result={importResult}
          isLoading={isImporting}
        />
      )}
    </Box>
  );
};

export default ClientsList;

