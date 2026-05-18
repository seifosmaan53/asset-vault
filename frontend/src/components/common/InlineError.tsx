// Copyright (c) 2025 Asset Vault. All rights reserved.

import { Typography, Box } from '@mui/material';
import ErrorIcon from '@mui/icons-material/Error';

interface InlineErrorProps {
  message: string;
  showIcon?: boolean;
}

export const InlineError = ({ message, showIcon = true }: InlineErrorProps) => {
  if (!message) return null;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        mt: 0.5,
        color: 'error.main',
      }}
    >
      {showIcon && <ErrorIcon sx={{ fontSize: 16 }} />}
      <Typography variant="caption" color="error">
        {message}
      </Typography>
    </Box>
  );
};
