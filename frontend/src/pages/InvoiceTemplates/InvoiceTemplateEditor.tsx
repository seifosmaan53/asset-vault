import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import {
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  Grid,
  Divider,
  Switch,
  FormControlLabel,
  Alert,
  CircularProgress,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import PreviewIcon from '@mui/icons-material/Preview';
import { useInvoiceTemplate, useCreateInvoiceTemplate, useUpdateInvoiceTemplate } from '../../hooks/useInvoiceTemplates';
import { useToast } from '../../contexts/ToastContext';
import { getErrorMessage } from '../../utils/errorHandling';
import type { CreateInvoiceTemplateDto, UpdateInvoiceTemplateDto, TemplateData } from '../../types/invoiceTemplate';

const InvoiceTemplateEditor = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = !!id;
  const { data: template, isLoading } = useInvoiceTemplate(id || '');
  const createTemplate = useCreateInvoiceTemplate();
  const updateTemplate = useUpdateInvoiceTemplate();
  const { showToast } = useToast();

  const { control, handleSubmit, reset, watch } = useForm<CreateInvoiceTemplateDto>({
    defaultValues: {
      name: '',
      description: '',
      templateData: {
        header: {
          companyName: '',
          companyAddress: '',
          companyPhone: '',
          companyEmail: '',
        },
        footer: {
          text: '',
          showPageNumbers: true,
        },
        styles: {
          primaryColor: '#1976d2',
          secondaryColor: '#424242',
          fontFamily: 'Arial, sans-serif',
          fontSize: 12,
        },
        sections: {
          showClientInfo: true,
          showStoreInfo: true,
          showItemsTable: true,
          showTotals: true,
          showNotes: true,
        },
      },
      isDefault: false,
    },
  });

  useEffect(() => {
    if (template) {
      reset({
        name: template.name,
        description: template.description || '',
        templateData: template.templateData,
        isDefault: template.isDefault,
      });
    }
  }, [template, reset]);

  const onSubmit = async (data: CreateInvoiceTemplateDto) => {
    try {
      if (isEdit && id) {
        await updateTemplate.mutateAsync({ id, data: data as UpdateInvoiceTemplateDto });
        showToast('Template updated successfully', 'success');
      } else {
        await createTemplate.mutateAsync(data);
        showToast('Template created successfully', 'success');
      }
      navigate('/invoice-templates');
    } catch (error: unknown) {
      showToast(getErrorMessage(error, 'Failed to save template'), 'error');
    }
  };

  const templateData = watch('templateData');

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box component="main">
      <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 600, mb: 3 }}>
        {isEdit ? 'Edit Invoice Template' : 'Create Invoice Template'}
      </Typography>

      <form onSubmit={handleSubmit(onSubmit)}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Basic Information
              </Typography>
              <Controller
                name="name"
                control={control}
                rules={{ required: 'Name is required' }}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    label="Template Name"
                    fullWidth
                    required
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                    sx={{ mb: 2 }}
                  />
                )}
              />
              <Controller
                name="description"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Description"
                    fullWidth
                    multiline
                    rows={3}
                    sx={{ mb: 2 }}
                  />
                )}
              />
              <Controller
                name="isDefault"
                control={control}
                render={({ field }) => (
                  <FormControlLabel
                    control={<Switch {...field} checked={field.value} />}
                    label="Set as default template"
                  />
                )}
              />
            </Paper>

            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Header Settings
              </Typography>
              <Controller
                name="templateData.header.companyName"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Company Name"
                    fullWidth
                    sx={{ mb: 2 }}
                  />
                )}
              />
              <Controller
                name="templateData.header.companyAddress"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Company Address"
                    fullWidth
                    multiline
                    rows={2}
                    sx={{ mb: 2 }}
                  />
                )}
              />
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Controller
                    name="templateData.header.companyPhone"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="Company Phone"
                        fullWidth
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={6}>
                  <Controller
                    name="templateData.header.companyEmail"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="Company Email"
                        fullWidth
                        type="email"
                      />
                    )}
                  />
                </Grid>
              </Grid>
            </Paper>

            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Footer Settings
              </Typography>
              <Controller
                name="templateData.footer.text"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Footer Text"
                    fullWidth
                    multiline
                    rows={2}
                    sx={{ mb: 2 }}
                  />
                )}
              />
              <Controller
                name="templateData.footer.showPageNumbers"
                control={control}
                render={({ field }) => (
                  <FormControlLabel
                    control={<Switch {...field} checked={field.value} />}
                    label="Show page numbers"
                  />
                )}
              />
            </Paper>

            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Style Settings
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Controller
                    name="templateData.styles.primaryColor"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="Primary Color"
                        fullWidth
                        type="color"
                        InputLabelProps={{ shrink: true }}
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={6}>
                  <Controller
                    name="templateData.styles.secondaryColor"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="Secondary Color"
                        fullWidth
                        type="color"
                        InputLabelProps={{ shrink: true }}
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={6}>
                  <Controller
                    name="templateData.styles.fontFamily"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="Font Family"
                        fullWidth
                        select
                        SelectProps={{ native: true }}
                      >
                        <option value="Arial, sans-serif">Arial</option>
                        <option value="'Times New Roman', serif">Times New Roman</option>
                        <option value="'Courier New', monospace">Courier New</option>
                        <option value="'Helvetica Neue', sans-serif">Helvetica</option>
                      </TextField>
                    )}
                  />
                </Grid>
                <Grid item xs={6}>
                  <Controller
                    name="templateData.styles.fontSize"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="Font Size"
                        fullWidth
                        type="number"
                        inputProps={{ min: 8, max: 24 }}
                        onChange={(e) => field.onChange(parseInt(e.target.value, 10))}
                      />
                    )}
                  />
                </Grid>
              </Grid>
            </Paper>

            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Section Visibility
              </Typography>
              <Controller
                name="templateData.sections.showClientInfo"
                control={control}
                render={({ field }) => (
                  <FormControlLabel
                    control={<Switch {...field} checked={field.value} />}
                    label="Show client information"
                    sx={{ display: 'block', mb: 1 }}
                  />
                )}
              />
              <Controller
                name="templateData.sections.showStoreInfo"
                control={control}
                render={({ field }) => (
                  <FormControlLabel
                    control={<Switch {...field} checked={field.value} />}
                    label="Show store information"
                    sx={{ display: 'block', mb: 1 }}
                  />
                )}
              />
              <Controller
                name="templateData.sections.showItemsTable"
                control={control}
                render={({ field }) => (
                  <FormControlLabel
                    control={<Switch {...field} checked={field.value} />}
                    label="Show items table"
                    sx={{ display: 'block', mb: 1 }}
                  />
                )}
              />
              <Controller
                name="templateData.sections.showTotals"
                control={control}
                render={({ field }) => (
                  <FormControlLabel
                    control={<Switch {...field} checked={field.value} />}
                    label="Show totals"
                    sx={{ display: 'block', mb: 1 }}
                  />
                )}
              />
              <Controller
                name="templateData.sections.showNotes"
                control={control}
                render={({ field }) => (
                  <FormControlLabel
                    control={<Switch {...field} checked={field.value} />}
                    label="Show notes"
                    sx={{ display: 'block' }}
                  />
                )}
              />
            </Paper>
          </Grid>

          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3, position: 'sticky', top: 20 }}>
              <Typography variant="h6" gutterBottom>
                Preview
              </Typography>
              <Box
                sx={{
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                  p: 2,
                  bgcolor: 'background.paper',
                  minHeight: 400,
                }}
              >
                {/* Preview would render here */}
                <Typography variant="body2" color="text.secondary">
                  Template preview will appear here
                </Typography>
              </Box>
              <Box display="flex" gap={2} mt={3}>
                <Button
                  type="submit"
                  variant="contained"
                  startIcon={<SaveIcon />}
                  fullWidth
                  disabled={createTemplate.isPending || updateTemplate.isPending}
                >
                  {createTemplate.isPending || updateTemplate.isPending ? (
                    <CircularProgress size={20} />
                  ) : (
                    'Save Template'
                  )}
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => navigate('/invoice-templates')}
                  fullWidth
                >
                  Cancel
                </Button>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      </form>
    </Box>
  );
};

export default InvoiceTemplateEditor;
