import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Divider,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import PrintIcon from '@mui/icons-material/Print';
import { useInvoice } from '../../hooks/useInvoices';
import { formatCurrency } from '../../utils/formatters';
import { formatDate } from '../../utils/dates';
import { invoicesApi } from '../../api/invoices';
import { useToast } from '../../contexts/ToastContext';
import { getErrorMessage } from '../../utils/errorHandling';
import { useQuery } from '@tanstack/react-query';
import { settingsApi } from '../../api/settings';
import Grid from '../../components/common/Grid';
import { useEffect, useState } from 'react';

// Extract print CSS to constant outside component to avoid re-rendering on every hot update
// This significantly improves dev server performance
const PRINT_CSS = `
        @media print {
          /* Preserve colors in print */
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          
          /* Hide navigation and layout elements */
          .MuiAppBar-root,
          .MuiDrawer-root,
          .MuiDrawer-paper,
          .MuiToolbar-root,
          nav,
          header:not(.invoice-print-header),
          aside,
          .MuiBox-root[class*="AppBar"],
          .MuiBox-root[class*="Toolbar"],
          [class*="AppBar"],
          [class*="Toolbar"],
          [class*="app-bar"],
          [class*="toolbar"] {
            display: none !important;
            visibility: hidden !important;
          }
          
          /* Hide all buttons and action items */
          button,
          .MuiButton-root,
          .MuiIconButton-root {
            display: none !important;
          }
          
          /* Hide no-print elements */
          .no-print {
            display: none !important;
          }
          
          /* Ensure print headers are visible */
          .invoice-print-header,
          #invoice-header {
            display: block !important;
          }
          
          /* Hide breadcrumbs */
          .MuiBreadcrumbs-root {
            display: none !important;
          }
          
          /* Hide any gray boxes or containers at the top */
          body > *:first-child:not(.invoice-print-header),
          main > *:first-child:not(.invoice-print-header),
          [class*="MuiBox-root"]:first-child:not(.invoice-print-header) {
            background: transparent !important;
          }
          
          /* Invoice print header - static by default */
          .invoice-print-header {
            position: static !important;
            display: block !important;
          }
          
          /* Print header should NOT be fixed for reliable multi-page printing */
          #invoice-header.invoice-print-header {
            position: static !important;
            height: auto !important;
            max-height: none !important;
            overflow: visible !important;
            padding: 8px 0 !important;
            border-bottom: 1px solid #1976d2 !important;
          }
          
          /* Invoice print footer */
          .invoice-print-footer {
            position: static !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 8px 0.5in !important;
            background: white !important;
            page-break-before: avoid !important;
            page-break-inside: avoid !important;
          }
          
          /* Reset body */
          body {
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
            padding-top: 0 !important;
          }
          
          /* Main content area */
          .MuiBox-root[component="main"],
          main {
            margin: 0 !important;
            padding: 0 !important;
            padding-top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            background: white !important;
          }
          
          /* Hide any top-level containers with background */
          body > div,
          body > div > div {
            background: white !important;
          }
          
          /* Invoice preview container */
          #invoice-preview {
            padding: 15px;
            background: white !important;
            color: black !important;
            margin: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            padding-top: 15px !important;
          }
          
          /* Compact spacing for print */
          #invoice-preview .MuiGrid-container {
            margin: 0 !important;
            width: 100% !important;
            margin-top: 0 !important;
            padding-top: 0 !important;
          }
          
          #invoice-preview .MuiGrid-item {
            padding: 8px !important;
          }
          
          /* Ensure first content element has proper spacing */
          #invoice-preview .MuiGrid-item:first-of-type {
            margin-top: 0 !important;
            padding-top: 0 !important;
          }
          
          /* Line items section - allow natural page breaks */
          #invoice-preview .MuiGrid-item[data-line-items="true"] {
            page-break-before: auto !important;
            break-before: auto !important;
            margin-top: 20px !important;
            padding-top: 10px !important;
          }
          
          /* Keep header and content together */
          .invoice-print-header + * {
            page-break-before: avoid !important;
          }
          
          /* Ensure all invoice preview content is visible */
          #invoice-preview,
          #invoice-preview * {
            visibility: visible !important;
          }
          
          /* Professional invoice styling */
          #invoice-preview .MuiTypography-h4,
          #invoice-preview .MuiTypography-h5,
          #invoice-preview .MuiTypography-h6 {
            color: #000 !important;
            font-weight: 600 !important;
          }
          
          #invoice-preview .MuiTypography-body1,
          #invoice-preview .MuiTypography-body2 {
            color: #333 !important;
          }
          
          #invoice-preview .MuiChip-root {
            border: 1px solid #ccc !important;
            background: white !important;
            color: #000 !important;
          }
          
          #invoice-preview .MuiTable-root {
            border-collapse: collapse;
          }
          
          #invoice-preview .MuiTableCell-root {
            border: 1px solid #ddd !important;
            padding: 12px !important;
          }
          
          #invoice-preview .MuiTableHead-root .MuiTableCell-root {
            background: #f5f5f5 !important;
            font-weight: 600 !important;
          }
          
          /* Page settings */
          @page {
            margin: 0.5in;
            size: letter;
          }
          
          /* Allow tables to break across pages, but keep rows intact */
          #invoice-preview table {
            page-break-inside: auto !important;
          }
          
          #invoice-preview tr {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
          
          /* Repeat table header on every page */
          #invoice-preview thead {
            display: table-header-group !important;
          }
          
          #invoice-preview tfoot {
            display: table-footer-group !important;
          }
          
          /* Totals: keep together, avoid splitting */
          #invoice-preview .invoice-totals-wrapper,
          #invoice-preview .invoice-totals-box,
          #invoice-preview .MuiGrid-item[data-totals="true"] {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
          
          #invoice-preview .MuiGrid-item[data-totals="true"] {
            margin-top: 24px !important;
            padding-top: 0 !important;
          }
        }
`;

const InvoicePreview = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: invoice, isLoading } = useInvoice(id || '');
  const { showToast } = useToast();
  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: settingsApi.getSettings,
  });

  const [isDownloading, setIsDownloading] = useState(false);

  // Inject PRINT_CSS with HMR-safe updates (prevents expensive re-renders + updates on hot reload)
  useEffect(() => {
    const styleId = 'invoice-preview-print-css';

    // If HMR swapped the module and PRINT_CSS changed, update it
    let style = document.getElementById(styleId) as HTMLStyleElement | null;

    if (!style) {
      style = document.createElement('style');
      style.id = styleId;
      document.head.appendChild(style);
    }

    if (style.textContent !== PRINT_CSS) {
      style.textContent = PRINT_CSS;
    }

    return () => {
      // Optional: if you want to remove on unmount (usually not necessary)
      // style?.remove();
    };
  }, []);

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = async () => {
    if (!id || isDownloading) return;
    setIsDownloading(true);
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
    } catch (error: unknown) {
      showToast(getErrorMessage(error, 'Failed to generate PDF'), 'error');
    } finally {
      setIsDownloading(false);
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
          Invoice not found
        </Typography>
        <Button variant="outlined" onClick={() => navigate('/invoices')}>
          Back to Invoices
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: '100%', width: '100%' }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2} className="no-print">
        <Typography variant="h4" component="h1">
          Invoice Preview
        </Typography>
        <Box display="flex" gap={2}>
          <Button
            variant="outlined"
            startIcon={isDownloading ? <CircularProgress size={16} /> : <DownloadIcon />}
            onClick={handleDownload}
            disabled={isDownloading}
          >
            {isDownloading ? 'Generating PDF...' : 'Download PDF'}
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

      <Paper sx={{ p: 2, maxWidth: '100%', width: '100%' }} id="invoice-preview">
        {/* Header Text */}
        {settings?.invoiceHeaderText && (
          <Box mb={1.5} sx={{ textAlign: 'center', pb: 1, borderBottom: '1px solid #e0e0e0' }} className="invoice-print-header">
            <Typography variant="body2" sx={{ color: '#666', fontSize: '0.875rem' }}>
              {settings.invoiceHeaderText}
            </Typography>
          </Box>
        )}

        {/* Company Header - Compact - Fixed on every page when printing */}
        <Box mb={1.5} className="invoice-print-header" sx={{ borderBottom: '1px solid #1976d2', pb: 1, pt: 1 }} id="invoice-header">
          <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ gap: 3 }}>
            <Box>
              <Typography variant="body1" component="h1" sx={{ fontWeight: 700, color: '#1976d2', fontSize: '0.9375rem', mb: 0.25, lineHeight: 1.2 }}>
                {settings?.companyName || 'InvoiceMe'}
              </Typography>
              {settings?.companyEmail && (
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem', lineHeight: 1.2 }}>
                  {settings.companyEmail}
                </Typography>
              )}
            </Box>
            <Box textAlign="right">
              <Typography variant="body1" component="h2" sx={{ fontWeight: 700, color: '#1976d2', fontSize: '0.9375rem', mb: 0.25, lineHeight: 1.2 }}>
                INVOICE
              </Typography>
              <Typography variant="body2" component="h3" sx={{ fontWeight: 600, fontSize: '0.8125rem', color: '#333', lineHeight: 1.2 }}>
                {invoice.number}
              </Typography>
            </Box>
          </Box>
        </Box>

        <Grid container spacing={2}>

          <Grid item xs={12} md={6}>
            <Box sx={{ p: 2.5, border: '1px solid #e0e0e0', borderRadius: 2, bgcolor: '#fafafa', height: '100%' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#1976d2', mb: 2, fontSize: '0.9375rem', textTransform: 'uppercase', letterSpacing: '1px', borderBottom: '2px solid #1976d2', pb: 1, display: 'inline-block', width: '100%' }}>
                Bill To:
              </Typography>
              <Box sx={{ mt: 2 }}>
                <Typography variant="h6" fontWeight="bold" sx={{ mb: 1.5, fontSize: '1rem', color: '#333' }}>
                  {invoice.client?.name}
                </Typography>
                {invoice.client?.email && (
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>
                      {invoice.client.email}
                    </Typography>
                  </Box>
                )}
                {invoice.client?.phone && (
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>
                      {invoice.client.phone}
                    </Typography>
                  </Box>
                )}
                {invoice.client?.addressJson && (
                  <Box mt={1.5} sx={{ pt: 1.5, borderTop: '1px solid #e0e0e0' }}>
                    <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.8, fontSize: '0.875rem' }}>
                      {invoice.client.addressJson.street}
                      <br />
                      {invoice.client.addressJson.city}, {invoice.client.addressJson.state}{' '}
                      {invoice.client.addressJson.zip}
                      <br />
                      {invoice.client.addressJson.country}
                    </Typography>
                  </Box>
                )}
              </Box>
            </Box>
          </Grid>

          <Grid item xs={12} md={6}>
            <Box sx={{ p: 2.5, border: '1px solid #e0e0e0', borderRadius: 2, bgcolor: '#fafafa', height: '100%' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#1976d2', mb: 2, fontSize: '0.9375rem', textTransform: 'uppercase', letterSpacing: '1px', borderBottom: '2px solid #1976d2', pb: 1, display: 'inline-block', width: '100%' }}>
                Invoice Details:
              </Typography>
              <Box sx={{ mt: 2 }}>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Issue Date:
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#333' }}>
                      {formatDate(invoice.issueDate)}
                    </Typography>
                  </Grid>
                  {invoice.dueDate && (
                    <>
                      <Grid item xs={6}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Due Date:
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2" sx={{ fontSize: '0.875rem', fontWeight: 600 }}>
                          {formatDate(invoice.dueDate)}
                        </Typography>
                      </Grid>
                    </>
                  )}
                  {invoice.paidAt && (
                    <>
                      <Grid item xs={6}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Paid Date:
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2" sx={{ fontSize: '0.875rem', fontWeight: 600 }} color="success.main">
                          {formatDate(invoice.paidAt)}
                        </Typography>
                      </Grid>
                    </>
                  )}
                  {invoice.store && (
                    <>
                      <Grid item xs={6}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Store:
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2" sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#333' }}>
                          {invoice.store.name} ({invoice.store.code})
                        </Typography>
                      </Grid>
                    </>
                  )}
                </Grid>
              </Box>
            </Box>
          </Grid>

          <Grid item xs={12} data-line-items="true" sx={{ '@media print': { marginTop: '20px !important', paddingTop: '10px !important', pageBreakBefore: 'always !important' } }}>
            <Box sx={{ mt: 2, '@media print': { marginTop: '20px !important', paddingTop: '10px !important' } }}>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#1976d2', mb: 2, fontSize: '1.125rem', textTransform: 'uppercase', letterSpacing: '1px', borderBottom: '2px solid #1976d2', pb: 1, display: 'inline-block' }}>
                Line Items
              </Typography>
              <TableContainer sx={{ border: '1px solid #e0e0e0', borderRadius: 2, mt: 2, boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                <Table>
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#1976d2' }}>
                      <TableCell sx={{ color: 'white', fontWeight: 700, py: 1.5, fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Description</TableCell>
                      <TableCell align="right" sx={{ color: 'white', fontWeight: 700, py: 1.5, fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Quantity</TableCell>
                      <TableCell align="right" sx={{ color: 'white', fontWeight: 700, py: 1.5, fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Unit Price</TableCell>
                      <TableCell align="right" sx={{ color: 'white', fontWeight: 700, py: 1.5, fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tax %</TableCell>
                      <TableCell align="right" sx={{ color: 'white', fontWeight: 700, py: 1.5, fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Discount %</TableCell>
                      <TableCell align="right" sx={{ color: 'white', fontWeight: 700, py: 1.5, fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {invoice.items && invoice.items.length > 0 ? (
                      invoice.items.map((item, index) => (
                        <TableRow 
                          key={item.id}
                          sx={{ 
                            bgcolor: index % 2 === 0 ? 'white' : '#f9f9f9',
                            '&:hover': { bgcolor: '#f5f5f5' },
                            borderBottom: '1px solid #e0e0e0'
                          }}
                        >
                          <TableCell sx={{ py: 1.5, fontSize: '0.875rem', fontWeight: 500 }}>{item.description}</TableCell>
                          <TableCell align="right" sx={{ py: 1.5, fontSize: '0.875rem' }}>{item.quantity}</TableCell>
                          <TableCell align="right" sx={{ py: 1.5, fontSize: '0.875rem', fontWeight: 500 }}>
                            {formatCurrency(item.unitPrice, invoice.currency)}
                          </TableCell>
                          <TableCell align="right" sx={{ py: 1.5, fontSize: '0.875rem' }}>{item.taxRate}%</TableCell>
                          <TableCell align="right" sx={{ py: 1.5, fontSize: '0.875rem' }}>{item.discountRate}%</TableCell>
                          <TableCell align="right" sx={{ py: 1.5, fontSize: '0.875rem', fontWeight: 700, color: '#1976d2' }}>
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
            </Box>
          </Grid>

          <Grid item xs={12} data-totals="true" sx={{ '@media print': { pageBreakInside: 'avoid', breakInside: 'avoid', marginTop: '60px !important', paddingTop: '15px !important' } }}>
            <Box display="flex" justifyContent="flex-end" sx={{ mt: 3, '@media print': { pageBreakInside: 'avoid', breakInside: 'avoid', marginTop: '60px !important', paddingTop: '15px !important' } }} className="invoice-totals-wrapper">
              <Box sx={{ p: 3, minWidth: 320, border: '2px solid #1976d2', borderRadius: 2, bgcolor: '#f8f9fa', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', '@media print': { pageBreakInside: 'avoid', breakInside: 'avoid', position: 'relative', zIndex: 1 } }} className="invoice-totals-box">
                <Grid container spacing={2}>
                  <Grid item xs={6} textAlign="right">
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem', fontWeight: 500 }}>Subtotal:</Typography>
                  </Grid>
                  <Grid item xs={6} textAlign="right">
                    <Typography variant="body1" sx={{ fontSize: '0.9375rem', fontWeight: 600, color: '#333' }}>{formatCurrency(invoice.subtotal, invoice.currency)}</Typography>
                  </Grid>
                  <Grid item xs={6} textAlign="right">
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem', fontWeight: 500 }}>Discount:</Typography>
                  </Grid>
                  <Grid item xs={6} textAlign="right">
                    <Typography variant="body1" sx={{ fontSize: '0.9375rem', fontWeight: 600 }} color="error.main">-{formatCurrency(invoice.discountTotal, invoice.currency)}</Typography>
                  </Grid>
                  <Grid item xs={6} textAlign="right">
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem', fontWeight: 500 }}>Tax:</Typography>
                  </Grid>
                  <Grid item xs={6} textAlign="right">
                    <Typography variant="body1" sx={{ fontSize: '0.9375rem', fontWeight: 600, color: '#333' }}>{formatCurrency(invoice.taxTotal, invoice.currency)}</Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Divider sx={{ borderWidth: 2, borderColor: '#1976d2', my: 1 }} />
                  </Grid>
                  <Grid item xs={6} textAlign="right">
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#1976d2', fontSize: '1.125rem' }}>Total:</Typography>
                  </Grid>
                  <Grid item xs={6} textAlign="right">
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#1976d2', fontSize: '1.125rem' }}>
                      {formatCurrency(invoice.total, invoice.currency)}
                    </Typography>
                  </Grid>
                </Grid>
              </Box>
            </Box>
          </Grid>

          {invoice.notes && (
            <Grid item xs={12}>
              <Box sx={{ p: 1.5, border: '1px solid #e0e0e0', borderRadius: 1, bgcolor: '#fafafa', mt: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#1976d2', mb: 0.5, fontSize: '0.875rem' }}>
                  Notes
                </Typography>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-line', fontSize: '0.8125rem' }}>{invoice.notes}</Typography>
              </Box>
            </Grid>
          )}

          {settings?.showPaymentInstructions && (settings?.defaultInvoiceTerms || settings?.defaultInvoiceNotes) && (
            <Grid item xs={12}>
              <Box sx={{ p: 1.5, border: '1px solid #e0e0e0', borderRadius: 1, bgcolor: '#fafafa', mt: 1 }}>
                {settings.defaultInvoiceTerms && (
                  <Box mb={1.5}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#1976d2', mb: 0.5, fontSize: '0.875rem' }}>
                      Terms & Conditions
                    </Typography>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-line', color: '#555', fontSize: '0.8125rem' }}>
                      {settings.defaultInvoiceTerms}
                    </Typography>
                  </Box>
                )}
                {settings.defaultInvoiceNotes && (
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#1976d2', mb: 0.5, fontSize: '0.875rem' }}>
                      Payment Instructions
                    </Typography>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-line', color: '#555', fontSize: '0.8125rem' }}>
                      {settings.defaultInvoiceNotes}
                    </Typography>
                  </Box>
                )}
              </Box>
            </Grid>
          )}

          {/* Footer Text */}
          {settings?.invoiceFooterText && (
            <Grid item xs={12}>
              <Box sx={{ textAlign: 'center', pt: 1, borderTop: '1px solid #e0e0e0', mt: 1 }} className="invoice-print-footer">
                <Typography variant="caption" sx={{ color: '#666', fontSize: '0.75rem' }}>
                  {settings.invoiceFooterText}
                </Typography>
              </Box>
            </Grid>
          )}

          {/* Company Tax/Registration Info */}
          {(settings?.companyTaxId || settings?.companyRegistrationNumber || settings?.companyVatNumber) && (
            <Grid item xs={12}>
              <Box sx={{ textAlign: 'center', mt: 1, pt: 1, borderTop: '1px solid #e0e0e0' }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                  {settings.companyTaxId && `Tax ID: ${settings.companyTaxId}`}
                  {settings.companyTaxId && (settings.companyRegistrationNumber || settings.companyVatNumber) && ' | '}
                  {settings.companyRegistrationNumber && `Reg. No: ${settings.companyRegistrationNumber}`}
                  {settings.companyRegistrationNumber && settings.companyVatNumber && ' | '}
                  {settings.companyVatNumber && `VAT: ${settings.companyVatNumber}`}
                </Typography>
              </Box>
            </Grid>
          )}
        </Grid>
      </Paper>
    </Box>
  );
};

export default InvoicePreview;

