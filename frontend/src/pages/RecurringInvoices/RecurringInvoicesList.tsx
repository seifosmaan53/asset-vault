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
  IconButton,
  CircularProgress,
  Chip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { useRecurringInvoices, useDeleteRecurringInvoice } from '../../hooks/useRecurringInvoices';
import { useClients } from '../../hooks/useClients';
import { formatDate } from '../../utils/dates';
import { useToast } from '../../contexts/ToastContext';

const RecurringInvoicesList = () => {
  const navigate = useNavigate();
  const { data: recurringInvoices, isLoading } = useRecurringInvoices();
  const { data: clients } = useClients();
  const deleteRecurringInvoice = useDeleteRecurringInvoice();
  const { showToast } = useToast();

  const getClientName = (clientId: string) => {
    const client = clients?.find((c) => c.id === clientId);
    return client?.name || clientId;
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this recurring invoice?')) {
      try {
        await deleteRecurringInvoice.mutateAsync(id);
        showToast('Recurring invoice deleted successfully', 'success');
      } catch (error: any) {
        showToast(error.response?.data?.message || 'Failed to delete recurring invoice', 'error');
      }
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
          Recurring Invoices
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/recurring-invoices/create')}
        >
          Create Recurring Invoice
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Client</TableCell>
              <TableCell>Frequency</TableCell>
              <TableCell>Next Run</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Invoices Generated</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {recurringInvoices && recurringInvoices.length > 0 ? (
              recurringInvoices.map((recurring) => (
                <TableRow key={recurring.id} hover>
                  <TableCell>{recurring.name}</TableCell>
                  <TableCell>{getClientName(recurring.clientId)}</TableCell>
                  <TableCell>
                    {recurring.frequency} (every {recurring.interval})
                  </TableCell>
                  <TableCell>{formatDate(recurring.nextRunDate)}</TableCell>
                  <TableCell>
                    <Chip
                      label={recurring.isActive ? 'Active' : 'Inactive'}
                      color={recurring.isActive ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>{recurring.invoicesGenerated}</TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={() => navigate(`/recurring-invoices/${recurring.id}`)}
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleDelete(recurring.id)}
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
                  No recurring invoices found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default RecurringInvoicesList;

