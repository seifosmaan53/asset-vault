import { useParams } from 'react-router-dom';
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
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import PrintIcon from '@mui/icons-material/Print';
import { useInvoice } from '../../hooks/useInvoices';
import { formatCurrency } from '../../utils/formatters';
import { formatDate } from '../../utils/dates';
import { InvoiceStatus } from '../../types/invoice';
import { invoicesApi } from '../../api/invoices';
import { useToast } from '../../contexts/ToastContext';

const InvoicePreview = () => {
  const { id } = useParams<{ id: string }>();
  const { data: invoice, isLoading } = useInvoice(id || '');
  const { showToast } = useToast();

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = async () => {
    if (!id) return;
    try {
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
        <Typography variant="h4" component="h1">
          Invoice Preview
        </Typography>
        <Box display="flex" gap={2}>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={handleDownload}
          >
            Download PDF
          </Button>
          <Button
            variant="outlined"
            startIcon={<PrintIcon />}
            onClick={handlePrint}
          >
            Print
          </Button>
        </Box>
      </Box>

      <Paper sx={{ p: 4 }} id="invoice-preview">
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Box display="flex" justifyContent="space-between" alignItems="flex-start">
              <Box>
                <Typography variant="h4" component="h1" gutterBottom>
                  InvoiceMe
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Invoice Management System
                </Typography>
              </Box>
              <Box textAlign="right">
                <Typography variant="h5" component="h2" gutterBottom>
                  {invoice.number}
                </Typography>
                <Chip
                  label={invoice.status}
                  color={getStatusColor(invoice.status)}
                  size="small"
                />
              </Box>
            </Box>
          </Grid>

          <Grid item xs={12}>
            <Divider />
          </Grid>

          <Grid item xs={12} md={6}>
            <Typography variant="h6" gutterBottom>
              Bill To:
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
          </Grid>

          <Grid item xs={12} md={6} textAlign="right">
            <Typography variant="body2" color="text.secondary">
              Issue Date: {formatDate(invoice.issueDate)}
            </Typography>
            {invoice.dueDate && (
              <Typography variant="body2" color="text.secondary">
                Due Date: {formatDate(invoice.dueDate)}
              </Typography>
            )}
            {invoice.paidAt && (
              <Typography variant="body2" color="text.secondary">
                Paid Date: {formatDate(invoice.paidAt)}
              </Typography>
            )}
          </Grid>

          <Grid item xs={12}>
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
          </Grid>

          <Grid item xs={12}>
            <Box display="flex" justifyContent="flex-end">
              <Box sx={{ minWidth: 300 }}>
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
                  <Grid item xs={12}>
                    <Divider />
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
              </Box>
            </Box>
          </Grid>

          {invoice.notes && (
            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Typography variant="h6" gutterBottom>
                Notes
              </Typography>
              <Typography variant="body2">{invoice.notes}</Typography>
            </Grid>
          )}
        </Grid>
      </Paper>

      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #invoice-preview, #invoice-preview * {
            visibility: visible;
          }
          #invoice-preview {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
        }
      `}</style>
    </Box>
  );
};

export default InvoicePreview;

