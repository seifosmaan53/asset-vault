import { createContext, useContext, useState, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import { Snackbar, Alert, Button, Box } from '@mui/material';

type ToastSeverity = 'success' | 'error' | 'warning' | 'info';

export interface ToastAction {
  label: string;
  onClick: () => void;
  color?: 'inherit' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';
}

export interface ToastOptions {
  severity?: ToastSeverity;
  action?: ToastAction;
  undo?: () => void;
  autoHideDuration?: number;
  persist?: boolean;
}

interface Toast {
  id: string;
  message: string;
  severity: ToastSeverity;
  action?: ToastAction;
  undo?: () => void;
  autoHideDuration?: number;
  persist?: boolean;
}

interface ToastContextType {
  showToast: (message: string, severity?: ToastSeverity) => void;
  showToastWithAction: (message: string, options?: ToastOptions) => string;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
};

interface ToastProviderProps {
  children: ReactNode;
  maxToasts?: number;
}

export const ToastProvider = ({ children, maxToasts = 5 }: ToastProviderProps) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timeoutRefs = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
    const timeout = timeoutRefs.current.get(id);
    if (timeout) {
      clearTimeout(timeout);
      timeoutRefs.current.delete(id);
    }
  }, []);

  const showToast = useCallback((msg: string, sev: ToastSeverity = 'info') => {
    showToastWithAction(msg, { severity: sev });
  }, []);

  const showToastWithAction = useCallback((msg: string, options: ToastOptions = {}) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    const {
      severity = 'info',
      action,
      undo,
      autoHideDuration = 6000,
      persist = false,
    } = options;

    const newToast: Toast = {
      id,
      message: msg,
      severity,
      action,
      undo,
      autoHideDuration: persist ? undefined : autoHideDuration,
      persist,
    };

    setToasts((prev) => {
      const updated = [...prev, newToast];
      // Limit number of toasts
      return updated.slice(-maxToasts);
    });

    // Auto-dismiss if not persistent
    if (!persist && autoHideDuration > 0) {
      const timeout = setTimeout(() => {
        dismissToast(id);
      }, autoHideDuration);
      timeoutRefs.current.set(id, timeout);
    }

    return id;
  }, [maxToasts, dismissToast]);

  const handleClose = useCallback((id: string) => {
    dismissToast(id);
  }, [dismissToast]);

  const handleUndo = useCallback((toast: Toast) => {
    if (toast.undo) {
      toast.undo();
    }
    dismissToast(toast.id);
  }, [dismissToast]);

  return (
    <ToastContext.Provider value={{ showToast, showToastWithAction, dismissToast }}>
      {children}
      <Box
        sx={{
          position: 'fixed',
          top: 16,
          right: 16,
          zIndex: 1400,
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
          maxWidth: '400px',
        }}
      >
        {toasts.map((toast, index) => (
          <Snackbar
            key={toast.id}
            open={true}
            anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
            sx={{ position: 'relative', transform: 'none', top: 0, right: 0 }}
          >
            <Alert
              onClose={() => handleClose(toast.id)}
              severity={toast.severity}
              sx={{ width: '100%' }}
              action={
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  {toast.undo && (
                    <Button
                      color="inherit"
                      size="small"
                      onClick={() => handleUndo(toast)}
                      sx={{ textTransform: 'none', minWidth: 'auto' }}
                    >
                      Undo
                    </Button>
                  )}
                  {toast.action && (
                    <Button
                      color={toast.action.color || 'inherit'}
                      size="small"
                      onClick={toast.action.onClick}
                      sx={{ textTransform: 'none', minWidth: 'auto' }}
                    >
                      {toast.action.label}
                    </Button>
                  )}
                </Box>
              }
            >
              {toast.message}
            </Alert>
          </Snackbar>
        ))}
      </Box>
    </ToastContext.Provider>
  );
};

