import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  CircularProgress,
  Divider,
  Skeleton,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import StoreIcon from '@mui/icons-material/Store';
import VisibilityIcon from '@mui/icons-material/Visibility';
import Grid from "../../components/common/Grid";
import { useClient } from '../../hooks/useClients';
import { useRecentItems } from '../../hooks/useRecentItems';
import { formatDate } from '../../utils/dates';
import { logger } from '../../utils/logger';
import { useToast } from '../../contexts/ToastContext';
import { useInvoices } from '../../hooks/useInvoices';
import { formatCurrency } from '../../utils/formatters';
import ReceiptIcon from '@mui/icons-material/Receipt';
import { useMemo } from 'react';
import { Breadcrumbs } from '../../components/common/Breadcrumbs';

const ClientDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: client, isLoading, refetch: refetchClient } = useClient(id || '');
  const { trackView } = useRecentItems();
  const { showToast } = useToast();
  const previousLocationRef = useRef<string>(location.pathname);
  const { data: allInvoices } = useInvoices();
  
  // Filter invoices for this client
  const clientInvoices = useMemo(() => {
    if (!allInvoices || !id) return [];
    return allInvoices.filter(invoice => invoice.clientId === id);
  }, [allInvoices, id]);

  // Track client view in recent items
  useEffect(() => {
    if (client && id) {
      trackView(id, 'client', client.name, `/clients/${id}`);
    }
  }, [client, id, trackView]);

  // Refetch client data when returning from store creation
  useEffect(() => {
    // Check if we're returning from store creation page
    const isReturningFromStoreCreation = 
      previousLocationRef.current !== location.pathname &&
      previousLocationRef.current.includes('/stores/new');
    
    if (isReturningFromStoreCreation && id) {
      // Refetch client to get updated stores list
      refetchClient().catch((error) => {
        logger.error('Error refetching client after store creation:', error);
        showToast('Failed to refresh client data', 'error');
      });
    }
    
    // Update previous location
    previousLocationRef.current = location.pathname;
  }, [location.pathname, id, refetchClient]);

  if (isLoading) {
    return (
      <Box>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Box display="flex" alignItems="center" gap={2}>
            <Skeleton variant="rectangular" width={100} height={40} />
            <Skeleton variant="text" width={200} height={40} />
          </Box>
          <Skeleton variant="rectangular" width={130} height={40} />
        </Box>
        <Grid container spacing={3}>
          {[1, 2, 3].map((i) => (
            <Grid item xs={12} md={6} key={i}>
              <Paper sx={{ p: 3 }}>
                <Skeleton variant="text" width={150} height={30} />
                <Divider sx={{ mb: 2, mt: 1 }} />
                <Skeleton variant="rectangular" width="100%" height={150} />
              </Paper>
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  if (!client) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '400px',
          gap: 2,
        }}
      >
        <Typography variant="h5" color="text.secondary">
          Client not found
        </Typography>
        <Button variant="outlined" onClick={() => navigate('/clients')}>
          Back to Clients
        </Button>
      </Box>
    );
  }

  return (
    <Box component="main">
      <Breadcrumbs
        items={[
          { label: 'Clients', path: '/clients' },
          { label: client.name },
        ]}
      />
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box display="flex" alignItems="center" gap={2}>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate('/clients')}
            variant="outlined"
            size="large"
            aria-label="Back to clients list"
          >
            Back
          </Button>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 600 }}>
            {client.name}
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<EditIcon />}
          onClick={() => {
            if (id) {
              navigate(`/clients/${id}/edit`);
            }
          }}
          disabled={!id}
          size="large"
          aria-label="Edit client"
        >
          Edit Client
        </Button>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Contact Information
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Typography variant="body2" color="text.secondary">
                  Name
                </Typography>
                <Typography variant="body1" fontWeight="bold">
                  {client.name}
                </Typography>
              </Grid>
              {client.email && (
                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary">
                    Email
                  </Typography>
                  <Typography variant="body1">{client.email}</Typography>
                </Grid>
              )}
              {client.phone && (
                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary">
                    Phone
                  </Typography>
                  <Typography variant="body1">{client.phone}</Typography>
                </Grid>
              )}
            </Grid>
          </Paper>
        </Grid>

        {client.addressJson && (
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Address
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Typography variant="body1">
                {client.addressJson.street}
                <br />
                {client.addressJson.city}, {client.addressJson.state} {client.addressJson.zip}
                <br />
                {client.addressJson.country}
              </Typography>
            </Paper>
          </Grid>
        )}

        {client.notes && (
          <Grid item xs={12}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Notes
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                {client.notes}
              </Typography>
            </Paper>
          </Grid>
        )}

        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Box display="flex" alignItems="center" gap={1}>
                <StoreIcon color="primary" />
                <Typography variant="h6" gutterBottom sx={{ mb: 0 }}>
                  Associated Stores
                </Typography>
                {client.stores && client.stores.length > 0 && (
                  <Chip
                    label={client.stores.length}
                    size="small"
                    color="primary"
                    sx={{ ml: 1 }}
                  />
                )}
              </Box>
              <Button
                variant="outlined"
                size="small"
                startIcon={<StoreIcon />}
                onClick={() => navigate('/stores/new')}
              >
                Add Store
              </Button>
            </Box>
            <Divider sx={{ mb: 2 }} />
            {client.stores && client.stores.length > 0 ? (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>Store Name</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Code</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Location</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 600 }}>Status</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {client.stores.map((store) => (
                      <TableRow key={store.id} hover>
                        <TableCell>
                          <Box display="flex" alignItems="center" gap={1}>
                            <StoreIcon fontSize="small" color="action" />
                            <Typography variant="body2" fontWeight={500}>
                              {store.name}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={store.code}
                            size="small"
                            sx={{
                              fontFamily: 'monospace',
                              fontWeight: 600,
                              bgcolor: 'primary.50',
                              color: 'primary.main',
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {store.city || store.state
                              ? [store.city, store.state].filter(Boolean).join(', ')
                              : store.address
                              ? store.address.substring(0, 30) + (store.address.length > 30 ? '...' : '')
                              : '-'}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            label={store.active ? 'Active' : 'Inactive'}
                            size="small"
                            color={store.active ? 'success' : 'default'}
                            sx={{ fontWeight: 500 }}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <IconButton
                            size="small"
                            onClick={() => navigate(`/stores/${store.id}`)}
                            title="View store details"
                          >
                            <VisibilityIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Box
                sx={{
                  textAlign: 'center',
                  py: 4,
                  color: 'text.secondary',
                }}
              >
                <StoreIcon sx={{ fontSize: 48, opacity: 0.3, mb: 1 }} />
                <Typography variant="body1" gutterBottom>
                  No stores associated with this client
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Create a new store and assign it to this client
                </Typography>
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<StoreIcon />}
                  onClick={() => navigate('/stores/new')}
                >
                  Create Store
                </Button>
              </Box>
            )}
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Box display="flex" alignItems="center" gap={1}>
                <ReceiptIcon color="primary" />
                <Typography variant="h6" gutterBottom sx={{ mb: 0 }}>
                  Associated Invoices
                </Typography>
                {clientInvoices && clientInvoices.length > 0 && (
                  <Chip
                    label={clientInvoices.length}
                    size="small"
                    color="primary"
                    sx={{ ml: 1 }}
                  />
                )}
              </Box>
              <Button
                variant="outlined"
                size="small"
                startIcon={<ReceiptIcon />}
                onClick={() => navigate('/invoices/create')}
              >
                Create Invoice
              </Button>
            </Box>
            <Divider sx={{ mb: 2 }} />
            {clientInvoices && clientInvoices.length > 0 ? (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>Invoice Number</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Date</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Type</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>Amount</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {clientInvoices.map((invoice) => (
                      <TableRow key={invoice.id} hover>
                        <TableCell>
                          <Box display="flex" alignItems="center" gap={1}>
                            <ReceiptIcon fontSize="small" color="action" />
                            <Typography variant="body2" fontWeight={500}>
                              {invoice.number}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {formatDate(invoice.issueDate)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={invoice.status}
                            size="small"
                            color={
                              invoice.status === 'paid'
                                ? 'success'
                                : invoice.status === 'overdue'
                                ? 'error'
                                : invoice.status === 'sent'
                                ? 'info'
                                : 'default'
                            }
                            sx={{ fontWeight: 500 }}
                          />
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={invoice.type}
                            size="small"
                            variant="outlined"
                            sx={{ fontWeight: 500 }}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" fontWeight={600}>
                            {formatCurrency(invoice.total, invoice.currency)}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <IconButton
                            size="small"
                            onClick={() => navigate(`/invoices/${invoice.id}`)}
                            title="View invoice details"
                          >
                            <VisibilityIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Box
                sx={{
                  textAlign: 'center',
                  py: 4,
                  color: 'text.secondary',
                }}
              >
                <ReceiptIcon sx={{ fontSize: 48, opacity: 0.3, mb: 1 }} />
                <Typography variant="body1" gutterBottom>
                  No invoices associated with this client
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Create a new invoice for this client
                </Typography>
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<ReceiptIcon />}
                  onClick={() => navigate('/invoices/create')}
                >
                  Create Invoice
                </Button>
              </Box>
            )}
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Additional Information
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Typography variant="body2" color="text.secondary">
                  Created
                </Typography>
                <Typography variant="body1">{formatDate(client.createdAt)}</Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="body2" color="text.secondary">
                  Last Updated
                </Typography>
                <Typography variant="body1">{formatDate(client.updatedAt)}</Typography>
              </Grid>
            </Grid>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ClientDetail;

