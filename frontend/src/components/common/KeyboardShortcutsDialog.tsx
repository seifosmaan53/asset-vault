import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Chip,
  Divider,
  useTheme,
  alpha,
} from '@mui/material';
import KeyboardIcon from '@mui/icons-material/Keyboard';
import CloseIcon from '@mui/icons-material/Close';

export type ShortcutGroup = {
  title: string;
  shortcuts: Array<{
    keys: string[];
    description: string;
  }>;
};

interface KeyboardShortcutsDialogProps {
  open: boolean;
  onClose: () => void;
  shortcuts: ShortcutGroup[];
}

const formatKey = (key: string): string => {
  const keyMap: Record<string, string> = {
    ctrl: 'Ctrl',
    meta: 'Cmd',
    shift: 'Shift',
    alt: 'Alt',
    escape: 'Esc',
    enter: 'Enter',
    space: 'Space',
    arrowup: '↑',
    arrowdown: '↓',
    arrowleft: '←',
    arrowright: '→',
  };

  const lowerKey = key.toLowerCase();
  if (keyMap[lowerKey]) {
    return keyMap[lowerKey];
  }

  // Capitalize single letter keys
  if (key.length === 1) {
    return key.toUpperCase();
  }

  return key;
};

const formatShortcut = (keys: string[]): string => {
  return keys
    .map(key => formatKey(key))
    .join(' + ');
};

export const KeyboardShortcutsDialog = ({ open, onClose, shortcuts }: KeyboardShortcutsDialogProps) => {
  const theme = useTheme();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
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
            <KeyboardIcon sx={{ color: 'primary.main' }} />
            <Typography variant="h6" fontWeight={600}>
              Keyboard Shortcuts
            </Typography>
          </Box>
          <Button
            onClick={onClose}
            sx={{ minWidth: 'auto', p: 1 }}
            aria-label="Close"
          >
            <CloseIcon />
          </Button>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {shortcuts.map((group, groupIndex) => (
            <Box key={groupIndex}>
              <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5, color: 'text.primary' }}>
                {group.title}
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {group.shortcuts.map((shortcut, index) => (
                  <Box
                    key={index}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      p: 1.5,
                      borderRadius: 1,
                      bgcolor: alpha(theme.palette.primary.main, 0.03),
                      '&:hover': {
                        bgcolor: alpha(theme.palette.primary.main, 0.06),
                      },
                    }}
                  >
                    <Typography variant="body2" color="text.secondary">
                      {shortcut.description}
                    </Typography>
                    <Box display="flex" gap={0.5} flexWrap="wrap" justifyContent="flex-end">
                      {shortcut.keys.map((key, keyIndex) => (
                        <Chip
                          key={keyIndex}
                          label={formatKey(key)}
                          size="small"
                          sx={{
                            height: 24,
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            bgcolor: 'background.paper',
                            border: `1px solid ${theme.palette.divider}`,
                            '& .MuiChip-label': {
                              px: 1,
                            },
                          }}
                        />
                      ))}
                    </Box>
                  </Box>
                ))}
              </Box>
              {groupIndex < shortcuts.length - 1 && <Divider sx={{ mt: 2 }} />}
            </Box>
          ))}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="contained" sx={{ borderRadius: 2 }}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};
