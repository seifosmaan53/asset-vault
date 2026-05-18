import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  IconButton,
  FormControlLabel,
  Checkbox,
  Alert,
  CircularProgress,
} from '@mui/material';
import EmailIcon from '@mui/icons-material/Email';
import CloseIcon from '@mui/icons-material/Close';
import AttachFileIcon from '@mui/icons-material/AttachFile';

interface EmailDialogProps {
  open: boolean;
  onClose: () => void;
  onSend: (options: {
    subject: string;
    message: string;
    to: string;
    includePdf: boolean;
  }) => Promise<void>;
  defaultTo?: string;
  defaultSubject?: string;
  isLoading?: boolean;
}

export const EmailDialog = ({
  open,
  onClose,
  onSend,
  defaultTo = '',
  defaultSubject = '',
  isLoading = false,
}: EmailDialogProps) => {
  const [to, setTo] = useState(defaultTo);
  const [subject, setSubject] = useState(defaultSubject);
  const [message, setMessage] = useState('');
  const [includePdf, setIncludePdf] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Reset form when dialog opens or defaults change
  useEffect(() => {
    if (open) {
      setTo(defaultTo);
      setSubject(defaultSubject);
      setMessage('');
      setIncludePdf(true);
      setError(null);
    }
  }, [open, defaultTo, defaultSubject]);

  const handleSend = async () => {
    if (!to || !to.trim()) {
      setError('Recipient email is required');
      return;
    }

    if (!subject || !subject.trim()) {
      setError('Subject is required');
      return;
    }

    setError(null);
    try {
      await onSend({
        to: to.trim(),
        subject: subject.trim(),
        message: message.trim(),
        includePdf,
      });
      handleClose();
    } catch (err: any) {
      setError(err.message || 'Failed to send email');
    }
  };

  const handleClose = () => {
    setTo(defaultTo);
    setSubject(defaultSubject);
    setMessage('');
    setIncludePdf(true);
    setError(null);
    onClose();
  };

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
            <EmailIcon sx={{ color: 'primary.main' }} />
            <Typography variant="h6" fontWeight={600}>
              Send Invoice via Email
            </Typography>
          </Box>
          <IconButton onClick={handleClose} size="small" disabled={isLoading}>
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

          <TextField
            label="To"
            type="email"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            fullWidth
            required
            disabled={isLoading}
            placeholder="client@example.com"
          />

          <TextField
            label="Subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            fullWidth
            required
            disabled={isLoading}
          />

          <TextField
            label="Message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            fullWidth
            multiline
            rows={6}
            disabled={isLoading}
            placeholder="Custom message (optional - default template will be used if empty)"
          />

          <FormControlLabel
            control={
              <Checkbox
                checked={includePdf}
                onChange={(e) => setIncludePdf(e.target.checked)}
                disabled={isLoading}
              />
            }
            label={
              <Box display="flex" alignItems="center" gap={1}>
                <AttachFileIcon fontSize="small" />
                <span>Include PDF attachment</span>
              </Box>
            }
          />
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2, pt: 1 }}>
        <Button onClick={handleClose} disabled={isLoading}>
          Cancel
        </Button>
        <Button
          onClick={handleSend}
          variant="contained"
          disabled={isLoading || !to || !subject}
          startIcon={isLoading ? <CircularProgress size={16} /> : <EmailIcon />}
          sx={{ borderRadius: 2 }}
        >
          {isLoading ? 'Sending...' : 'Send Email'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
