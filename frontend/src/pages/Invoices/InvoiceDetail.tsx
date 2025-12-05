import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Tooltip,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DownloadIcon from '@mui/icons-material/Download';
import PreviewIcon from '@mui/icons-material/Preview';
import { useInvoice, useUpdateInvoice } from '../../hooks/useInvoices';
import { formatCurrency } from '../../utils/formatters';
import { formatDate } from '../../utils/dates';
import { InvoiceStatus } from '../../types/invoice';
import { useToast } from '../../contexts/ToastContext';
import { invoicesApi } from '../../api/invoices';
import EmailIcon from '@mui/icons-material/Email';
import TransformIcon from '@mui/icons-material/Transform';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

const InvoiceDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: invoice, isLoading } = useInvoice(id || '');
  const updateInvoice = useUpdateInvoice();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

  const handleMarkAsPaid = async () => {
    try {
      if (invoice && id) {
        await updateInvoice.mutateAsync({
          id,
          data: {
            status: 'paid',
            paidAt: new Date().toISOString(),
          },
        });
        showToast('Invoice marked as paid', 'success');
      }
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to update invoice', 'error');
    }
  };

  const handleStatusChange = async (status: InvoiceStatus) => {
    if (status === 'cancelled') {
      setCancelDialogOpen(true);
      return;
    }
    
    try {
      if (invoice && id) {
        await updateInvoice.mutateAsync({
          id,
          data: { status },
        });
        showToast(`Invoice status updated to ${status}`, 'success');
      }
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to update status', 'error');
    }
  };

  const handleConfirmCancel = async () => {
    try {
      if (invoice && id) {
        await updateInvoice.mutateAsync({
          id,
          data: { status: 'cancelled' },
        });
        showToast('Invoice cancelled', 'success');
        setCancelDialogOpen(false);
      }
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to cancel invoice', 'error');
    }
  };

  const handleSendEmail = async () => {
    if (!id) return;
    try {
      await invoicesApi.sendEmail(id);
      showToast('Invoice email sent successfully', 'success');
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to send email', 'error');
    }
  };

  const handleConvertToInvoice = async () => {
    if (!id) return;
    try {
      await invoicesApi.convertToInvoice(id);
      queryClient.invalidateQueries({ queryKey: ['invoices', id] });
      showToast('Estimate converted to invoice successfully', 'success');
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to convert estimate', 'error');
    }
  };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (!invoice) {
    return <Typography>Invoice not found</Typography>;
  }

  const getStatusColor = (status: InvoiceStatus) => {
    switch (status) {
      case 'paid':
        return 'success';
      case 'overdue':
        return 'error';
      case 'sent':
        return 'info';
      case 'draft':
        return 'default';
      default:
        return 'default';
    }
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" component="h1">
            {invoice.number}
          </Typography>
          <Chip
            label={invoice.status}
            color={getStatusColor(invoice.status)}
            sx={{ mt: 1 }}
          />
        </Box>
        <Box display="flex" gap={2}>
          <Button
            variant="outlined"
            startIcon={<PreviewIcon />}
            onClick={() => navigate(`/invoices/${id}/preview`)}
          >
            Preview
          </Button>
          {invoice.status !== 'draft' && invoice.client?.email && (
            <Button
              variant="outlined"
              startIcon={<EmailIcon />}
              onClick={handleSendEmail}
            >
              Send Email
            </Button>
          )}
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={async () => {
              if (!id) return;
              try {
                const { invoicesApi } = await import('../../api/invoices');
                const blob = await invoicesApi.generatePdf(id);
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `invoice-${invoice?.number || id}.pdf`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
                showToast('PDF downloaded successfully', 'success');
              } catch (error: any) {
                showToast(error.response?.data?.message || 'Failed to generate PDF', 'error');
              }
            }}
          >
            Download PDF
          </Button>
          <Button
            variant="outlined"
            startIcon={<EditIcon />}
            onClick={() => navigate(`/invoices/${id}/edit`)}
          >
            Edit
          </Button>
          {invoice.type === 'estimate' && (
            <Button
              variant="contained"
              startIcon={<TransformIcon />}
              onClick={handleConvertToInvoice}
            >
              Convert to Invoice
            </Button>
          )}
          {invoice.status === 'sent' && (
            <Tooltip title="Mark this invoice as manually paid. This is a manual status update - no online payment processing is performed.">
              <Button variant="contained" onClick={handleMarkAsPaid}>
                Mark as Paid
              </Button>
            </Tooltip>
          )}
        </Box>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Client Information
            </Typography>
            <Typography variant="body1" fontWeight="bold">
              {invoice.client?.name}
            </Typography>
            {invoice.client?.email && (
              <Typography variant="body2" color="text.secondary">
                {invoice.client.email}
              </Typography>
            )}
            {invoice.client?.phone && (
              <Typography variant="body2" color="text.secondary">
                {invoice.client.phone}
              </Typography>
            )}
            {invoice.client?.addressJson && (
              <Box mt={1}>
                <Typography variant="body2" color="text.secondary">
                  {invoice.client.addressJson.street}
                  <br />
                  {invoice.client.addressJson.city}, {invoice.client.addressJson.state}{' '}
                  {invoice.client.addressJson.zip}
                  <br />
                  {invoice.client.addressJson.country}
                </Typography>
              </Box>
            )}
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Invoice Details
            </Typography>
            <Grid container spacing={1}>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">
                  Type:
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2">{invoice.type}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">
                  Issue Date:
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2">{formatDate(invoice.issueDate)}</Typography>
              </Grid>
              {invoice.dueDate && (
                <>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      Due Date:
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2">{formatDate(invoice.dueDate)}</Typography>
                  </Grid>
                </>
              )}
              {invoice.paidAt && (
                <>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      Paid At:
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2">{formatDate(invoice.paidAt)}</Typography>
                  </Grid>
                </>
              )}
            </Grid>
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Line Items
            </Typography>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Description</TableCell>
                    <TableCell align="right">Quantity</TableCell>
                    <TableCell align="right">Unit Price</TableCell>
                    <TableCell align="right">Tax %</TableCell>
                    <TableCell align="right">Discount %</TableCell>
                    <TableCell align="right">Total</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {invoice.items && invoice.items.length > 0 ? (
                    invoice.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.description}</TableCell>
                        <TableCell align="right">{item.quantity}</TableCell>
                        <TableCell align="right">
                          {formatCurrency(item.unitPrice, invoice.currency)}
                        </TableCell>
                        <TableCell align="right">{item.taxRate}%</TableCell>
                        <TableCell align="right">{item.discountRate}%</TableCell>
                        <TableCell align="right">
                          {formatCurrency(item.lineTotal, invoice.currency)}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} align="center">
                        No items
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            <Divider sx={{ my: 2 }} />
            <Grid container spacing={2}>
              <Grid item xs={6} textAlign="right">
                <Typography>Subtotal:</Typography>
              </Grid>
              <Grid item xs={6} textAlign="right">
                <Typography>{formatCurrency(invoice.subtotal, invoice.currency)}</Typography>
              </Grid>
              <Grid item xs={6} textAlign="right">
                <Typography>Discount:</Typography>
              </Grid>
              <Grid item xs={6} textAlign="right">
                <Typography>-{formatCurrency(invoice.discountTotal, invoice.currency)}</Typography>
              </Grid>
              <Grid item xs={6} textAlign="right">
                <Typography>Tax:</Typography>
              </Grid>
              <Grid item xs={6} textAlign="right">
                <Typography>{formatCurrency(invoice.taxTotal, invoice.currency)}</Typography>
              </Grid>
              <Grid item xs={6} textAlign="right">
                <Typography variant="h6">Total:</Typography>
              </Grid>
              <Grid item xs={6} textAlign="right">
                <Typography variant="h6">
                  {formatCurrency(invoice.total, invoice.currency)}
                </Typography>
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        {invoice.notes && (
          <Grid item xs={12}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                Notes
              </Typography>
              <Typography variant="body2">{invoice.notes}</Typography>
            </Paper>
          </Grid>
        )}

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Timeline
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                <CheckCircleIcon color="primary" sx={{ mt: 0.5 }} />
                <Box>
                  <Typography variant="body2" fontWeight="bold">
                    Created
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formatDate(invoice.createdAt)}
                  </Typography>
                </Box>
              </Box>
              {invoice.status !== 'draft' && (
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                  <RadioButtonUncheckedIcon color="info" sx={{ mt: 0.5 }} />
                  <Box>
                    <Typography variant="body2" fontWeight="bold">
                      Status: {invoice.status}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatDate(invoice.updatedAt)}
                    </Typography>
                  </Box>
                </Box>
              )}
              {invoice.paidAt && (
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                  <CheckCircleIcon color="success" sx={{ mt: 0.5 }} />
                  <Box>
                    <Typography variant="body2" fontWeight="bold">
                      Paid
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatDate(invoice.paidAt)}
                    </Typography>
                  </Box>
                </Box>
              )}
            </Box>
          </Paper>
        </Grid>
      </Grid>

      <Dialog open={cancelDialogOpen} onClose={() => setCancelDialogOpen(false)}>
        <DialogTitle>Cancel Invoice</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to cancel this invoice? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCancelDialogOpen(false)}>No, Keep Invoice</Button>
          <Button onClick={handleConfirmCancel} color="error" variant="contained">
            Yes, Cancel Invoice
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default InvoiceDetail;

