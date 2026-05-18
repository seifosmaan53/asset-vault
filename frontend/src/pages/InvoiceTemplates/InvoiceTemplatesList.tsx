import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  Tooltip,
  Skeleton,
  CircularProgress,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import ArticleIcon from '@mui/icons-material/Article';
import StarIcon from '@mui/icons-material/Star';
import { useInvoiceTemplates, useDeleteInvoiceTemplate } from '../../hooks/useInvoiceTemplates';
import { useToast } from '../../contexts/ToastContext';
import { getErrorMessage } from '../../utils/errorHandling';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { formatDate } from '../../utils/dates';

const InvoiceTemplatesList = () => {
  const navigate = useNavigate();
  const { data: templates, isLoading } = useInvoiceTemplates();
  const deleteTemplate = useDeleteInvoiceTemplate();
  const { showToast } = useToast();
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<string | null>(null);

  const handleDeleteClick = useCallback((id: string) => {
    setTemplateToDelete(id);
    setDeleteConfirmOpen(true);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!templateToDelete) return;
    
    try {
      await deleteTemplate.mutateAsync(templateToDelete);
      showToast('Template deleted successfully', 'success');
      setDeleteConfirmOpen(false);
      setTemplateToDelete(null);
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error, 'Failed to delete template', {
        operation: 'delete',
        resource: 'invoice template',
      });
      showToast(errorMessage, 'error');
    }
  }, [templateToDelete, deleteTemplate, showToast]);

  const handleDeleteCancel = useCallback(() => {
    setDeleteConfirmOpen(false);
    setTemplateToDelete(null);
  }, []);

  if (isLoading) {
    return (
      <Box>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Skeleton variant="text" width={200} height={40} />
          <Skeleton variant="rectangular" width={150} height={40} />
        </Box>
        <Paper>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell><Skeleton /></TableCell>
                  <TableCell><Skeleton /></TableCell>
                  <TableCell><Skeleton /></TableCell>
                  <TableCell align="right"><Skeleton /></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {[1, 2, 3].map((i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton /></TableCell>
                    <TableCell><Skeleton /></TableCell>
                    <TableCell><Skeleton /></TableCell>
                    <TableCell align="right"><Skeleton width={100} /></TableCell>
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
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Box>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 600, mb: 0.5 }}>
            Invoice Templates
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {templates?.length || 0} {templates?.length === 1 ? 'template' : 'templates'}
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/invoice-templates/create')}
          size="large"
        >
          Create Template
        </Button>
      </Box>

      <TableContainer component={Paper} sx={{ borderRadius: 2, boxShadow: 1 }}>
        <Table>
          <TableHead>
            <TableRow sx={{ bgcolor: 'grey.50' }}>
              <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Description</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Created</TableCell>
              <TableCell align="right" sx={{ fontWeight: 600 }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {templates && templates.length > 0 ? (
              templates.map((template) => (
                <TableRow key={template.id} hover>
                  <TableCell>
                    <Box display="flex" alignItems="center" gap={1}>
                      <ArticleIcon sx={{ color: 'primary.main' }} />
                      <Typography variant="body1" fontWeight={500}>
                        {template.name}
                      </Typography>
                      {template.isDefault && (
                        <Chip
                          icon={<StarIcon />}
                          label="Default"
                          size="small"
                          color="primary"
                          sx={{ height: 20, fontSize: '0.7rem' }}
                        />
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {template.description || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label="Active"
                      size="small"
                      color="success"
                      sx={{ height: 24 }}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {formatDate(template.createdAt)}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Box display="flex" gap={1} justifyContent="flex-end">
                      <Tooltip title="View Template">
                        <IconButton
                          size="small"
                          onClick={() => navigate(`/invoice-templates/${template.id}`)}
                        >
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Edit Template">
                        <IconButton
                          size="small"
                          onClick={() => navigate(`/invoice-templates/${template.id}/edit`)}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete Template">
                        <IconButton
                          size="small"
                          onClick={() => handleDeleteClick(template.id)}
                          color="error"
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
                <TableCell colSpan={5} align="center" sx={{ py: 8 }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <ArticleIcon sx={{ fontSize: 64, color: 'text.disabled' }} />
                    <Typography variant="h6" color="text.secondary">
                      No templates yet
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Create your first invoice template to customize invoice appearance
                    </Typography>
                    <Button
                      variant="contained"
                      startIcon={<AddIcon />}
                      onClick={() => navigate('/invoice-templates/create')}
                      sx={{ mt: 1 }}
                    >
                      Create Template
                    </Button>
                  </Box>
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
        title="Delete Template"
        message="Are you sure you want to delete this invoice template? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        confirmColor="error"
        loading={deleteTemplate.isPending}
        severity="error"
      />
    </Box>
  );
};

export default InvoiceTemplatesList;
