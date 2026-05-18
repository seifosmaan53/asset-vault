import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  LinearProgress,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import CloseIcon from '@mui/icons-material/Close';

interface ExportProgressDialogProps {
  open: boolean;
  current: number;
  total: number;
  onCancel?: () => void;
  filename?: string;
}

const ExportProgressDialog = ({
  open,
  current,
  total,
  onCancel,
  filename = 'data',
}: ExportProgressDialogProps) => {
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
  const isComplete = current >= total;

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      aria-labelledby="export-progress-dialog-title"
      maxWidth="sm"
      fullWidth
      disableEscapeKeyDown={!isComplete}
      sx={{
        '& .MuiDialog-paper': {
          borderRadius: 2,
        },
      }}
    >
      <DialogTitle id="export-progress-dialog-title">
        <Box display="flex" alignItems="center" gap={1.5}>
          <DownloadIcon color="primary" />
          <Typography variant="h6" component="span" fontWeight="bold">
            Exporting {filename}
          </Typography>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 1 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
            <Typography variant="body2" color="text.secondary">
              Processing items...
            </Typography>
            <Typography variant="body2" fontWeight={600} color="primary">
              {percentage}%
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={percentage}
            sx={{
              height: 8,
              borderRadius: 4,
              mb: 2,
            }}
          />
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="body2" color="text.secondary">
              {current.toLocaleString()} of {total.toLocaleString()} items
            </Typography>
            {isComplete && (
              <Typography variant="body2" color="success.main" fontWeight={600}>
                Complete!
              </Typography>
            )}
          </Box>
        </Box>
      </DialogContent>
      {onCancel && !isComplete && (
        <DialogActions sx={{ p: 2, pt: 1 }}>
          <Button
            onClick={onCancel}
            startIcon={<CloseIcon />}
            color="inherit"
            variant="outlined"
          >
            Cancel
          </Button>
        </DialogActions>
      )}
    </Dialog>
  );
};

export default ExportProgressDialog;
