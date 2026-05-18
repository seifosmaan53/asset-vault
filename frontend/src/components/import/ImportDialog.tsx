import { useState, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  IconButton,
  Alert,
  LinearProgress,
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import CloseIcon from '@mui/icons-material/Close';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { parseCSV, parseExcel, isSupportedFile, getFileExtension } from '../../utils/import';

interface ImportDialogProps {
  open: boolean;
  onClose: () => void;
  onFileSelect: (data: any[], file: File) => void;
  acceptedFormats?: string[];
  maxFileSize?: number; // in MB
}

export const ImportDialog = ({
  open,
  onClose,
  onFileSelect,
  acceptedFormats = ['.csv', '.xlsx', '.xls'],
  maxFileSize = 10,
}: ImportDialogProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileSelect = useCallback(async (selectedFile: File) => {
    setError(null);
    setFile(null);

    // Validate file type
    if (!isSupportedFile(selectedFile)) {
      setError(`Unsupported file type. Please upload a CSV or Excel file (${acceptedFormats.join(', ')})`);
      return;
    }

    // Validate file size
    const fileSizeMB = selectedFile.size / (1024 * 1024);
    if (fileSizeMB > maxFileSize) {
      setError(`File size exceeds ${maxFileSize}MB limit. Please upload a smaller file.`);
      return;
    }

    setFile(selectedFile);
    setIsProcessing(true);

    try {
      const ext = getFileExtension(selectedFile.name);
      const data = ext === 'csv' ? await parseCSV(selectedFile) : await parseExcel(selectedFile);
      
      if (data.length === 0) {
        setError('File appears to be empty or could not be parsed.');
        setFile(null);
        return;
      }

      onFileSelect(data, selectedFile);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse file. Please check the file format.');
      setFile(null);
    } finally {
      setIsProcessing(false);
    }
  }, [onFileSelect, acceptedFormats, maxFileSize]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFileSelect(selectedFile);
    }
  }, [handleFileSelect]);

  const handleClose = useCallback(() => {
    setFile(null);
    setError(null);
    setIsProcessing(false);
    onClose();
  }, [onClose]);

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
        },
      }}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center" gap={1.5}>
            <UploadFileIcon sx={{ color: 'primary.main' }} />
            <Typography variant="h6" fontWeight={600}>
              Import Data
            </Typography>
          </Box>
          <IconButton onClick={handleClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          {error && (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          <Box
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            sx={{
              border: '2px dashed',
              borderColor: file ? 'primary.main' : 'divider',
              borderRadius: 2,
              p: 4,
              textAlign: 'center',
              bgcolor: file ? 'primary.50' : 'background.paper',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              '&:hover': {
                borderColor: 'primary.main',
                bgcolor: 'action.hover',
              },
            }}
          >
            <input
              type="file"
              accept={acceptedFormats.join(',')}
              onChange={handleInputChange}
              style={{ display: 'none' }}
              id="file-upload-input"
              disabled={isProcessing}
            />
            <label htmlFor="file-upload-input">
              <Box sx={{ cursor: 'pointer' }}>
                <CloudUploadIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  {file ? file.name : 'Drop file here or click to browse'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Supported formats: {acceptedFormats.join(', ')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Max file size: {maxFileSize}MB
                </Typography>
              </Box>
            </label>
          </Box>

          {isProcessing && (
            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Processing file...
              </Typography>
              <LinearProgress />
            </Box>
          )}

          {file && !isProcessing && (
            <Alert severity="success">
              File loaded successfully: {file.name} ({file.size > 1024 * 1024 
                ? `${(file.size / (1024 * 1024)).toFixed(2)} MB`
                : `${(file.size / 1024).toFixed(2)} KB`})
            </Alert>
          )}
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2, pt: 1 }}>
        <Button onClick={handleClose}>Cancel</Button>
        <Button
          onClick={handleClose}
          variant="contained"
          disabled={!file || isProcessing}
          sx={{ borderRadius: 2 }}
        >
          Continue
        </Button>
      </DialogActions>
    </Dialog>
  );
};
